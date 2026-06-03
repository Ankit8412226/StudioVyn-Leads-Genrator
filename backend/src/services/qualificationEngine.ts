/**
 * Lead Qualification Engine — Computes scores and qualification status (Phase 4)
 * Pure logic module — no AI calls.
 */
import { ILead, QualificationStatus } from '../models/Lead';
import { GeminiEnrichmentResult } from './geminiService';
import { ValidationResult, isValidForQualification } from './validationService';

export interface QualificationResult {
  leadScore: number;         // 0-100
  agencyFitScore: number;    // 0-100
  opportunityScore: number;  // 0-100
  confidenceScore: number;   // 0-100
  qualificationStatus: QualificationStatus;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

// ================================================================
// Quality string to numeric score mapping
// ================================================================
const QUALITY_SCORES: Record<string, number> = {
  'poor': 20, 'fair': 40, 'good': 65, 'excellent': 90,
  'none': 10, 'minimal': 30, 'moderate': 55, 'strong': 80,
  'low': 25, 'medium': 50, 'high': 75, 'very_high': 95,
  'outdated': 80, 'dated': 60, 'modern': 30, 'cutting_edge': 10,
  'slow': 80, 'average': 50, 'fast': 25,
};

function qualityToScore(value: string | undefined, fallback = 50): number {
  if (!value) return fallback;
  return QUALITY_SCORES[value.toLowerCase()] ?? fallback;
}

// Reverse mapping for website quality — lower quality = higher opportunity
function websiteQualityToOpportunity(grade: string | undefined): number {
  if (!grade) return 90; // No website = maximum opportunity
  const scores: Record<string, number> = { 'F': 95, 'D': 80, 'C': 60, 'B': 40, 'A': 20 };
  return scores[grade.toUpperCase()] ?? 70;
}

// ================================================================
// LEAD SCORE (Phase 4)
// Weighted combination of rating, reviews, contact completeness, etc.
// ================================================================
export function computeLeadScore(lead: ILead, validation?: ValidationResult): number {
  let score = 0;

  // Rating component (0-25 points)
  if (lead.rating) {
    score += Math.min(25, (lead.rating / 5) * 25);
  } else {
    score += 10; // Unknown rating = neutral
  }

  // Review count component (0-15 points)
  if (lead.reviewCount) {
    if (lead.reviewCount >= 100) score += 15;
    else if (lead.reviewCount >= 50) score += 12;
    else if (lead.reviewCount >= 20) score += 9;
    else if (lead.reviewCount >= 5) score += 6;
    else score += 3;
  }

  // Contact info completeness (0-20 points)
  if (validation) {
    if (validation.phone === 'valid') score += 10;
    if (validation.email === 'valid') score += 7;
    if (validation.phone === 'suspicious' || validation.email === 'suspicious') score += 3;
  } else {
    if (lead.phone) score += 8;
    if (lead.email) score += 5;
  }

  // Website absence = opportunity (0-15 points for agency selling web services)
  if (!lead.website) {
    score += 15; // No website = golden opportunity
  } else {
    // Has website but might be bad
    const grade = lead.websiteAnalysis?.overallGrade;
    if (grade === 'F' || grade === 'D') score += 12;
    else if (grade === 'C') score += 8;
    else score += 3;
  }

  // Business info completeness (0-10 points)
  if (lead.businessName) score += 3;
  if (lead.category || lead.industry) score += 3;
  if (lead.address || lead.city) score += 2;
  if (lead.description) score += 2;

  // AI confidence boost (0-15 points)
  if (lead.aiConfidenceScore) {
    score += Math.min(15, (lead.aiConfidenceScore / 100) * 15);
  }

  return Math.round(Math.min(100, Math.max(0, score)));
}

// ================================================================
// AGENCY FIT SCORE
// How well does this lead fit a web development agency?
// ================================================================
export function computeAgencyFitScore(
  lead: ILead,
  enrichment?: GeminiEnrichmentResult
): number {
  let score = 0;

  // No website = perfect fit (0-30 points)
  if (!lead.website) {
    score += 30;
  } else {
    const issues = lead.websiteAnalysis?.detectedIssues || [];
    score += Math.min(25, issues.length * 5);
  }

  // Enrichment data (0-30 points)
  if (enrichment) {
    score += qualityToScore(enrichment.agencyFit, 40) * 0.3;
  }

  // Industry alignment (0-15 points)
  const highValueIndustries = [
    'restaurant', 'hotel', 'healthcare', 'clinic', 'hospital',
    'education', 'gym', 'fitness', 'salon', 'spa', 'real estate',
    'construction', 'legal', 'law', 'dental', 'medical',
    'ecommerce', 'retail', 'manufacturing', 'consulting',
  ];
  const category = (lead.category || lead.industry || '').toLowerCase();
  if (highValueIndustries.some(ind => category.includes(ind))) {
    score += 15;
  } else {
    score += 8;
  }

  // Good rating with reviews = established business (0-15 points)
  if (lead.rating && lead.rating >= 4.0 && lead.reviewCount && lead.reviewCount >= 10) {
    score += 15;
  } else if (lead.rating && lead.rating >= 3.5) {
    score += 10;
  } else {
    score += 5;
  }

  // Has phone = reachable (0-10 points)
  if (lead.phone) score += 10;

  return Math.round(Math.min(100, Math.max(0, score)));
}

// ================================================================
// OPPORTUNITY SCORE
// How much opportunity does this lead represent?
// ================================================================
export function computeOpportunityScore(
  lead: ILead,
  enrichment?: GeminiEnrichmentResult
): number {
  let score = 0;

  // Website opportunity (0-35 points)
  if (!lead.website) {
    score += 35; // Maximum opportunity
  } else {
    score += websiteQualityToOpportunity(lead.websiteAnalysis?.overallGrade) * 0.35;
  }

  // Detected issues (0-25 points)
  const issues = lead.websiteAnalysis?.detectedIssues || [];
  if (!lead.website) {
    // No website = treat as all issues present
    score += 25;
  } else {
    score += Math.min(25, issues.length * 4);
  }

  // Growth potential (0-20 points)
  if (enrichment) {
    score += qualityToScore(enrichment.growthPotential, 50) * 0.2;
  } else {
    score += 10;
  }

  // Revenue potential (0-20 points)
  if (enrichment) {
    score += qualityToScore(enrichment.revenuePotential, 50) * 0.2;
  } else {
    score += 10;
  }

  return Math.round(Math.min(100, Math.max(0, score)));
}

// ================================================================
// QUALIFICATION STATUS
// ================================================================
export function determineQualificationStatus(leadScore: number): QualificationStatus {
  if (leadScore >= 80) return 'HOT';
  if (leadScore >= 50) return 'WARM';
  return 'COLD';
}

export function determinePriority(status: QualificationStatus): 'low' | 'medium' | 'high' | 'urgent' {
  switch (status) {
    case 'HOT': return 'high';
    case 'WARM': return 'medium';
    case 'COLD': return 'low';
  }
}

// ================================================================
// FULL QUALIFICATION
// ================================================================
export function qualifyLead(
  lead: ILead,
  enrichment?: GeminiEnrichmentResult,
  validation?: ValidationResult
): QualificationResult {
  // If validation fails hard, mark as cold
  if (validation && !isValidForQualification(validation)) {
    return {
      leadScore: 15,
      agencyFitScore: 10,
      opportunityScore: 10,
      confidenceScore: 20,
      qualificationStatus: 'COLD',
      priority: 'low',
    };
  }

  const leadScore = computeLeadScore(lead, validation);
  const agencyFitScore = computeAgencyFitScore(lead, enrichment);
  const opportunityScore = computeOpportunityScore(lead, enrichment);

  // Confidence is the average of all scores weighted by data availability
  const dataPoints = [
    lead.phone ? 1 : 0,
    lead.email ? 1 : 0,
    lead.rating ? 1 : 0,
    lead.businessName ? 1 : 0,
    lead.category ? 1 : 0,
    enrichment ? 1 : 0,
  ];
  const dataCompleteness = dataPoints.reduce((a, b) => a + b, 0) / dataPoints.length;
  const aiConfidence = enrichment?.aiConfidenceScore ?? 50;
  const confidenceScore = Math.round(dataCompleteness * 50 + (aiConfidence / 100) * 50);

  const qualificationStatus = determineQualificationStatus(leadScore);
  const priority = determinePriority(qualificationStatus);

  return {
    leadScore,
    agencyFitScore,
    opportunityScore,
    confidenceScore: Math.min(100, Math.max(0, confidenceScore)),
    qualificationStatus,
    priority,
  };
}
