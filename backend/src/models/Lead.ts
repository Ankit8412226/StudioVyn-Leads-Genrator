import mongoose, { Document, Schema } from 'mongoose';

// Lead Statuses
export const LEAD_STATUSES = ['new', 'contacted', 'interested', 'qualified', 'won', 'lost'] as const;
export type LeadStatus = typeof LEAD_STATUSES[number];

// Message Statuses
export const MESSAGE_STATUSES = ['pending', 'sent', 'failed'] as const;
export type MessageStatus = typeof MESSAGE_STATUSES[number];
export const RESPONSE_STATUSES = ['none', 'replied'] as const;
export type ResponseStatus = typeof RESPONSE_STATUSES[number];

// Lead Sources
export const LEAD_SOURCES = [
  'google_maps',
  'csv_import',
  'excel_import',
  'manual',
  'justdial',
  'indiamart',
  'yelp',
  'other',
] as const;
export type LeadSource = typeof LEAD_SOURCES[number];

// Qualification Status
export const QUALIFICATION_STATUSES = ['HOT', 'WARM', 'COLD'] as const;
export type QualificationStatus = typeof QUALIFICATION_STATUSES[number];

// Validation Status
export const VALIDATION_VALUES = ['valid', 'invalid', 'missing', 'suspicious'] as const;
export type ValidationValue = typeof VALIDATION_VALUES[number];

export interface IWebsiteAnalysis {
  mobileResponsiveness: string;
  uiQuality: string;
  uxQuality: string;
  designModernity: string;
  loadingSpeed: string;
  seoReadiness: string;
  technicalSeo: string;
  securitySignals: string;
  ctaEffectiveness: string;
  trustSignals: string;
  conversionPotential: string;
  detectedIssues: string[];
  overallGrade: string;
}

export interface IEstimatedProjectValue {
  websiteDevelopment?: string;
  seo?: string;
  branding?: string;
  automation?: string;
  aiIntegration?: string;
  totalMin?: number;
  totalMax?: number;
  currency: string;
}

export interface IValidation {
  email: ValidationValue;
  phone: ValidationValue;
  website: ValidationValue;
  overallValid: boolean;
}

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
  industry?: string;
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
  messageStatus?: MessageStatus;
  attemptCount?: number;
  responseStatus?: ResponseStatus;
  respondedAt?: Date;
  lastInboundAt?: Date;

  // AI Analysis (Legacy — from Fireworks)
  aiScore?: number;
  aiPotential?: string;
  aiJustification?: string;
  aiRecommendedServices?: string[];
  aiOutreachAngle?: string;
  aiFollowUpMessage?: string;
  aiConversionProbability?: number;
  aiPainPoints?: string[];
  aiIdealSolution?: string;
  aiLandingHeadline?: string;
  aiLandingSubhead?: string;
  aiLandingBullets?: string[];
  aiLandingCta?: string;
  heroImagePath?: string;

  // === NEW: Gemini AI Enrichment (Phase 2) ===
  aiSummary?: string;
  aiOpportunityReport?: string;
  aiRecommendations?: string[];
  aiConfidenceScore?: number;

  // === NEW: Website Analysis (Phase 3) ===
  websiteAnalysis?: IWebsiteAnalysis;

  // === NEW: Lead Qualification (Phase 4) ===
  leadScore?: number;
  agencyFitScore?: number;
  opportunityScore?: number;
  confidenceScore?: number;
  qualificationStatus?: QualificationStatus;

  // === NEW: Project Value Estimation (Phase 5) ===
  estimatedProjectValue?: IEstimatedProjectValue;

  // === NEW: Sales Insights (Phase 6) ===
  outreachSummary?: string;
  recommendedPitch?: string;
  painPointsDetailed?: string[];
  serviceRecommendations?: string[];
  whyValuable?: string;

  // === NEW: Data Validation (Phase 7) ===
  validation?: IValidation;

  // === NEW: Raw Data Preservation ===
  rawExtractedData?: Record<string, any>;

  // === NEW: Enrichment Tracking ===
  enrichedAt?: Date;
  enrichmentVersion?: number;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const WebsiteAnalysisSchema = new Schema<IWebsiteAnalysis>(
  {
    mobileResponsiveness: { type: String, default: 'unknown' },
    uiQuality: { type: String, default: 'unknown' },
    uxQuality: { type: String, default: 'unknown' },
    designModernity: { type: String, default: 'unknown' },
    loadingSpeed: { type: String, default: 'unknown' },
    seoReadiness: { type: String, default: 'unknown' },
    technicalSeo: { type: String, default: 'unknown' },
    securitySignals: { type: String, default: 'unknown' },
    ctaEffectiveness: { type: String, default: 'unknown' },
    trustSignals: { type: String, default: 'unknown' },
    conversionPotential: { type: String, default: 'unknown' },
    detectedIssues: [{ type: String }],
    overallGrade: { type: String, default: 'N/A' },
  },
  { _id: false }
);

