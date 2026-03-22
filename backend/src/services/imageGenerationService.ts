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
    return 'sophisticated financial office, marble desk, gold pen, legal documents, trust and authority aesthetic, deep navy and gold color palette';
  }
  if (cat.includes('dental') || cat.includes('clinic') || cat.includes('doctor') || cat.includes('medical') || cat.includes('health')) {
    return 'pristine modern clinic interior, white and mint green, advanced medical equipment, clean sterile environment, trust and care aesthetic';
  }
  if (cat.includes('restaurant') || cat.includes('cafe') || cat.includes('food') || cat.includes('bakery')) {
    return 'upscale restaurant ambience, warm moody lighting, gourmet food styling, bokeh background, rich earthy tones, appetizing and luxurious';
  }
  if (cat.includes('salon') || cat.includes('beauty') || cat.includes('spa') || cat.includes('hair')) {
    return 'elegant beauty salon interior, rose gold accents, professional styling chair, soft diffused lighting, luxury pampering aesthetic';
  }
  if (cat.includes('gym') || cat.includes('fitness') || cat.includes('yoga') || cat.includes('wellness')) {
    return 'premium fitness studio, dramatic motivational lighting, modern equipment, energy and vitality, dark background with neon accents';
  }
  if (cat.includes('real estate') || cat.includes('property') || cat.includes('builder') || cat.includes('architect')) {
    return 'stunning luxury property exterior at golden hour, clean architectural lines, lush landscaping, aspirational lifestyle aesthetic';
  }
  if (cat.includes('legal') || cat.includes('advocate') || cat.includes('lawyer') || cat.includes('attorney')) {
    return 'prestigious law office, mahogany desk, legal books, scales of justice, power and authority, deep burgundy and gold tones';
  }
  if (cat.includes('school') || cat.includes('academy') || cat.includes('education') || cat.includes('tutor') || cat.includes('coaching')) {
    return 'bright modern classroom, engaged students, digital learning boards, inspiring educational environment, vibrant and welcoming';
  }
  if (cat.includes('tech') || cat.includes('software') || cat.includes('it') || cat.includes('digital')) {
    return 'futuristic tech workspace, multiple monitors with code, ambient purple and blue neon lighting, innovation and precision aesthetic';
  }
  return 'premium modern business office, glass and steel architecture, professional team silhouettes, cinematic wide angle, success and growth aesthetic';
};

const buildPrompt = (lead: ILead) => {
  const category = lead.category || 'local business';
  const city = lead.city || '';
  const categoryVisuals = getCategoryVisuals(category);

  return `Ultra-premium marketing hero banner for a ${category} business${city ? ` in ${city}` : ''}. ` +
    `Visual style: ${categoryVisuals}. ` +
    `Photorealistic, 8K quality, award-winning advertising photography. ` +
    `Cinematic depth of field, professional studio lighting with dramatic shadows and highlights. ` +
    `Rich color grading, magazine cover quality. ` +
    `Wide 16:9 hero banner composition with clear focal point on left third. ` +
    `Subtle gradient overlay on right side creating space for text. ` +
    `Premium luxury brand aesthetic, high-end and trustworthy. ` +
    `NO text, NO watermarks, NO logos. Hyper realistic, ultra detailed.`;
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
