import mongoose, { Document, Schema, Types } from 'mongoose';
import { MESSAGE_STATUSES, MessageStatus } from './Lead';

export interface ICampaignLead extends Document {
  campaignId: Types.ObjectId;
  leadId: Types.ObjectId;
  messageStatus: MessageStatus;
  messageText?: string;
  heroImagePath?: string;
  lastContactedAt?: Date;
  attemptCount: number;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CampaignLeadSchema = new Schema<ICampaignLead>(
  {
    campaignId: { type: Schema.Types.ObjectId, ref: 'Campaign', required: true, index: true },
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
    messageStatus: { type: String, enum: MESSAGE_STATUSES, default: 'pending', index: true },
    messageText: { type: String },
    heroImagePath: { type: String },
    lastContactedAt: { type: Date },
    attemptCount: { type: Number, default: 0 },
    error: { type: String },
  },
  { timestamps: true }
);

CampaignLeadSchema.index({ campaignId: 1, leadId: 1 }, { unique: true });
CampaignLeadSchema.index({ messageStatus: 1, updatedAt: -1 });

export const CampaignLead = mongoose.model<ICampaignLead>('CampaignLead', CampaignLeadSchema);