const EstimatedProjectValueSchema = new Schema<IEstimatedProjectValue>(
  {
    websiteDevelopment: { type: String },
    seo: { type: String },
    branding: { type: String },
    automation: { type: String },
    aiIntegration: { type: String },
    totalMin: { type: Number },
    totalMax: { type: Number },
    currency: { type: String, default: 'INR' },
  },
  { _id: false }
);

const ValidationSchema = new Schema<IValidation>(
  {
    email: { type: String, enum: VALIDATION_VALUES, default: 'missing' },
    phone: { type: String, enum: VALIDATION_VALUES, default: 'missing' },
    website: { type: String, enum: VALIDATION_VALUES, default: 'missing' },
    overallValid: { type: Boolean, default: false },
  },
  { _id: false }
);

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
    industry: { type: String, trim: true },
    rating: { type: Number },
    reviewCount: { type: Number },
    priceLevel: { type: String },
    description: { type: String },
    openingHours: [{ type: String }],
    attributes: [{ type: String }],

    // Location
    address: { type: String },
    city: { type: String, index: true },
    state: { type: String, index: true },
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
    lastContactedAt: { type: Date, alias: 'last_contacted_at' },
    nextFollowUpAt: { type: Date, index: true },
    messageStatus: { type: String, enum: MESSAGE_STATUSES, default: 'pending', index: true, alias: 'message_status' },
    attemptCount: { type: Number, default: 0, alias: 'attempt_count' },
    responseStatus: { type: String, enum: RESPONSE_STATUSES, default: 'none', index: true },
    respondedAt: { type: Date },
    lastInboundAt: { type: Date },

    // AI Analysis (Legacy — from Fireworks)
    aiScore: { type: Number },
    aiPotential: { type: String },
    aiJustification: { type: String },
    aiRecommendedServices: [{ type: String }],
    aiOutreachAngle: { type: String },
    aiFollowUpMessage: { type: String },
    aiConversionProbability: { type: Number },
    aiPainPoints: [{ type: String }],
    aiIdealSolution: { type: String },
    aiLandingHeadline: { type: String },
    aiLandingSubhead: { type: String },
    aiLandingBullets: [{ type: String }],
    aiLandingCta: { type: String },
    heroImagePath: { type: String },

    // === NEW: Gemini AI Enrichment ===
    aiSummary: { type: String },
    aiOpportunityReport: { type: String },
    aiRecommendations: [{ type: String }],
    aiConfidenceScore: { type: Number },

    // === NEW: Website Analysis ===
    websiteAnalysis: { type: WebsiteAnalysisSchema },

    // === NEW: Lead Qualification ===
    leadScore: { type: Number, index: true },
    agencyFitScore: { type: Number, index: true },
    opportunityScore: { type: Number, index: true },
    confidenceScore: { type: Number },
    qualificationStatus: { type: String, enum: QUALIFICATION_STATUSES, index: true },

    // === NEW: Project Value Estimation ===
    estimatedProjectValue: { type: EstimatedProjectValueSchema },

    // === NEW: Sales Insights ===
    outreachSummary: { type: String },
    recommendedPitch: { type: String },
    painPointsDetailed: [{ type: String }],
    serviceRecommendations: [{ type: String }],
    whyValuable: { type: String },

    // === NEW: Data Validation ===
    validation: { type: ValidationSchema },

    // === NEW: Raw Data Preservation ===
    rawExtractedData: { type: Schema.Types.Mixed },

    // === NEW: Enrichment Tracking ===
    enrichedAt: { type: Date },
    enrichmentVersion: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

// === Existing Indexes (Preserved) ===
LeadSchema.index({ status: 1, createdAt: -1 });
LeadSchema.index({ source: 1, createdAt: -1 });
LeadSchema.index({ isHotLead: 1, status: 1 });
LeadSchema.index({ messageStatus: 1, lastContactedAt: -1 });
LeadSchema.index({ fullName: 'text', businessName: 'text', email: 'text' });

// === NEW: Performance Indexes ===
LeadSchema.index({ leadScore: -1, createdAt: -1 });
LeadSchema.index({ qualificationStatus: 1, createdAt: -1 });
LeadSchema.index({ agencyFitScore: -1 });
LeadSchema.index({ 'estimatedProjectValue.totalMax': -1 });
LeadSchema.index({ industry: 1, createdAt: -1 });
LeadSchema.index({ enrichedAt: 1 });

// Mark as hot lead if high rating and has phone
LeadSchema.pre('save', function () {
  if (this.isNew && this.rating && this.rating >= 4.0 && this.phone) {
    this.isHotLead = true;
    this.priority = 'high';
  }
});

export const Lead = mongoose.model<ILead>('Lead', LeadSchema);
