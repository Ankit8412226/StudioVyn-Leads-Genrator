import type { Metadata } from 'next';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api';
const API_BASE = API_URL.replace(/\/api\/?$/, '');
const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '';

async function fetchLead(id: string) {
  try {
    const res = await fetch(`${API_URL}/leads/${id}`, { cache: 'no-store' });
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = await fetchLead(id);
  const lead = data?.data?.lead;
  const businessName = lead?.businessName || lead?.fullName || 'Your Business';
  const heroImageUrl = lead?.heroImagePath
    ? `${API_BASE}${lead.heroImagePath.startsWith('/') ? '' : '/'}${lead.heroImagePath}`
    : null;

  return {
    title: `${businessName} — Custom Website Demo | Studiovyn`,
    description: `I've designed a specialized landing page for ${businessName}. See the mockup and why it will help you grow.`,
    openGraph: {
      title: `${businessName} x Studiovyn Demo`,
      description: `See the new digital face of ${businessName}. Custom built for ${lead?.city || 'you'}.`,
      images: heroImageUrl ? [{ url: heroImageUrl, width: 1200, height: 630, alt: businessName }] : [],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${businessName} Custom Mockup`,
      description: `See your personalized website demo by Studiovyn.`,
      images: heroImageUrl ? [heroImageUrl] : [],
    },
  };
}

export default async function DemoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await fetchLead(id);
  const lead = data?.data?.lead;

  if (!data?.success || !lead) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <div style={{ textAlign: 'center', color: 'white' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🔍</div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>Demo not found</h1>
          <p style={{ marginTop: 8, color: '#94a3b8' }}>This link may have expired or the page was removed.</p>
        </div>
      </div>
    );
  }

  const heroImageUrl = lead.heroImagePath
    ? `${API_BASE}${lead.heroImagePath.startsWith('/') ? '' : '/'}${lead.heroImagePath}`
    : null;

  const businessName = lead.businessName || lead.fullName || 'your business';
  const category = lead.category || 'your business';
  const city = lead.city || '';

  const whatsappDigits = WHATSAPP_NUMBER.replace(/\D/g, '');
  const whatsappText = encodeURIComponent(
    `Hi! I just saw the personalized demo you built for ${businessName}. I'm interested — when can we talk?`
  );
  const whatsappLink = whatsappDigits ? `https://wa.me/${whatsappDigits}?text=${whatsappText}` : null;

  const painPoints: string[] = lead.aiPainPoints ?? [
    'Potential customers can\'t find you easily online',
    'No easy way for customers to contact or book you instantly',
    'Missing out on leads who search and leave without calling',
  ];

  const bullets: string[] = lead.aiLandingBullets ?? [
    '✓ Mobile-first landing page ready in 48 hours',
    '✓ WhatsApp & call button for instant lead capture',
    '✓ Google-ready profile to show up in local search',
  ];

  const headline = lead.aiLandingHeadline || `More Customers for ${businessName} — Starting This Week`;
  const subhead = lead.aiLandingSubhead || `We built a personalised demo to show exactly how your ${category} business can get more calls, walk-ins, and bookings online.`;
  const outreachAngle = lead.aiOutreachAngle || `A quick modern landing page built specifically for ${category} businesses${city ? ` in ${city}` : ''}.`;
  const idealSolution = lead.aiIdealSolution || 'A fast mobile-friendly page + WhatsApp lead capture + Google-optimised listing.';
  const cta = lead.aiLandingCta || 'Book a FREE 15-Min Demo Call';
  const rating = lead.rating;
  const reviewCount = lead.reviewCount;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', system-ui, -apple-system, sans-serif; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.4); }
          50% { box-shadow: 0 0 0 12px rgba(34,197,94,0); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        .fade-up-1 { animation: fadeUp 0.6s ease-out 0.1s both; }
        .fade-up-2 { animation: fadeUp 0.6s ease-out 0.25s both; }
        .fade-up-3 { animation: fadeUp 0.6s ease-out 0.4s both; }
        .fade-up-4 { animation: fadeUp 0.6s ease-out 0.55s both; }
        .fade-up-5 { animation: fadeUp 0.6s ease-out 0.7s both; }
        .wa-btn { animation: pulse-glow 2s infinite; }
        .float { animation: float 3s ease-in-out infinite; }

        .pain-item:hover { transform: translateX(4px); background: #fef2f2 !important; }
        .bullet-item:hover { transform: translateX(4px); background: #f0fdf4 !important; }
        .pain-item, .bullet-item { transition: all 0.2s ease; }

        @media (max-width: 640px) {
          .hero-title { font-size: 28px !important; }
          .hero-sub { font-size: 16px !important; }
          .section-grid { grid-template-columns: 1fr !important; }
          .cta-section { padding: 32px 20px !important; }
        }
      `}</style>

      <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'Inter', system-ui, sans-serif", color: '#0f172a' }}>

        {/* ── TOP TRUST BAR ── */}
        <div style={{ background: 'linear-gradient(90deg, #6366f1, #8b5cf6)', padding: '10px 24px', textAlign: 'center' }}>
          <p style={{ color: 'white', fontSize: 13, fontWeight: 600, letterSpacing: 0.3 }}>
            🔒 This is a private, personalized demo built exclusively for <strong>{businessName}</strong>
          </p>
        </div>

        {/* ── HERO SECTION ── */}
        <section style={{ position: 'relative', background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)', overflow: 'hidden', paddingBottom: 0 }}>
          {/* Background decoration */}
          <div style={{ position: 'absolute', top: -100, right: -100, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)' }} />
          <div style={{ position: 'absolute', bottom: -50, left: -50, width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)' }} />

          <div style={{ maxWidth: 900, margin: '0 auto', padding: '56px 24px 0', position: 'relative', zIndex: 1 }}>
            {/* Label */}
            <div className="fade-up-1" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: 999, padding: '6px 16px', marginBottom: 24 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#818cf8', animation: 'pulse-glow 2s infinite' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#a5b4fc', letterSpacing: 1, textTransform: 'uppercase' }}>
                Personalized Demo · Built for {businessName}
              </span>
            </div>

            {/* Headline */}
            <h1 className="hero-title fade-up-2" style={{ fontSize: 42, fontWeight: 900, color: 'white', lineHeight: 1.15, marginBottom: 20, letterSpacing: -0.5 }}>
              {headline}
            </h1>

            {/* Subhead */}
            <p className="hero-sub fade-up-3" style={{ fontSize: 18, color: '#94a3b8', lineHeight: 1.7, marginBottom: 32, maxWidth: 680 }}>
              {subhead}
            </p>

            {/* Badges */}
            <div className="fade-up-4" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 40 }}>
              {rating && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 8, padding: '8px 14px' }}>
                  <span style={{ fontSize: 16 }}>⭐</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#fbbf24' }}>{rating} Stars</span>
                  {reviewCount && <span style={{ fontSize: 12, color: '#78716c' }}>({reviewCount} reviews)</span>}
                </div>
              )}
              {city && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 14px' }}>
                  <span style={{ fontSize: 14 }}>📍</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#cbd5e1' }}>{city}</span>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: '8px 14px' }}>
                <span style={{ fontSize: 14 }}>🚀</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#4ade80' }}>Ready in 48 hrs</span>
              </div>
            </div>
          </div>

          {/* Hero image — full width, bottom-edge touching */}
          {heroImageUrl && (
            <div className="fade-up-5" style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px' }}>
              <div style={{
                borderRadius: '20px 20px 0 0',
                overflow: 'hidden',
                boxShadow: '0 -20px 80px rgba(99,102,241,0.3), 0 40px 80px rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderBottom: 'none',
              }}>
                <img
                  src={heroImageUrl}
                  alt={`Hero banner for ${businessName}`}
                  style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'cover', maxHeight: 420 }}
                />
                {/* Glass overlay at bottom of image */}
                <div style={{
                  background: 'linear-gradient(0deg, rgba(15,23,42,0.9) 0%, transparent 100%)',
                  marginTop: -80,
                  height: 80,
                  position: 'relative',
                  zIndex: 1,
                }} />
              </div>
            </div>
          )}
        </section>

        {/* ── MAIN CONTENT ── */}
        <main style={{ maxWidth: 900, margin: '0 auto', padding: '48px 24px 80px' }}>

          {/* ── OUTREACH ANGLE / YOUR EDGE ── */}
          <div style={{ background: 'linear-gradient(135deg, #eff6ff, #f5f3ff)', border: '1px solid #c7d2fe', borderRadius: 16, padding: '20px 24px', marginBottom: 40, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div style={{ fontSize: 28, flexShrink: 0 }}>💡</div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>Why We Reached Out</p>
              <p style={{ fontSize: 16, color: '#334155', lineHeight: 1.6, fontWeight: 500 }}>{outreachAngle}</p>
            </div>
          </div>

          {/* ── PAIN POINTS + SOLUTION GRID ── */}
          <div className="section-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 40 }}>

            {/* Pain Points */}
            <div style={{ background: 'white', borderRadius: 20, padding: 28, boxShadow: '0 4px 24px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>⚠️</div>
                <div>
                  <p style={{ fontSize: 12, color: '#ef4444', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>What's Costing You Money</p>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>Current Pain Points</h2>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {painPoints.map((p, idx) => (
                  <div key={idx} className="pain-item" style={{ display: 'flex', gap: 12, padding: '12px 14px', borderRadius: 12, background: '#fff5f5', border: '1px solid #fee2e2', color: '#7f1d1d', fontSize: 14, lineHeight: 1.5, cursor: 'default' }}>
                    <span style={{ flexShrink: 0, color: '#ef4444', fontWeight: 700 }}>✗</span>
                    <span>{p}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* What We'll Build */}
            <div style={{ background: 'white', borderRadius: 20, padding: 28, boxShadow: '0 4px 24px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🎯</div>
                <div>
                  <p style={{ fontSize: 12, color: '#16a34a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>Our Solution</p>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>What We'll Build</h2>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {bullets.map((b, idx) => (
                  <div key={idx} className="bullet-item" style={{ display: 'flex', gap: 12, padding: '12px 14px', borderRadius: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#14532d', fontSize: 14, lineHeight: 1.5, cursor: 'default' }}>
                    <span style={{ flexShrink: 0, color: '#16a34a', fontWeight: 700 }}>✓</span>
                    <span>{b.replace(/^[✓✗•\-\s]+/, '')}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── RECOMMENDED PACKAGE ── */}
          <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)', borderRadius: 24, padding: '36px 36px 40px', marginBottom: 40, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.2) 0%, transparent 70%)' }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 999, padding: '4px 12px', marginBottom: 16 }}>
                <span style={{ fontSize: 12 }}>⚡</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: 0.8 }}>Recommended Just for {businessName}</span>
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: 'white', marginBottom: 12 }}>The Complete Growth Package</h2>
              <p style={{ fontSize: 16, color: '#94a3b8', lineHeight: 1.7, marginBottom: 28, maxWidth: 560 }}>
                {idealSolution}
              </p>

              {/* Package Features */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 32 }}>
                {[
                  { icon: '🌐', label: 'Mobile-first Website', sub: 'Fast, Google-indexed' },
                  { icon: '💬', label: 'WhatsApp Integration', sub: 'Instant lead capture' },
                  { icon: '📊', label: 'Analytics Dashboard', sub: 'Track every visitor' },
                  { icon: '🔍', label: 'Local SEO Setup', sub: 'Rank in Google Maps' },
                ].map((f) => (
                  <div key={f.label} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span style={{ fontSize: 22 }}>{f.icon}</span>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: 'white', marginBottom: 2 }}>{f.label}</p>
                      <p style={{ fontSize: 11, color: '#64748b' }}>{f.sub}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* CTA Buttons */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
                {whatsappLink && (
                  <a
                    href={whatsappLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="wa-btn"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '16px 28px',
                      borderRadius: 14,
                      background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                      color: 'white',
                      fontWeight: 800,
                      fontSize: 16,
                      textDecoration: 'none',
                      boxShadow: '0 8px 32px rgba(34,197,94,0.4)',
                      transition: 'transform 0.2s',
                    }}
                  >
                    <svg width="22" height="22" viewBox="0 0 32 32" fill="white" xmlns="http://www.w3.org/2000/svg"><path d="M16 0C7.163 0 0 7.163 0 16c0 2.823.738 5.47 2.028 7.768L0 32l8.447-2.007A15.93 15.93 0 0016 32c8.837 0 16-7.163 16-16S24.837 0 16 0zm0 29.333c-2.65 0-5.13-.688-7.28-1.894l-.521-.299-5.01 1.191 1.27-4.887-.33-.546A13.3 13.3 0 012.667 16C2.667 8.636 8.636 2.667 16 2.667S29.333 8.636 29.333 16 23.364 29.333 16 29.333z"/><path d="M24.09 19.778c-.39-.195-2.31-1.14-2.668-1.27-.357-.13-.618-.195-.878.195-.26.39-1.01 1.27-1.237 1.53-.228.26-.455.293-.846.098-.39-.195-1.648-.608-3.139-1.936-1.16-1.033-1.944-2.31-2.172-2.7-.228-.39-.024-.6.171-.795.176-.175.39-.455.586-.683.195-.228.26-.39.39-.65.13-.26.065-.488-.033-.683-.098-.195-.878-2.115-1.203-2.895-.317-.76-.64-.657-.878-.67-.228-.012-.488-.015-.748-.015-.26 0-.683.098-1.04.488-.357.39-1.36 1.328-1.36 3.24s1.393 3.76 1.587 4.02c.195.26 2.74 4.183 6.638 5.863.927.4 1.65.64 2.214.819.93.297 1.778.255 2.447.154.747-.113 2.31-.944 2.636-1.855.325-.912.325-1.693.228-1.855-.098-.163-.357-.26-.748-.455z"/></svg>
                    {cta}
                  </a>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 20px', borderRadius: 14, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
                  <span style={{ fontSize: 18 }}>🎁</span>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>100% Free Demo</p>
                    <p style={{ fontSize: 11, color: '#64748b' }}>No payment required</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── SOCIAL PROOF / TRUST STRIP ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 40 }}>
            {[
              { stat: '500+', label: 'Businesses Served', icon: '🏆' },
              { stat: '48 hrs', label: 'Delivery Time', icon: '⚡' },
              { stat: '4.9★', label: 'Client Rating', icon: '⭐' },
              { stat: '3×', label: 'Avg Lead Increase', icon: '📈' },
            ].map((item) => (
              <div key={item.label} style={{ background: 'white', borderRadius: 16, padding: '20px 16px', textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>{item.icon}</div>
                <p style={{ fontSize: 28, fontWeight: 900, color: '#0f172a', marginBottom: 4 }}>{item.stat}</p>
                <p style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>{item.label}</p>
              </div>
            ))}
          </div>

          {/* ── FINAL CTA BOTTOM ── */}
          {whatsappLink && (
            <div style={{ background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', border: '2px solid #bbf7d0', borderRadius: 20, padding: '32px 28px', textAlign: 'center' }}>
              <div className="float" style={{ fontSize: 48, marginBottom: 12 }}>👋</div>
              <h3 style={{ fontSize: 22, fontWeight: 800, color: '#14532d', marginBottom: 8 }}>
                This demo is waiting for you, {businessName}!
              </h3>
              <p style={{ fontSize: 15, color: '#166534', marginBottom: 24, lineHeight: 1.6 }}>
                Reply on WhatsApp right now — we'll send the full demo walkthrough, timeline, and pricing in under 5 minutes.
              </p>
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '16px 36px',
                  borderRadius: 14,
                  background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                  color: 'white',
                  fontWeight: 800,
                  fontSize: 17,
                  textDecoration: 'none',
                  boxShadow: '0 8px 32px rgba(34,197,94,0.35)',
                }}
              >
                💬 Chat on WhatsApp Now
              </a>
              <p style={{ fontSize: 12, color: '#4ade80', marginTop: 14 }}>⚡ Average response time: &lt; 5 minutes</p>
            </div>
          )}
        </main>

        {/* ── FOOTER ── */}
        <footer style={{ borderTop: '1px solid #e2e8f0', padding: '20px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: '#94a3b8' }}>
            🔒 This is a private, personalized page. Built with ❤️ by <strong style={{ color: '#6366f1' }}>Studiovyn</strong>
          </p>
        </footer>
      </div>
    </>
  );
}
