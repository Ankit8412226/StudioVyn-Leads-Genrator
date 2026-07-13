import { ILead } from '../models/Lead';
import { delay } from '../utils/delay';
import { logger } from '../utils/logger';

const FIREWORKS_API_KEY = process.env.FIREWORKS_API_KEY ?? '';
const FIREWORKS_TEXT_MODEL = process.env.FIREWORKS_TEXT_MODEL ?? 'accounts/fireworks/models/deepseek-v3p1';
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
    : 'Losing map customers to competitors, zero digital lead capture';
  
  return `You are a high-performance growth marketer. Write a Curiosity-Driven WhatsApp message.\n\n` +
    `Strategy:\n` +
    `- USE MILLION-DOLLAR COPYWRITING. Focus on "The Gap" between where they are and where they could be.\n` +
    `- Be professional, brief (Max 240 chars).\n` +
    `- Reference their ${lead.rating ? `${lead.rating} star rating` : 'quality'}.\n` +
    `- Ask a curiosity-gap question. Example: "Have you seen how your business looks on mobile lately?"\n\n` +
    `Business: ${businessName}\n` +
    `Category: ${category}\n` +
    `Pain Points: ${painPoints}\n` +
    `${landingPageUrl ? `Include Link: ${landingPageUrl}` : ''}\n\n` +
    `Output only the message text. No subject lines. No emojis except one 🚀 or ✨.`;
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
  logger.warn('Personalized messaging AI disabled. Using local fallback.');
  return fallbackMessage(lead, landingPageUrl, variant).slice(0, MAX_MESSAGE_CHARS);
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
  logger.warn('Follow-up messaging AI disabled. Using local fallback.');
  return fallbackFollowUp(lead, landingPageUrl, variant).slice(0, MAX_MESSAGE_CHARS);
};
