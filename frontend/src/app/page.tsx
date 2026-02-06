'use client';

import {
  Clock,
  Flame,
  MapPin,
  MessageSquare,
  Phone,
  RefreshCw,
  Search,
  Star,
  Trophy,
  Users,
  X
} from 'lucide-react';
import { useEffect, useState } from 'react';

const API_URL = 'https://studiovyn-leads-genrator.onrender.com/api';
const SCRAPER_API_URL = 'http://localhost:5000/api';

async function fetchAPI(endpoint: string, options?: RequestInit) {
  const res = await fetch(`${API_URL}${endpoint}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  return res.json();
}

async function fetchScraperAPI(endpoint: string, options?: RequestInit) {
  const res = await fetch(`${SCRAPER_API_URL}${endpoint}`, {
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
  const [scrapeForm, setScrapeForm] = useState({ query: '', location: '', limit: 30, source: 'all' as 'google' | 'all' });

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
      // Choose endpoint based on source selection
      const endpoint = scrapeForm.source === 'all' ? '/scraper/all-sources' : '/scraper/google-maps';

      const res = await fetchScraperAPI(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          query: scrapeForm.query,
          location: scrapeForm.location,
          limit: scrapeForm.limit,
        }),
      });

      if (res.success) {
        if (scrapeForm.source === 'all') {
          // Multi-source response
          alert(
            `✅ Multi-Source Scraping Complete!\n\n` +
            `📊 Sources:\n` +
            `   • Google Maps: ${res.data.sources?.googleMaps || 0} leads\n` +
            `   • JustDial: ${res.data.sources?.justDial || 0} leads\n` +
            `   • IndiaMART: ${res.data.sources?.indiaMART || 0} leads\n` +
            `   • Yelp (Intl): ${res.data.sources?.yelp || 0} leads\n\n` +
            `📈 Results:\n` +
            `   • Total Scraped: ${res.data.totalScraped || 0}\n` +
            `   • Unique Leads: ${res.data.uniqueLeads || 0}\n` +
            `   • 🔥 Hot Leads: ${res.data.hotLeads || 0}\n` +
            `   • 💾 Saved: ${res.data.saved || 0}\n` +
            `   • 📋 Duplicates: ${res.data.duplicates || 0}`
          );
        } else {
          // Google Maps only response
          alert(`✅ Scraped ${res.data.scraped} leads!\n🔥 Hot Leads: ${res.data.hotLeads}\n💾 Saved: ${res.data.saved}`);
        }
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
          {filteredLeads.map((lead) => {
            // Source badge styling
            const getSourceStyle = (source: string) => {
              switch (source) {
                case 'google_maps':
                  return { bg: '#dbeafe', color: '#2563eb', icon: '🗺️', label: 'Google Maps' };
                case 'justdial':
                  return { bg: '#fef3c7', color: '#d97706', icon: '📞', label: 'JustDial' };
                case 'indiamart':
                  return { bg: '#fce7f3', color: '#db2777', icon: '🏭', label: 'IndiaMART' };
                case 'yelp':
                  return { bg: '#ffedd5', color: '#ea580c', icon: '🌟', label: 'Yelp (Intl)' };
                default:
                  return { bg: '#f1f5f9', color: '#64748b', icon: '🌐', label: source };
              }
            };
            const sourceStyle = getSourceStyle(lead.source);

            return (
              <div key={lead._id} style={{ background: lead.isHotLead ? 'linear-gradient(135deg, #fef2f2 0%, #fff 100%)' : 'white', borderRadius: 16, padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: lead.isHotLead ? '2px solid #fecaca' : '1px solid #e2e8f0', transition: 'transform 0.2s, box-shadow 0.2s' }}>
                {/* Source Badge - Top */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    borderRadius: 20,
                    background: sourceStyle.bg,
                    color: sourceStyle.color,
                    fontSize: 12,
                    fontWeight: 600
                  }}>
                    {sourceStyle.icon} {sourceStyle.label}
                  </span>
                  {lead.isHotLead && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, background: '#fef2f2', color: '#dc2626', fontSize: 12, fontWeight: 600 }}>
                      <Flame style={{ width: 12, height: 12 }} /> Hot Lead
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#0f172a' }}>{lead.businessName || lead.fullName}</h3>
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
                  {!lead.website && (
                    <span style={{ padding: '2px 8px', background: '#dcfce7', color: '#16a34a', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                      🎯 No Website
                    </span>
                  )}
                </div>

                {lead.address && (
                  <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
                    📍 {lead.address}
                  </p>
                )}

                {lead.email && (
                  <p style={{ margin: '0 0 16px', fontSize: 13, color: '#2563eb' }}>
                    📧 {lead.email}
                  </p>
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
                  {lead.email && (
                    <a href={`mailto:${lead.email}`} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 10, background: '#fef3c7', color: '#d97706', fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>
                      📧 Email
                    </a>
                  )}
                </div>

                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8' }}>
                  <span>{new Date(lead.createdAt).toLocaleDateString()}</span>
                  <span style={{ fontWeight: 500 }}>{lead.phone}</span>
                </div>
              </div>
            );
          })}
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
          <div style={{ background: 'white', borderRadius: 24, padding: 32, width: '100%', maxWidth: 520, boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0f172a' }}>🔍 Scrape Leads</h2>
                <p style={{ margin: '4px 0 0', fontSize: 14, color: '#64748b' }}>Find hot leads without websites</p>
              </div>
              <button onClick={() => setScraperOpen(false)} style={{ padding: 8, borderRadius: 8, border: 'none', background: '#f1f5f9', cursor: 'pointer' }}>
                <X style={{ width: 20, height: 20, color: '#64748b' }} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Source Selection */}
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 10 }}>Data Sources</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <button
                    type="button"
                    onClick={() => setScrapeForm({ ...scrapeForm, source: 'google' })}
                    style={{
                      padding: '16px 12px',
                      borderRadius: 12,
                      border: scrapeForm.source === 'google' ? '2px solid #667eea' : '2px solid #e2e8f0',
                      background: scrapeForm.source === 'google' ? 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)' : 'white',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ fontSize: 20, marginBottom: 4 }}>🗺️</div>
                    <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 14 }}>Google Maps</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Single source</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setScrapeForm({ ...scrapeForm, source: 'all' })}
                    style={{
                      padding: '16px 12px',
                      borderRadius: 12,
                      border: scrapeForm.source === 'all' ? '2px solid #10b981' : '2px solid #e2e8f0',
                      background: scrapeForm.source === 'all' ? 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)' : 'white',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.2s',
                      position: 'relative',
                    }}
                  >
                    <div style={{ position: 'absolute', top: -8, right: 8, background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>
                      RECOMMENDED
                    </div>
                    <div style={{ fontSize: 20, marginBottom: 4 }}>🚀</div>
                    <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 14 }}>All Sources</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                      <span style={{ background: '#dbeafe', color: '#2563eb', padding: '1px 6px', borderRadius: 4, marginRight: 4 }}>Maps</span>
                      <span style={{ background: '#fef3c7', color: '#d97706', padding: '1px 6px', borderRadius: 4, marginRight: 4 }}>JustDial</span>
                      <span style={{ background: '#fce7f3', color: '#db2777', padding: '1px 6px', borderRadius: 4, marginRight: 4 }}>IndiaMART</span>
                      <span style={{ background: '#ffedd5', color: '#ea580c', padding: '1px 6px', borderRadius: 4 }}>Yelp</span>
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Search Query *</label>
                <input
                  type="text"
                  placeholder="e.g., dental clinics, CA firms, restaurants..."
                  value={scrapeForm.query}
                  onChange={(e) => setScrapeForm({ ...scrapeForm, query: e.target.value })}
                  style={{ width: '100%', padding: 14, borderRadius: 12, border: '2px solid #e2e8f0', fontSize: 15, outline: 'none', boxSizing: 'border-box', background: '#fff', color: '#0f172a' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Location</label>
                <input
                  type="text"
                  placeholder="e.g., New York, NY, Dubai, London, Mumbai..."
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

              {/* Quality Filter Info */}
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 16 }}>🎯</span>
                  <span style={{ fontWeight: 600, color: '#166534', fontSize: 13 }}>Smart Filtering Active</span>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: '#15803d', lineHeight: 1.5 }}>
                  Only businesses <strong>without websites</strong> will be scraped. Perfect for selling web services!
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button onClick={() => setScraperOpen(false)} style={{ flex: 1, padding: 16, borderRadius: 12, border: '2px solid #e2e8f0', background: 'white', color: '#475569', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button
                onClick={handleScrape}
                disabled={!scrapeForm.query}
                style={{
                  flex: 1,
                  padding: 16,
                  borderRadius: 12,
                  border: 'none',
                  background: scrapeForm.query ? (scrapeForm.source === 'all' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)') : '#e2e8f0',
                  color: scrapeForm.query ? 'white' : '#94a3b8',
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: scrapeForm.query ? 'pointer' : 'not-allowed',
                  boxShadow: scrapeForm.query ? '0 8px 20px rgba(16,185,129,0.4)' : 'none'
                }}
              >
                {scrapeForm.source === 'all' ? '🚀 Scrape All Sources' : '🗺️ Scrape Google Maps'}
              </button>
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
