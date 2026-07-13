import { ILead } from '../models/Lead';
import { delay } from '../utils/delay';
import { logger } from '../utils/logger';

const FIREWORKS_API_KEY = process.env.FIREWORKS_API_KEY ?? '';
const FIREWORKS_TEXT_MODEL = process.env.FIREWORKS_TEXT_MODEL ?? 'accounts/fireworks/models/deepseek-v3p1';
const FIREWORKS_CHAT_ENDPOINT = process.env.FIREWORKS_CHAT_ENDPOINT ?? 'https://api.fireworks.ai/inference/v1/chat/completions';

const RETRY_DELAYS_MS = [2000, 5000, 10000];

const isRetryableStatus = (status: number) =>
  status === 408 || status === 429 || status >= 500;

export interface LeadInsights {
  painPoints: string[];
  outreachAngle: string;
  landingHeadline: string;
  landingSubhead: string;
  landingBullets: string[];
  demoCta: string;
  idealSolution: string;
}

const buildPrompt = (lead: ILead) => {
  const businessName = lead.businessName || lead.fullName || 'the business';
  const category = lead.category || 'local business';
  const city = lead.city ? ` in ${lead.city}` : '';

  return `You are a world-class growth copywriter and marketing strategist. Analyze this business and output JSON only.\n\n` +
    `Business Name: ${businessName}\n` +
    `Category: ${category}\n` +
    `City: ${lead.city ?? 'N/A'}\n` +
    `Rating: ${lead.rating ?? 'N/A'}\n` +
    `Review Count: ${lead.reviewCount ?? 'N/A'}\n` +
    `Website: ${lead.website ? 'Yes' : 'No'}\n` +
    `Source: ${lead.source}\n\n` +
    `Copywriting Strategy:\n` +
    `- USE MILLION-DOLLAR COPYWRITING PRINCIPLES. Focus on "What's in it for the customer?"\n` +
    `- Landing Headline: MUST BE A HOOK. Example: "Dominating [City] as the #1 [Category]" or "Your Best Work, Finally Shown Properly."\n` +
    `- Landing Subhead: MUST FOCUS ON ROI. Mention speed, trust, or automated growth.\n` +
    `- Pain Points: Direct and "Stinging". Why is a missing website costing them lakhs? (e.g., "Leaking map leads to competitors").\n` +
    `- Bullets: Pure Benefits. Focus on: Instant Contact, Trust/Ratings, and 24/7 Automation.\n` +
    `- TONE: Bold, Professional, and Visionary. You are showing them their future billion-dollar brand.\n\n` +
    `Requirements:\n` +
    `- Output valid JSON only (no markdown)\n` +
    `- Return JSON with keys:\n` +
    `pain_points (array of 3 specific economic pain points),\n` +
    `outreach_angle (string - the "Reason Why" this business needs to move now),\n` +
    `landing_headline (string - high-impact, bold),\n` +
    `landing_subhead (string - benefit-driven),\n` +
    `landing_bullets (array of 3 benefit-focused bullets),\n` +
    `demo_cta (string - low friction action),\n` +
    `ideal_solution (string - comprehensive digital transformation summary).`;
};

const fallbackInsights = (lead: ILead): LeadInsights => {
  const businessName = lead.businessName || lead.fullName || 'your business';
  const category = lead.category || 'local businesses';
  return {
    painPoints: [
      'Customers may have trouble finding clear services and pricing online',
      'Missed leads from people who prefer to message or book instantly',
      'No simple way to capture inquiries 24/7',
    ],
    outreachAngle: `Quick win: a clean, mobile-first page that helps ${category} capture more inquiries without extra staff.`,
    landingHeadline: `A modern online presence for ${businessName}`,
    landingSubhead: `Turn searches into bookings with a fast, trustworthy page built for ${category}.`,
    landingBullets: [
      'Instant WhatsApp/Call buttons',
      'Clear services, pricing, and reviews',
      'AI chat to capture leads 24/7',
    ],
    demoCta: 'Want a 2-minute demo?',
    idealSolution: 'A lightweight landing page + WhatsApp lead capture + basic analytics.',
  };
};

const parseJsonSafe = (content: string): any | null => {
  try {
    // Attempt 1: Standard JSON parse
    return JSON.parse(content);
  } catch {
    try {
      // Attempt 2: Extract JSON using regex (handles markdown backticks and extra text)
      const jsonRegex = /\{[\s\S]*\}/;
      const match = content.match(jsonRegex);
      if (match) {
        return JSON.parse(match[0]);
      }
    } catch {
      return null;
    }
  }
  return null;
};

export const generateLeadInsights = async (lead: ILead): Promise<LeadInsights> => {
  logger.warn('Fireworks AI leads analysis disabled. Using local fallback.');
  return fallbackInsights(lead);
};
