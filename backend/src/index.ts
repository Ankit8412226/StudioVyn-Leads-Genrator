import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import path from 'path';
import { connectDB } from './db';
import { Campaign } from './models/Campaign';
import { CampaignLead } from './models/CampaignLead';
import { ILead, Lead } from './models/Lead';
import { addLeadsToCampaign, createCampaign, enqueueCampaignLeads } from './services/campaignService';
import { generateLeadInsights } from './services/aiLeadAnalysisService';
import { processDueFollowUps } from './services/followUpService';
import { scrapeGoogleMaps } from './services/scraper/googleMapsScraper';
import { IndiaMartLead, scrapeIndiaMART } from './services/scraper/indiamartScraper';
import { JustDialLead, scrapeJustDial } from './services/scraper/justDialScraper';
import { scrapeYelp, YelpLead } from './services/scraper/yelpScraper';
import { enrichLeadPipeline } from './services/enrichmentPipeline';
import { streamLeadsToCsv } from './services/exportService';
import { startReportScheduler } from './services/reportScheduler';

const app = express();
const PORT = process.env.PORT || 5000;
const IS_VERCEL = !!process.env.VERCEL || process.env.NODE_ENV === 'production';
const GENERATED_ASSETS_DIR = process.env.GENERATED_ASSETS_DIR
  ?? path.join(process.cwd(), 'generated-assets');
const ENABLE_FOLLOW_UP_SCHEDULER = (process.env.ENABLE_FOLLOW_UP_SCHEDULER ?? 'true') === 'true';
const FOLLOW_UP_POLL_INTERVAL_SEC = Number(process.env.FOLLOW_UP_POLL_INTERVAL_SEC ?? '60');


// Middleware
app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use('/generated-assets', express.static(GENERATED_ASSETS_DIR));

connectDB();

if (!IS_VERCEL && ENABLE_FOLLOW_UP_SCHEDULER) {
  const intervalMs = Math.max(FOLLOW_UP_POLL_INTERVAL_SEC, 15) * 1000;
  setInterval(() => {
    void processDueFollowUps(10).catch((err) => {
      console.error(`❌ Follow-up scheduler error: ${err.message}`);
    });
  }, intervalMs);
}

const enrichLeadWithInsights = async (lead: ILead) => {
  const insights = await generateLeadInsights(lead);
  lead.aiPainPoints = insights.painPoints;
  lead.aiOutreachAngle = insights.outreachAngle;
  lead.aiIdealSolution = insights.idealSolution;
  lead.aiLandingHeadline = insights.landingHeadline;
  lead.aiLandingSubhead = insights.landingSubhead;
  lead.aiLandingBullets = insights.landingBullets;
  lead.aiLandingCta = insights.demoCta;
};

function cleanWebsite(url?: string): string {
  if (!url) return '';
  return url.trim().toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '');
}

async function findExistingLead(scraped: {
  businessName: string;
  phone?: string;
  website?: string;
  email?: string;
}): Promise<any> {
  const orConditions: any[] = [{ businessName: scraped.businessName }];
  
  if (scraped.phone) {
    orConditions.push({ phone: scraped.phone });
  }
  if (scraped.email) {
    orConditions.push({ email: scraped.email.toLowerCase().trim() });
  }
  
  const match = await Lead.findOne({ $or: orConditions });
  if (match) return match;

  if (scraped.website) {
    const targetNorm = cleanWebsite(scraped.website);
    if (targetNorm) {
      const leadsWithWebsites = await Lead.find({ website: { $ne: null } });
      for (const lead of leadsWithWebsites) {
        if (cleanWebsite(lead.website) === targetNorm) {
          return lead;
        }
      }
    }
  }

  return null;
}

