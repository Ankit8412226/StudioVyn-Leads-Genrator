import { Page } from 'puppeteer';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Use stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

export interface YelpLead {
  businessName: string;
  fullName: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  city?: string;
  rating?: number;
  reviewCount?: number;
  category?: string;
  priceLevel?: string;
  source: 'yelp';
}

export interface YelpConfig {
  query: string;
  location: string;
  limit?: number;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class YelpScraper {
  private browser: any = null;
  private page: Page | null = null;

  async init(): Promise<void> {
    console.log('🚀 Starting Yelp browser with Stealth mode...');
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1920,1080',
      ],
    });

    this.page = await this.browser.newPage();
    await this.page!.setViewport({ width: 1920, height: 1080 });

    // Set a very realistic user agent
    await this.page!.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    );

    // Extra headers to look more human
    await this.page!.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
    });
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  private async checkCaptcha(): Promise<boolean> {
    if (!this.page) return false;

    const captchaExists = await this.page.evaluate(() => {
      const texts = ['robot', 'captcha', 'security check', 'verification', 'access to this page has been denied'];
      const bodyText = document.body.innerText.toLowerCase();
      const hasText = texts.some(t => bodyText.includes(t));
      const hasIframe = !!document.querySelector('iframe[title="DataDome CAPTCHA"]');
      const hasSlider = !!document.querySelector('#px-captcha, #captcha-container, .slider');
      return hasText || hasIframe || hasSlider;
    });

    if (captchaExists) {
      console.log('⚠️ Yelp Block detected! (CAPTCHA / Slider / DataDome)');
      return true;
    }
    return false;
  }

  private async solveSlider(): Promise<boolean> {
    if (!this.page) return false;

    try {
      // Find the DataDome iframe
      const frameElement = await this.page.$('iframe[title="DataDome CAPTCHA"]');
      if (!frameElement) {
        console.log('❌ Slider iframe not found.');
        return false;
      }

      const frame = await frameElement.contentFrame();
      if (!frame) {
        console.log('❌ Could not access iframe content.');
        return false;
      }

      console.log('🤖 Attempting to solve slider CAPTCHA...');

      // Find the slider handle
      const sliderHandle = await frame.$('.slider');
      const sliderContainer = await frame.$('.sliderContainer');

      if (!sliderHandle || !sliderContainer) {
        console.log('❌ Slider elements not found inside iframe.');
        return false;
      }

      const handleBox = await sliderHandle.boundingBox();
      const containerBox = await sliderContainer.boundingBox();

      if (!handleBox || !containerBox) {
        console.log('❌ Could not get element coordinates.');
        return false;
      }

      // Human-like drag: Start at center of handle
      const startX = handleBox.x + handleBox.width / 2;
      const startY = handleBox.y + handleBox.height / 2;

      // Target is near the end of the container
      const targetX = containerBox.x + containerBox.width - (handleBox.width / 2) - 5;

      // Move mouse to start position
      await this.page.mouse.move(startX, startY);
      await delay(500 + Math.random() * 500);
      await this.page.mouse.down();
      await delay(200 + Math.random() * 200);

      // Move in random steps with jitter
      const steps = 20 + Math.floor(Math.random() * 15);
      const stepX = (targetX - startX) / steps;

      for (let i = 1; i <= steps; i++) {
        const currentX = startX + (stepX * i);
        // Add random Y jitter to look more human (+/- 3px)
        const jitterY = startY + (Math.random() * 6 - 3);

        // Speed up in the middle, slow at start/end (Ease in/out)
        await this.page.mouse.move(currentX, jitterY);

        // Randomized delay between steps
        const stepDelay = (i < 5 || i > steps - 5) ? 60 + Math.random() * 60 : 15 + Math.random() * 20;
        await delay(stepDelay);
      }

      await delay(300 + Math.random() * 500);
      await this.page.mouse.up();

      console.log('✅ Slider drag action finished. Waiting to see if it clears...');
      await delay(5000); // Give it time to process and reload

      return true;
    } catch (error: any) {
      console.error('❌ Error solving slider:', error.message);
      return false;
    }
  }

  async scrape(config: YelpConfig): Promise<YelpLead[]> {
    let { query, location, limit = 30 } = config;
    const leads: YelpLead[] = [];
    const seenNames = new Set<string>();

    // Fallback for too broad locations
    if (location.toLowerCase() === 'us' || location.toLowerCase() === 'usa') {
      location = 'San Francisco, CA';
    }

    try {
      if (!this.page) {
        await this.init();
      }

      // Random User Agent rotation for this session
      const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
      ];
      await this.page!.setUserAgent(userAgents[Math.floor(Math.random() * userAgents.length)]);

      // Step 1: Visit homepage and do some "human" scrolling
      console.log('🏠 Warming up on Yelp homepage...');
      await this.page!.goto('https://www.yelp.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await delay(2000 + Math.random() * 2000);
      await this.page!.evaluate(() => window.scrollBy(0, 300 + Math.random() * 300));
      await delay(1000);

      // Step 2: Use search URL but with extra random params to look less like a scraper
      const searchQuery = encodeURIComponent(query);
      const searchLocation = encodeURIComponent(location);
      // Adding common Yelp URL params to look natural
      const url = `https://www.yelp.com/search?find_desc=${searchQuery}&find_loc=${searchLocation}&ns=1`;

      console.log(`🔍 Yelp: Searching "${query}" in "${location}"`);
      await this.page!.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await delay(4000 + Math.random() * 4000);

      // Check for Bot Detection
      if (await this.checkCaptcha()) {
        const solved = await this.solveSlider();
        if (solved) {
          // Check again after solving attempt
          if (await this.checkCaptcha()) {
            console.log('❌ Slider solution failed or another block appeared.');
            return [];
          }
          console.log('🎉 Slider CAPTCHA solved successfully!');
        } else {
          return [];
        }
      }

      let pageNum = 0;
      const maxPages = 3;

      while (leads.length < limit && pageNum < maxPages) {
        console.log(`📄 Scanning results page ${pageNum + 1}...`);

        // Final check for results or empty state
        const hasResults = await this.page!.evaluate(() => {
          return !!document.querySelector('[data-testid="serp-ia-card"], [class*="container"], h3 a, [class*="businessName"]');
        });

        if (!hasResults) {
          console.log('⚠️ No obvious listings found. Trying one more scroll...');
          await this.page!.evaluate(() => window.scrollBy(0, 600));
          await delay(2000);
        }

        const listings = await this.page!.evaluate(() => {
          const results: any[] = [];

          // These are the most stable indicators of a business card in 2024/2025
          const cardSelectors = [
            'div[data-testid="serp-ia-card"]',
            'li[class*="css-"]',
            'div[class*="container__"]',
            '[class*="searchResult"]'
          ];

          let cards: Element[] = [];
          for (const sel of cardSelectors) {
            const found = Array.from(document.querySelectorAll(sel));
            // Filter out cards that don't have an H3 (likely ads or layout divs)
            const validCards = found.filter(c => c.querySelector('h3'));
            if (validCards.length > 3) {
              cards = validCards;
              break;
            }
          }

          // Backtrack: if still no cards, just find all H3s and get their containers
          if (cards.length === 0) {
            cards = Array.from(document.querySelectorAll('h3'))
              .map(h3 => h3.closest('li, div[class*="container"]'))
              .filter((el): el is Element => el !== null);
          }

          cards.forEach((card) => {
            try {
              // Name & Link
              const nameEl = card.querySelector('h3 a, a[class*="businessName"], a[class*="css-19v1rkv"]');
              const name = nameEl?.textContent?.trim() || '';
              const detailUrl = (nameEl as HTMLAnchorElement)?.href || '';

              // Rating
              let rating = 0;
              const ratingEl = card.querySelector('[aria-label*="star rating"], [class*="rating"]');
              if (ratingEl) {
                const aria = ratingEl.getAttribute('aria-label') || '';
                const match = aria.match(/([\d.]+)/);
                if (match) rating = parseFloat(match[1]);
              }

              // Category
              const spans = Array.from(card.querySelectorAll('span, p, button'));
              const category = spans.find(s => {
                const txt = s.textContent || '';
                return txt.length > 2 && txt.length < 25 && !txt.includes('(') && !txt.includes('$');
              })?.textContent?.trim() || '';

              if (name && detailUrl && detailUrl.includes('/biz/')) {
                results.push({ name, rating, detailUrl, category });
              }
            } catch (e) { }
          });
          return results;
        });

        console.log(`📋 Found ${listings.length} listings on page ${pageNum + 1}`);

        for (const listing of listings) {
          if (leads.length >= limit) break;
          if (seenNames.has(listing.name.toLowerCase())) continue;

          try {
            console.log(`🔗 Scanning: ${listing.name}...`);
            await this.page!.goto(listing.detailUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await delay(2500 + Math.random() * 2500);

            const details = await this.page!.evaluate(() => {
              let phone = '';
              let website = '';
              let address = '';

              // Better phone detection logic
              const allElements = Array.from(document.querySelectorAll('a, p, span, div'));
              const phoneMatch = allElements.find(el => {
                const txt = el.textContent || '';
                return /^\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/.test(txt.trim()) ||
                  /^\+\d{1,3}\s?\(?\d{2,3}\)?[\s.-]?\d{3,4}[\s.-]?\d{4}$/.test(txt.trim());
              });
              phone = phoneMatch?.textContent?.trim() || '';

              if (!phone) {
                const telLink = document.querySelector('a[href^="tel:"]');
                phone = telLink?.getAttribute('href')?.replace('tel:', '') || '';
              }

              // Website detection (avoiding Yelp internal links)
              const websiteSelectors = [
                'a[href*="biz_redir"]',
                'a[class*="css-1idmmu3"]',
                'a[target="_blank"][rel*="nofollow"]',
                'a[role="link"]'
              ];

              for (const sel of websiteSelectors) {
                const link = document.querySelector(sel) as HTMLAnchorElement;
                if (link && link.href) {
                  const href = link.href;
                  if (href.includes('biz_redir')) {
                    const params = new URLSearchParams(href.split('?')[1]);
                    const decoded = params.get('url');
                    if (decoded) { website = decodeURIComponent(decoded); break; }
                  } else if (!href.includes('yelp.') && (href.startsWith('http') || href.startsWith('www'))) {
                    website = href;
                    break;
                  }
                }
              }

              // Address
              const addressEl = document.querySelector('address, [class*="address"]');
              address = addressEl?.textContent?.replace('Get Directions', '').trim() || '';

              return { phone, website, address };
            });

            // If it has a website, we skip it (not a lead for us)
            if (details.website && !details.website.includes('yelp.com')) {
              console.log(`⏭️ Skipping ${listing.name}: Already has website.`);
            } else if (details.phone && details.phone.length >= 8) {
              seenNames.add(listing.name.toLowerCase());
              leads.push({
                businessName: listing.name,
                fullName: listing.name,
                phone: details.phone,
                address: details.address || '',
                city: location,
                rating: listing.rating,
                category: listing.category,
                source: 'yelp',
              });
              console.log(`✅ ${leads.length}/${limit}: ${listing.name} (Lead found!)`);
            } else {
              console.log(`⏭️ Skipping ${listing.name}: No phone found.`);
            }

            await delay(1500 + Math.random() * 2000);
          } catch (e: any) {
            console.log(`⚠️ Error details: ${e.message}`);
          }
        }

        if (leads.length < limit) {
          pageNum++;
          const nextUrl = `${url}&start=${pageNum * 10}`;
          try {
            await this.page!.goto(nextUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await delay(3000 + Math.random() * 3000);
          } catch (e) { break; }
        } else {
          break;
        }
      }

      console.log(`\n🏁 Yelp complete: ${leads.length} leads gathered.`);
      return leads;

    } catch (error: any) {
      console.error('❌ Scraper error:', error.message);
      return leads;
    }
  }
}

let yelpInstance: YelpScraper | null = null;

export async function scrapeYelp(config: YelpConfig): Promise<YelpLead[]> {
  if (!yelpInstance) {
    yelpInstance = new YelpScraper();
  }

  try {
    return await yelpInstance.scrape(config);
  } finally {
    await yelpInstance.close();
    yelpInstance = null;
  }
}
