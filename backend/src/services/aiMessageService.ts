import { ILead } from '../models/Lead';
import { delay } from '../utils/delay';
import { logger } from '../utils/logger';

const FIREWORKS_API_KEY = process.env.FIREWORKS_API_KEY ?? '';
const FIREWORKS_TEXT_MODEL = process.env.FIREWORKS_TEXT_MODEL ?? 'accounts/fireworks/models/llama-v3p1-8b-instruct';
const FIREWORKS_CHAT_ENDPOINT = process.env.FIREWORKS_CHAT_ENDPOINT ?? 'https://api.fireworks.ai/inference/v1/chat/completions';

const MAX_MESSAGE_CHARS = 300;
type MessageVariant = 'A' | 'B';
const RETRY_DELAYS_MS = [2000, 5000, 10000];

const isRetryableStatus = (status: number) =>
  status === 408 || status === 429 || status >= 500;

const buildPrompt = (lead: ILead, landingPageUrl?: string | null, variant: MessageVariant = 'A') => {
  const businessName = lead.businessName || lead.fullName || 'the business';
  const category = lead.category || 'local business';
  const city = lead.city ? ` in ${lead.city}` : '';
  const painPoints = (lead.aiPainPoints && lead.aiPainPoints.length > 0)
    ? lead.aiPainPoints.join('; ')
    : 'Low online conversion, missing lead capture, limited booking clarity';
  const outreachAngle = lead.aiOutreachAngle ?? 'A quick modern landing page + WhatsApp lead capture';
  const demoLine = landingPageUrl ? `Include this demo link: ${landingPageUrl}` : 'Ask for a quick demo';
  const variantGuidance = variant === 'A'
    ? 'Variant A: ultra-short (1-2 sentences), soft CTA.'
    : 'Variant B: slightly more detailed (2-3 sentences), include 1 pain point and demo link.';

  return `Write a short, friendly WhatsApp outreach message.\n\nRules:\n- Max ${MAX_MESSAGE_CHARS} characters\n- Mention the business name\n- Reference the business category\n- Conversational, human tone\n- Avoid spammy or pushy wording\n- Output only the message text\n\nBusiness Name: ${businessName}\nCategory: ${category}\nCity: ${lead.city ?? 'N/A'}\nRating: ${lead.rating ?? 'N/A'}\nReview Count: ${lead.reviewCount ?? 'N/A'}\nWebsite: ${lead.website ? 'Yes' : 'No'}\nPain Points: ${painPoints}\nOutreach Angle: ${outreachAngle}\n${demoLine}\nVariant: ${variant}\n${variantGuidance}\n\nContext: You found them on Google Maps${city}. You help businesses improve online bookings and conversions.`;
};

const fallbackMessage = (lead: ILead, landingPageUrl?: string | null, variant: MessageVariant = 'A') => {
  const businessName = lead.businessName || lead.fullName || 'there';
  const category = lead.category || 'businesses';
  const city = lead.city ? ` in ${lead.city}` : '';
  const ratingLine = lead.rating ? ` and your ${lead.rating}⭐ ratings` : '';
  const linkLine = landingPageUrl ? ` Quick demo: ${landingPageUrl}` : '';
  if (variant === 'A') {
    return `Hi ${businessName}! I found you on Google Maps${city}${ratingLine}. We help ${category} get more bookings. Want a 2-minute demo?${linkLine}`;
  }
  return `Hi ${businessName}! I noticed many ${category} miss leads without a clear landing page${ratingLine}. We can set up a modern page + WhatsApp capture.${linkLine} Want a quick demo?`;
};