async function processScrapedLead(scraped: any, location: string, defaultSource: string): Promise<{ saved: boolean, isDuplicate: boolean, isHot: boolean, leadId: string }> {
  const businessName = scraped.businessName || scraped.fullName;
  const source = scraped.source || defaultSource;
  
  if (!businessName) throw new Error('Missing business name');

  // Check duplicate
  const existing = await findExistingLead({
    businessName,
    phone: scraped.phone,
    website: scraped.website,
    email: scraped.email
  });

  if (existing) {
    // Merge new fields into existing
    let modified = false;
    const fieldsToMerge = [
      'phone', 'email', 'website', 'address', 'city', 'state', 'country',
      'category', 'rating', 'reviewCount', 'priceLevel', 'description',
      'openingHours', 'attributes'
    ];
    
    for (const field of fieldsToMerge) {
      if (!(existing as any)[field] && (scraped as any)[field]) {
        (existing as any)[field] = (scraped as any)[field];
        modified = true;
      }
    }
    
    // Merge rawExtractedData
    existing.rawExtractedData = {
      ...(existing.rawExtractedData || {}),
      ...scraped
    };
    
    // Add source tag if different
    if (source && existing.source !== source) {
      const sourceTag = `source_${source}`;
      if (!existing.tags.includes(sourceTag)) {
        existing.tags.push(sourceTag);
        modified = true;
      }
    }

    await existing.save();
    
    // Trigger background enrichment pipeline to update scores and reports
    void enrichLeadPipeline(existing._id.toString()).catch(err => {
      console.error(`Error enriching updated duplicate lead ${existing._id}:`, err);
    });

    return { saved: false, isDuplicate: true, isHot: existing.isHotLead, leadId: existing._id.toString() };
  } else {
    // Create new lead
    const isHot = !!(scraped.rating && scraped.rating >= 4.0 && !scraped.website);
    
    const lead = new Lead({
      fullName: businessName,
      businessName,
      phone: scraped.phone,
      email: scraped.email,
      website: scraped.website,
      address: scraped.address,
      city: scraped.city || location,
      state: scraped.state,
      category: scraped.category,
      industry: scraped.industry,
      rating: scraped.rating,
      reviewCount: scraped.reviewCount,
      priceLevel: scraped.priceLevel,
      description: scraped.description,
      openingHours: scraped.openingHours,
      attributes: scraped.attributes,
      country: scraped.country || scraped.address?.split(',').pop()?.trim() || 'India',
      source: source,
      status: 'new',
      isHotLead: isHot,
      priority: isHot ? 'high' : 'medium',
      rawExtractedData: scraped,
    });

    await lead.save();

    // Trigger background enrichment pipeline
    void enrichLeadPipeline(lead._id.toString()).catch(err => {
      console.error(`Error enriching new lead ${lead._id}:`, err);
    });

    return { saved: true, isDuplicate: false, isHot, leadId: lead._id.toString() };
  }
}


