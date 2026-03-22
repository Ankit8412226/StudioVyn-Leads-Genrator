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

  return `You are a growth consultant. Analyze the lead and output JSON only.\n\n` +
    `Business Name: ${businessName}\n` +
    `Category: ${category}\n` +
    `City: ${lead.city ?? 'N/A'}\n` +
    `Rating: ${lead.rating ?? 'N/A'}\n` +
    `Review Count: ${lead.reviewCount ?? 'N/A'}\n` +
    `Website: ${lead.website ? 'Yes' : 'No'}\n` +
    `Source: ${lead.source}\n\n` +
    `Requirements:\n` +
    `- Output valid JSON only (no markdown)\n` +
    `- Keep language concise, friendly, non-judgmental\n` +
    `- Pain points must be plausible and respectful\n` +
    `- Focus on missing website, low conversion, online booking, trust, and lead capture\n` +
    `- Include a demo CTA\n\n` +
    `Return JSON with keys:\n` +
    `pain_points (array of 2-4 strings),\n` +
    `outreach_angle (string),\n` +
    `landing_headline (string),\n` +
    `landing_subhead (string),\n` +
    `landing_bullets (array of 3 strings),\n` +
    `demo_cta (string),\n` +
    `ideal_solution (string).\n\n` +
    `Context: We help ${category} businesses${city} improve bookings and conversions with modern websites and AI chat.`;
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
  const trimmed = content.trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    return null;
  }
};

export const generateLeadInsights = async (lead: ILead): Promise<LeadInsights> => {
  if (!FIREWORKS_API_KEY) {
    logger.warn('FIREWORKS_API_KEY not set. Using fallback insights.');
    return fallbackInsights(lead);
  }

  try {
    const prompt = buildPrompt(lead);
    let data: any | null = null;
    let lastError: string | null = null;

    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
      const res = await fetch(FIREWORKS_CHAT_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${FIREWORKS_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: FIREWORKS_TEXT_MODEL,
          messages: [
            { role: 'system', content: 'You produce concise JSON for lead analysis.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.4,
          max_tokens: 300,
        }),
      });

      if (res.ok) {
        data = await res.json();
        break;
      }

      const errorText = await res.text();
      lastError = `Fireworks analysis error: ${res.status} ${errorText}`;

      if (!isRetryableStatus(res.status) || attempt === RETRY_DELAYS_MS.length) {
        throw new Error(lastError);
      }

      await delay(RETRY_DELAYS_MS[attempt]);
    }

    const raw = data?.choices?.[0]?.message?.content ?? '';
    const parsed = parseJsonSafe(raw);
    if (!parsed) {
      throw new Error('Fireworks returned invalid JSON for lead analysis');
    }

    return {
      painPoints: Array.isArray(parsed.pain_points) ? parsed.pain_points.slice(0, 4) : fallbackInsights(lead).painPoints,
      outreachAngle: typeof parsed.outreach_angle === 'string' ? parsed.outreach_angle : fallbackInsights(lead).outreachAngle,
      landingHeadline: typeof parsed.landing_headline === 'string' ? parsed.landing_headline : fallbackInsights(lead).landingHeadline,
      landingSubhead: typeof parsed.landing_subhead === 'string' ? parsed.landing_subhead : fallbackInsights(lead).landingSubhead,
      landingBullets: Array.isArray(parsed.landing_bullets) ? parsed.landing_bullets.slice(0, 3) : fallbackInsights(lead).landingBullets,
      demoCta: typeof parsed.demo_cta === 'string' ? parsed.demo_cta : fallbackInsights(lead).demoCta,
      idealSolution: typeof parsed.ideal_solution === 'string' ? parsed.ideal_solution : fallbackInsights(lead).idealSolution,
    };
  } catch (error: any) {
    logger.error(`Lead analysis failed: ${error.message}`);
    return fallbackInsights(lead);
  }
};
