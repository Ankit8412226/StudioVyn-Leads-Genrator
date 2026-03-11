import fs from 'fs';
import path from 'path';
import { ILead } from '../models/Lead';
import { logger } from '../utils/logger';

const FIREWORKS_API_KEY = process.env.FIREWORKS_API_KEY ?? '';
const FIREWORKS_IMAGE_MODEL = process.env.FIREWORKS_IMAGE_MODEL ?? 'accounts/fireworks/models/flux-1-schnell-fp8';
const FIREWORKS_IMAGE_ENDPOINT = process.env.FIREWORKS_IMAGE_ENDPOINT
  ?? `https://api.fireworks.ai/inference/v1/workflows/${FIREWORKS_IMAGE_MODEL}/text_to_image`;

const GENERATED_ASSETS_DIR = process.env.GENERATED_ASSETS_DIR
  ?? path.join(process.cwd(), 'generated-assets');

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

const buildPrompt = (lead: ILead) => {
  const category = lead.category || 'local business';
  return `A modern website hero section for a premium ${category} business. Clean SaaS landing page style, professional marketing design, crisp typography, modern UI, subtle gradients, cinematic lighting, high-end brand feel, wide composition.`;
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
        guidance_scale: 2.5,
        num_inference_steps: 4,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Fireworks image error: ${res.status} ${errorText}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    fs.writeFileSync(outputPath, Buffer.from(arrayBuffer));
    return outputPath;
  } catch (error: any) {
    logger.error(`Image generation failed: ${error.message}`);
    return null;
  }
};
