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

const ensureLeadInsights = async (lead: ILead) => {
  const hasInsights = Boolean(
    lead.aiPainPoints?.length ||
    lead.aiOutreachAngle ||
    lead.aiLandingHeadline ||
    lead.aiLandingSubhead
  );
  if (hasInsights) return;

  const insights = await generateLeadInsights(lead);
  lead.aiPainPoints = insights.painPoints;
  lead.aiOutreachAngle = insights.outreachAngle;
  lead.aiIdealSolution = insights.idealSolution;
  lead.aiLandingHeadline = insights.landingHeadline;
  lead.aiLandingSubhead = insights.landingSubhead;
  lead.aiLandingBullets = insights.landingBullets;
  lead.aiLandingCta = insights.demoCta;
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

  try {
    await ensureLeadInsights(lead);
    const landingPageUrl = `${PUBLIC_WEB_URL.replace(/\/$/, '')}/demo/${lead._id}`;
    if (!campaignLead.messageVariant) {
      campaignLead.messageVariant = pickVariant(lead._id.toString());
    }

    const message = campaignLead.messageText
      ?? await generatePersonalizedMessage(lead, landingPageUrl, campaignLead.messageVariant);
    campaignLead.messageText = message;

    let imagePath: string | null = null;
    if (includeImage) {
      imagePath = campaignLead.heroImagePath
        ?? await generateHeroImage(lead);
      if (imagePath) {
        campaignLead.heroImagePath = imagePath;
        lead.heroImagePath = toPublicImagePath(imagePath);
      }
    }

    const delayMs = getRandomDelay();
    logger.info(`Waiting ${delayMs}ms before sending to ${whatsappId}`);
    await delay(delayMs);

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

    logger.info(`Message sent to ${whatsappId} (${lead.businessName ?? lead.fullName})`);
  } catch (error: any) {
    campaignLead.messageStatus = 'failed';
    campaignLead.error = error.message;
    lead.messageStatus = 'failed';
    lead.lastContactedAt = new Date();

    await Promise.all([campaignLead.save(), lead.save()]);
    logger.error(`Message failed for ${campaignLeadId}: ${error.message}`);
    throw error;
  }
};
