/**
 * Export Service — Handles streaming CSV generation for lead data (Phase 11)
 */
import { Response } from 'express';
import { Lead } from '../models/Lead';
import { logger } from '../utils/logger';

interface ExportFilters {
  filter?: 'today' | 'last7' | 'last30' | 'custom' | 'all';
  startDate?: string;
  endDate?: string;
  qualificationStatus?: 'HOT' | 'WARM' | 'COLD' | 'qualified' | 'all';
}

/**
 * Escapes fields for CSV, wrapping in double quotes and escaping inner quotes.
 */
function escapeCsv(val: any): string {
  if (val === null || val === undefined) return '""';
  let str = String(val).trim();
  // Escape inner double quotes by doubling them
  str = str.replace(/"/g, '""');
  // Wrap in double quotes if it contains separator, quotes, or newlines
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str}"`;
  }
  return `"${str}"`; // Safe to always wrap in quotes for uniformity
}

/**
 * Build mongo query based on filter parameters
 */
export function buildExportQuery(filters: ExportFilters): any {
  const query: any = {};

  // 1. Date filters
  if (filters.filter && filters.filter !== 'all') {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    if (filters.filter === 'today') {
      query.createdAt = { $gte: startOfToday };
    } else if (filters.filter === 'last7') {
      const sevenDaysAgo = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000);
      query.createdAt = { $gte: sevenDaysAgo };
    } else if (filters.filter === 'last30') {
      const thirtyDaysAgo = new Date(startOfToday.getTime() - 30 * 24 * 60 * 60 * 1000);
      query.createdAt = { $gte: thirtyDaysAgo };
    } else if (filters.filter === 'custom' && filters.startDate) {
      const start = new Date(filters.startDate);
      const end = filters.endDate ? new Date(filters.endDate) : new Date();
      // Ensure custom includes the whole end day if only date is passed
      if (filters.endDate && !filters.endDate.includes('T')) {
        end.setHours(23, 59, 59, 999);
      }
      query.createdAt = { $gte: start, $lte: end };
    }
  }

  // 2. Qualification filters
  if (filters.qualificationStatus && filters.qualificationStatus !== 'all') {
    if (filters.qualificationStatus === 'qualified') {
      query.qualificationStatus = { $in: ['HOT', 'WARM'] };
    } else {
      query.qualificationStatus = filters.qualificationStatus;
    }
  }

  return query;
}

/**
 * Streams leads as a CSV direct to HTTP response.
 */
export async function streamLeadsToCsv(res: Response, filters: ExportFilters): Promise<void> {
  const query = buildExportQuery(filters);
  logger.info(`📤 Starting CSV stream export with query: ${JSON.stringify(query)}`);

  // Set response headers for download
  const filename = `studiovyn-leads-${new Date().toISOString().split('T')[0]}.csv`;
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Define headers for CSV
  const csvHeaders = [
    'Business Name',
    'Full Name',
    'Email',
    'Phone',
    'Alt Phone',
    'Website',
    'Category',
    'Industry',
    'Rating',
    'Review Count',
    'Price Level',
    'Address',
    'City',
    'State',
    'Country',
    'Source',
    'Status',
    'Qualification Status',
    'Lead Score',
    'Agency Fit Score',
    'Opportunity Score',
    'Confidence Score',
    'Est Web Dev Value',
    'Est SEO Value',
    'Est Total Value Min',
    'Est Total Value Max',
    'Outreach Pitch',
    'AI Summary',
    'Email Validation',
    'Phone Validation',
    'Website Validation',
    'Created At'
  ];

  // Write header row
  res.write(csvHeaders.map(escapeCsv).join(',') + '\n');

  // Use mongoose cursor to stream large datasets without overloading memory
  const cursor = Lead.find(query).sort({ createdAt: -1 }).cursor();

  try {
    for await (const lead of cursor) {
      const row = [
        lead.businessName || '',
        lead.fullName || '',
        lead.email || '',
        lead.phone || '',
        lead.alternatePhone || '',
        lead.website || '',
        lead.category || '',
        lead.industry || '',
        lead.rating !== undefined ? lead.rating : '',
        lead.reviewCount !== undefined ? lead.reviewCount : '',
        lead.priceLevel || '',
        lead.address || '',
        lead.city || '',
        lead.state || '',
        lead.country || '',
        lead.source || '',
        lead.status || '',
        lead.qualificationStatus || 'UNQUALIFIED',
        lead.leadScore !== undefined ? lead.leadScore : '',
        lead.agencyFitScore !== undefined ? lead.agencyFitScore : '',
        lead.opportunityScore !== undefined ? lead.opportunityScore : '',
        lead.confidenceScore !== undefined ? lead.confidenceScore : '',
        lead.estimatedProjectValue?.websiteDevelopment || '',
        lead.estimatedProjectValue?.seo || '',
        lead.estimatedProjectValue?.totalMin !== undefined ? lead.estimatedProjectValue.totalMin : '',
        lead.estimatedProjectValue?.totalMax !== undefined ? lead.estimatedProjectValue.totalMax : '',
        lead.recommendedPitch || '',
        lead.aiSummary || '',
        lead.validation?.email || 'missing',
        lead.validation?.phone || 'missing',
        lead.validation?.website || 'missing',
        lead.createdAt ? lead.createdAt.toISOString() : ''
      ];

      res.write(row.map(escapeCsv).join(',') + '\n');
    }
    
    res.end();
    logger.info('✅ CSV streaming completed successfully.');
  } catch (error: any) {
    logger.error(`❌ Error streaming CSV: ${error.message}`);
    // If headers already sent, we just end the response abruptly to signify error
    if (!res.headersSent) {
      res.status(500).send('Error generating export');
    } else {
      res.end();
    }
  }
}
