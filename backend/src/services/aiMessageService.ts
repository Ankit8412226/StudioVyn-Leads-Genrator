import { ILead } from '../models/Lead';
import { delay } from '../utils/delay';
import { logger } from '../utils/logger';

const FIREWORKS_API_KEY = process.env.FIREWORKS_API_KEY ?? '';
const FIREWORKS_TEXT_MODEL = process.env.FIREWORKS_TEXT_MODEL ?? 'accounts/fireworks/models/llama-v3p1-8b-instruct';
const FIREWORKS_CHAT_ENDPOINT = process.env.FIREWORKS_CHAT_ENDPOINT ?? 'https://api.fireworks.ai/inference/v1/chat/completions';

const MAX_MESSAGE_CHARS = 300;
const RETRY_DELAYS_MS = [2000, 5000, 10000];

const isRetryableStatus = (status: number) =>
  status === 408 || status === 429 || status >= 500;

const buildPrompt = (lead: ILead) => {
  const businessName = lead.businessName || lead.fullName || 'the business';
  const category = lead.category || 'local business';
  const city = lead.city ? ` in ${lead.city}` : '';
  const rating = lead.rating ? `${lead.rating} stars` : 'strong ratings';

  return `Write a short, friendly WhatsApp outreach message.\n\nRules:\n- Max ${MAX_MESSAGE_CHARS} characters\n- Mention the business name\n- Reference the business category\n- Conversational, human tone\n- Avoid spammy or pushy wording\n- Output only the message text\n\nBusiness Name: ${businessName}\nCategory: ${category}\nCity: ${lead.city ?? 'N/A'}\nRating: ${lead.rating ?? 'N/A'}\nReview Count: ${lead.reviewCount ?? 'N/A'}\nWebsite: ${lead.website ? 'Yes' : 'No'}\n\nContext: You found them on Google Maps${city}. You help businesses improve online bookings and conversions.`;
};

const fallbackMessage = (lead: ILead) => {
  const businessName = lead.businessName || lead.fullName || 'there';
  const category = lead.category || 'businesses';
  const city = lead.city ? ` in ${lead.city}` : '';
  const ratingLine = lead.rating ? ` and your ${lead.rating}⭐ ratings` : '';
  return `Hi! I found ${businessName} on Google Maps${city}${ratingLine}. We help ${category} get more bookings with modern websites and AI chat. Want to see a quick demo?`;
};

export const generatePersonalizedMessage = async (lead: ILead): Promise<string> => {
  if (!FIREWORKS_API_KEY) {
    logger.warn('FIREWORKS_API_KEY not set. Using fallback message.');
    return fallbackMessage(lead).slice(0, MAX_MESSAGE_CHARS);
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
    return fallbackMessage(lead).slice(0, MAX_MESSAGE_CHARS);
  }
};
