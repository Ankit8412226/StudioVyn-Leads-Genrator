import { Types } from 'mongoose';
import { Campaign } from '../models/Campaign';
import { CampaignLead } from '../models/CampaignLead';
import { Lead } from '../models/Lead';
import { messageQueue } from './messageQueue';
import { logger } from '../utils/logger';

export const createCampaign = async (name: string) => {
  const campaign = new Campaign({ name });
  await campaign.save();
  return campaign;
};

export const addLeadsToCampaign = async (campaignId: string, leadIds: string[]) => {
  if (!Types.ObjectId.isValid(campaignId)) {
    throw new Error('Invalid campaign id');
  }

  const campaignObjectId = new Types.ObjectId(campaignId);
  const validLeadIds = leadIds
    .filter((id) => Types.ObjectId.isValid(id))
    .map((id) => new Types.ObjectId(id));

  const leads = await Lead.find({ _id: { $in: validLeadIds } }).select('_id').lean();
  const leadIdSet = new Set(leads.map((lead) => lead._id.toString()));

  const operations = leadIds
    .filter((id) => leadIdSet.has(id))
    .map((leadId) => ({
      updateOne: {
        filter: { campaignId: campaignObjectId, leadId: new Types.ObjectId(leadId) },
        update: { $setOnInsert: { campaignId: campaignObjectId, leadId: new Types.ObjectId(leadId) } },
        upsert: true,
      },
    }));

  if (operations.length > 0) {
    await CampaignLead.bulkWrite(operations, { ordered: false });
  }

  return { added: operations.length, requested: leadIds.length };
};

export const enqueueCampaignLeads = async (campaignId: string, includeImage: boolean) => {
  if (!Types.ObjectId.isValid(campaignId)) {
    throw new Error('Invalid campaign id');
  }

  const pendingLeads = await CampaignLead.find({ campaignId, messageStatus: 'pending' })
    .select('_id')
    .lean();

  for (const lead of pendingLeads) {
    await messageQueue.add({ campaignLeadId: lead._id.toString(), includeImage });
  }

  logger.info(`Enqueued ${pendingLeads.length} campaign leads for campaign ${campaignId}`);
  return pendingLeads.length;
};
