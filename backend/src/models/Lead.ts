import mongoose, { Document, Schema } from 'mongoose';

// Lead Statuses
export const LEAD_STATUSES = ['new', 'contacted', 'interested', 'qualified', 'won', 'lost'] as const;
export type LeadStatus = typeof LEAD_STATUSES[number];

// Lead Sources
export const LEAD_SOURCES = [
  'google_maps',
  'csv_import',
  'excel_import',
  'manual',
  'justdial',
  'indiamart',
  'other',
] as const;
export type LeadSource = typeof LEAD_SOURCES[number];

export interface ILead extends Document {
  // Contact Info
  fullName: string;
  email?: string;
  phone?: string;
  alternatePhone?: string;

  // Business Info
  businessName?: string;
  website?: string;
  category?: string;
  rating?: number;
  reviewCount?: number;
  priceLevel?: string;
  description?: string;
  openingHours?: string[];
  attributes?: string[];

  // Location
  address?: string;
  city?: string;
  state?: string;
  country?: string;

  // Lead Metadata
  source: LeadSource;
  status: LeadStatus;
  isHotLead: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';

  // Notes & Tags
  tags: string[];
  notes: string;
  lastNote?: string;

  // Tracking
  lastContactedAt?: Date;
  nextFollowUpAt?: Date;

  // AI Analysis
  aiScore?: number;
  aiPotential?: string;
  aiJustification?: string;
  aiRecommendedServices?: string[];
  aiOutreachAngle?: string;
  aiFollowUpMessage?: string;
  aiConversionProbability?: number;
  aiPainPoints?: string[];
  aiIdealSolution?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const LeadSchema = new Schema<ILead>(
  {
    // Contact Info
    fullName: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true, index: true },
    phone: { type: String, trim: true, index: true },
    alternatePhone: { type: String, trim: true },

    // Business Info
    businessName: { type: String, trim: true },
    website: { type: String, trim: true },
    category: { type: String, trim: true },
    rating: { type: Number },
    reviewCount: { type: Number },
    priceLevel: { type: String },
    description: { type: String },
    openingHours: [{ type: String }],
    attributes: [{ type: String }],

    // Location
    address: { type: String },
    city: { type: String, index: true },
    state: { type: String },
    country: { type: String, index: true },

    // Lead Metadata
    source: { type: String, enum: LEAD_SOURCES, default: 'manual', index: true },
    status: { type: String, enum: LEAD_STATUSES, default: 'new', index: true },
    isHotLead: { type: Boolean, default: false, index: true },
    priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },

    // Notes & Tags
    tags: [{ type: String, trim: true }],
    notes: { type: String, default: '' },
    lastNote: { type: String },

    // Tracking
    lastContactedAt: { type: Date },
    nextFollowUpAt: { type: Date, index: true },

    // AI Analysis
    aiScore: { type: Number },
    aiPotential: { type: String },
    aiJustification: { type: String },
    aiRecommendedServices: [{ type: String }],
    aiOutreachAngle: { type: String },
    aiFollowUpMessage: { type: String },
    aiConversionProbability: { type: Number },
    aiPainPoints: [{ type: String }],
    aiIdealSolution: { type: String },
  },
  {
    timestamps: true,
  }
);

// Indexes
LeadSchema.index({ status: 1, createdAt: -1 });
LeadSchema.index({ source: 1, createdAt: -1 });
LeadSchema.index({ isHotLead: 1, status: 1 });
LeadSchema.index({ fullName: 'text', businessName: 'text', email: 'text' });

// Mark as hot lead if high rating and has phone
LeadSchema.pre('save', function () {
  if (this.isNew && this.rating && this.rating >= 4.0 && this.phone) {
    this.isHotLead = true;
    this.priority = 'high';
  }
});

export const Lead = mongoose.model<ILead>('Lead', LeadSchema);