app.get('/api/leads', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({
        success: true,
        data: { leads: [], pagination: { page: 1, limit: 50, total: 0, pages: 0 } },
      });
    }

    const {
      page = 1,
      limit = 50,
      search,
      status,
      messageStatus,
      source,
      isHotLead,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const query: any = {};

    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { businessName: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    if (status) query.status = status;
    if (messageStatus) query.messageStatus = messageStatus;
    if (source) query.source = source;
    if (isHotLead === 'true') query.isHotLead = true;

    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 100);
    const skip = (pageNum - 1) * limitNum;

    const [leads, total] = await Promise.all([
      Lead.find(query)
        .sort({ [sortBy as string]: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Lead.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        leads,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get hot leads
app.get('/api/leads/hot', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, data: { leads: [] } });
    }

    const leads = await Lead.find({ isHotLead: true, status: { $ne: 'won' } })
      .sort({ rating: -1, createdAt: -1 })
      .limit(50)
      .lean();

    res.json({ success: true, data: { leads } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single lead
app.get('/api/leads/:id', async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }
    res.json({ success: true, data: { lead } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create lead
app.post('/api/leads', async (req, res) => {
  try {
    const lead = new Lead(req.body);
    await lead.save();
    res.status(201).json({ success: true, data: { lead } });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Update lead
app.put('/api/leads/:id', async (req, res) => {
  try {
    const lead = await Lead.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!lead) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }
    res.json({ success: true, data: { lead } });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Delete lead
app.delete('/api/leads/:id', async (req, res) => {
  try {
    const lead = await Lead.findByIdAndDelete(req.params.id);
    if (!lead) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }
    res.json({ success: true, message: 'Lead deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete ALL leads
app.delete('/api/leads', async (req, res) => {
  try {
    const result = await Lead.deleteMany({});
    console.log(`🗑️ Deleted ${result.deletedCount} leads`);
    res.json({ success: true, message: `Deleted ${result.deletedCount} leads` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Bulk update leads
app.put('/api/leads/bulk/update', async (req, res) => {
  try {
    const { ids, updates } = req.body;
    const result = await Lead.updateMany(
      { _id: { $in: ids } },
      { $set: updates }
    );
    res.json({ success: true, data: { modifiedCount: result.modifiedCount } });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Bulk delete leads
app.delete('/api/leads/bulk/delete', async (req, res) => {
  try {
    const { ids } = req.body;
    const result = await Lead.deleteMany({ _id: { $in: ids } });
    res.json({ success: true, data: { deletedCount: result.deletedCount } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// CAMPAIGN ROUTES
// ============================================

app.post('/api/campaigns', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'Campaign name is required' });
    }
    const campaign = await createCampaign(name);
    res.status(201).json({ success: true, data: { campaign } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/campaigns', async (_req, res) => {
  try {
    const campaigns = await Campaign.find().sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: { campaigns } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/campaigns/:id', async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id).lean();
    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    const stats = await CampaignLead.aggregate([
      { $match: { campaignId: campaign._id } },
      { $group: { _id: '$messageStatus', count: { $sum: 1 } } },
    ]);

    res.json({ success: true, data: { campaign, stats } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/campaigns/:id/leads', async (req, res) => {
  try {
    const { leadIds } = req.body;
    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({ success: false, error: 'leadIds array is required' });
    }
    const result = await addLeadsToCampaign(req.params.id, leadIds);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/campaigns/:id/leads', async (req, res) => {
  try {
    const leads = await CampaignLead.find({ campaignId: req.params.id })
      .populate('leadId')
      .lean();
    res.json({ success: true, data: { leads } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/campaigns/:id/start', async (req, res) => {
  try {
    const includeImage = Boolean(req.body?.includeImage ?? true);
    const queued = await enqueueCampaignLeads(req.params.id, includeImage);
    res.json({ success: true, data: { queued } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// SCRAPER ROUTES
// ============================================
// Scrape Google Maps
app.post('/api/scraper/google-maps', async (req, res) => {
  try {
    const { query, location, limit = 30 } = req.body;

    if (!query) {
      return res.status(400).json({ success: false, error: 'Query is required' });
    }

    console.log(`🔍 Starting scrape: "${query}" in "${location || 'default'}"`);

    const scrapedLeads = await scrapeGoogleMaps({ query, location, limit });

    let savedCount = 0;
    let duplicateCount = 0;
    let hotLeadCount = 0;

    if (mongoose.connection.readyState === 1) {
      for (const scraped of scrapedLeads) {
        try {
          const result = await processScrapedLead(scraped, location || 'default', 'google_maps');
          if (result.saved) {
            savedCount++;
            if (result.isHot) hotLeadCount++;
            console.log(`💾 Saved: ${scraped.businessName} (${scraped.rating}⭐) from Google Maps`);
          } else if (result.isDuplicate) {
            duplicateCount++;
            console.log(`📋 Merged Duplicate: ${scraped.businessName} from Google Maps`);
          }
        } catch (leadError: any) {
          console.error(`❌ Error processing "${scraped.businessName}":`, leadError.message);
        }
      }
      console.log(`\n📊 Summary: ${savedCount} saved, ${duplicateCount} duplicates, ${hotLeadCount} hot leads`);
    } else {
      hotLeadCount = scrapedLeads.filter(l => l.rating && l.rating >= 4.0 && l.phone).length;
    }

    res.json({
      success: true,
      data: {
        scraped: scrapedLeads.length,
        saved: savedCount,
        duplicates: duplicateCount,
        hotLeads: hotLeadCount,
        leads: scrapedLeads,
      },
    });
  } catch (error: any) {
    console.error('Scraping error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});


// Scrape India-specific sources (JustDial + IndiaMART)
app.post('/api/scraper/india', async (req, res) => {
  try {
    const { query, location, limit = 30 } = req.body;

    if (!query) {
      return res.status(400).json({ success: false, error: 'Query is required' });
    }

    console.log(`\n🇮🇳 Starting India-specific scrape: "${query}" in "${location || 'India'}"`);

    const [justDialLeads, indiaMartLeads] = await Promise.allSettled([
      scrapeJustDial({ query, city: location || 'Mumbai', limit: Math.ceil(limit / 2) }),
      scrapeIndiaMART({ query, city: location, limit: Math.ceil(limit / 2) }),
    ]);

    const allLeads: any[] = [];

    if (justDialLeads.status === 'fulfilled') {
      justDialLeads.value.forEach(l => allLeads.push({ ...l, source: 'justdial' }));
    }
    if (indiaMartLeads.status === 'fulfilled') {
      indiaMartLeads.value.forEach(l => allLeads.push({ ...l, source: 'indiamart' }));
    }

    // Deduplicate
    const seenPhones = new Set<string>();
    const seenNames = new Set<string>();
    const uniqueLeads = allLeads.filter(lead => {
      const phoneKey = lead.phone?.replace(/\D/g, '') || '';
      const nameKey = lead.businessName.toLowerCase();
      if (phoneKey && seenPhones.has(phoneKey)) return false;
      if (seenNames.has(nameKey)) return false;
      if (phoneKey) seenPhones.add(phoneKey);
      seenNames.add(nameKey);
      return true;
    });

    // Save to DB
    let savedCount = 0;
    let duplicateCount = 0;
    if (mongoose.connection.readyState === 1) {
      for (const scraped of uniqueLeads) {
        try {
          const result = await processScrapedLead(scraped, location || 'India', scraped.source || 'justdial');
          if (result.saved) {
            savedCount++;
          } else if (result.isDuplicate) {
            duplicateCount++;
          }
        } catch (err) { /* skip */ }
      }
    }

    res.json({
      success: true,
      data: {
        scraped: uniqueLeads.length,
        saved: savedCount,
        duplicates: duplicateCount,
        leads: uniqueLeads,
        sources: {
          justDial: justDialLeads.status === 'fulfilled' ? justDialLeads.value.length : 0,
          indiaMART: indiaMartLeads.status === 'fulfilled' ? indiaMartLeads.value.length : 0,
        }
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Scrape Yelp (International)
app.post('/api/scraper/yelp', async (req, res) => {
  try {
    const { query, location, limit = 30 } = req.body;

    if (!query) {
      return res.status(400).json({ success: false, error: 'Query is required' });
    }

    console.log(`\n🌎 Starting Yelp scrape: "${query}" in "${location || 'New York, NY'}"`);

    const yelpLeads = await scrapeYelp({ query, location: location || 'New York, NY', limit });

    // Save to DB
    let savedCount = 0;
    let duplicateCount = 0;
    if (mongoose.connection.readyState === 1) {
      for (const scraped of yelpLeads) {
        try {
          const result = await processScrapedLead(scraped, location || 'New York, NY', 'yelp');
          if (result.saved) {
            savedCount++;
          } else if (result.isDuplicate) {
            duplicateCount++;
          }
        } catch (err) { /* skip */ }
      }
    }

    res.json({
      success: true,
      data: {
        scraped: yelpLeads.length,
        saved: savedCount,
        duplicates: duplicateCount,
        leads: yelpLeads
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// MULTI-SOURCE SCRAPER (Google Maps + JustDial + IndiaMART + Yelp)
// ============================================

app.post('/api/scraper/all-sources', async (req, res) => {
  try {
    const { query, location, limit = 30 } = req.body;

    if (!query) {
      return res.status(400).json({ success: false, error: 'Query is required' });
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🚀 MULTI-SOURCE SCRAPING: "${query}" in "${location || 'India'}"`);
    console.log(`${'='.repeat(60)}\n`);

    // Scrape from all sources in parallel
    const [googleLeads, justDialLeads, indiaMartLeads, yelpLeads] = await Promise.allSettled([
      scrapeGoogleMaps({ query, location, limit: Math.ceil(limit / 4) }),
      scrapeJustDial({ query, city: location || 'Mumbai', limit: Math.ceil(limit / 4) }),
      scrapeIndiaMART({ query, city: location, limit: Math.ceil(limit / 4) }),
      scrapeYelp({ query, location: location || 'New York, NY', limit: Math.ceil(limit / 4) }),
    ]);

    // Combine all leads
    type CombinedLead = {
      businessName: string;
      fullName: string;
      phone?: string;
      email?: string;
      website?: string;
      address?: string;
      city?: string;
      rating?: number;
      reviewCount?: number;
      category?: string;
      source: string;
    };

    const allLeads: CombinedLead[] = [];

    // Add Google Maps leads
    if (googleLeads.status === 'fulfilled') {
      googleLeads.value.forEach(lead => {
        allLeads.push({ ...lead, source: 'google_maps' });
      });
      console.log(`✅ Google Maps: ${googleLeads.value.length} leads`);
    } else {
      console.log(`❌ Google Maps failed: ${googleLeads.reason}`);
    }

    // Add JustDial leads
    if (justDialLeads.status === 'fulfilled') {
      justDialLeads.value.forEach((lead: JustDialLead) => {
        allLeads.push({
          businessName: lead.businessName,
          fullName: lead.fullName,
          phone: lead.phone,
          email: lead.email,
          address: lead.address,
          city: lead.city,
          rating: lead.rating,
          reviewCount: lead.reviewCount,
          category: lead.category,
          source: 'justdial',
        });
      });
      console.log(`✅ JustDial: ${justDialLeads.value.length} leads`);
    } else {
      console.log(`❌ JustDial failed: ${justDialLeads.reason}`);
    }

    // Add IndiaMART leads
    if (indiaMartLeads.status === 'fulfilled') {
      indiaMartLeads.value.forEach((lead: IndiaMartLead) => {
        allLeads.push({
          businessName: lead.businessName,
          fullName: lead.fullName,
          phone: lead.phone,
          email: lead.email,
          address: lead.address,
          city: lead.city,
          category: lead.category,
          source: 'indiamart',
        });
      });
      console.log(`✅ IndiaMART: ${indiaMartLeads.value.length} leads`);
    } else {
      console.log(`❌ IndiaMART failed: ${indiaMartLeads.reason}`);
    }

    // Add Yelp leads (International - US, UK, Canada, UAE)
    if (yelpLeads.status === 'fulfilled') {
      yelpLeads.value.forEach((lead: YelpLead) => {
        allLeads.push({
          businessName: lead.businessName,
          fullName: lead.fullName,
          phone: lead.phone,
          email: lead.email,
          address: lead.address,
          city: lead.city,
          rating: lead.rating,
          reviewCount: lead.reviewCount,
          category: lead.category,
          source: 'yelp',
        });
      });
      console.log(`✅ Yelp (International): ${yelpLeads.value.length} leads`);
    } else {
      console.log(`❌ Yelp failed: ${yelpLeads.reason}`);
    }

    console.log(`\n📊 Total combined leads: ${allLeads.length}`);

    // Deduplicate by phone or business name
    const seenPhones = new Set<string>();
    const seenNames = new Set<string>();
    const uniqueLeads = allLeads.filter(lead => {
      const phoneKey = lead.phone?.replace(/\D/g, '') || '';
      const nameKey = lead.businessName.toLowerCase();

      if (phoneKey && seenPhones.has(phoneKey)) return false;
      if (seenNames.has(nameKey)) return false;

      if (phoneKey) seenPhones.add(phoneKey);
      seenNames.add(nameKey);
      return true;
    });

    console.log(`📊 After deduplication: ${uniqueLeads.length} unique leads`);

    // Save to database
    let savedCount = 0;
    let duplicateCount = 0;
    let hotLeadCount = 0;

    if (mongoose.connection.readyState === 1) {
      for (const scraped of uniqueLeads) {
        try {
          const result = await processScrapedLead(scraped, location || 'India', scraped.source || 'other');
          if (result.saved) {
            savedCount++;
            if (result.isHot) hotLeadCount++;
            console.log(`💾 Saved: ${scraped.businessName} from ${scraped.source}`);
          } else if (result.isDuplicate) {
            duplicateCount++;
            console.log(`📋 Merged Duplicate: ${scraped.businessName} from ${scraped.source}`);
          }
        } catch (err: any) {
          console.error(`❌ Error processing "${scraped.businessName}":`, err.message);
        }
      }

      console.log(`\n${'='.repeat(60)}`);
      console.log(`📊 FINAL SUMMARY`);
      console.log(`${'='.repeat(60)}`);
      console.log(`   ✅ Saved: ${savedCount}`);
      console.log(`   🔥 Hot Leads: ${hotLeadCount}`);
      console.log(`   📋 Duplicates: ${duplicateCount}`);
      console.log(`${'='.repeat(60)}\n`);
    }

    res.json({
      success: true,
      data: {
        sources: {
          googleMaps: googleLeads.status === 'fulfilled' ? googleLeads.value.length : 0,
          justDial: justDialLeads.status === 'fulfilled' ? justDialLeads.value.length : 0,
          indiaMART: indiaMartLeads.status === 'fulfilled' ? indiaMartLeads.value.length : 0,
          yelp: yelpLeads.status === 'fulfilled' ? yelpLeads.value.length : 0,
        },
        totalScraped: allLeads.length,
        uniqueLeads: uniqueLeads.length,
        saved: savedCount,
        hotLeads: hotLeadCount,
        duplicates: duplicateCount,
        leads: uniqueLeads,
      },
    });
  } catch (error: any) {
    console.error('Multi-source scraping error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// ANALYTICS ROUTES
// ============================================

// Get dashboard stats
app.get('/api/analytics/overview', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({
        success: true,
        data: {
          stats: { totalLeads: 0, hotLeads: 0, newLeads: 0, contactedLeads: 0, wonLeads: 0, conversionRate: 0 },
          sourceBreakdown: [],
          statusBreakdown: {},
          messageVariantStats: [],
          followUpStats: {},
          followUp2Stats: {},
          recentLeads: [],
        },
      });
    }

    const [
      totalLeads,
      hotLeads,
      newLeads,
      contactedLeads,
      wonLeads,
    ] = await Promise.all([
      Lead.countDocuments(),
      Lead.countDocuments({ isHotLead: true }),
      Lead.countDocuments({ status: 'new' }),
      Lead.countDocuments({ status: 'contacted' }),
      Lead.countDocuments({ status: 'won' }),
    ]);

    const sourceBreakdown = await Lead.aggregate([
      { $group: { _id: '$source', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const statusBreakdown = await Lead.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const messageVariantStats = await CampaignLead.aggregate([
      { $match: { messageStatus: 'sent' } },
      {
        $group: {
          _id: '$messageVariant',
          sent: { $sum: 1 },
          replied: { $sum: { $cond: [{ $eq: ['$responseStatus', 'replied'] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const followUpStats = await CampaignLead.aggregate([
      { $group: { _id: '$followUpStatus', count: { $sum: 1 } } },
    ]);

    const followUp2Stats = await CampaignLead.aggregate([
      { $group: { _id: '$followUp2Status', count: { $sum: 1 } } },
    ]);

    const recentLeads = await Lead.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    res.json({
      success: true,
      data: {
        stats: {
          totalLeads,
          hotLeads,
          newLeads,
          contactedLeads,
          wonLeads,
          conversionRate: totalLeads > 0 ? ((wonLeads / totalLeads) * 100).toFixed(1) : 0,
        },
        sourceBreakdown: sourceBreakdown.map((s) => ({ source: s._id, count: s.count })),
        statusBreakdown: statusBreakdown.reduce((acc, s) => {
          acc[s._id] = s.count;
          return acc;
        }, {} as Record<string, number>),
        messageVariantStats: messageVariantStats.map((s) => ({
          variant: s._id ?? 'A',
          sent: s.sent ?? 0,
          replied: s.replied ?? 0,
        })),
        followUpStats: followUpStats.reduce((acc, s) => {
          acc[s._id ?? 'unknown'] = s.count;
          return acc;
        }, {} as Record<string, number>),
        followUp2Stats: followUp2Stats.reduce((acc, s) => {
          acc[s._id ?? 'unknown'] = s.count;
          return acc;
        }, {} as Record<string, number>),
        recentLeads,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// NEW DASHBOARD & ANALYTICS APIs
// ============================================

// Get high-level metrics for dashboard cards
app.get('/api/dashboard/metrics', async (req, res) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(startOfToday.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      todayStats,
      weekStats,
      monthStats,
      overallStats
    ] = await Promise.all([
      // Today
      Lead.aggregate([
        { $match: { createdAt: { $gte: startOfToday } } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            qualified: { $sum: { $cond: [{ $in: ['$qualificationStatus', ['HOT', 'WARM']] }, 1, 0] } },
            hot: { $sum: { $cond: [{ $eq: ['$qualificationStatus', 'HOT'] }, 1, 0] } },
            warm: { $sum: { $cond: [{ $eq: ['$qualificationStatus', 'WARM'] }, 1, 0] } },
            cold: { $sum: { $cond: [{ $eq: ['$qualificationStatus', 'COLD'] }, 1, 0] } }
          }
        }
      ]),
      // Last 7 days
      Lead.aggregate([
        { $match: { createdAt: { $gte: sevenDaysAgo } } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            qualified: { $sum: { $cond: [{ $in: ['$qualificationStatus', ['HOT', 'WARM']] }, 1, 0] } },
            pipelineValue: { $sum: { $ifNull: ['$estimatedProjectValue.totalMax', 0] } }
          }
        }
      ]),
      // Last 30 days
      Lead.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            qualified: { $sum: { $cond: [{ $in: ['$qualificationStatus', ['HOT', 'WARM']] }, 1, 0] } },
            pipelineValue: { $sum: { $ifNull: ['$estimatedProjectValue.totalMax', 0] } }
          }
        }
      ]),
      // Overall
      Lead.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            qualified: { $sum: { $cond: [{ $in: ['$qualificationStatus', ['HOT', 'WARM']] }, 1, 0] } },
            pipelineValue: { $sum: { $ifNull: ['$estimatedProjectValue.totalMax', 0] } }
          }
        }
      ])
    ]);

    const defaultStats = { total: 0, qualified: 0, hot: 0, warm: 0, cold: 0, pipelineValue: 0 };
    res.json({
      success: true,
      data: {
        today: todayStats[0] ? { ...defaultStats, ...todayStats[0] } : defaultStats,
        week: weekStats[0] ? { ...defaultStats, ...weekStats[0] } : defaultStats,
        month: monthStats[0] ? { ...defaultStats, ...monthStats[0] } : defaultStats,
        overall: overallStats[0] ? { ...defaultStats, ...overallStats[0] } : defaultStats
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get data formatted for Recharts components
app.get('/api/analytics/charts', async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0,0,0,0);

    const allLeads = await Lead.find({}, 'createdAt leadScore agencyFitScore qualificationStatus estimatedProjectValue industry category city')
      .lean();

    const dayWiseMap: Record<string, number> = {};
    // Pre-populate last 30 days
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      dayWiseMap[dateStr] = 0;
    }

    const pipelineDailyMap: Record<string, number> = {};
    for (const dateStr of Object.keys(dayWiseMap)) {
      pipelineDailyMap[dateStr] = 0;
    }

    const qualTrendsMap: Record<string, { HOT: number, WARM: number, COLD: number }> = {};
    for (const dateStr of Object.keys(dayWiseMap)) {
      qualTrendsMap[dateStr] = { HOT: 0, WARM: 0, COLD: 0 };
    }

    const leadScoreDist = [
      { range: '0-20', count: 0 },
      { range: '21-40', count: 0 },
      { range: '41-60', count: 0 },
      { range: '61-80', count: 0 },
      { range: '81-100', count: 0 },
    ];

    const agencyFitDist: Record<string, number> = { 'poor': 0, 'fair': 0, 'good': 0, 'excellent': 0 };
    const industryMap: Record<string, number> = {};
    const cityMap: Record<string, number> = {};

    for (const lead of allLeads) {
      const score = lead.leadScore ?? 0;
      if (score <= 20) leadScoreDist[0].count++;
      else if (score <= 40) leadScoreDist[1].count++;
      else if (score <= 60) leadScoreDist[2].count++;
      else if (score <= 80) leadScoreDist[3].count++;
      else leadScoreDist[4].count++;

      const fit = lead.agencyFitScore ?? 0;
      if (fit >= 80) agencyFitDist['excellent']++;
      else if (fit >= 60) agencyFitDist['good']++;
      else if (fit >= 35) agencyFitDist['fair']++;
      else agencyFitDist['poor']++;

      const ind = (lead.industry || lead.category || 'Other').trim();
      const capitalizedInd = ind.charAt(0).toUpperCase() + ind.slice(1).toLowerCase();
      industryMap[capitalizedInd] = (industryMap[capitalizedInd] || 0) + 1;

      const city = lead.city || 'Unknown';
      const capitalizedCity = city.charAt(0).toUpperCase() + city.slice(1).toLowerCase();
      cityMap[capitalizedCity] = (cityMap[capitalizedCity] || 0) + 1;

      if (lead.createdAt) {
        const dateStr = lead.createdAt.toISOString().split('T')[0];
        if (dayWiseMap[dateStr] !== undefined) {
          dayWiseMap[dateStr]++;
          const maxVal = lead.estimatedProjectValue?.totalMax || 0;
          pipelineDailyMap[dateStr] += maxVal;

          const qStatus = lead.qualificationStatus;
          if (qStatus && qualTrendsMap[dateStr]) {
            qualTrendsMap[dateStr][qStatus]++;
          }
        }
      }
    }

    const dayWise = Object.entries(dayWiseMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const industryDistribution = Object.entries(industryMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    const cityDistribution = Object.entries(cityMap)
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const agencyFitDistribution = Object.entries(agencyFitDist)
      .map(([name, count]) => ({ name, count }));

    let runningSum = 0;
    const olderLeadsPipelineSum = allLeads
      .filter(l => l.createdAt && l.createdAt < thirtyDaysAgo)
      .reduce((sum, l) => sum + (l.estimatedProjectValue?.totalMax || 0), 0);
    
    runningSum = olderLeadsPipelineSum;
    
    const pipelineGrowth = Object.entries(pipelineDailyMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, dailySum]) => {
        runningSum += dailySum;
        return { date, value: runningSum };
      });

    const qualificationTrends = Object.entries(qualTrendsMap)
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      success: true,
      data: {
        dayWise,
        leadScoreDistribution: leadScoreDist,
        industryDistribution,
        cityDistribution,
        agencyFitDistribution,
        pipelineGrowth,
        qualificationTrends,
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// CSV Export route using streaming service
app.get('/api/export/csv', async (req, res) => {
  try {
    const { filter, startDate, endDate, qualificationStatus } = req.query;
    await streamLeadsToCsv(res, {
      filter: filter as any,
      startDate: startDate as string,
      endDate: endDate as string,
      qualificationStatus: qualificationStatus as any
    });
  } catch (error: any) {
    console.error('CSV export route error:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

// Trigger full AI enrichment manually for a lead
app.post('/api/leads/:id/enrich', async (req, res) => {
  try {
    const lead = await enrichLeadPipeline(req.params.id);
    if (!lead) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }
    res.json({ success: true, data: { lead } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// HEALTH CHECK
// ============================================

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Studiovyn Leads API is running',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

// Start server (local/dev only; Vercel runs as serverless function)
if (!IS_VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📍 API: http://localhost:${PORT}/api`);
    
    // Start automated daily/weekly/monthly report generator
    startReportScheduler();
  });
}

export default app;
