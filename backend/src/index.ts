import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import { Lead } from './models/Lead';
import { analyzeLead } from './services/ai/geminiService';
import { scrapeGoogleMaps } from './services/scraper/googleMapsScraper';

const app = express();
const PORT = process.env.PORT || 5000;
const IS_VERCEL = !!process.env.VERCEL || process.env.NODE_ENV === 'production';

// Use MongoDB Atlas free tier or local MongoDB
// For local: mongodb://localhost:27017/studiovyn-leads
// For Atlas: Get your connection string from mongodb.com/cloud/atlas
const MONGODB_URI = 'mongodb+srv://ankitpandey841226_db_user:3PLwsbcSGpYf5r9w@cluster0.sneikwd.mongodb.net/studiovyn-leads?retryWrites=true&w=majority&appName=Cluster0'


// Middleware
app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Connect to MongoDB with retry
const connectDB = async () => {
  if (!MONGODB_URI) {
    console.log('⚠️ MONGODB_URI is not set. Skipping MongoDB connection.');
    return;
  }

  try {
    console.log('🔌 Attempting to connect to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
      family: 4, // Force IPv4
    });
    console.log('✅ Connected to MongoDB');
  } catch (err: any) {
    console.error('❌ MongoDB Connection Error:', err.message);
    console.log('⚠️ MongoDB not available. Running in limited mode.');
    console.log('   Check if MONGODB_URI is correct in Vercel environment variables.');
    console.log('   Also check if you have whitelisted 0.0.0.0/0 in MongoDB Atlas.');
  }


};

connectDB();


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
      let skippedCount = 0;

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

          // Perform AI Analysis for intelligent qualification
          console.log(`🤖 Analyzing lead with Gemini: ${scraped.businessName}...`);
          const aiAnalysis = await analyzeLead(scraped);

          // 🎯 POST-AI QUALITY FILTER: Only save high-quality leads
          const isWorthSaving =
            aiAnalysis.leadType === 'hot' ||
            aiAnalysis.score >= 60 ||
            (aiAnalysis.conversionProbability >= 50);

          if (!isWorthSaving) {
            console.log(`⏭️ Skipping ${scraped.businessName}: Low AI score (${aiAnalysis.score}) and ${aiAnalysis.leadType} lead type`);
            skippedCount++;
            continue;
          }

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
            country: scraped.address?.split(',').pop()?.trim() || 'India', // Try to get the last part of address
            source: 'google_maps',
            status: 'new',
            isHotLead: aiAnalysis.leadType === 'hot' || aiAnalysis.score >= 80,
            priority: aiAnalysis.leadType === 'hot' ? 'high' : (aiAnalysis.score >= 70 ? 'high' : 'medium'),

            // AI Data
            aiScore: aiAnalysis.score,
            aiPotential: aiAnalysis.leadType,
            aiJustification: aiAnalysis.reason,
            aiRecommendedServices: aiAnalysis.whatToSell,
            aiOutreachAngle: aiAnalysis.firstMessageHook,
            aiFollowUpMessage: aiAnalysis.followUpMessage,
            aiConversionProbability: aiAnalysis.conversionProbability,
            aiPainPoints: aiAnalysis.painPoints,
            aiIdealSolution: aiAnalysis.idealSolution,
            notes: `AI Analysis: ${aiAnalysis.reason}\nRecommended: ${aiAnalysis.whatToSell.join(', ')}`,
          });

          await lead.save();
          savedCount++;
          if (lead.isHotLead) hotLeadCount++;

          // Log quality summary
          const qualityEmoji = aiAnalysis.leadType === 'hot' ? '🔥' : aiAnalysis.leadType === 'warm' ? '☀️' : '❄️';
          console.log(`💾 Saved ${qualityEmoji} ${scraped.businessName} (Score: ${aiAnalysis.score}, Conv: ${aiAnalysis.conversionProbability}%)`);

        } catch (leadError: any) {
          console.error(`❌ Error processing lead "${scraped.businessName}":`, leadError.message);
          // Still try to save basic data if AI/full-save failed?
          // Actually, let's just log and continue to the next one to be safe.
        }
      }

      console.log(`\n📊 Quality Summary: ${savedCount} saved, ${skippedCount} skipped (low quality), ${duplicateCount} duplicates`);
    } else {
      // Count hot leads even without saving
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
        recentLeads,
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
