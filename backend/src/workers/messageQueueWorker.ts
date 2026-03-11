import 'dotenv/config';
import { connectDB } from '../db';
import { CampaignLead } from '../models/CampaignLead';
import { Lead } from '../models/Lead';
import { generatePersonalizedMessage } from '../services/aiMessageService';
import { generateHeroImage } from '../services/imageGenerationService';
import { MessageJob, messageQueue } from '../services/messageQueue';
import { sendWhatsAppMessage } from '../services/whatsappService';
import { delay } from '../utils/delay';
import { logger } from '../utils/logger';
import { Job } from 'bull';

const DEFAULT_COUNTRY_CODE = process.env.DEFAULT_COUNTRY_CODE ?? '91';

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

const processJob = async (job: Job<MessageJob>) => {
  const { campaignLeadId, includeImage } = job.data;

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
    const message = campaignLead.messageText
      ?? await generatePersonalizedMessage(lead);
    campaignLead.messageText = message;

    let imagePath: string | null = null;
    if (includeImage) {
      imagePath = campaignLead.heroImagePath
        ?? await generateHeroImage(lead);
      if (imagePath) {
        campaignLead.heroImagePath = imagePath;
      }
    }

    const delayMs = getRandomDelay();
    logger.info(`Waiting ${delayMs}ms before sending to ${whatsappId}`);
    await delay(delayMs);

    await sendWhatsAppMessage(whatsappId, message, imagePath);

    campaignLead.messageStatus = 'sent';
    campaignLead.lastContactedAt = new Date();
    campaignLead.error = undefined;
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

const startWorker = async () => {
  await connectDB();

  messageQueue.process(1, processJob);

  messageQueue.on('error', (err) => {
    logger.error(`Queue error: ${err.message}`);
  });

  logger.info('Message queue worker started.');
};

startWorker().catch((err) => {
  logger.error(`Worker startup failed: ${err.message}`);
  process.exit(1);
});
