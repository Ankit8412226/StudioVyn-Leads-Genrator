import puppeteer, { Browser, Page } from 'puppeteer';

export interface IndiaMartLead {
  businessName: string;
  fullName: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  city?: string;
  category?: string;
  products?: string[];
  source: 'indiamart';
}

export interface IndiaMartConfig {
  query: string;
  city?: string;
  limit?: number;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * IndiaMART Scraper - B2B leads with emails (no website preferred)
 */
export class IndiaMartScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async init(): Promise<void> {
    console.log('🚀 Starting IndiaMART browser...');
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

  async scrape(config: IndiaMartConfig): Promise<IndiaMartLead[]> {
    const { query, city, limit = 30 } = config;
    const leads: IndiaMartLead[] = [];
    const seenNames = new Set<string>();

    try {
      if (!this.page) {
        await this.init();
      }

      // IndiaMART search URL
      const searchQuery = encodeURIComponent(query);
      const cityParam = city ? `&mcatid=&city=${encodeURIComponent(city)}` : '';
      const url = `https://dir.indiamart.com/search.mp?ss=${searchQuery}${cityParam}`;

      console.log(`🔍 IndiaMART: Searching "${query}"${city ? ` in "${city}"` : ''}`);
      console.log(`🔍 Navigating to: ${url}`);

      await this.page!.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
      await delay(3000);

      // Wait for listings
      await this.page!.waitForSelector('.prd-list, .lst-li, .listing', { timeout: 10000 }).catch(() => {
        console.log('⚠️ IndiaMART listings not found, trying anyway...');
      });

      let scrollCount = 0;
      const maxScrolls = 5;

      while (leads.length < limit && scrollCount < maxScrolls) {
        // Extract business listings
        const listings = await this.page!.evaluate(() => {
          const results: any[] = [];

          // IndiaMART listing selectors
          const cards = document.querySelectorAll('.lst-li, .prd-list, .listing-card, [class*="card"]');

          cards.forEach((card) => {
            try {
              // Business name
              const nameEl = card.querySelector('.lcname, .companyname, .supplier-name, h2, .title');
              const name = nameEl?.textContent?.trim() || '';

              // Phone
              let phone = '';
              const phoneEl = card.querySelector('[class*="phone"], .tel, .contact-number, a[href^="tel:"]');
              if (phoneEl) {
                const href = phoneEl.getAttribute('href') || '';
                phone = href.replace('tel:', '') || phoneEl.textContent?.replace(/\D/g, '') || '';
              }

              // Email - IndiaMART often shows emails
              let email = '';
              const emailEl = card.querySelector('a[href^="mailto:"], [class*="email"]');
              if (emailEl) {
                const href = emailEl.getAttribute('href') || '';
                email = href.replace('mailto:', '') || emailEl.textContent?.trim() || '';
              }

              // Address/City
              let address = '';
              const addressEl = card.querySelector('.cityname, .lcity, .address, .location');
              if (addressEl) address = addressEl.textContent?.trim() || '';

              // Category/Products
              let category = '';
              const categoryEl = card.querySelector('.prdname, .product-name, .category');
              if (categoryEl) category = categoryEl.textContent?.trim() || '';

              // Website check
              let website = '';
              const websiteEl = card.querySelector('a[href*="website"], .website-link');
              if (websiteEl) website = (websiteEl as HTMLAnchorElement).href || '';

              // Also check if they have a detailed IndiaMART page (not a website)
              const hasDetailPage = card.querySelector('a[href*="indiamart.com"]');

              if (name && name.length > 2) {
                results.push({
                  name,
                  phone,
                  email,
                  address,
                  category,
                  website,
                  hasDetailPage: !!hasDetailPage
                });
              }
            } catch (e) {
              // Skip bad entries
            }
          });

          return results;
        });

        console.log(`📋 IndiaMART: Found ${listings.length} listings`);

        for (const listing of listings) {
          if (leads.length >= limit) break;
          if (seenNames.has(listing.name.toLowerCase())) continue;

          // Filter: Only include leads WITHOUT website
          if (listing.website && !listing.website.includes('indiamart.com')) {
            console.log(`⏭️ Skipping ${listing.name}: Has external website`);
            continue;
          }

          // Must have phone or email
          if (!listing.phone && !listing.email) {
            console.log(`⏭️ Skipping ${listing.name}: No contact info`);
            continue;
          }

          seenNames.add(listing.name.toLowerCase());

          leads.push({
            businessName: listing.name,
            fullName: listing.name,
            phone: listing.phone || undefined,
            email: listing.email || undefined,
            address: listing.address,
            city: city || listing.address,
            category: listing.category,
            source: 'indiamart',
          });

          console.log(`✅ IndiaMART ${leads.length}/${limit}: ${listing.name}`);
          if (listing.phone) console.log(`   📞 Phone: ${listing.phone}`);
          if (listing.email) console.log(`   📧 Email: ${listing.email}`);
          console.log(`   🎯 No website - Perfect B2B lead!`);
        }

        // Scroll to load more
        if (leads.length < limit) {
          await this.page!.evaluate(() => window.scrollBy(0, 1000));
          await delay(2000);
          scrollCount++;
        }
      }

      console.log(`\n✅ IndiaMART scraping complete: ${leads.length} leads (no website)`);
      return leads;

    } catch (error: any) {
      console.error('❌ IndiaMART scraping error:', error.message);
      return leads; // Return what we have
    }
  }
}

let indiaMartInstance: IndiaMartScraper | null = null;

export async function scrapeIndiaMART(config: IndiaMartConfig): Promise<IndiaMartLead[]> {
  if (!indiaMartInstance) {
    indiaMartInstance = new IndiaMartScraper();
    await indiaMartInstance.init();
  }

  try {
    return await indiaMartInstance.scrape(config);
  } finally {
    await indiaMartInstance.close();
    indiaMartInstance = null;
  }
}
