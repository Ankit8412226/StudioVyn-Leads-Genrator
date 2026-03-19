const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api';
const API_BASE = API_URL.replace(/\/api\/?$/, '');
const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '';

async function fetchLead(id: string) {
  const res = await fetch(`${API_URL}/leads/${id}`, { cache: 'no-store' });
  return res.json();
}

export default async function DemoPage({ params }: { params: { id: string } }) {
  const data = await fetchLead(params.id);
  const lead = data?.data?.lead;

  if (!data?.success || !lead) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <div style={{ textAlign: 'center', color: '#0f172a' }}>
          <h1 style={{ margin: 0, fontSize: 28 }}>Demo not found</h1>
          <p style={{ marginTop: 8, color: '#64748b' }}>We could not load this demo page.</p>
        </div>
      </div>
    );
  }

  const heroImageUrl = lead.heroImagePath
    ? `${API_BASE}${lead.heroImagePath.startsWith('/') ? '' : '/'}${lead.heroImagePath}`
    : null;
  const businessName = lead.businessName || lead.fullName || 'your business';
  const whatsappDigits = WHATSAPP_NUMBER.replace(/\D/g, '');
  const whatsappText = encodeURIComponent(`Hi, I saw the demo for ${businessName}. Can we talk?`);
  const whatsappLink = whatsappDigits ? `https://wa.me/${whatsappDigits}?text=${whatsappText}` : null;

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#0f172a' }}>
      <header style={{ padding: '48px 24px 24px', textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: 13, letterSpacing: 1.2, color: '#64748b', textTransform: 'uppercase' }}>Personalized Demo</p>
        <h1 style={{ margin: '12px 0 8px', fontSize: 36, fontWeight: 800 }}>
          {lead.aiLandingHeadline || `A modern online presence for ${lead.businessName || lead.fullName}`}
        </h1>
        <p style={{ margin: 0, fontSize: 18, color: '#475569' }}>
          {lead.aiLandingSubhead || 'Turn searches into bookings with a fast, trustworthy landing page.'}
        </p>
      </header>

      <main style={{ maxWidth: 1000, margin: '0 auto', padding: '0 24px 64px' }}>
        {heroImageUrl && (
          <div style={{ margin: '24px 0', borderRadius: 20, overflow: 'hidden', boxShadow: '0 18px 40px rgba(15, 23, 42, 0.15)' }}>
            <img src={heroImageUrl} alt="Demo hero" style={{ width: '100%', height: 'auto', display: 'block' }} />
          </div>
        )}

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24, marginTop: 24 }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 24, boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)', border: '1px solid #e2e8f0' }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 18 }}>Pain Points We Can Fix</h2>
            {(lead.aiPainPoints && lead.aiPainPoints.length > 0) ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {lead.aiPainPoints.map((p: string, idx: number) => (
                  <div key={idx} style={{ padding: '8px 12px', borderRadius: 10, background: '#f1f5f9', color: '#334155', fontSize: 14 }}>
                    {p}
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>We’ll highlight quick wins after a short demo.</p>
            )}
          </div>

          <div style={{ background: 'white', borderRadius: 16, padding: 24, boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)', border: '1px solid #e2e8f0' }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 18 }}>What The Demo Includes</h2>
            {(lead.aiLandingBullets && lead.aiLandingBullets.length > 0) ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {lead.aiLandingBullets.map((b: string, idx: number) => (
                  <div key={idx} style={{ padding: '8px 12px', borderRadius: 10, background: '#ecfeff', color: '#0f172a', fontSize: 14 }}>
                    {b}
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>Clear services, instant WhatsApp CTA, and a trust-first layout.</p>
            )}
          </div>
        </section>

        <section style={{ marginTop: 32, background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: 'white', borderRadius: 20, padding: 28, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>Recommended Solution</h2>
          <p style={{ margin: 0, fontSize: 15, color: 'rgba(255,255,255,0.85)' }}>
            {lead.aiIdealSolution || 'A lightweight landing page + WhatsApp lead capture + basic analytics.'}
          </p>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, alignSelf: 'flex-start', padding: '10px 16px', borderRadius: 12, background: '#22c55e', color: '#0f172a', fontWeight: 700, fontSize: 14 }}>
            {lead.aiLandingCta || 'Want a 2-minute demo?'}
          </div>
          {whatsappLink && (
            <a href={whatsappLink} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, alignSelf: 'flex-start', padding: '12px 18px', borderRadius: 12, background: 'white', color: '#0f172a', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
              Chat on WhatsApp
            </a>
          )}
        </section>

        <p style={{ marginTop: 24, color: '#64748b', fontSize: 13, textAlign: 'center' }}>
          Reply on WhatsApp to get the demo walkthrough and timeline.
        </p>
      </main>
    </div>
  );
}
