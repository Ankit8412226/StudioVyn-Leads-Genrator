/**
 * Enrichment Pipeline Service — Orchestrates the full lead enrichment flow (Phase 8)
 */
import { ILead, Lead } from '../models/Lead';
import { logger } from '../utils/logger';
import { validateLeadData } from './validationService';
import { analyzeWebsite } from './websiteAnalyzer';
import {
  enrichLeadWithGemini,
  analyzeWebsiteWithGemini,
  generateSalesInsights,
  estimateProjectValue,
  isGeminiAvailable,
  GeminiEnrichmentResult,
  WebsiteAnalysisResult,
  SalesInsightsResult,
  ProjectValueResult
} from './geminiService';
import { qualifyLead } from './qualificationEngine';

/**
 * Main orchestration pipeline for lead enrichment.
 * Runs validation, Puppeteer-based website analysis, Gemini AI analysis, scoring, and saves to database.
 */
export async function enrichLeadPipeline(leadId: string): Promise<ILead | null> {
  logger.info(`🚀 Starting enrichment pipeline for Lead ID: ${leadId}`);
  
  const lead = await Lead.findById(leadId);
  if (!lead) {
    logger.error(`❌ Lead not found in database: ${leadId}`);
    return null;
  }

  try {
    // 1. Preserve original extracted data in rawExtractedData if not already set
    if (!lead.rawExtractedData) {
      // Create a shallow copy of lead fields for raw preservation
      const rawData: Record<string, any> = {};
      const fieldsToPreserve = [
        'fullName', 'email', 'phone', 'alternatePhone', 'businessName',
        'website', 'category', 'industry', 'rating', 'reviewCount',
        'priceLevel', 'description', 'address', 'city', 'state', 'country',
        'source', 'status', 'openingHours', 'attributes'
      ];
      for (const field of fieldsToPreserve) {
        if ((lead as any)[field] !== undefined) {
          rawData[field] = (lead as any)[field];
        }
      }
      lead.rawExtractedData = rawData;
    }

    // 2. Validate contact details
    const validationResult = validateLeadData({
      email: lead.email,
      phone: lead.phone,
      website: lead.website,
    });
    lead.validation = validationResult;

    // 3. Analyze website (if one exists and is valid/suspicious)
    let websiteRawReport = null;
    if (lead.website && (validationResult.website === 'valid' || validationResult.website === 'suspicious')) {
      try {
        websiteRawReport = await analyzeWebsite(lead.website);
      } catch (err: any) {
        logger.error(`Failed during Puppeteer website analysis for ${lead.website}: ${err.message}`);
      }
    }

    let geminiEnrichment: GeminiEnrichmentResult | undefined;
    let geminiWebsiteAnalysis: WebsiteAnalysisResult | undefined;
    let geminiSalesInsights: SalesInsightsResult | undefined;
    let geminiProjectValue: ProjectValueResult | undefined;

    // 4. Call Gemini if available
    if (isGeminiAvailable()) {
      try {
        logger.info(`✨ Calling Gemini for lead enrichment...`);
        geminiEnrichment = await enrichLeadWithGemini(lead);
        
        // Save enrichment results to lead
        lead.aiSummary = geminiEnrichment.aiSummary;
        lead.aiOpportunityReport = geminiEnrichment.aiOpportunityReport;
        lead.aiRecommendations = geminiEnrichment.aiRecommendations;
        lead.aiConfidenceScore = geminiEnrichment.aiConfidenceScore;

        // Run Gemini qualitative website analysis if website is present
        if (lead.website) {
          try {
            logger.info(`✨ Calling Gemini for website analysis audit...`);
            // Incorporate Puppeteer details into prompting by passing them, or let Gemini analyze
            const businessName = lead.businessName || lead.fullName || 'Unknown';
            const category = lead.category || lead.industry || 'Business';
            
            geminiWebsiteAnalysis = await analyzeWebsiteWithGemini(lead.website, businessName, category);
            
            // Merge qualitative analysis with Puppeteer quantitative check
            lead.websiteAnalysis = {
              mobileResponsiveness: geminiWebsiteAnalysis.mobileResponsiveness,
              uiQuality: geminiWebsiteAnalysis.uiQuality,
              uxQuality: geminiWebsiteAnalysis.uxQuality,
              designModernity: geminiWebsiteAnalysis.designModernity,
              loadingSpeed: websiteRawReport && websiteRawReport.loadTimeMs > 0 
                ? (websiteRawReport.loadTimeMs < 3000 ? 'fast' : websiteRawReport.loadTimeMs < 7000 ? 'average' : 'slow')
                : geminiWebsiteAnalysis.loadingSpeed,
              seoReadiness: geminiWebsiteAnalysis.seoReadiness,
              technicalSeo: geminiWebsiteAnalysis.technicalSeo,
              securitySignals: websiteRawReport ? (websiteRawReport.sslValid ? 'good' : 'none') : geminiWebsiteAnalysis.securitySignals,
              ctaEffectiveness: websiteRawReport && !websiteRawReport.hasCta ? 'poor' : geminiWebsiteAnalysis.ctaEffectiveness,
              trustSignals: geminiWebsiteAnalysis.trustSignals,
              conversionPotential: geminiWebsiteAnalysis.conversionPotential,
              detectedIssues: Array.from(new Set([
                ...(websiteRawReport?.error ? ['website_broken'] : []),
                ...(websiteRawReport && !websiteRawReport.sslValid ? ['missing_ssl'] : []),
                ...(websiteRawReport && !websiteRawReport.hasMobileMeta ? ['no_mobile_optimization'] : []),
                ...(websiteRawReport && !websiteRawReport.hasCta ? ['weak_cta'] : []),
                ...geminiWebsiteAnalysis.detectedIssues
              ])),
              overallGrade: geminiWebsiteAnalysis.overallGrade,
            };
          } catch (webErr: any) {
            logger.error(`Failed to analyze website with Gemini: ${webErr.message}`);
          }
        }

        // Project Value Estimation
        try {
          logger.info(`✨ Estimating project value with Gemini...`);
          geminiProjectValue = await estimateProjectValue(lead);
          lead.estimatedProjectValue = {
            websiteDevelopment: geminiProjectValue.websiteDevelopment,
            seo: geminiProjectValue.seo,
            branding: geminiProjectValue.branding,
            automation: geminiProjectValue.automation,
            aiIntegration: geminiProjectValue.aiIntegration,
            totalMin: geminiProjectValue.totalMin,
            totalMax: geminiProjectValue.totalMax,
            currency: geminiProjectValue.currency,
          };
        } catch (valErr: any) {
          logger.error(`Failed to estimate project value with Gemini: ${valErr.message}`);
        }

        // Sales Insights
        try {
          logger.info(`✨ Generating sales insights with Gemini...`);
          geminiSalesInsights = await generateSalesInsights(lead);
          lead.outreachSummary = geminiSalesInsights.outreachSummary;
          lead.recommendedPitch = geminiSalesInsights.recommendedPitch;
          lead.painPointsDetailed = geminiSalesInsights.painPointsDetailed;
          lead.serviceRecommendations = geminiSalesInsights.serviceRecommendations;
          lead.whyValuable = geminiSalesInsights.whyValuable;
        } catch (salesErr: any) {
          logger.error(`Failed to generate sales insights with Gemini: ${salesErr.message}`);
        }

      } catch (geminiErr: any) {
        logger.error(`❌ Core Gemini enrichment failed: ${geminiErr.message}. Falling back to basic scoring.`);
      }
    } else {
      logger.warn(`⚠️ Gemini API Key not set. Skipping Gemini enrichment steps.`);
    }

// 5. Populate legacy fields from Gemini results for backwards compatibility
    lead.aiScore = lead.leadScore ?? 50;
    lead.aiPotential = lead.aiOpportunityReport || lead.aiSummary || 'Analysis pending.';
    lead.aiJustification = lead.whyValuable || lead.outreachSummary || 'Potential lead.';
    lead.aiRecommendedServices = lead.serviceRecommendations || [];
    lead.aiOutreachAngle = lead.outreachSummary || 'Outreach candidate.';
    lead.aiFollowUpMessage = lead.recommendedPitch || `Hello ${lead.fullName || 'there'}, let's build a stunning page for ${lead.businessName || 'your business'} to turn searches into customers!`;
    lead.aiConversionProbability = lead.leadScore ?? 50;
    lead.aiPainPoints = lead.painPointsDetailed || [];
    lead.aiIdealSolution = lead.aiSummary || 'Website & digital presence upgrade.';
    lead.aiLandingHeadline = `A modern online presence for ${lead.businessName || lead.fullName}`;
    lead.aiLandingSubhead = `Turn searches into bookings with a fast, trustworthy website.`;
    lead.aiLandingBullets = (lead.aiRecommendations && lead.aiRecommendations.length > 0)
      ? lead.aiRecommendations.slice(0, 3)
      : ['Instant WhatsApp/Call buttons', 'Clear services & reviews', 'AI chat to capture leads 24/7'];
    lead.aiLandingCta = 'Want a 2-minute demo?';

    // 6. Run lead qualification scoring engine
    const qualResults = qualifyLead(lead, geminiEnrichment, validationResult);
    lead.leadScore = qualResults.leadScore;
    lead.agencyFitScore = qualResults.agencyFitScore;
    lead.opportunityScore = qualResults.opportunityScore;
    lead.confidenceScore = qualResults.confidenceScore;
    lead.qualificationStatus = qualResults.qualificationStatus;
    lead.priority = qualResults.priority;

    // Save tracking info
    lead.enrichedAt = new Date();
    lead.enrichmentVersion = (lead.enrichmentVersion ?? 0) + 1;

    // 7. Save to database
    await lead.save();
    logger.info(`✅ Successfully enriched Lead: ${lead.businessName || lead.fullName} (${lead._id}) - Score: ${lead.leadScore}, Status: ${lead.qualificationStatus}`);
    return lead;
  } catch (pipelineErr: any) {
    logger.error(`❌ Critical error in lead enrichment pipeline: ${pipelineErr.message}`);
    return lead; // return partially updated lead
  }
}
