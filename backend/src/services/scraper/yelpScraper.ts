import puppeteer, { Browser, Page } from 'puppeteer';

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
  location: string; // e.g., "New York, NY", "London, UK", "Dubai"
  limit?: number;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Yelp Scraper - Extracts businesses from Yelp (US, UK, Canada, UAE)
 * Filters for businesses WITHOUT websites for selling web services
 */
export class YelpScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async init(): Promise<void> {
    console.log('🚀 Starting Yelp browser...');
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

  async scrape(config: YelpConfig): Promise<YelpLead[]> {
    const { query, location, limit = 30 } = config;
    const leads: YelpLead[] = [];
    const seenNames = new Set<string>();

    try {
      if (!this.page) {
        await this.init();
      }

      // Yelp search URL
      const searchQuery = encodeURIComponent(query);
      const searchLocation = encodeURIComponent(location);
      const url = `https://www.yelp.com/search?find_desc=${searchQuery}&find_loc=${searchLocation}`;

      console.log(`🔍 Yelp: Searching "${query}" in "${location}"`);
      console.log(`🔍 Navigating to: ${url}`);

      await this.page!.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
      await delay(3000);

      // Wait for listings
      await this.page!.waitForSelector('[data-testid="serp-ia-card"], .container__09f24__FeTO6, .businessName__09f24', { timeout: 15000 }).catch(() => {
        console.log('⚠️ Yelp listings not found, trying anyway...');
      });

      let page = 0;
      const maxPages = 3;

      while (leads.length < limit && page < maxPages) {
        // Extract business listings
        const listings = await this.page!.evaluate(() => {
          const results: any[] = [];

          // Yelp listing selectors
          const cards = document.querySelectorAll('[data-testid="serp-ia-card"], .container__09f24__FeTO6, [class*="searchResult"]');

          cards.forEach((card) => {
            try {
              // Business name
              const nameEl = card.querySelector('a[class*="businessName"], h3 a, .businessName__09f24 a, [class*="css-19v1rkv"]');
              const name = nameEl?.textContent?.trim() || '';

              // Rating
              let rating = 0;
              const ratingEl = card.querySelector('[aria-label*="star rating"], [class*="rating"], [class*="stars"]');
              if (ratingEl) {
                const ariaLabel = ratingEl.getAttribute('aria-label') || '';
                const match = ariaLabel.match(/([\d.]+)\s*star/i);
                if (match) rating = parseFloat(match[1]);
              }

              // Review count
              let reviewCount = 0;
              const reviewEl = card.querySelector('[class*="reviewCount"], .css-chan6m');
              if (reviewEl) {
                const text = reviewEl.textContent || '';
                const match = text.match(/(\d+)/);
                if (match) reviewCount = parseInt(match[0], 10);
              }

              // Category
              let category = '';
              const categoryEl = card.querySelector('[class*="category"], .css-11bijt4, .priceCategory__09f24');
              if (categoryEl) category = categoryEl.textContent?.replace(/\$+/g, '').trim() || '';

              // Price level
              let priceLevel = '';
              const priceMatch = card.innerHTML.match(/(\${1,4})/);
              if (priceMatch) priceLevel = priceMatch[1];

              // Address/Location
              let address = '';
              const addressEl = card.querySelector('[class*="secondaryAttributes"], .css-e81eai, .priceRange__09f24');
              if (addressEl) {
                const text = addressEl.textContent || '';
                // Extract address (usually after category and price)
                address = text.replace(/\$+/g, '').replace(category, '').trim();
              }

              // Get business URL for detail scraping
              let detailUrl = '';
              if (nameEl) {
                detailUrl = (nameEl as HTMLAnchorElement).href || '';
              }

              if (name && name.length > 2) {
                results.push({
                  name,
                  rating,
                  reviewCount,
                  category,
                  priceLevel,
                  address,
                  detailUrl
                });
              }
            } catch (e) {
              // Skip bad entries
            }
          });

          return results;
        });

        console.log(`📋 Yelp Page ${page + 1}: Found ${listings.length} listings`);

        // Process each listing
        for (const listing of listings) {
          if (leads.length >= limit) break;
          if (seenNames.has(listing.name.toLowerCase())) continue;

          // Click on listing to get phone and website info
          if (listing.detailUrl) {
            try {
              await this.page!.goto(listing.detailUrl, { waitUntil: 'networkidle2', timeout: 30000 });
              await delay(2000);

              // Extract phone and website from detail page
              const details = await this.page!.evaluate(() => {
                let phone = '';
                let website = '';

                // Phone - multiple selectors
                const phoneEl = document.querySelector('a[href^="tel:"], [class*="phone"], p[class*="css-1p9ibgf"]');
                if (phoneEl) {
                  const href = phoneEl.getAttribute('href') || '';
                  phone = href.replace('tel:', '') || phoneEl.textContent?.replace(/\D/g, '') || '';
                }

                // Website
                const websiteEl = document.querySelector('a[href*="biz_redir"], a[class*="css-1idmmu3"]');
                if (websiteEl) {
                  const href = websiteEl.getAttribute('href') || '';
                  if (href.includes('biz_redir') || (!href.includes('yelp.com') && href.startsWith('http'))) {
                    website = href;
                  }
                }

                // Also check for "Website" text links
                const allLinks = document.querySelectorAll('a');
                allLinks.forEach(link => {
                  if (link.textContent?.toLowerCase().includes('website') ||
                    link.textContent?.toLowerCase().includes('business site')) {
                    website = link.href || website;
                  }
                });

                return { phone, website };
              });

              // Skip if has website (we want leads without websites)
              if (details.website && !details.website.includes('yelp.com')) {
                console.log(`⏭️ Skipping ${listing.name}: Has website`);
                // Go back to search results
                await this.page!.goBack({ waitUntil: 'networkidle2' });
                await delay(1000);
                continue;
              }

              // Skip if no phone
              if (!details.phone || details.phone.length < 8) {
                console.log(`⏭️ Skipping ${listing.name}: No phone number`);
                await this.page!.goBack({ waitUntil: 'networkidle2' });
                await delay(1000);
                continue;
              }

              seenNames.add(listing.name.toLowerCase());

              leads.push({
                businessName: listing.name,
                fullName: listing.name,
                phone: details.phone,
                address: listing.address,
                city: location,
                rating: listing.rating,
                reviewCount: listing.reviewCount,
                category: listing.category,
                priceLevel: listing.priceLevel,
                source: 'yelp',
              });

              console.log(`✅ Yelp ${leads.length}/${limit}: ${listing.name}`);
              console.log(`   📞 Phone: ${details.phone}`);
              console.log(`   ⭐ Rating: ${listing.rating} (${listing.reviewCount} reviews)`);
              console.log(`   🎯 No website - Perfect foreign lead!`);

              // Go back to search results
              await this.page!.goBack({ waitUntil: 'networkidle2' });
              await delay(1000);

            } catch (detailError) {
              console.log(`⚠️ Could not get details for ${listing.name}`);
            }
          }
        }

        // Go to next page if needed
        if (leads.length < limit) {
          const nextPageUrl = `${url}&start=${(page + 1) * 10}`;
          await this.page!.goto(nextPageUrl, { waitUntil: 'networkidle2', timeout: 30000 });
          await delay(2000);
          page++;
        } else {
          break;
        }
      }

      console.log(`\n✅ Yelp scraping complete: ${leads.length} leads (no website)`);
      return leads;

    } catch (error: any) {
      console.error('❌ Yelp scraping error:', error.message);
      return leads; // Return what we have
    }
  }
}

let yelpInstance: YelpScraper | null = null;

export async function scrapeYelp(config: YelpConfig): Promise<YelpLead[]> {
  if (!yelpInstance) {
    yelpInstance = new YelpScraper();
    await yelpInstance.init();
  }

  try {
    return await yelpInstance.scrape(config);
  } finally {
    await yelpInstance.close();
    yelpInstance = null;
  }
}
