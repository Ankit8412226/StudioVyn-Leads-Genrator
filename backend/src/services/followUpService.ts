import { CampaignLead } from '../models/CampaignLead';
import { Lead } from '../models/Lead';
import { generateFollowUpMessage } from './aiMessageService';
import { sendWhatsAppMessage } from './whatsappService';
import { logger } from '../utils/logger';

const DEFAULT_COUNTRY_CODE = process.env.DEFAULT_COUNTRY_CODE ?? '91';
const PUBLIC_WEB_URL = process.env.PUBLIC_WEB_URL ?? 'http://localhost:3000';

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

const shouldSkipFollowUp = (status?: string, responseStatus?: string) =>
  status === 'won' || status === 'lost' || responseStatus === 'replied';

const processFollowUpStage = async (
  stage: 1 | 2,
  batchSize: number
) => {
  const now = new Date();
  const stageFilter = stage === 1
    ? {
        followUpStatus: 'pending',
        followUpAt: { $lte: now },
      }
    : {
        followUp2Status: 'pending',
        followUp2At: { $lte: now },
        followUpStatus: 'sent',
      };

  const dueLeads = await CampaignLead.find({
    ...stageFilter,
    messageStatus: 'sent',
  })
    .sort(stage === 1 ? { followUpAt: 1 } : { followUp2At: 1 })
    .limit(batchSize)
    .lean();

  if (dueLeads.length === 0) return 0;

  let processed = 0;

  for (const campaignLead of dueLeads) {
    try {
      const lead = await Lead.findById(campaignLead.leadId);
      if (!lead || shouldSkipFollowUp(lead.status, lead.responseStatus)) {
        await CampaignLead.findByIdAndUpdate(campaignLead._id, {
          ...(stage === 1 ? { followUpStatus: 'failed' } : { followUp2Status: 'failed' }),
          error: lead ? 'Follow-up skipped due to lead status' : 'Lead not found',
        });
        continue;
      }

      const whatsappId = formatWhatsAppId(lead.phone ?? lead.alternatePhone ?? null);
      if (!whatsappId) {
        await CampaignLead.findByIdAndUpdate(campaignLead._id, {
          ...(stage === 1 ? { followUpStatus: 'failed' } : { followUp2Status: 'failed' }),
          error: 'Missing valid phone number for follow-up',
        });
        continue;
      }

      const landingPageUrl = `${PUBLIC_WEB_URL.replace(/\/$/, '')}/demo/${lead._id}`;
      const variant = campaignLead.messageVariant === 'B' ? 'B' : 'A';
      const followUpMessage = (stage === 1 ? campaignLead.followUpMessage : campaignLead.followUp2Message)
        ?? await generateFollowUpMessage(lead, landingPageUrl, variant);

      await sendWhatsAppMessage(whatsappId, followUpMessage);

      lead.lastContactedAt = new Date();
      await lead.save();

      await CampaignLead.findByIdAndUpdate(campaignLead._id, {
        ...(stage === 1
          ? {
              followUpStatus: 'sent',
              followUpMessage,
              followUpAttemptCount: (campaignLead.followUpAttemptCount ?? 0) + 1,
            }
          : {
              followUp2Status: 'sent',
              followUp2Message: followUpMessage,
              followUp2AttemptCount: (campaignLead.followUp2AttemptCount ?? 0) + 1,
            }),
        lastContactedAt: lead.lastContactedAt,
        error: undefined,
      });

      processed += 1;
      logger.info(`Follow-up sent to ${whatsappId} (${lead.businessName ?? lead.fullName})`);
    } catch (error: any) {
      await CampaignLead.findByIdAndUpdate(campaignLead._id, {
        ...(stage === 1 ? { followUpStatus: 'failed' } : { followUp2Status: 'failed' }),
        error: error.message,
        ...(stage === 1
          ? { followUpAttemptCount: (campaignLead.followUpAttemptCount ?? 0) + 1 }
          : { followUp2AttemptCount: (campaignLead.followUp2AttemptCount ?? 0) + 1 }),
      });
      logger.error(`Follow-up failed for ${campaignLead._id}: ${error.message}`);
    }
  }

  return processed;
};

export const processDueFollowUps = async (batchSize = 10) => {
  const first = await processFollowUpStage(1, batchSize);
  const second = await processFollowUpStage(2, batchSize);
  return first + second;
};
