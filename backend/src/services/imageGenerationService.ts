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
    return 'a clean professional accountant desk with a high-end laptop showing a modern financial dashboard and tax website, leather notebook, calculator, glasses, trust and growth aesthetic';
  }
  
  if (cat.includes('dental') || cat.includes('clinic') || cat.includes('doctor') || cat.includes('medical') || cat.includes('health')) {
    return 'a pristine doctor office desk with a modern tablet showing a patient booking website, stethoscope next to the tablet, clean medical interior background, professional and caring';
  }
  
  if (cat.includes('restaurant') || cat.includes('cafe') || cat.includes('food') || cat.includes('bakery')) {
    return 'a rustic wooden restaurant table with a premium tablet showing a beautiful food menu and ordering website, a fresh coffee cup and a small plant, warm lighting, inviting and modern';
  }
  
  if (cat.includes('salon') || cat.includes('beauty') || cat.includes('spa') || cat.includes('hair')) {
    return 'a chic salon counter with a sleek laptop showing a beauty booking and services website, premium hair products in background, soft elegant lighting, stylish and professional';
  }
  
  if (cat.includes('gym') || cat.includes('fitness') || cat.includes('yoga') || cat.includes('wellness')) {
    return 'a modern gym reception desk with a tablet showing a fitness membership and class schedule website, gym water bottle and protein shaker next to it, high-energy gym background, clean and motivational';
  }
  
  if (cat.includes('real estate') || cat.includes('property') || cat.includes('builder') || cat.includes('architect')) {
    return 'a designer architectural desk with a large tablet showing a luxury property listing website, blueprints and architectural tools nearby, high-end office background, success and growth';
  }
  
  if (cat.includes('legal') || cat.includes('advocate') || cat.includes('lawyer') || cat.includes('attorney')) {
    return 'a prestigious law office desk with a premium laptop showing a professional legal services website, legal gavel and books in background, classic and authoritative';
  }
  
  if (cat.includes('school') || cat.includes('academy') || cat.includes('education') || cat.includes('tutor') || cat.includes('coaching')) {
    return 'a bright modern student desk with a tablet showing an educational platform and course website, books and stationery, inspiring and vibrant';
  }
  
  if (cat.includes('tech') || cat.includes('software') || cat.includes('it') || cat.includes('digital')) {
    return 'a high-tech developer desk with a premium monitor showing a modern software landing page, neon ambient lighting, mechanical keyboard, precision and innovation';
  }
  
  return 'a professional business desk with a high-end laptop showing a modern company landing page, coffee cup, notebook, success and growth aesthetic';
};

const buildPrompt = (lead: ILead) => {
  const category = lead.category || 'local business';
  const city = lead.city || '';
  const categoryVisuals = getCategoryVisuals(category);

  return `A classic, professional marketing photo of ${categoryVisuals}. ` +
    `The screen clearly shows a stunning, modern website layout designed for a ${category} in ${city}. ` +
    `Photorealistic, 8K, high-end commercial photography. ` +
    `Focus is sharp on the device screen showing the website. ` +
    `Atmosphere of business growth, improvement, and modernization. ` +
    `Cinematic lighting, warm and trustworthy colors. ` +
    `NO distorted text, NO messy artifacts. Ultra detailed, magazine quality.`;
};

export const generateHeroImage = async (lead: ILead): Promise<string | null> => {
  if (!FIREWORKS_API_KEY) {
    logger.warn('FIREWORKS_API_KEY not set. Skipping image generation.');
    return null;
  }

  const businessName = lead.businessName || lead.fullName || 'business';
  const fileName = `${sanitizeFilename(businessName)}.png`;
  const outputPath = path.join(GENERATED_ASSETS_DIR, fileName);

  if (fs.existsSync(outputPath)) {
    return outputPath;
  }

  ensureDir(GENERATED_ASSETS_DIR);

  try {
    const prompt = buildPrompt(lead);

    let arrayBuffer: ArrayBuffer | null = null;
    let lastError: string | null = null;

    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
      const res = await fetch(FIREWORKS_IMAGE_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${FIREWORKS_API_KEY}`,
          'Content-Type': 'application/json',
          Accept: 'image/png',
        },
        body: JSON.stringify({
          prompt,
          aspect_ratio: '16:9',
          guidance_scale: 3.5,
          num_inference_steps: 8,
        }),
      });

      if (res.ok) {
        arrayBuffer = await res.arrayBuffer();
        break;
      }

      const errorText = await res.text();
      lastError = `Fireworks image error: ${res.status} ${errorText}`;

      if (!isRetryableStatus(res.status) || attempt === RETRY_DELAYS_MS.length) {
        throw new Error(lastError);
      }

      await delay(RETRY_DELAYS_MS[attempt]);
    }

    if (!arrayBuffer) {
      throw new Error('Fireworks image error: empty response');
    }

    fs.writeFileSync(outputPath, Buffer.from(arrayBuffer));
    return outputPath;
  } catch (error: any) {
    logger.error(`Image generation failed: ${error.message}`);
    return null;
  }
};
