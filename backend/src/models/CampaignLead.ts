import mongoose, { Document, Schema, Types } from 'mongoose';
import { MESSAGE_STATUSES, MessageStatus } from './Lead';

export interface ICampaignLead extends Document {
  campaignId: Types.ObjectId;
  leadId: Types.ObjectId;
  messageStatus: MessageStatus;
  messageText?: string;
  messageVariant?: 'A' | 'B';
  heroImagePath?: string;
  lastContactedAt?: Date;
  attemptCount: number;
  responseStatus?: 'none' | 'replied';
  responseAt?: Date;
  followUpStatus?: MessageStatus;
  followUpMessage?: string;
  followUpAt?: Date;
  followUpAttemptCount?: number;
  followUp2Status?: MessageStatus;
  followUp2Message?: string;
  followUp2At?: Date;
  followUp2AttemptCount?: number;
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
    messageVariant: { type: String, enum: ['A', 'B'], default: 'A', index: true },
    heroImagePath: { type: String },
    lastContactedAt: { type: Date },
    attemptCount: { type: Number, default: 0 },
    responseStatus: { type: String, enum: ['none', 'replied'], default: 'none', index: true },
    responseAt: { type: Date },
    followUpStatus: { type: String, enum: MESSAGE_STATUSES, default: 'pending', index: true },
    followUpMessage: { type: String },
    followUpAt: { type: Date, index: true },
    followUpAttemptCount: { type: Number, default: 0 },
    followUp2Status: { type: String, enum: MESSAGE_STATUSES, default: 'pending', index: true },
    followUp2Message: { type: String },
    followUp2At: { type: Date, index: true },
    followUp2AttemptCount: { type: Number, default: 0 },
    error: { type: String },
  },
  { timestamps: true }
);

CampaignLeadSchema.index({ campaignId: 1, leadId: 1 }, { unique: true });
CampaignLeadSchema.index({ messageStatus: 1, updatedAt: -1 });
CampaignLeadSchema.index({ followUpStatus: 1, followUpAt: 1 });
CampaignLeadSchema.index({ followUp2Status: 1, followUp2At: 1 });
CampaignLeadSchema.index({ messageVariant: 1, responseStatus: 1 });

export const CampaignLead = mongoose.model<ICampaignLead>('CampaignLead', CampaignLeadSchema);
