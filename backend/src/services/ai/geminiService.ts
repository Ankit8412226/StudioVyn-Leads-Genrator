const SAMBA_API_KEY = process.env.SAMBA_API_KEY || "968786de-205b-4005-80e0-a2c1d705707d";
const SAMBA_ENDPOINT = "https://api.sambanova.ai/v1/chat/completions";

export interface AIAnalysis {
  score: number;
  leadType: 'hot' | 'warm' | 'cold';
  reason: string;
  whatToSell: string[];
  firstMessageHook: string;
  followUpMessage: string;
  conversionProbability: number;
  painPoints: string[];
  idealSolution: string;
}

/**
 * 🔒 SAFE JSON EXTRACTOR
 * Never trust LLM output directly.
 */
function extractJSON(text: string): AIAnalysis {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('No valid JSON found in LLM response');
  }

  const jsonString = text.slice(start, end + 1);
  return JSON.parse(jsonString);
}

export async function analyzeLead(leadData: {
  businessName: string;
  category?: string;
  rating?: number;
  reviewCount?: number;
  website?: string | null;
  address?: string;
  priceLevel?: string;
  description?: string;
  openingHours?: string[];
  attributes?: string[];
}): Promise<AIAnalysis> {

  if (!SAMBA_API_KEY) {
    return {
      score: 0,
      leadType: 'cold',
      reason: 'SAMBA_API_KEY not configured',
      whatToSell: [],
      firstMessageHook: '',
      followUpMessage: '',
      conversionProbability: 0,
      painPoints: [],
      idealSolution: ''
    };
  }

  const prompt = `
You are an expert Sales Strategy Consultant for a high-end Digital Marketing Agency.
Your job is to analyze this Google Maps lead and tell the Agency Owner EXACTLY how to close them.

Business Name: ${leadData.businessName}
Category: ${leadData.category || 'Unknown'}
Google Rating: ${leadData.rating ?? 'N/A'}
Total Reviews: ${leadData.reviewCount ?? 'N/A'}
Has Website: ${leadData.website ? 'Yes' : 'No'}
Address: ${leadData.address || 'Unknown'}
Price Level: ${leadData.priceLevel || 'N/A'}
Description: ${leadData.description || 'N/A'}
Operational Info: ${leadData.openingHours?.join(', ') || 'N/A'}
Attributes: ${leadData.attributes?.join(', ') || 'N/A'}

Strategy Rules:
1. CUSTOMER PAIN: If they have high reviews but NO website, they are LOSING money to competitors. This is a "Gold Mine" lead.
2. AUTHORITY LOSS: If they are a "Luxury" ($$$) business but have a cheap or no website, it's a "Brand Emergency".
3. CONVERSION LOSS: If they have no booking/ordering system, they are "Leaking Revenue".

Return ONLY raw JSON in this format:
{
  "score": 0-100, (Agency priority score)
  "leadType": "hot" | "warm" | "cold",
  "reason": "Expert tactical reason why the agency owner should care about this lead",
  "whatToSell": ["Specific Agency Package 1", "Specific Agency Package 2"],
  "firstMessageHook": "A direct, high-converting B2B WhatsApp/Email opener for the owner",
  "followUpMessage": "A professional but persistent agency follow-up script",
  "conversionProbability": 0-100, (Chance of closing this lead)
  "painPoints": ["Business owner's biggest fears or missing revenue sources"],
  "idealSolution": "The exact 'Grand Slam' offer that would be impossible for them to refuse"
}
`;

  try {
    const startTime = Date.now();
    const res = await fetch(SAMBA_ENDPOINT, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SAMBA_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "Meta-Llama-3.1-8B-Instruct", // ✅ Stable + cheap
        messages: [
          {
            role: "system",
            content: "You are an assistant that outputs only valid JSON objects."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 800
      })
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Samba API Error Detail:", err);
      throw new Error(`SambaNova API error: ${res.status}`);
    }

    const data: any = await res.json();
    const rawText = data?.choices?.[0]?.message?.content;

    if (!rawText) {
      throw new Error("Empty response from SambaNova");
    }

    // 🔒 SAFE PARSE (NO CRASH)
    const analysis = extractJSON(rawText);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // 🌟 PERFECT LOGS
    const typeEmoji = analysis.leadType === 'hot' ? '🔥' : analysis.leadType === 'warm' ? '☀️' : '❄️';
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✨ [AI ANALYSIS SUCCESS] ${leadData.businessName}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`   ⏱️  Time: ${duration}s`);
    console.log(`   🧠  Model: Llama-3.1-8B-Instruct`);
    console.log(`   🎯  Status: ${typeEmoji} ${analysis.leadType.toUpperCase()}`);
    console.log(`   📈  Lead Score: ${analysis.score}%`);
    console.log(`   💰  Conversion Probability: ${analysis.conversionProbability}%`);
    console.log(`   📝  Reason: ${analysis.reason}`);
    console.log(`   🛠️  Target Offer: ${analysis.idealSolution}`);
    console.log(`   💡  Outreach Hook: "${analysis.firstMessageHook}"`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    return analysis;

  } catch (error: any) {
    console.error(`\n❌ [AI ANALYSIS FAILED] ${leadData.businessName}:`, error.message);

    // 🔒 HARD FALLBACK (LOGIC-BASED, NEVER FAILS)
    const rating = leadData.rating ?? 0;
    const reviews = leadData.reviewCount ?? 0;
    const hasWebsite = Boolean(leadData.website);
    const isHot = rating >= 4 && reviews >= 50 && !hasWebsite;

    return {
      score: isHot ? 85 : 60,
      leadType: isHot ? 'hot' : hasWebsite ? 'warm' : 'cold',
      reason: isHot
        ? 'Strong Google presence but no website.'
        : hasWebsite
          ? 'Business is established but can be improved.'
          : 'Weak or limited online signals.',
      whatToSell: hasWebsite
        ? ['Website Redesign', 'Performance Marketing']
        : ['Website Development', 'SEO', 'Google Leads CRM'],
      firstMessageHook: hasWebsite
        ? 'We help local businesses convert more visitors into customers.'
        : 'Loved your Google reviews—noticed you don’t have a website yet.',
      followUpMessage: 'Checking in to see if you received my previous message regarding your business growth.',
      conversionProbability: isHot ? 40 : 15,
      painPoints: hasWebsite ? ['Outdated design', 'Slow loading'] : ['No online presence', 'Missing local leads'],
      idealSolution: hasWebsite ? 'Complete website overhaul and SEO' : 'New conversion-focused website'
    };
  }
}
