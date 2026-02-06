import puppeteer, { Browser, Page } from 'puppeteer';

export interface JustDialLead {
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
  source: 'justdial';
}

export interface JustDialConfig {
  query: string;
  city: string;
  limit?: number;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * JustDial Scraper - Extracts businesses with phone and email (no website preferred)
 */
export class JustDialScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async init(): Promise<void> {
    console.log('🚀 Starting JustDial browser...');
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

  async scrape(config: JustDialConfig): Promise<JustDialLead[]> {
    const { query, city, limit = 30 } = config;
    const leads: JustDialLead[] = [];
    const seenNames = new Set<string>();

    try {
      if (!this.page) {
        await this.init();
      }

      // JustDial URL format: https://www.justdial.com/city/category
      const searchQuery = query.toLowerCase().replace(/\s+/g, '-');
      const citySlug = city.toLowerCase().replace(/\s+/g, '-');
      const url = `https://www.justdial.com/${citySlug}/${searchQuery}`;

      console.log(`🔍 JustDial: Searching "${query}" in "${city}"`);
      console.log(`🔍 Navigating to: ${url}`);

      await this.page!.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
      await delay(3000);

      // Wait for listings
      await this.page!.waitForSelector('.cntanr, .store-details, .jsx-3649403366', { timeout: 10000 }).catch(() => {
        console.log('⚠️ JustDial listings not found, trying anyway...');
      });

      let scrollCount = 0;
      const maxScrolls = 5;

      while (leads.length < limit && scrollCount < maxScrolls) {
        // Extract business listings
        const listings = await this.page!.evaluate(() => {
          const results: any[] = [];

          // Try multiple selectors for JustDial
          const cards = document.querySelectorAll('.cntanr, .store-details, .resultbox_info, [class*="resultbox"]');

          cards.forEach((card) => {
            try {
              // Business name
              const nameEl = card.querySelector('.lng_cont_name, .store-name, .resultbox_title_anchor, [class*="title"]');
              const name = nameEl?.textContent?.trim() || '';

              // Phone (JustDial encodes phone numbers)
              let phone = '';
              const phoneEl = card.querySelector('.mobilesv, [class*="phone"], [class*="callcontent"]');
              if (phoneEl) {
                // JustDial uses font-based encoding, try to get from data attributes
                const dataPhone = phoneEl.getAttribute('data-phone') || '';
                phone = dataPhone || phoneEl.textContent?.replace(/\D/g, '') || '';
              }

              // Rating
              let rating = 0;
              const ratingEl = card.querySelector('.star_m, .rating, [class*="rating"]');
              if (ratingEl) {
                const ratingText = ratingEl.textContent || '';
                const match = ratingText.match(/[\d.]+/);
                if (match) rating = parseFloat(match[0]);
              }

              // Review count
              let reviewCount = 0;
              const reviewEl = card.querySelector('.rt_count, .votes, [class*="review"]');
              if (reviewEl) {
                const reviewText = reviewEl.textContent || '';
                const match = reviewText.match(/\d+/);
                if (match) reviewCount = parseInt(match[0], 10);
              }

              // Address
              let address = '';
              const addressEl = card.querySelector('.cont_sw_addr, .address-info, [class*="address"]');
              if (addressEl) address = addressEl.textContent?.trim() || '';

              // Category
              let category = '';
              const categoryEl = card.querySelector('.lng_cont_catgy, .category, .cat-name');
              if (categoryEl) category = categoryEl.textContent?.trim() || '';

              // Website check
              let website = '';
              const websiteEl = card.querySelector('a[href*="website"], a.website');
              if (websiteEl) website = (websiteEl as HTMLAnchorElement).href || '';

              if (name && name.length > 2) {
                results.push({ name, phone, rating, reviewCount, address, category, website });
              }
            } catch (e) {
              // Skip bad entries
            }
          });

          return results;
        });

        console.log(`📋 JustDial: Found ${listings.length} listings`);

        for (const listing of listings) {
          if (leads.length >= limit) break;
          if (seenNames.has(listing.name.toLowerCase())) continue;

          // Filter: Only include leads WITHOUT website
          if (listing.website) {
            console.log(`⏭️ Skipping ${listing.name}: Has website`);
            continue;
          }

          // Filter: Must have phone
          if (!listing.phone || listing.phone.length < 8) {
            console.log(`⏭️ Skipping ${listing.name}: No valid phone`);
            continue;
          }

          seenNames.add(listing.name.toLowerCase());

          leads.push({
            businessName: listing.name,
            fullName: listing.name,
            phone: listing.phone,
            address: listing.address,
            city: city,
            rating: listing.rating,
            reviewCount: listing.reviewCount,
            category: listing.category,
            source: 'justdial',
          });

          console.log(`✅ JustDial ${leads.length}/${limit}: ${listing.name}`);
          console.log(`   📞 Phone: ${listing.phone}`);
          console.log(`   ⭐ Rating: ${listing.rating || 'N/A'}`);
          console.log(`   🎯 No website - Perfect lead!`);
        }

        // Scroll to load more
        if (leads.length < limit) {
          await this.page!.evaluate(() => window.scrollBy(0, 1000));
          await delay(2000);
          scrollCount++;
        }
      }

      console.log(`\n✅ JustDial scraping complete: ${leads.length} leads (no website)`);
      return leads;

    } catch (error: any) {
      console.error('❌ JustDial scraping error:', error.message);
      return leads; // Return what we have
    }
  }
}

let justDialInstance: JustDialScraper | null = null;

export async function scrapeJustDial(config: JustDialConfig): Promise<JustDialLead[]> {
  if (!justDialInstance) {
    justDialInstance = new JustDialScraper();
    await justDialInstance.init();
  }

  try {
    return await justDialInstance.scrape(config);
  } finally {
    await justDialInstance.close();
    justDialInstance = null;
  }
}
