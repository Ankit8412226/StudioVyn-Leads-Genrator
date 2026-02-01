'use client';

import {
  Clock,
  Flame,
  Globe,
  MapPin,
  MessageSquare,
  Phone,
  RefreshCw,
  Search,
  Star,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

async function fetchAPI(endpoint: string, options?: RequestInit) {
  const res = await fetch(`${API_URL}${endpoint}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  return res.json();
}

interface Lead {
  _id: string;
  fullName: string;
  businessName?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  city?: string;
  category?: string;
  rating?: number;
  reviewCount?: number;
  priceLevel?: string;
  description?: string;
  openingHours?: string[];
  attributes?: string[];
  source: string;
  status: string;
  isHotLead: boolean;
  priority: string;
  aiScore?: number;
  aiPotential?: string;
  aiJustification?: string;
  aiRecommendedServices?: string[];
  aiOutreachAngle?: string;
  aiFollowUpMessage?: string;
  aiConversionProbability?: number;
  aiPainPoints?: string[];
  aiIdealSolution?: string;
  createdAt: string;
}

interface Stats {
  totalLeads: number;
  hotLeads: number;
  newLeads: number;
  contactedLeads: number;
  wonLeads: number;
  conversionRate: string | number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [scraperOpen, setScraperOpen] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [scrapeForm, setScrapeForm] = useState({ query: '', location: '', limit: 30 });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, leadsRes] = await Promise.all([
        fetchAPI('/analytics/overview'),
        fetchAPI('/leads?limit=100&sortBy=createdAt&sortOrder=desc'),
      ]);
      if (statsRes.success) setStats(statsRes.data.stats);
      if (leadsRes.success) setLeads(leadsRes.data.leads);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleScrape = async () => {
    if (!scrapeForm.query) return;
    setScraperOpen(false);
    setScraping(true);
    try {
      const res = await fetchAPI('/scraper/google-maps', {
        method: 'POST',
        body: JSON.stringify(scrapeForm),
      });
      if (res.success) {
        alert(`✅ Scraped ${res.data.scraped} leads!\n🔥 Hot Leads: ${res.data.hotLeads}\n💾 Saved: ${res.data.saved}`);
        fetchData();
      } else {
        alert(`❌ Error: ${res.error}`);
      }
    } catch (error: any) {
      alert(`❌ Error: ${error.message}`);
    }
    setScraping(false);
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await fetchAPI(`/leads/${id}`, { method: 'PUT', body: JSON.stringify({ status }) });
      setLeads(leads.map((l) => (l._id === id ? { ...l, status } : l)));
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const getWhatsAppLink = (phone: string) => `https://wa.me/${phone.replace(/\D/g, '')}`;

  const filteredLeads = leads.filter((lead) => {
    if (filter === 'hot' && !lead.isHotLead) return false;
    if (filter === 'new' && lead.status !== 'new') return false;
    if (filter === 'contacted' && lead.status !== 'contacted') return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return lead.fullName?.toLowerCase().includes(q) || lead.businessName?.toLowerCase().includes(q) || lead.phone?.includes(q);
    }
    return true;
  });

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        <div style={{ textAlign: 'center', color: 'white' }}>
          <RefreshCw style={{ width: 48, height: 48, animation: 'spin 1s linear infinite' }} />
          <p style={{ marginTop: 16, fontSize: 18 }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <header style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '20px 32px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)' }}>
              <Users style={{ width: 24, height: 24, color: 'white' }} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'white' }}>Studiovyn Leads</h1>
              <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.8)' }}>Hot leads finder</p>
            </div>
          </div>
          <button
            onClick={() => setScraperOpen(true)}
            disabled={scraping}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 12, border: 'none', background: 'white', color: '#667eea', fontSize: 15, fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', transition: 'transform 0.2s' }}
          >
            {scraping ? <RefreshCw style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} /> : <Search style={{ width: 18, height: 18 }} />}
            {scraping ? 'Scraping...' : 'Scrape Leads'}
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 32px' }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 32 }}>
          {[
            { label: 'Total Leads', value: stats?.totalLeads || 0, icon: Users, color: '#667eea', bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
            { label: 'Hot Leads', value: stats?.hotLeads || 0, icon: Flame, color: '#ef4444', bg: 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)' },
            { label: 'New', value: stats?.newLeads || 0, icon: Clock, color: '#f59e0b', bg: 'linear-gradient(135deg, #f59e0b 0%, #eab308 100%)' },
            { label: 'Contacted', value: stats?.contactedLeads || 0, icon: Phone, color: '#3b82f6', bg: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)' },
            { label: 'Won', value: stats?.wonLeads || 0, icon: Trophy, color: '#10b981', bg: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)' },
          ].map((stat) => (
            <div key={stat.label} style={{ background: 'white', borderRadius: 16, padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ margin: 0, fontSize: 14, color: '#64748b', fontWeight: 500 }}>{stat.label}</p>
                  <p style={{ margin: '8px 0 0', fontSize: 32, fontWeight: 700, color: '#0f172a' }}>{stat.value}</p>
                </div>
                <div style={{ width: 56, height: 56, borderRadius: 14, background: stat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px rgba(0,0,0,0.15)' }}>
                  <stat.icon style={{ width: 28, height: 28, color: 'white' }} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 24, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
            <Search style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search leads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '14px 16px 14px 48px', borderRadius: 12, border: '2px solid #e2e8f0', fontSize: 15, outline: 'none', transition: 'border-color 0.2s', background: '#fff', color: '#0f172a' }}
            />
          </div>
          {['all', 'hot', 'new', 'contacted'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{ padding: '12px 20px', borderRadius: 10, background: filter === f ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'white', color: filter === f ? 'white' : '#64748b', fontSize: 14, fontWeight: 600, cursor: 'pointer', boxShadow: filter === f ? '0 4px 15px rgba(102,126,234,0.4)' : '0 2px 8px rgba(0,0,0,0.05)', border: filter === f ? 'none' : '1px solid #e2e8f0' }}
            >
              {f === 'hot' ? '🔥 Hot' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
          <button onClick={fetchData} style={{ padding: 12, borderRadius: 10, border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer' }}>
            <RefreshCw style={{ width: 18, height: 18, color: '#64748b' }} />
          </button>
        </div>

        {/* Leads Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 20 }}>
          {filteredLeads.map((lead) => (
            <div key={lead._id} style={{ background: lead.isHotLead ? 'linear-gradient(135deg, #fef2f2 0%, #fff 100%)' : 'white', borderRadius: 16, padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: lead.isHotLead ? '2px solid #fecaca' : '1px solid #e2e8f0', transition: 'transform 0.2s, box-shadow 0.2s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#0f172a' }}>{lead.businessName || lead.fullName}</h3>
                    {lead.isHotLead && <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, background: '#fef2f2', color: '#dc2626', fontSize: 12, fontWeight: 600 }}><Flame style={{ width: 12, height: 12 }} /> Hot</span>}
                    {lead.aiPotential === 'hot' && <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, background: '#f0f9ff', color: '#0369a1', fontSize: 12, fontWeight: 600 }}>🤖 AI High</span>}
                  </div>
                  {lead.category && <p style={{ margin: '4px 0 0', fontSize: 14, color: '#64748b' }}>{lead.category}</p>}
                </div>
                <select
                  value={lead.status}
                  onChange={(e) => handleStatusChange(lead._id, e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, fontWeight: 500, background: lead.status === 'won' ? '#dcfce7' : lead.status === 'contacted' ? '#dbeafe' : '#f1f5f9', color: lead.status === 'won' ? '#16a34a' : lead.status === 'contacted' ? '#2563eb' : '#475569', cursor: 'pointer' }}
                >
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="interested">Interested</option>
                  <option value="qualified">Qualified</option>
                  <option value="won">Won</option>
                  <option value="lost">Lost</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                {lead.rating && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 14, color: '#f59e0b' }}>
                    <Star style={{ width: 16, height: 16, fill: '#fbbf24' }} /> {lead.rating} ({lead.reviewCount || 0})
                  </span>
                )}
                {lead.city && <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 14, color: '#64748b' }}><MapPin style={{ width: 16, height: 16 }} /> {lead.city}</span>}
                {lead.priceLevel && <span style={{ padding: '2px 8px', background: '#fef3c7', color: '#92400e', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{lead.priceLevel}</span>}
                {lead.openingHours && lead.openingHours.length > 0 && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '2px 8px', background: '#f1f5f9', color: '#475569', borderRadius: 6 }}>
                    <Clock style={{ width: 14, height: 14 }} /> {lead.openingHours[0].split('⋅')[0]}
                  </span>
                )}
              </div>

              {lead.attributes && lead.attributes.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                  {lead.attributes.slice(0, 4).map(attr => (
                    <span key={attr} style={{ fontSize: 11, color: '#10b981', background: '#ecfdf5', padding: '2px 8px', borderRadius: 4, fontWeight: 500 }}>
                      ✓ {attr}
                    </span>
                  ))}
                </div>
              )}

              {lead.description && (
                <p style={{ margin: '0 0 16px', fontSize: 13, color: '#475569', fontStyle: 'italic', lineHeight: 1.4, borderLeft: '3px solid #e2e8f0', paddingLeft: 12 }}>
                  "{lead.description}"
                </p>
              )}

              <div style={{ marginBottom: 20 }}>
                {lead.aiScore && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ display: 'flex', gap: 12 }}>
                        <div>
                          <span style={{ display: 'block', fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Match Score</span>
                          <span style={{ fontSize: 18, fontWeight: 800, color: lead.aiScore >= 80 ? '#16a34a' : '#2563eb' }}>{lead.aiScore}%</span>
                        </div>
                        {lead.aiConversionProbability && (
                          <div>
                            <span style={{ display: 'block', fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Conversion</span>
                            <span style={{ fontSize: 18, fontWeight: 800, color: '#7c3aed' }}>{lead.aiConversionProbability}%</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ width: '100%', height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${lead.aiScore}%`, height: '100%', background: lead.aiScore >= 80 ? 'linear-gradient(90deg, #10b981, #34d399)' : 'linear-gradient(90deg, #6366f1, #818cf8)' }} />
                    </div>
                  </div>
                )}
              </div>

              {lead.aiJustification && (
                <div style={{ marginBottom: 16, padding: '16px', background: '#f8fafc', borderRadius: 14, border: '1px solid #e2e8f0', position: 'relative' }}>
                  <div style={{ position: 'absolute', top: -10, left: 12, padding: '2px 8px', background: '#334155', color: 'white', borderRadius: 6, fontSize: 10, fontWeight: 700 }}>AI STRATEGY</div>

                  <p style={{ margin: '0 0 12px', fontSize: 13, color: '#1e293b', lineHeight: 1.5 }}>
                    {lead.aiJustification}
                  </p>

                  {(lead.aiOutreachAngle || lead.aiFollowUpMessage) && (
                    <div style={{ padding: '12px', background: 'white', borderRadius: 12, border: '1px solid #cbd5e1', marginBottom: 12 }}>
                      {lead.aiOutreachAngle && (
                        <div style={{ marginBottom: 10 }}>
                          <span style={{ display: 'block', fontSize: 10, color: '#64748b', fontWeight: 700, marginBottom: 4, letterSpacing: '0.05em' }}>PRIMARY HOOK</span>
                          <p style={{ margin: 0, fontSize: 12, color: '#0f172a', fontWeight: 500, lineHeight: 1.4 }}>"{lead.aiOutreachAngle}"</p>
                        </div>
                      )}
                      {lead.aiFollowUpMessage && (
                        <div>
                          <span style={{ display: 'block', fontSize: 10, color: '#64748b', fontWeight: 700, marginBottom: 4, letterSpacing: '0.05em' }}>FOLLOW-UP</span>
                          <p style={{ margin: 0, fontSize: 12, color: '#475569', fontStyle: 'italic', lineHeight: 1.4 }}>"{lead.aiFollowUpMessage}"</p>
                        </div>
                      )}
                    </div>
                  )}

                  {lead.aiPainPoints && lead.aiPainPoints.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <span style={{ display: 'block', fontSize: 10, color: '#ef4444', fontWeight: 700, marginBottom: 6, letterSpacing: '0.05em' }}>PAIN POINTS</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {lead.aiPainPoints.map(point => (
                          <span key={point} style={{ padding: '2px 8px', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: 6, fontSize: 11, color: '#b91c1c' }}>
                            ✕ {point}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {lead.aiIdealSolution && (
                    <div style={{ padding: '12px', background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', borderRadius: 12, border: '1px solid #bbf7d0', marginBottom: 12 }}>
                      <span style={{ display: 'block', fontSize: 10, color: '#15803d', fontWeight: 700, marginBottom: 4, letterSpacing: '0.05em' }}>IDEAL SOLUTION</span>
                      <p style={{ margin: 0, fontSize: 13, color: '#166534', fontWeight: 600 }}>{lead.aiIdealSolution}</p>
                    </div>
                  )}

                  {lead.aiRecommendedServices && lead.aiRecommendedServices.length > 0 && (
                    <div>
                      <span style={{ display: 'block', fontSize: 10, color: '#64748b', fontWeight: 700, marginBottom: 6, letterSpacing: '0.05em' }}>RECOMMENDED SERVICES</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {lead.aiRecommendedServices.map(service => (
                          <span key={service} style={{ padding: '4px 10px', background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 11, color: '#475569', fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                            {service}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {lead.phone && (
                  <>
                    <a href={`tel:${lead.phone}`} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 10, background: '#eff6ff', color: '#2563eb', fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>
                      <Phone style={{ width: 16, height: 16 }} /> Call
                    </a>
                    <a href={getWhatsAppLink(lead.phone)} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 10, background: '#dcfce7', color: '#16a34a', fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>
                      <MessageSquare style={{ width: 16, height: 16 }} /> WhatsApp
                    </a>
                  </>
                )}
                {lead.website && (
                  <a href={lead.website} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 10, background: '#f1f5f9', color: '#475569', fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>
                    <Globe style={{ width: 16, height: 16 }} /> Website
                  </a>
                )}
              </div>

              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8' }}>
                <span>{new Date(lead.createdAt).toLocaleDateString()}</span>
                <span style={{ textTransform: 'capitalize', color: '#667eea', fontWeight: 500 }}>{lead.source.replace('_', ' ')}</span>
              </div>
            </div>
          ))}
        </div>

        {
          filteredLeads.length === 0 && (
            <div style={{ textAlign: 'center', padding: 80 }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                <Search style={{ width: 32, height: 32, color: '#94a3b8' }} />
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 600, color: '#0f172a', margin: '0 0 8px' }}>No leads found</h3>
              <p style={{ fontSize: 15, color: '#64748b', margin: '0 0 24px' }}>Start by scraping some leads from Google Maps</p>
              <button onClick={() => setScraperOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 28px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer', boxShadow: '0 8px 20px rgba(102,126,234,0.4)' }}>
                <Search style={{ width: 18, height: 18 }} /> Scrape Leads
              </button>
            </div>
          )
        }
      </main>

      {/* Scraper Modal */}
      {scraperOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: 24, padding: 32, width: '100%', maxWidth: 480, boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0f172a' }}>🔍 Scrape Google Maps</h2>
                <p style={{ margin: '4px 0 0', fontSize: 14, color: '#64748b' }}>Find hot leads without any API keys</p>
              </div>
              <button onClick={() => setScraperOpen(false)} style={{ padding: 8, borderRadius: 8, border: 'none', background: '#f1f5f9', cursor: 'pointer' }}>
                <X style={{ width: 20, height: 20, color: '#64748b' }} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Search Query *</label>
                <input
                  type="text"
                  placeholder="e.g., restaurants, marketing agencies, gyms..."
                  value={scrapeForm.query}
                  onChange={(e) => setScrapeForm({ ...scrapeForm, query: e.target.value })}
                  style={{ width: '100%', padding: 14, borderRadius: 12, border: '2px solid #e2e8f0', fontSize: 15, outline: 'none', boxSizing: 'border-box', background: '#fff', color: '#0f172a' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Location</label>
                <input
                  type="text"
                  placeholder="e.g., Mumbai, Delhi, Bangalore..."
                  value={scrapeForm.location}
                  onChange={(e) => setScrapeForm({ ...scrapeForm, location: e.target.value })}
                  style={{ width: '100%', padding: 14, borderRadius: 12, border: '2px solid #e2e8f0', fontSize: 15, outline: 'none', boxSizing: 'border-box', background: '#fff', color: '#0f172a' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Number of Leads</label>
                <input
                  type="number"
                  min={5}
                  max={100}
                  value={scrapeForm.limit}
                  onChange={(e) => setScrapeForm({ ...scrapeForm, limit: parseInt(e.target.value, 10) })}
                  style={{ width: '100%', padding: 14, borderRadius: 12, border: '2px solid #e2e8f0', fontSize: 15, outline: 'none', boxSizing: 'border-box', background: '#fff', color: '#0f172a' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
              <button onClick={() => setScraperOpen(false)} style={{ flex: 1, padding: 16, borderRadius: 12, border: '2px solid #e2e8f0', background: 'white', color: '#475569', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleScrape} disabled={!scrapeForm.query} style={{ flex: 1, padding: 16, borderRadius: 12, border: 'none', background: scrapeForm.query ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#e2e8f0', color: scrapeForm.query ? 'white' : '#94a3b8', fontSize: 15, fontWeight: 600, cursor: scrapeForm.query ? 'pointer' : 'not-allowed', boxShadow: scrapeForm.query ? '0 8px 20px rgba(102,126,234,0.4)' : 'none' }}>Start Scraping</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        button:hover { transform: translateY(-1px); }
        input:focus { border-color: #667eea !important; }
      `}</style>
    </div>
  );
}