export const generatePersonalizedMessage = async (
  lead: ILead,
  landingPageUrl?: string | null,
  variant: MessageVariant = 'A'
): Promise<string> => {
  if (!FIREWORKS_API_KEY) {
    logger.warn('FIREWORKS_API_KEY not set. Using fallback message.');
    return fallbackMessage(lead, landingPageUrl, variant).slice(0, MAX_MESSAGE_CHARS);
  }

  try {
    const prompt = buildPrompt(lead, landingPageUrl, variant);

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
            { role: 'system', content: 'You write concise, friendly WhatsApp outreach messages.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.6,
          max_tokens: 160,
        }),
      });

      if (res.ok) {
        data = await res.json();
        break;
      }

      const errorText = await res.text();
      lastError = `Fireworks chat error: ${res.status} ${errorText}`;

      if (!isRetryableStatus(res.status) || attempt === RETRY_DELAYS_MS.length) {
        throw new Error(lastError);
      }

      await delay(RETRY_DELAYS_MS[attempt]);
    }

    const message = data?.choices?.[0]?.message?.content?.trim();

    if (!message) {
      throw new Error('Fireworks returned empty message');
    }

    return message.slice(0, MAX_MESSAGE_CHARS);
  } catch (error: any) {
    logger.error(`AI message generation failed: ${error.message}`);
    return fallbackMessage(lead, landingPageUrl, variant).slice(0, MAX_MESSAGE_CHARS);
  }
};

const buildFollowUpPrompt = (lead: ILead, landingPageUrl?: string | null, variant: MessageVariant = 'A') => {
  const businessName = lead.businessName || lead.fullName || 'the business';
  const category = lead.category || 'local business';
  const city = lead.city ? ` in ${lead.city}` : '';
  const painPoints = (lead.aiPainPoints && lead.aiPainPoints.length > 0)
    ? lead.aiPainPoints.join('; ')
    : 'Missed inquiries and low conversion';
  const demoLine = landingPageUrl ? `Include this demo link: ${landingPageUrl}` : 'Ask for a quick demo';
  const variantGuidance = variant === 'A'
    ? 'Variant A: very short follow-up (1 sentence).'
    : 'Variant B: short follow-up (2 sentences) and mention 1 pain point.';

  return `Write a polite follow-up WhatsApp message.\n\nRules:\n- Max ${MAX_MESSAGE_CHARS} characters\n- Friendly, non-pushy\n- Ask if they want a quick demo\n- Output only the message text\n\nBusiness Name: ${businessName}\nCategory: ${category}\nCity: ${lead.city ?? 'N/A'}\nPain Points: ${painPoints}\n${demoLine}\nVariant: ${variant}\n${variantGuidance}\n\nContext: You help ${category} businesses${city} improve bookings and conversions.`;
};

const fallbackFollowUp = (lead: ILead, landingPageUrl?: string | null, variant: MessageVariant = 'A') => {
  const businessName = lead.businessName || lead.fullName || 'there';
  const linkLine = landingPageUrl ? ` Demo: ${landingPageUrl}` : '';
  if (variant === 'A') {
    return `Just checking in, ${businessName}. Want a quick demo?${linkLine}`;
  }
  return `Quick follow-up, ${businessName} - we can help capture more inquiries with a simple landing page.${linkLine} Want a demo?`;
};

export const generateFollowUpMessage = async (
  lead: ILead,
  landingPageUrl?: string | null,
  variant: MessageVariant = 'A'
): Promise<string> => {
  if (!FIREWORKS_API_KEY) {
    logger.warn('FIREWORKS_API_KEY not set. Using fallback follow-up message.');
    return fallbackFollowUp(lead, landingPageUrl, variant).slice(0, MAX_MESSAGE_CHARS);
  }

  try {
    const prompt = buildFollowUpPrompt(lead, landingPageUrl, variant);

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
            { role: 'system', content: 'You write concise, friendly WhatsApp follow-ups.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.5,
          max_tokens: 120,
        }),
      });

      if (res.ok) {
        data = await res.json();
        break;
      }

      const errorText = await res.text();
      lastError = `Fireworks follow-up error: ${res.status} ${errorText}`;

      if (!isRetryableStatus(res.status) || attempt === RETRY_DELAYS_MS.length) {
        throw new Error(lastError);
      }

      await delay(RETRY_DELAYS_MS[attempt]);
    }

    const message = data?.choices?.[0]?.message?.content?.trim();
    if (!message) {
      throw new Error('Fireworks returned empty follow-up message');
    }
    return message.slice(0, MAX_MESSAGE_CHARS);
  } catch (error: any) {
    logger.error(`AI follow-up generation failed: ${error.message}`);
    return fallbackFollowUp(lead, landingPageUrl, variant).slice(0, MAX_MESSAGE_CHARS);
  }
};
