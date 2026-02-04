import puppeteer, { Browser, Page } from 'puppeteer';

export interface ScrapedLead {
  businessName: string;
  fullName: string;
  phone?: string;
  website?: string;
  address?: string;
  city?: string;
  rating?: number;
  reviewCount?: number;
  category?: string;
  priceLevel?: string;
  description?: string;
  openingHours?: string[];
  attributes?: string[];
  lat?: number;
  lng?: number;
  country?: string;
}

export interface ScraperConfig {
  query: string;
  location?: string;
  limit?: number;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Google Maps Scraper - Clicks each listing to get phone numbers
 */
export class GoogleMapsScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async init(): Promise<void> {
    console.log('🚀 Starting browser...');
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--window-size=1920,1080',
      ],
    });

    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 1920, height: 1080 });
    await this.page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  async scrape(config: ScraperConfig): Promise<ScrapedLead[]> {
    const { query, location, limit = 30 } = config;
    const leads: ScrapedLead[] = [];
    const seenNames = new Set<string>();

    try {
      if (!this.page) {
        await this.init();
      }

      // Construct a more explicit search query to prevent autocorrection
      const searchQuery = location ? `${query} in ${location}` : query;
      const url = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`;

      console.log(`🔍 Searching for: "${query}" in "${location || 'default location'}"`);
      console.log(`🔍 Navigating to: ${url}`);
      await this.page!.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
      await delay(3000);

      // Verify we're in the correct location by checking the URL
      const currentUrl = this.page!.url();
      console.log(`📍 Current URL after navigation: ${currentUrl}`);

      // Extract location from URL to verify
      const urlLocationMatch = currentUrl.match(/\/search\/([^/@]+)/);
      if (urlLocationMatch) {
        const urlSearchTerm = decodeURIComponent(urlLocationMatch[1]);
        console.log(`📍 URL search term: "${urlSearchTerm}"`);

        // Check if the location in URL matches what we requested
        if (location && !urlSearchTerm.toLowerCase().includes(location.toLowerCase())) {
          console.warn(`⚠️ WARNING: Requested location "${location}" but URL shows "${urlSearchTerm}"`);
          console.warn(`⚠️ Google Maps may have redirected to a different location!`);
          console.warn(`⚠️ This might happen due to typos or geolocation-based suggestions.`);
        }
      }

      // Wait for results
      await this.page!.waitForSelector('div[role="feed"]', { timeout: 10000 }).catch(() => {
        console.log('⚠️ Feed not found, trying anyway...');
      });

      let processedCount = 0;
      let scrollCount = 0;
      const maxScrolls = 10;

      while (leads.length < limit && scrollCount < maxScrolls) {
        // Get all listing links
        const listingLinks = await this.page!.$$('div[role="feed"] a[href*="/maps/place/"]');
        console.log(`📋 Found ${listingLinks.length} listings, processed ${processedCount}`);

        // Process listings we haven't processed yet
        for (let i = processedCount; i < listingLinks.length && leads.length < limit; i++) {
          try {
            // Re-fetch the links since DOM might have changed
            const currentLinks = await this.page!.$$('div[role="feed"] a[href*="/maps/place/"]');
            if (i >= currentLinks.length) break;

            const link = currentLinks[i];

            // Get name from aria-label before clicking
            const ariaLabel = await link.evaluate((el: Element) => el.getAttribute('aria-label') || '');
            console.log(`\n👆 Clicking: ${ariaLabel.substring(0, 40)}...`);

            // Click to open details
            await link.click();
            await delay(2500);

            // Extract details from the panel
            const details = await this.page!.evaluate(() => {
              // Business name
              let name = '';
              const h1 = document.querySelector('h1.DUwDvf, h1.fontHeadlineLarge');
              if (h1) name = h1.textContent?.trim() || '';

              // Phone
              let phone = '';
              const phoneBtn = document.querySelector('button[data-item-id^="phone:"], a[data-item-id^="phone:"]');
              if (phoneBtn) {
                const itemId = phoneBtn.getAttribute('data-item-id') || '';
                phone = itemId.replace('phone:tel:', '').replace('phone:', '');
              }
              if (!phone) {
                const phoneElements = document.querySelectorAll('[aria-label*="Phone"], [aria-label*="phone"]');
                phoneElements.forEach(el => {
                  const label = el.getAttribute('aria-label') || '';
                  const match = label.match(/[\d\s\-\+]{8,}/);
                  if (match && !phone) phone = match[0].replace(/\s/g, '');
                });
              }

              // Website
              let website = '';
              const websiteLink = document.querySelector('a[data-item-id="authority"]') as HTMLAnchorElement;
              if (websiteLink) website = websiteLink.href;

              // Address
              let address = '';
              const addressBtn = document.querySelector('button[data-item-id="address"]');
              if (addressBtn) {
                const textDiv = addressBtn.querySelector('.fontBodyMedium');
                if (textDiv) address = textDiv.textContent?.trim() || '';
              }

              // Rating & Reviews
              let rating = 0;
              let reviewCount = 0;
              const ratingDiv = document.querySelector('div.F7nice');
              if (ratingDiv) {
                const spans = ratingDiv.querySelectorAll('span');
                spans.forEach(span => {
                  const text = span.textContent || '';
                  const num = parseFloat(text);
                  if (!isNaN(num) && num > 0 && num <= 5 && !rating) rating = num;
                  const reviewMatch = text.match(/\(([\d,]+)\)/);
                  if (reviewMatch) reviewCount = parseInt(reviewMatch[1].replace(/,/g, ''), 10);
                });
              }

              // Category
              let category = '';
              const categoryBtn = document.querySelector('button[jsaction*="category"]');
              if (categoryBtn) category = categoryBtn.textContent?.trim() || '';

              // Price Level
              let priceLevel = '';
              const priceEl = document.querySelector('span[aria-label*="Price:"]');
              if (priceEl) priceLevel = priceEl.getAttribute('aria-label') || '';
              else {
                const priceSpans = Array.from(document.querySelectorAll('span')).filter(s => s.textContent?.includes('₹') || s.textContent?.includes('$'));
                if (priceSpans.length > 0) priceLevel = priceSpans[0].textContent?.trim() || '';
              }

              // Description
              let description = '';
              const descEl = document.querySelector('div.PYvS2b');
              if (descEl) description = descEl.textContent?.trim() || '';

              // Attributes (Quick chips)
              let attributes: string[] = [];
              const attrEls = document.querySelectorAll('div.LT7H9b span button');
              attrEls.forEach(el => {
                if (el.textContent) attributes.push(el.textContent.trim());
              });

              // Opening Hours Status
              let openingHours: string[] = [];
              const hoursEl = document.querySelector('div.t3970d');
              if (hoursEl) {
                const statusText = hoursEl.getAttribute('aria-label') || hoursEl.textContent || '';
                openingHours.push(statusText.trim());
              }

              return { name, phone, website, address, rating, reviewCount, category, priceLevel, description, attributes, openingHours };
            });

            const urlAfterClick = this.page!.url();
            const coordMatch = urlAfterClick.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
            const lat = coordMatch ? parseFloat(coordMatch[1]) : undefined;
            const lng = coordMatch ? parseFloat(coordMatch[2]) : undefined;

            processedCount = i + 1;

            // Validate and add
            if (details.name && details.name.length > 2 && !seenNames.has(details.name.toLowerCase())) {
              seenNames.add(details.name.toLowerCase());

              // Extract city from address if available
              let extractedCity = location;
              if (details.address) {
                // Address format is usually: "Street, Area, City, State, Country"
                const addressParts = details.address.split(',').map(p => p.trim());
                // City is typically the 2nd or 3rd part from the end
                if (addressParts.length >= 2) {
                  extractedCity = addressParts[addressParts.length - 3] || addressParts[addressParts.length - 2] || location;
                }
              }

              leads.push({
                businessName: details.name,
                fullName: details.name,
                phone: details.phone || undefined,
                website: details.website || undefined,
                address: details.address || undefined,
                city: extractedCity || undefined,
                category: details.category || undefined,
                rating: details.rating || undefined,
                reviewCount: details.reviewCount || undefined,
                priceLevel: details.priceLevel || undefined,
                description: details.description || undefined,
                openingHours: details.openingHours.length > 0 ? details.openingHours : undefined,
                attributes: details.attributes.length > 0 ? details.attributes : undefined,
                lat,
                lng,
              });

              console.log(`✅ ${leads.length}/${limit}: ${details.name}`);
              console.log(`   📍 City: ${extractedCity || 'Unknown'}`);
              console.log(`   📞 Phone: ${details.phone || 'Not found'}`);
              console.log(`   ⭐ Rating: ${details.rating || 'N/A'} (${details.reviewCount} reviews)`);
              console.log(`   🌐 Website: ${details.website ? 'Yes' : 'No'}`);
            }

            // Go back to list - click outside or scroll
            await this.page!.keyboard.press('Escape');
            await delay(800);

          } catch (err: any) {
            console.log(`⚠️ Error on listing ${i}: ${err.message?.substring(0, 50)}`);
            processedCount = i + 1;
            await this.page!.keyboard.press('Escape');
            await delay(500);
          }
        }

        // Scroll to load more
        if (leads.length < limit) {
          await this.page!.evaluate(() => {
            const feed = document.querySelector('div[role="feed"]');
            if (feed) feed.scrollTop = feed.scrollHeight;
          });
          await delay(2000);
          scrollCount++;
        }
      }

      console.log(`\n✅ Scraping complete: ${leads.length} leads with phone numbers`);
      return leads;

    } catch (error: any) {
      console.error('❌ Scraping error:', error.message);
      throw error;
    }
  }
}

let scraperInstance: GoogleMapsScraper | null = null;

export async function scrapeGoogleMaps(config: ScraperConfig): Promise<ScrapedLead[]> {
  if (!scraperInstance) {
    scraperInstance = new GoogleMapsScraper();
    await scraperInstance.init();
  }

  try {
    return await scraperInstance.scrape(config);
  } finally {
    await scraperInstance.close();
    scraperInstance = null;
  }
}
