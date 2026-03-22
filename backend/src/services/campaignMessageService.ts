import path from 'path';
import { CampaignLead } from '../models/CampaignLead';
import { ILead, Lead } from '../models/Lead';
import { generatePersonalizedMessage } from './aiMessageService';
import { generateLeadInsights } from './aiLeadAnalysisService';
import { generateHeroImage } from './imageGenerationService';
import { sendWhatsAppMessage } from './whatsappService';
import { delay } from '../utils/delay';
import { logger } from '../utils/logger';

const DEFAULT_COUNTRY_CODE = process.env.DEFAULT_COUNTRY_CODE ?? '91';
const PUBLIC_WEB_URL = process.env.PUBLIC_WEB_URL ?? 'http://localhost:3000';
const GENERATED_ASSETS_ROUTE = '/generated-assets';
const FOLLOW_UP_DELAY_HOURS = Number(process.env.FOLLOW_UP_DELAY_HOURS ?? '48');
const FOLLOW_UP2_DELAY_HOURS = Number(process.env.FOLLOW_UP2_DELAY_HOURS ?? '96');

const formatWhatsAppId = (rawPhone?: string | null) => {
  if (!rawPhone) return null;
  const digits = rawPhone.replace(/\D/g, '');
  if (!digits) return null;

  const withCountry = digits.startsWith('0')
    ? `${DEFAULT_COUNTRY_CODE}${digits.replace(/^0+/, '')}`
    : digits.length <= 10
      ? `${DEFAULT_COUNTRY_CODE}${digits}`
      : digits;

  return `${withCountry}@c.us`;
};

const getRandomDelay = () => {
  const minMs = 30 * 1000;
  const maxMs = 120 * 1000;
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
};

const pickVariant = (leadId: string): 'A' | 'B' => {
  const lastChar = leadId.slice(-1);
  const value = parseInt(lastChar, 16);
  return Number.isNaN(value) || value % 2 === 0 ? 'A' : 'B';
};

const toPublicImagePath = (imagePath: string) => {
  const filename = path.basename(imagePath);
  return `${GENERATED_ASSETS_ROUTE}/${filename}`;
};

/**
 * Builds a plain-text fallback message without calling AI.
 * Used when AI message generation completely fails.
 */
const buildFallbackMessage = (lead: ILead, landingPageUrl: string, variant: 'A' | 'B'): string => {
  const businessName = lead.businessName || lead.fullName || 'there';
  const category = lead.category || 'businesses';
  const city = lead.city ? ` in ${lead.city}` : '';
  const ratingLine = lead.rating ? ` and your ${lead.rating}⭐ rating` : '';
  const linkLine = ` Quick demo: ${landingPageUrl}`;
  if (variant === 'A') {
    return `Hi ${businessName}! I found you on Google Maps${city}${ratingLine}. We help ${category} get more bookings. Want a 2-minute demo?${linkLine}`.slice(0, 300);
  }
  return `Hi ${businessName}! Many ${category} businesses${city} miss leads without a clear landing page${ratingLine}. We can help with a fast page + WhatsApp capture.${linkLine} Want a quick demo?`.slice(0, 300);
};

// ─── Step 1: AI Insight Enrichment (NON-BLOCKING) ────────────────────────────
// Generates AI insights and persists them to DB so subsequent runs skip the AI call.
const ensureAndPersistInsights = async (lead: ILead): Promise<void> => {
  const hasInsights = Boolean(
    lead.aiPainPoints?.length ||
    lead.aiOutreachAngle ||
    lead.aiLandingHeadline ||
    lead.aiLandingSubhead
  );
  if (hasInsights) return;

  try {
    logger.info(`Generating AI insights for: ${lead.businessName ?? lead.fullName}`);
    const insights = await generateLeadInsights(lead);
    lead.aiPainPoints = insights.painPoints;
    lead.aiOutreachAngle = insights.outreachAngle;
    lead.aiIdealSolution = insights.idealSolution;
    lead.aiLandingHeadline = insights.landingHeadline;
    lead.aiLandingSubhead = insights.landingSubhead;
    lead.aiLandingBullets = insights.landingBullets;
    lead.aiLandingCta = insights.demoCta;
    // Persist to DB so we don't re-generate on every campaign run
    await lead.save();
    logger.info(`✅ AI insights saved for: ${lead.businessName ?? lead.fullName}`);
  } catch (err: any) {
    // NON-FATAL: continue with empty insights; message generation uses its own fallback
    logger.warn(`⚠️ AI insights failed for "${lead.businessName ?? lead.fullName}": ${err.message}. Continuing without insights.`);
  }
};

