import fs from 'fs';
import path from 'path';
import { ILead } from '../models/Lead';
import { delay } from '../utils/delay';
import { logger } from '../utils/logger';

const FIREWORKS_API_KEY = process.env.FIREWORKS_API_KEY ?? '';
const FIREWORKS_IMAGE_MODEL = process.env.FIREWORKS_IMAGE_MODEL ?? 'accounts/fireworks/models/flux-1-schnell-fp8';
const FIREWORKS_IMAGE_ENDPOINT = process.env.FIREWORKS_IMAGE_ENDPOINT
  ?? `https://api.fireworks.ai/inference/v1/workflows/${FIREWORKS_IMAGE_MODEL}/text_to_image`;

const GENERATED_ASSETS_DIR = process.env.GENERATED_ASSETS_DIR
  ?? path.join(process.cwd(), 'generated-assets');
const RETRY_DELAYS_MS = [2000, 5000, 10000];

const isRetryableStatus = (status: number) =>
  status === 408 || status === 429 || status >= 500;

const ensureDir = (dirPath: string) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const sanitizeFilename = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 80) || 'business';

const getCategoryVisuals = (category: string): string => {
  const cat = category.toLowerCase();
  
  if (cat.includes('ca') || cat.includes('chartered') || cat.includes('accountant') || cat.includes('tax') || cat.includes('gst') || cat.includes('audit')) {
    return 'a high-end UI/UX mockup of a tax and financial services website, clean white layout with navy blue and gold accents, professional tables, glassmorphic booking card, Behance-style showcase';
  }
  
  if (cat.includes('dental') || cat.includes('clinic') || cat.includes('doctor') || cat.includes('medical') || cat.includes('health')) {
    return 'a stunning landing page design for a luxury dental clinic, soft mint and blue color palette, intuitive doctor booking interface, clean iconography, high-key lighting UI, Dribbble-style showcase';
  }
  
  if (cat.includes('restaurant') || cat.includes('cafe') || cat.includes('food') || cat.includes('bakery')) {
    return 'a vibrant appetizing restaurant website design, full-width high-res food hero, elegant typography, warm earthy tones, modern online menu layout, food-delivery UI mockup';
  }
  
  if (cat.includes('salon') || cat.includes('beauty') || cat.includes('spa') || cat.includes('hair')) {
    return 'a sophisticated luxury salon website UI, rose gold and minimalist white palette, service list with price cards, elegant serif typography, fashion-editorial design style';
  }
  
  if (cat.includes('gym') || cat.includes('fitness') || cat.includes('yoga') || cat.includes('wellness')) {
    return 'a high-energy fitness club landing page UI, dark mode design with neon lime and purple accents, bold motivational headers, grid layout for class schedules, startup-tech aesthetic';
  }
  
  if (cat.includes('real estate') || cat.includes('property') || cat.includes('builder') || cat.includes('architect')) {
    return 'a premium architectural portfolio and real estate website design, wide-angle property banners, clean minimalist grid, luxury serif fonts, expert UI/UX showcase';
  }
  
  if (cat.includes('legal') || cat.includes('advocate') || cat.includes('lawyer') || cat.includes('attorney')) {
    return 'an authoritative and modern law firm website layout, clean professional grid, trustworthy deep blue and grey accents, service expertise cards, prestigious serif typography';
  }
  
  if (cat.includes('school') || cat.includes('academy') || cat.includes('education') || cat.includes('tutor') || cat.includes('coaching')) {
    return 'an inspiring and bright educational platform UI design, playful colors, student learning dashboard, vibrant icons, clean and modern school website layout';
  }
  
  if (cat.includes('tech') || cat.includes('software') || cat.includes('it') || cat.includes('digital')) {
    return 'a futuristic SaaS landing page UI mockup, dark background with complex neon gradients, feature cards with 3D icons, clean and sharp developer-focused design';
  }
  
  return 'a professional high-end business landing page UI, modern clean grid, sharp headers, balanced white space, high-quality showcase mockup';
};

const buildPrompt = (lead: ILead) => {
  const category = lead.category || 'local business';
  const city = lead.city || '';
  const categoryVisuals = getCategoryVisuals(category);

  return `A high-end, professional UI/UX design showcase of ${categoryVisuals} for a ${category} in ${city}. ` +
    `The design is presented as a clean, long-scroll landing page screenshot in a high-resolution 3D perspective mockup. ` +
    `Modern web design features: clean typography, vibrant color scheme, professional layout, balanced white space. ` +
    `Dribbble and Behance top-featured style. ` +
    `Shot on a soft minimalist background with 3D depth and shadows. ` +
    `8K resolution, ultra-clean design, magazine quality, NO messy artifacts.`;
};

export const generateHeroImage = async (lead: ILead): Promise<string | null> => {
  logger.warn('Image generation AI disabled. Skipping.');
  return null;
};
