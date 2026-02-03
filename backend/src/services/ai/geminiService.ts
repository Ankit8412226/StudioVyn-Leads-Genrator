const SAMBA_API_KEY = "194a4a17-719f-4a4b-99da-6304f5c3ee0f";
const SAMBA_ENDPOINT = "https://api.sambanova.ai/v1/chat/completions";
const SAMBA_DAILY_LIMIT = Number(process.env.SAMBA_DAILY_LIMIT ?? 240);

let dailyRequestCount = 0;
let dailyWindowDate = new Date().toISOString().slice(0, 10); // UTC YYYY-MM-DD

function checkAndIncrementDailyLimit() {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== dailyWindowDate) {
    dailyWindowDate = today;
    dailyRequestCount = 0;
  }
  if (dailyRequestCount >= SAMBA_DAILY_LIMIT) {
    return false;
  }
  dailyRequestCount += 1;
  return true;
}

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

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeJsonLike(text: string): string {
  let cleaned = text.trim();

  // Strip code fences if present.
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\s*/, "").replace(/\s*```$/, "");
  }

  // Find the first JSON object.
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('No valid JSON found in LLM response');
  }

  cleaned = cleaned.slice(start, end + 1);

  // Normalize smart quotes.
  cleaned = cleaned
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");

  // Remove trailing commas before } or ].
  cleaned = cleaned.replace(/,\s*([}\]])/g, "$1");

  // Replace single-quoted strings with double quotes (best-effort).
  cleaned = cleaned.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_, inner) => {
    const escaped = inner.replace(/"/g, '\\"');
    return `"${escaped}"`;
  });

  return cleaned;
}

/**
 * 🔒 SAFE JSON EXTRACTOR
 * Never trust LLM output directly.
 */
function extractJSON(text: string): AIAnalysis {
  const raw = normalizeJsonLike(text);
  return JSON.parse(raw);
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
  if (!checkAndIncrementDailyLimit()) {
    console.warn(`⚠️  SambaNova daily limit reached (${SAMBA_DAILY_LIMIT}/day). Using fallback.`);
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
    const maxRetries = Number(process.env.SAMBA_MAX_RETRIES ?? 3);
    const baseDelayMs = Number(process.env.SAMBA_RETRY_BASE_MS ?? 600);
    const minDelayMs = Number(process.env.SAMBA_MIN_DELAY_MS ?? 150);
    let res: Response | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        const backoff = baseDelayMs * Math.pow(2, attempt - 1);
        const jitter = Math.floor(Math.random() * 200);
        await sleep(backoff + jitter);
      }

      // Light pacing between requests to reduce rate-limit bursts.
      if (minDelayMs > 0) {
        await sleep(minDelayMs);
      }

      res = await fetch(SAMBA_ENDPOINT, {
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
              content: "You are an assistant that outputs only valid JSON objects without code fences or extra text."
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

      if (res.ok) break;

      const retryAfter = Number(res.headers.get("retry-after") || "0");
      const err = await res.text();
      console.error("Samba API Error Detail:", err);

      if (res.status === 429 && attempt < maxRetries) {
        const waitMs = retryAfter > 0 ? retryAfter * 1000 : baseDelayMs;
        await sleep(waitMs);
        continue;
      }

      throw new Error(`SambaNova API error: ${res.status}`);
    }

    if (!res || !res.ok) {
      throw new Error("SambaNova API error: failed after retries");
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
