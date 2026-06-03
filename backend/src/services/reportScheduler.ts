/**
 * Report Scheduler Service — Automatically runs daily, weekly, and monthly CSV exports (Phase 12-13)
 * Uses standard setInterval/timeout checks without requiring external cron dependencies.
 */
import fs from 'fs';
import path from 'path';
import { Lead } from '../models/Lead';
import { logger } from '../utils/logger';

const EXPORTS_DIR = path.join(__dirname, '../../exports');
const DAILY_DIR = path.join(EXPORTS_DIR, 'daily');
const WEEKLY_DIR = path.join(EXPORTS_DIR, 'weekly');
const MONTHLY_DIR = path.join(EXPORTS_DIR, 'monthly');

// Keep track of the last run dates to prevent duplicate executions
let lastDailyRun: string = '';
let lastWeeklyRun: string = '';
let lastMonthlyRun: string = '';

/**
 * Initialize directories for exports
 */
export function initExportDirs() {
  const dirs = [EXPORTS_DIR, DAILY_DIR, WEEKLY_DIR, MONTHLY_DIR];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.info(`📁 Created export directory: ${dir}`);
    }
  }
}

/**
 * Helper to escape values for CSV
 */
function escapeCsv(val: any): string {
  if (val === null || val === undefined) return '""';
  let str = String(val).trim();
  str = str.replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Core function to query database and write leads within a date range to a CSV file
 */
async function generateCsvFile(startDate: Date, endDate: Date, filePath: string, reportType: string): Promise<number> {
  logger.info(`📊 Generating ${reportType} report at ${filePath} for range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
  
  const query = {
    createdAt: { $gte: startDate, $lte: endDate }
  };

  const leads = await Lead.find(query).sort({ createdAt: -1 });
  
  const csvHeaders = [
    'Business Name',
    'Full Name',
    'Email',
    'Phone',
    'Website',
    'Category',
    'Industry',
    'Rating',
    'Review Count',
    'Qualification Status',
    'Lead Score',
    'Agency Fit Score',
    'Opportunity Score',
    'Est Total Value Min',
    'Est Total Value Max',
    'Created At'
  ];

  const writeStream = fs.createWriteStream(filePath);
  
  // Write header
  writeStream.write(csvHeaders.map(escapeCsv).join(',') + '\n');

  // Write summary stats comment block at the top
  const totalLeads = leads.length;
  const hotLeads = leads.filter(l => l.qualificationStatus === 'HOT').length;
  const warmLeads = leads.filter(l => l.qualificationStatus === 'WARM').length;
  const coldLeads = leads.filter(l => l.qualificationStatus === 'COLD').length;
  const pipelineValue = leads.reduce((sum, l) => sum + (l.estimatedProjectValue?.totalMax || 0), 0);

  // Write data rows
  for (const lead of leads) {
    const row = [
      lead.businessName || '',
      lead.fullName || '',
      lead.email || '',
      lead.phone || '',
      lead.website || '',
      lead.category || '',
      lead.industry || '',
      lead.rating !== undefined ? lead.rating : '',
      lead.reviewCount !== undefined ? lead.reviewCount : '',
      lead.qualificationStatus || 'UNQUALIFIED',
      lead.leadScore !== undefined ? lead.leadScore : '',
      lead.agencyFitScore !== undefined ? lead.agencyFitScore : '',
      lead.opportunityScore !== undefined ? lead.opportunityScore : '',
      lead.estimatedProjectValue?.totalMin !== undefined ? lead.estimatedProjectValue.totalMin : '',
      lead.estimatedProjectValue?.totalMax !== undefined ? lead.estimatedProjectValue.totalMax : '',
      lead.createdAt ? lead.createdAt.toISOString() : ''
    ];
    writeStream.write(row.map(escapeCsv).join(',') + '\n');
  }

  return new Promise((resolve, reject) => {
    writeStream.end();
    writeStream.on('finish', () => {
      // Append brief summary meta to a companion log file
      const summaryPath = filePath.replace('.csv', '-summary.json');
      fs.writeFileSync(summaryPath, JSON.stringify({
        reportType,
        generatedAt: new Date().toISOString(),
        dateRange: { start: startDate, end: endDate },
        stats: {
          totalLeads,
          hotLeads,
          warmLeads,
          coldLeads,
          pipelineValue
        }
      }, null, 2));

      logger.info(`✅ Generated ${reportType} report with ${totalLeads} leads. Summary written.`);
      resolve(totalLeads);
    });
    writeStream.on('error', (err) => {
      logger.error(`❌ Error writing ${reportType} CSV file: ${err.message}`);
      reject(err);
    });
  });
}

/**
 * Check if scheduler tasks need to run
 */
export async function checkAndRunReports(): Promise<void> {
  const now = new Date();
  
  // Format keys as YYYY-MM-DD
  const todayKey = now.toISOString().split('T')[0];
  
  // 1. Daily Report Check (run at midnight or shortly after, once per day)
  // Period: previous calendar day
  if (lastDailyRun !== todayKey) {
    try {
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const startOfYesterday = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0);
      const endOfYesterday = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
      
      const fileName = `daily-leads-${todayKey}.csv`;
      const filePath = path.join(DAILY_DIR, fileName);
      
      await generateCsvFile(startOfYesterday, endOfYesterday, filePath, 'daily');
      lastDailyRun = todayKey;
    } catch (err: any) {
      logger.error(`Error in daily report job: ${err.message}`);
    }
  }

  // 2. Weekly Report Check (run on Sunday night/Monday midnight once a week)
  // Period: last 7 days
  const isMonday = now.getDay() === 1; // 1 = Monday
  const weekYear = `${now.getFullYear()}-W${getWeekNumber(now)}`;
  if (isMonday && lastWeeklyRun !== weekYear) {
    try {
      const startOfLastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      startOfLastWeek.setHours(0, 0, 0, 0);
      
      const endOfLastWeek = new Date(now.getTime() - 1000); // just before now
      
      const fileName = `weekly-leads-${weekYear}.csv`;
      const filePath = path.join(WEEKLY_DIR, fileName);
      
      await generateCsvFile(startOfLastWeek, endOfLastWeek, filePath, 'weekly');
      lastWeeklyRun = weekYear;
    } catch (err: any) {
      logger.error(`Error in weekly report job: ${err.message}`);
    }
  }

  // 3. Monthly Report Check (run on 1st of month once a month)
  // Period: previous calendar month
  const isFirstOfMonth = now.getDate() === 1;
  const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  if (isFirstOfMonth && lastMonthlyRun !== monthYear) {
    try {
      // Previous month
      let prevMonth = now.getMonth() - 1;
      let prevYear = now.getFullYear();
      if (prevMonth < 0) {
        prevMonth = 11;
        prevYear -= 1;
      }
      const startOfLastMonth = new Date(prevYear, prevMonth, 1, 0, 0, 0, 0);
      const endOfLastMonth = new Date(prevYear, prevMonth + 1, 0, 23, 59, 59, 999);
      
      const fileName = `monthly-leads-${monthYear}.csv`;
      const filePath = path.join(MONTHLY_DIR, fileName);
      
      await generateCsvFile(startOfLastMonth, endOfLastMonth, filePath, 'monthly');
      lastMonthlyRun = monthYear;
    } catch (err: any) {
      logger.error(`Error in monthly report job: ${err.message}`);
    }
  }
}

/**
 * Gets ISO week number
 */
function getWeekNumber(d: Date): number {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNo;
}

/**
 * Starts the scheduling loop (checks every 10 minutes)
 */
export function startReportScheduler(): void {
  initExportDirs();
  
  logger.info('⏰ Report scheduler daemon initialized.');
  
  // Initial check on startup (asynchronously in background)
  checkAndRunReports().catch(err => logger.error(`Error checking reports on startup: ${err.message}`));
  
  // Set up 10 minutes checking interval (600,000 ms)
  setInterval(() => {
    logger.info('⏰ Checking for report schedules...');
    checkAndRunReports().catch(err => logger.error(`Error checking reports in loop: ${err.message}`));
  }, 600000);
}
