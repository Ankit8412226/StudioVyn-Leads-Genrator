/**
 * Website Analyzer Service — Page analysis using Puppeteer (Phase 3)
 */
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { logger } from '../utils/logger';

// Apply stealth plugin if not already applied
try {
  puppeteer.use(StealthPlugin());
} catch {
  // Ignore if already registered
}

export interface WebsiteAnalysisRaw {
  url: string;
  loadTimeMs: number;
  sslValid: boolean;
  hasMobileMeta: boolean;
  hasCta: boolean;
  hasSchema: boolean;
  h1Count: number;
  title: string;
  metaDescription: string;
  ogTagsCount: number;
  screenshotPath?: string;
  error?: string;
}

/**
 * Normalizes URL by adding protocol if missing
 */
function normalizeUrl(url: string): string {
  let cleaned = url.trim();
  if (!/^https?:\/\//i.test(cleaned)) {
    cleaned = `http://${cleaned}`;
  }
  return cleaned;
}

/**
 * Runs page analysis using Puppeteer
 */
export async function analyzeWebsite(url: string): Promise<WebsiteAnalysisRaw> {
  const normalizedUrl = normalizeUrl(url);
  const startTime = Date.now();
  
  let browser: any = null;
  const result: WebsiteAnalysisRaw = {
    url: normalizedUrl,
    loadTimeMs: 0,
    sslValid: normalizedUrl.startsWith('https://'),
    hasMobileMeta: false,
    hasCta: false,
    hasSchema: false,
    h1Count: 0,
    title: '',
    metaDescription: '',
    ogTagsCount: 0,
  };

  try {
    logger.info(`🌐 Starting website analysis for: ${normalizedUrl}`);
    
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    );

    // Navigate with 20 seconds timeout
    await page.goto(normalizedUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    
    result.loadTimeMs = Date.now() - startTime;
    
    // Check if redirect upgraded to SSL
    const finalUrl = page.url();
    result.sslValid = finalUrl.startsWith('https://');

    // Run script on page context to extract details
    const extractedData = await page.evaluate(() => {
      // 1. Mobile meta check
      const viewport = document.querySelector('meta[name="viewport"]');
      const hasMobileMeta = !!viewport && viewport.getAttribute('content')?.includes('width=device-width');

      // 2. CTA check
      const ctaTerms = ['contact', 'call', 'email', 'get in touch', 'book', 'schedule', 'register', 'sign up', 'apply', 'buy', 'order', 'demo', 'trial', 'quote', 'started'];
      let hasCta = false;
      
      const interactiveElements = document.querySelectorAll('a, button, input[type="submit"], input[type="button"]');
      for (const el of Array.from(interactiveElements)) {
        const text = (el.textContent || '').toLowerCase().trim();
        const value = el.getAttribute('value')?.toLowerCase().trim() || '';
        const id = el.id.toLowerCase();
        const className = el.className.toString().toLowerCase();

        const matchText = text || value || id || className;
        if (ctaTerms.some(term => matchText.includes(term))) {
          hasCta = true;
          break;
        }
      }

      // 3. Schema check
      const jsonLd = document.querySelectorAll('script[type="application/ld+json"]');
      const microdata = document.querySelectorAll('[itemscope]');
      const hasSchema = jsonLd.length > 0 || microdata.length > 0;

      // 4. Heading check
      const h1s = document.querySelectorAll('h1');
      const h1Count = h1s.length;

      // 5. Title
      const title = document.title || '';

      // 6. Meta description
      const metaDescEl = document.querySelector('meta[name="description"]');
      const metaDescription = metaDescEl?.getAttribute('content') || '';

      // 7. OG tags count
      const ogTags = document.querySelectorAll('meta[property^="og:"]');
      const ogTagsCount = ogTags.length;

      return {
        hasMobileMeta,
        hasCta,
        hasSchema,
        h1Count,
        title,
        metaDescription,
        ogTagsCount,
      };
    });

    Object.assign(result, extractedData);
    logger.info(`✅ Successfully analyzed website: ${normalizedUrl} in ${result.loadTimeMs}ms`);
  } catch (err: any) {
    logger.error(`❌ Error analyzing website ${normalizedUrl}: ${err.message}`);
    result.error = err.message;
    // Keep baseline default values
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeErr: any) {
        logger.error(`Error closing browser: ${closeErr.message}`);
      }
    }
  }

  return result;
}
