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

    // If MongoDB is connected, save to database
    let savedCount = 0;
    let duplicateCount = 0;
    let hotLeadCount = 0;

    if (mongoose.connection.readyState === 1) {
      for (const scraped of scrapedLeads) {
        try {
          // Check for duplicates by phone or business name
          const existing = await Lead.findOne({
            $or: [
              ...(scraped.phone ? [{ phone: scraped.phone }] : []),
              { businessName: scraped.businessName },
            ],
          });

          if (existing) {
            duplicateCount++;
            continue;
          }

          // Determine if it's a hot lead based on rating and no website
          const isHot = !!(scraped.rating && scraped.rating >= 4.0 && !scraped.website);

          const lead = new Lead({
            fullName: scraped.businessName,
            businessName: scraped.businessName,
            phone: scraped.phone,
            website: scraped.website,
            address: scraped.address,
            city: scraped.city || location,
            category: scraped.category,
            rating: scraped.rating,
            reviewCount: scraped.reviewCount,
            priceLevel: scraped.priceLevel,
            description: scraped.description,
            openingHours: scraped.openingHours,
            attributes: scraped.attributes,
            country: scraped.address?.split(',').pop()?.trim() || 'India',
            source: 'google_maps',
            status: 'new',
            isHotLead: isHot,
            priority: isHot ? 'high' : 'medium',
          });

          try {
            await enrichLeadWithInsights(lead);
          } catch (insightError: any) {
            console.error(`⚠️ Insight error for "${scraped.businessName}":`, insightError.message);
          }

          await lead.save();
          savedCount++;
          if (lead.isHotLead) hotLeadCount++;

          console.log(`💾 Saved: ${scraped.businessName} (${scraped.rating}⭐) from Google Maps`);

        } catch (leadError: any) {
          console.error(`❌ Error saving "${scraped.businessName}":`, leadError.message);
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
        leads: scrapedLeads, // Return scraped data even if not saved
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
          const existing = await Lead.findOne({
            $or: [
              ...(scraped.phone ? [{ phone: scraped.phone }] : []),
              { businessName: scraped.businessName },
            ],
          });
          if (existing) {
            duplicateCount++;
            continue;
          }
          const lead = new Lead({
            ...scraped,
            fullName: scraped.businessName,
            city: scraped.city || location,
            status: 'new',
            isHotLead: !!(scraped.rating && scraped.rating >= 4.0),
            priority: (scraped.rating && scraped.rating >= 4.0) ? 'high' : 'medium',
          });
          try {
            await enrichLeadWithInsights(lead);
          } catch (insightError: any) {
            console.error(`⚠️ Insight error for "${scraped.businessName}":`, insightError.message);
          }
          await lead.save();
          savedCount++;
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
          const existing = await Lead.findOne({
            $or: [
              ...(scraped.phone ? [{ phone: scraped.phone }] : []),
              { businessName: scraped.businessName },
            ],
          });
          if (existing) {
            duplicateCount++;
            continue;
          }
          const lead = new Lead({
            ...scraped,
            fullName: scraped.businessName,
            city: location,
            status: 'new',
            isHotLead: !!(scraped.rating && scraped.rating >= 4.0),
            priority: (scraped.rating && scraped.rating >= 4.0) ? 'high' : 'medium',
          });
          try {
            await enrichLeadWithInsights(lead);
          } catch (insightError: any) {
            console.error(`⚠️ Insight error for "${scraped.businessName}":`, insightError.message);
          }
          await lead.save();
          savedCount++;
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
          // Check for existing
          const existing = await Lead.findOne({
            $or: [
              ...(scraped.phone ? [{ phone: scraped.phone }] : []),
              { businessName: scraped.businessName },
            ],
          });

          if (existing) {
            duplicateCount++;
            continue;
          }

          // Determine hot lead based on rating
          const isHot = !!(scraped.rating && scraped.rating >= 4.0);

          const lead = new Lead({
            fullName: scraped.businessName,
            businessName: scraped.businessName,
            phone: scraped.phone,
            email: scraped.email,
            address: scraped.address,
            city: scraped.city || location,
            category: scraped.category,
            rating: scraped.rating,
            reviewCount: scraped.reviewCount,
            source: scraped.source,
            status: 'new',
            isHotLead: isHot,
            priority: isHot ? 'high' : 'medium',
          });

          try {
            await enrichLeadWithInsights(lead);
          } catch (insightError: any) {
            console.error(`⚠️ Insight error for "${scraped.businessName}":`, insightError.message);
          }

          await lead.save();
          savedCount++;
          if (lead.isHotLead) hotLeadCount++;

          console.log(`💾 Saved: ${scraped.businessName} from ${scraped.source}`);

        } catch (err: any) {
          console.error(`❌ Error: ${scraped.businessName}: ${err.message}`);
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
  });
}

export default app;
