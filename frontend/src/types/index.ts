// API Types for Lead Management System

// Lead Types
export interface Lead {
  _id: string;
  tenantId: string;
  fullName: string;
  email?: string;
  phone?: string;
  alternatePhone?: string;
  businessName?: string;
  website?: string;
  industry?: string;
  category?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  source: {
    platform: LeadSourcePlatform;
    campaign?: string;
    channel?: string;
    referrer?: string;
    scraperJobId?: string;
  };
  leadType: 'inbound' | 'outbound';
  status: LeadStatus;
  priority: Priority;
  assignedTo?: User;
  team?: string;
  tags: string[];
  notes: Note[];
  activities: Activity[];
  socialLinks?: {
    linkedin?: string;
    instagram?: string;
    facebook?: string;
    twitter?: string;
    youtube?: string;
  };
  enrichmentData?: {
    companySize?: string;
    revenue?: string;
    foundedYear?: number;
    technologies?: string[];
    description?: string;
    employees?: number;
    enrichedAt?: string;
    enrichmentSource?: string;
  };
  fingerprint: string;
  duplicateOf?: string;
  mergedFrom?: string[];
  isDuplicate: boolean;
  lastContactedAt?: string;
  nextFollowUpAt?: string;
  conversionValue?: number;
  customFields?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'interested'
  | 'qualified'
  | 'proposal'
  | 'negotiation'
  | 'won'
  | 'lost'
  | 'unqualified';

export type LeadSourcePlatform =
  | 'google_maps'
  | 'instagram'
  | 'facebook'
  | 'linkedin'
  | 'twitter'
  | 'whatsapp'
  | 'telegram'
  | 'email'
  | 'website_form'
  | 'landing_page'
  | 'chat_widget'
  | 'webhook'
  | 'facebook_lead_form'
  | 'google_lead_form'
  | 'csv_import'
  | 'excel_import'
  | 'manual'
  | 'justdial'
  | 'indiamart'
  | 'yelp'
  | 'clutch'
  | 'other';

export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export interface Note {
  _id?: string;
  content: string;
  createdBy: User;
  createdAt: string;
}

export interface Activity {
  _id?: string;
  type: ActivityType;
  description: string;
  outcome?: string;
  metadata?: Record<string, any>;
  createdBy: User;
  createdAt: string;
}

export type ActivityType =
  | 'call'
  | 'email'
  | 'whatsapp'
  | 'meeting'
  | 'note'
  | 'status_change'
  | 'assignment'
  | 'tag_added'
  | 'tag_removed'
  | 'created'
  | 'imported'
  | 'enriched'
  | 'merged';

// User Types
export interface User {
  _id: string;
  tenantId: string;
  email: string;
  profile: {
    firstName: string;
    lastName: string;
    avatar?: string;
    phone?: string;
    jobTitle?: string;
  };
  role: UserRole;
  permissions: string[];
  settings?: {
    theme: 'light' | 'dark' | 'system';
    notifications: {
      email: boolean;
      push: boolean;
      leadAssigned: boolean;
      leadUpdated: boolean;
      dailyDigest: boolean;
    };
    timezone: string;
    language: string;
  };
  lastLoginAt?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type UserRole = 'admin' | 'manager' | 'agent' | 'viewer';

// Tenant Types
export interface Tenant {
  _id: string;
  name: string;
  slug: string;
  subscription: {
    plan: 'free' | 'starter' | 'pro' | 'enterprise';
    status: 'active' | 'past_due' | 'canceled' | 'trialing';
    leadLimit: number;
    userLimit: number;
    scraperJobsLimit: number;
    startedAt: string;
    expiresAt?: string;
  };
  settings: {
    branding: {
      logo?: string;
      primaryColor?: string;
      companyName?: string;
    };
    pipelineStages: PipelineStage[];
    customFields: CustomField[];
    defaultLeadStatus: string;
    defaultLeadAssignment: 'round_robin' | 'manual' | 'none';
    deduplicationEnabled: boolean;
    autoEnrichmentEnabled: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface PipelineStage {
  id: string;
  name: string;
  color: string;
  order: number;
  isDefault?: boolean;
  isWon?: boolean;
  isLost?: boolean;
}

export interface CustomField {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'checkbox';
  options?: string[];
  required?: boolean;
  order: number;
}

// Scraper Types
export interface ScraperJob {
  _id: string;
  tenantId: string;
  type: ScraperType;
  name: string;
  config: {
    query: string;
    location?: string;
    limit: number;
    filters?: Record<string, any>;
  };
  status: JobStatus;
  progress: {
    total: number;
    processed: number;
    failed: number;
    currentPage?: number;
  };
  results: {
    leadsCreated: number;
    duplicatesFound: number;
    errors: string[];
    sampleLeads?: Array<{
      name: string;
      phone?: string;
      email?: string;
    }>;
  };
  error?: string;
  startedAt?: string;
  completedAt?: string;
  createdBy: User;
  createdAt: string;
}

export type ScraperType = 'google_maps' | 'linkedin' | 'justdial' | 'indiamart' | 'yelp' | 'clutch' | 'custom';
export type JobStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

// Analytics Types
export interface AnalyticsOverview {
  overview: {
    totalLeads: number;
    newLeads: number;
    todayLeads: number;
    weekLeads: number;
    monthLeads: number;
    conversionRate: number;
    totalValue: number;
  };
  statusBreakdown: Record<string, number>;
  sourceBreakdown: Array<{
    source: string;
    count: number;
  }>;
}

export interface PipelineData {
  stage: PipelineStage;
  leads: Lead[];
  count: number;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  details?: any[];
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: {
    items: T[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
      hasMore: boolean;
    };
  };
}

// Auth Types
export interface AuthData {
  user: User;
  tenant: Tenant;
  accessToken: string;
  refreshToken: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  companyName: string;
}