// ─── Step 2: Message Generation (NON-BLOCKING) ───────────────────────────────
// Falls back to a hardcoded template if both the AI and service-level fallback fail.
const safeGenerateMessage = async (
  lead: ILead,
  landingPageUrl: string,
  variant: 'A' | 'B',
  existingMessage?: string
): Promise<string> => {
  if (existingMessage) return existingMessage;

  try {
    const msg = await generatePersonalizedMessage(lead, landingPageUrl, variant);
    if (msg) return msg;
    throw new Error('Empty message returned from AI service');
  } catch (err: any) {
    logger.warn(`⚠️ Message generation failed: ${err.message}. Using hardcoded fallback.`);
    return buildFallbackMessage(lead, landingPageUrl, variant);
  }
};

// ─── Step 3: Image Generation (NON-BLOCKING) ─────────────────────────────────
// Always returns null on failure — never throws.
const safeGenerateImage = async (lead: ILead, existingPath?: string): Promise<string | null> => {
  if (existingPath) return existingPath;
  try {
    return await generateHeroImage(lead);
  } catch (err: any) {
    logger.warn(`⚠️ Image generation failed: ${err.message}. Sending text-only.`);
    return null;
  }
};

export const processCampaignLead = async (campaignLeadId: string, includeImage: boolean) => {
  const campaignLead = await CampaignLead.findById(campaignLeadId);
  if (!campaignLead) {
    logger.warn(`CampaignLead not found: ${campaignLeadId}`);
    return;
  }

  if (campaignLead.messageStatus === 'sent') {
    logger.info(`CampaignLead already sent: ${campaignLeadId}`);
    return;
  }

  const lead = await Lead.findById(campaignLead.leadId);
  if (!lead) {
    logger.warn(`Lead not found for CampaignLead: ${campaignLeadId}`);
    return;
  }

  campaignLead.attemptCount += 1;
  lead.attemptCount = (lead.attemptCount ?? 0) + 1;

  const whatsappId = formatWhatsAppId(lead.phone ?? lead.alternatePhone ?? null);
  if (!whatsappId) {
    campaignLead.messageStatus = 'failed';
    campaignLead.error = 'Missing valid phone number';
    lead.messageStatus = 'failed';
    await Promise.all([campaignLead.save(), lead.save()]);
    return;
  }

  // ── Step 1: AI Insights — errors are swallowed, NEVER block WhatsApp send ──
  await ensureAndPersistInsights(lead);

  // ── Step 2: Build message + image — errors produce safe fallbacks ──────────
  const landingPageUrl = `${PUBLIC_WEB_URL.replace(/\/$/, '')}/demo/${lead._id}`;
  if (!campaignLead.messageVariant) {
    campaignLead.messageVariant = pickVariant(lead._id.toString());
  }

  const message = await safeGenerateMessage(
    lead,
    landingPageUrl,
    campaignLead.messageVariant,
    campaignLead.messageText ?? undefined
  );
  campaignLead.messageText = message;

  let imagePath: string | null = null;
  if (includeImage) {
    imagePath = await safeGenerateImage(lead, campaignLead.heroImagePath ?? undefined);
    if (imagePath) {
      campaignLead.heroImagePath = imagePath;
      lead.heroImagePath = toPublicImagePath(imagePath);
    }
  }

  // ── Step 3: Random human-like delay, then SEND (this is the critical step) ─
  const delayMs = getRandomDelay();
  logger.info(`⏳ Waiting ${Math.round(delayMs / 1000)}s before sending to ${whatsappId}…`);
  await delay(delayMs);

  try {
    await sendWhatsAppMessage(whatsappId, message, imagePath);

    campaignLead.messageStatus = 'sent';
    campaignLead.lastContactedAt = new Date();
    campaignLead.error = undefined;
    if (!campaignLead.followUpAt) {
      campaignLead.followUpAt = new Date(Date.now() + FOLLOW_UP_DELAY_HOURS * 60 * 60 * 1000);
      campaignLead.followUpStatus = 'pending';
    }
    if (!campaignLead.followUp2At) {
      campaignLead.followUp2At = new Date(Date.now() + FOLLOW_UP2_DELAY_HOURS * 60 * 60 * 1000);
      campaignLead.followUp2Status = 'pending';
    }
    lead.messageStatus = 'sent';
    lead.status = 'contacted';
    lead.lastContactedAt = campaignLead.lastContactedAt;

    await Promise.all([campaignLead.save(), lead.save()]);
    logger.info(`✅ WhatsApp sent → ${whatsappId} (${lead.businessName ?? lead.fullName})`);
  } catch (error: any) {
    // Only the WhatsApp send failure marks the campaign lead as failed
    campaignLead.messageStatus = 'failed';
    campaignLead.error = `WhatsApp send error: ${error.message}`;
    lead.messageStatus = 'failed';
    lead.lastContactedAt = new Date();

    await Promise.all([campaignLead.save(), lead.save()]);
    logger.error(`❌ WhatsApp send failed for ${campaignLeadId}: ${error.message}`);
    throw error;
  }
};
