/**
 * Gemini AI Service — Handles all AI enrichment via Google Gemini
 * Replaces Fireworks for new enrichment; Fireworks kept for legacy fields.
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ILead } from '../models/Lead';
import { logger } from '../utils/logger';
import { delay } from '../utils/delay';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? '';
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';
const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [2000, 5000, 10000];
const TIMEOUT_MS = 30000;

let genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!genAI) {
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured');
    }
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  }
  return genAI;
}

function parseJsonSafe(content: string): any | null {
  try {
    return JSON.parse(content);
  } catch {
    try {
      const match = content.match(/```json\s*([\s\S]*?)\s*```/);
      if (match) return JSON.parse(match[1]);
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
    } catch {
      return null;
    }
  }
  return null;
}

async function callGemini(prompt: string, systemInstruction: string): Promise<any> {
  const ai = getGenAI();
  const model = ai.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json',
    },
  });

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

      try {
        const result = await model.generateContent(prompt);
        clearTimeout(timeout);
        const text = result.response.text();
        const parsed = parseJsonSafe(text);
        if (!parsed) {
          throw new Error(`Gemini returned invalid JSON: ${text.substring(0, 200)}`);
        }
        return parsed;
      } finally {
        clearTimeout(timeout);
      }
    } catch (err: any) {
      lastError = err;
      logger.error(`Gemini attempt ${attempt + 1}/${MAX_RETRIES + 1} failed: ${err.message}`);

      if (attempt < MAX_RETRIES) {
        await delay(RETRY_DELAYS_MS[attempt]);
      }
    }
  }

  throw lastError || new Error('Gemini call failed after all retries');
}

// ================================================================
// LEAD ENRICHMENT (Phase 2)
// ================================================================

export interface GeminiEnrichmentResult {
  aiSummary: string;
  aiOpportunityReport: string;
  aiRecommendations: string[];
  aiConfidenceScore: number;
  businessQuality: string;
  growthPotential: string;
  digitalPresence: string;
  serviceOpportunity: string;
  revenuePotential: string;
  agencyFit: string;
}

export async function enrichLeadWithGemini(lead: ILead): Promise<GeminiEnrichmentResult> {
  const businessName = lead.businessName || lead.fullName || 'Unknown Business';
  const category = lead.category || lead.industry || 'local business';

  const prompt = `Analyze this business lead for a digital agency:

Business Name: ${businessName}
Category: ${category}
City: ${lead.city ?? 'N/A'}
State: ${lead.state ?? 'N/A'}
Country: ${lead.country ?? 'India'}
Rating: ${lead.rating ?? 'N/A'}
Review Count: ${lead.reviewCount ?? 'N/A'}
Website: ${lead.website || 'NONE - No website'}
Phone: ${lead.phone ? 'Yes' : 'No'}
Email: ${lead.email ? 'Yes' : 'No'}
Description: ${lead.description || 'N/A'}
Address: ${lead.address || 'N/A'}

Return JSON with these exact keys:
{
  "ai_summary": "2-3 sentence business summary and digital readiness assessment",
  "opportunity_report": "Detailed analysis of why this is a good/bad lead for a web development agency",
  "recommendations": ["array of 3-5 specific actionable recommendations"],
  "confidence_score": 0-100,
  "business_quality": "poor/fair/good/excellent",
  "growth_potential": "low/medium/high/very_high",
  "digital_presence": "none/minimal/moderate/strong",
  "service_opportunity": "low/medium/high/very_high",
  "revenue_potential": "low/medium/high/very_high",
  "agency_fit": "poor/fair/good/excellent"
}`;

  const systemInstruction = 'You are a senior digital marketing analyst evaluating business leads for a web development and digital marketing agency in India. Be specific, data-driven, and actionable. Output valid JSON only.';

  const result = await callGemini(prompt, systemInstruction);

  return {
    aiSummary: result.ai_summary || `${businessName} is a ${category} business.`,
    aiOpportunityReport: result.opportunity_report || 'Analysis pending.',
    aiRecommendations: Array.isArray(result.recommendations) ? result.recommendations : [],
    aiConfidenceScore: typeof result.confidence_score === 'number' ? Math.min(100, Math.max(0, result.confidence_score)) : 50,
    businessQuality: result.business_quality || 'fair',
    growthPotential: result.growth_potential || 'medium',
    digitalPresence: result.digital_presence || 'minimal',
    serviceOpportunity: result.service_opportunity || 'medium',
    revenuePotential: result.revenue_potential || 'medium',
    agencyFit: result.agency_fit || 'fair',
  };
}

// ================================================================
// WEBSITE ANALYSIS (Phase 3) — via Gemini
// ================================================================

export interface WebsiteAnalysisResult {
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

export async function analyzeWebsiteWithGemini(
  websiteUrl: string,
  businessName: string,
  category: string
): Promise<WebsiteAnalysisResult> {
  const prompt = `Analyze this business website for a web development agency evaluating redesign opportunities:

Website URL: ${websiteUrl}
Business Name: ${businessName}
Category: ${category}

Based on the URL and business type, provide your best assessment. Return JSON with these exact keys:
{
  "mobile_responsiveness": "poor/fair/good/excellent",
  "ui_quality": "poor/fair/good/excellent",
  "ux_quality": "poor/fair/good/excellent",
  "design_modernity": "outdated/dated/modern/cutting_edge",
  "loading_speed": "slow/average/fast/excellent",
  "seo_readiness": "poor/fair/good/excellent",
  "technical_seo": "poor/fair/good/excellent",
  "security_signals": "none/basic/good/excellent",
  "cta_effectiveness": "poor/fair/good/excellent",
  "trust_signals": "poor/fair/good/excellent",
  "conversion_potential": "low/medium/high/very_high",
  "detected_issues": ["array of detected issues from: website_broken, outdated_website, redesign_needed, seo_opportunity, performance_opportunity, branding_opportunity, automation_opportunity, missing_ssl, no_mobile_optimization, weak_cta, no_social_proof"],
  "overall_grade": "A/B/C/D/F"
}`;

  const systemInstruction = 'You are a senior web developer and UX expert auditing websites for a web agency. Be honest and specific about issues. Output valid JSON only.';

  const result = await callGemini(prompt, systemInstruction);

  return {
    mobileResponsiveness: result.mobile_responsiveness || 'unknown',
    uiQuality: result.ui_quality || 'unknown',
    uxQuality: result.ux_quality || 'unknown',
    designModernity: result.design_modernity || 'unknown',
    loadingSpeed: result.loading_speed || 'unknown',
    seoReadiness: result.seo_readiness || 'unknown',
    technicalSeo: result.technical_seo || 'unknown',
    securitySignals: result.security_signals || 'unknown',
    ctaEffectiveness: result.cta_effectiveness || 'unknown',
    trustSignals: result.trust_signals || 'unknown',
    conversionPotential: result.conversion_potential || 'unknown',
    detectedIssues: Array.isArray(result.detected_issues) ? result.detected_issues : [],
    overallGrade: result.overall_grade || 'N/A',
  };
}

// ================================================================
// SALES INSIGHTS (Phase 6)
// ================================================================

export interface SalesInsightsResult {
  outreachSummary: string;
  recommendedPitch: string;
  painPointsDetailed: string[];
  serviceRecommendations: string[];
  whyValuable: string;
}

export async function generateSalesInsights(lead: ILead): Promise<SalesInsightsResult> {
  const businessName = lead.businessName || lead.fullName || 'Unknown Business';
  const category = lead.category || lead.industry || 'local business';

  const prompt = `Generate sales outreach insights for this business lead:

Business Name: ${businessName}
Category: ${category}
City: ${lead.city ?? 'N/A'}
Rating: ${lead.rating ?? 'N/A'} (${lead.reviewCount ?? 0} reviews)
Website: ${lead.website || 'NO WEBSITE'}
Phone: ${lead.phone ? 'Available' : 'Not available'}
Lead Score: ${lead.leadScore ?? 'Not scored'}
Website Issues: ${lead.websiteAnalysis?.detectedIssues?.join(', ') || 'N/A'}

Return JSON:
{
  "outreach_summary": "2-3 sentence summary of why to contact this business and what to pitch",
  "recommended_pitch": "Specific pitch script/approach for the sales team",
  "pain_points": ["3-5 specific pain points this business likely experiences"],
  "service_recommendations": ["Ordered list of 3-5 services to pitch"],
  "why_valuable": "1-2 sentences on why this lead is valuable for the agency"
}`;

  const systemInstruction = 'You are a senior sales strategist for a web development agency in India. Generate specific, actionable sales insights. Use Indian Rupee (₹) for pricing references. Output valid JSON only.';

  const result = await callGemini(prompt, systemInstruction);

  return {
    outreachSummary: result.outreach_summary || `${businessName} is a potential lead for digital services.`,
    recommendedPitch: result.recommended_pitch || 'Propose a website and digital presence upgrade.',
    painPointsDetailed: Array.isArray(result.pain_points) ? result.pain_points : [],
    serviceRecommendations: Array.isArray(result.service_recommendations) ? result.service_recommendations : [],
    whyValuable: result.why_valuable || 'This business can benefit from improved digital presence.',
  };
}

// ================================================================
// PROJECT VALUE ESTIMATION (Phase 5)
// ================================================================

export interface ProjectValueResult {
  websiteDevelopment: string;
  seo: string;
  branding: string;
  automation: string;
  aiIntegration: string;
  totalMin: number;
  totalMax: number;
  currency: string;
}

export async function estimateProjectValue(lead: ILead): Promise<ProjectValueResult> {
  const businessName = lead.businessName || lead.fullName || 'Unknown Business';
  const category = lead.category || lead.industry || 'local business';

  const prompt = `Estimate project values for services this business might need (Indian Rupee ₹):

Business Name: ${businessName}
Category: ${category}
City: ${lead.city ?? 'N/A'}
Rating: ${lead.rating ?? 'N/A'}
Current Website: ${lead.website || 'NONE'}
Website Grade: ${lead.websiteAnalysis?.overallGrade || 'N/A'}
Digital Presence: ${lead.aiSummary || 'Unknown'}

Return JSON with value estimates:
{
  "website_development": "₹X - ₹Y",
  "seo": "₹X - ₹Y",
  "branding": "₹X - ₹Y",
  "automation": "₹X - ₹Y",
  "ai_integration": "₹X - ₹Y",
  "total_min": 15000,
  "total_max": 200000,
  "currency": "INR"
}

Value tiers:
- Small/Simple: ₹15,000 - ₹30,000
- Medium: ₹30,000 - ₹75,000
- Large: ₹75,000 - ₹2,00,000
- Enterprise: ₹2,00,000+`;

  const systemInstruction = 'You are a project estimator for a digital agency in India. Provide realistic Indian market price estimates in Rupees. Output valid JSON only.';

  const result = await callGemini(prompt, systemInstruction);

  return {
    websiteDevelopment: result.website_development || '₹15,000 - ₹30,000',
    seo: result.seo || '₹10,000 - ₹25,000',
    branding: result.branding || '₹10,000 - ₹20,000',
    automation: result.automation || '₹15,000 - ₹40,000',
    aiIntegration: result.ai_integration || '₹20,000 - ₹50,000',
    totalMin: typeof result.total_min === 'number' ? result.total_min : 15000,
    totalMax: typeof result.total_max === 'number' ? result.total_max : 75000,
    currency: 'INR',
  };
}

export function isGeminiAvailable(): boolean {
  return !!GEMINI_API_KEY;
}
