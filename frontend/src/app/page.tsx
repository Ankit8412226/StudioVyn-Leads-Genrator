'use client';

import {
  Clock,
  Download,
  Flame,
  MapPin,
  MessageSquare,
  Phone,
  RefreshCw,
  Search,
  Star,
  Trophy,
  Trash2,
  Users,
  X,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Layout,
  Zap,
  Sparkles
} from 'lucide-react';
import { useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api';
const SCRAPER_API_URL = API_URL;

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
  aiLandingHeadline?: string;
  aiLandingSubhead?: string;
  aiLandingBullets?: string[];
  aiLandingCta?: string;
  heroImagePath?: string;
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

interface MessageVariantStat {
  variant: 'A' | 'B';
  sent: number;
  replied: number;
}

interface AnalyticsExtras {
  messageVariantStats: MessageVariantStat[];
  followUpStats: Record<string, number>;
  followUp2Stats: Record<string, number>;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsExtras | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [scraperOpen, setScraperOpen] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [scrapeForm, setScrapeForm] = useState({ query: '', location: '', limit: 30, source: 'google' as 'google' | 'india' | 'yelp' });
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [campaignRunning, setCampaignRunning] = useState(false);
  const [selectedLeadForDetail, setSelectedLeadForDetail] = useState<Lead | null>(null);
  const [leadDetailOpen, setLeadDetailOpen] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, leadsRes] = await Promise.all([
        fetchAPI('/analytics/overview'),
        fetchAPI('/leads?limit=100&sortBy=createdAt&sortOrder=desc'),
      ]);
      if (statsRes.success) {
        setStats(statsRes.data.stats);
        setAnalytics({
          messageVariantStats: statsRes.data.messageVariantStats || [],
          followUpStats: statsRes.data.followUpStats || {},
          followUp2Stats: statsRes.data.followUp2Stats || {},
        });
      }
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
      const endpointMap = {
        google: '/scraper/google-maps',
        india: '/scraper/india',
        yelp: '/scraper/yelp'
      };
      const endpoint = endpointMap[scrapeForm.source];

      const res = await fetchScraperAPI(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          query: scrapeForm.query,
          location: scrapeForm.location,
          limit: scrapeForm.limit,
        }),
      });

      if (res.success) {
        alert(
          `✅ Scraping Complete!\n\n` +
          `📊 Results:\n` +
          `   • Traverses: ${res.data.scraped || 0} leads\n` +
          `   • 🥇 Saved: ${res.data.saved || 0}\n` +
          `   • 📋 Duplicates: ${res.data.duplicates || 0}`
        );
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

  const toggleSelectLead = (id: string) => {
    setSelectedLeadIds((prev) => (
      prev.includes(id) ? prev.filter((leadId) => leadId !== id) : [...prev, id]
    ));
  };

  const selectAllFiltered = () => {
    setSelectedLeadIds(filteredLeads.map((lead) => lead._id));
  };

  const clearSelection = () => {
    setSelectedLeadIds([]);
  };

  const runCampaign = async () => {
    if (selectedLeadIds.length === 0) {
      alert('Select at least 1 lead to run a campaign.');
      return;
    }

    const defaultName = `Campaign ${new Date().toLocaleString()}`;
    const name = prompt('Campaign name', defaultName);
    if (!name) return;

    const includeImage = confirm('Include AI image in WhatsApp message?');

    setCampaignRunning(true);
    try {
      const campaignRes = await fetchAPI('/campaigns', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      if (!campaignRes.success) {
        throw new Error(campaignRes.error || 'Failed to create campaign');
      }

      const campaignId = campaignRes.data.campaign._id;

      const addRes = await fetchAPI(`/campaigns/${campaignId}/leads`, {
        method: 'POST',
        body: JSON.stringify({ leadIds: selectedLeadIds }),
      });
      if (!addRes.success) {
        throw new Error(addRes.error || 'Failed to add leads to campaign');
      }

      const startRes = await fetchAPI(`/campaigns/${campaignId}/start`, {
        method: 'POST',
        body: JSON.stringify({ includeImage }),
      });
      if (!startRes.success) {
        throw new Error(startRes.error || 'Failed to start campaign');
      }

      alert(`Campaign started. ${startRes.data.queued} leads are being processed.`);
      clearSelection();
    } catch (error: any) {
      alert(`Campaign failed: ${error.message}`);
    } finally {
      setCampaignRunning(false);
    }
  };

  const deleteSelectedLeads = async () => {
    if (selectedLeadIds.length === 0) {
      const confirmAll = confirm('Delete all leads? This cannot be undone.');
      if (!confirmAll) return;
      try {
        const res = await fetchAPI('/leads', { method: 'DELETE' });
        if (!res.success) throw new Error(res.error || 'Failed to delete leads');
        setLeads([]);
        setSelectedLeadIds([]);
        alert(res.message || 'All leads deleted.');
      } catch (error: any) {
        alert(`Delete failed: ${error.message}`);
      }
      return;
    }

    const confirmDelete = confirm(`Delete ${selectedLeadIds.length} selected lead(s)? This cannot be undone.`);
    if (!confirmDelete) return;

    try {
      const res = await fetchAPI('/leads/bulk/delete', {
        method: 'DELETE',
        body: JSON.stringify({ ids: selectedLeadIds }),
      });
      if (!res.success) throw new Error(res.error || 'Failed to delete selected leads');
      setLeads(leads.filter((lead) => !selectedLeadIds.includes(lead._id)));
      setSelectedLeadIds([]);
      alert(`Deleted ${res.data?.deletedCount ?? selectedLeadIds.length} lead(s).`);
    } catch (error: any) {
      alert(`Delete failed: ${error.message}`);
    }
  };

  const exportLeadsToCsv = () => {
    const exportLeads = selectedLeadIds.length > 0
      ? leads.filter((lead) => selectedLeadIds.includes(lead._id))
      : filteredLeads;

    if (exportLeads.length === 0) {
      alert('No leads to export.');
      return;
    }

    const columns: Array<{ key: keyof Lead; label: string }> = [
      { key: 'fullName', label: 'Full Name' },
      { key: 'businessName', label: 'Business Name' },
      { key: 'phone', label: 'Phone' },
      { key: 'email', label: 'Email' },
      { key: 'website', label: 'Website' },
      { key: 'address', label: 'Address' },
      { key: 'city', label: 'City' },
      { key: 'category', label: 'Category' },
      { key: 'rating', label: 'Rating' },
      { key: 'reviewCount', label: 'Review Count' },
      { key: 'priceLevel', label: 'Price Level' },
      { key: 'description', label: 'Description' },
      { key: 'source', label: 'Source' },
      { key: 'status', label: 'Status' },
      { key: 'isHotLead', label: 'Hot Lead' },
      { key: 'priority', label: 'Priority' },
      { key: 'createdAt', label: 'Created At' },
    ];

    const escapeCsv = (value: unknown) => {
      if (value === null || value === undefined) return '';
      const str = String(value).replace(/\r?\n|\r/g, ' ').trim();
      if (str.includes('"') || str.includes(',') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const header = columns.map((c) => escapeCsv(c.label)).join(',');
    const rows = exportLeads.map((lead) =>
      columns.map((c) => {
        const value = lead[c.key];
        if (c.key === 'createdAt' && typeof value === 'string') {
          return escapeCsv(new Date(value).toISOString());
        }
        return escapeCsv(value);
      }).join(',')
    );

    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `leads_export_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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

        {/* Message Performance */}
        {analytics && (
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 700, color: '#0f172a' }}>Message Performance</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              {(['A', 'B'] as const).map((variant) => {
                const stat = analytics.messageVariantStats.find((s) => s.variant === variant) || { sent: 0, replied: 0 };
                const replyRate = stat.sent > 0 ? Math.round((stat.replied / stat.sent) * 100) : 0;
                return (
                  <div key={variant} style={{ background: 'white', borderRadius: 14, padding: 18, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }}>
                    <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700, letterSpacing: 1 }}>VARIANT {variant}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
                      <div>
                        <div style={{ fontSize: 20, fontWeight: 700 }}>{stat.sent}</div>
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>Sent</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 20, fontWeight: 700 }}>{stat.replied}</div>
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>Replied</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 20, fontWeight: 700 }}>{replyRate}%</div>
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>Reply Rate</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Follow-up Status */}
        {analytics && (
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 700, color: '#0f172a' }}>Follow-up Status</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              {[
                { label: 'Follow-up 1 Pending', value: analytics.followUpStats.pending || 0 },
                { label: 'Follow-up 1 Sent', value: analytics.followUpStats.sent || 0 },
                { label: 'Follow-up 1 Failed', value: analytics.followUpStats.failed || 0 },
                { label: 'Follow-up 2 Pending', value: analytics.followUp2Stats.pending || 0 },
                { label: 'Follow-up 2 Sent', value: analytics.followUp2Stats.sent || 0 },
                { label: 'Follow-up 2 Failed', value: analytics.followUp2Stats.failed || 0 },
              ].map((item) => (
                <div key={item.label} style={{ background: 'white', borderRadius: 14, padding: 18, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }}>
                  <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700, letterSpacing: 0.5 }}>{item.label}</div>
                  <div style={{ marginTop: 8, fontSize: 24, fontWeight: 700, color: '#0f172a' }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={selectAllFiltered}
              disabled={filteredLeads.length === 0}
              style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid #e2e8f0', background: 'white', cursor: filteredLeads.length === 0 ? 'not-allowed' : 'pointer', color: '#0f172a', fontWeight: 600, fontSize: 13 }}
            >
              Select All
            </button>
            <button
              onClick={clearSelection}
              disabled={selectedLeadIds.length === 0}
              style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid #e2e8f0', background: 'white', cursor: selectedLeadIds.length === 0 ? 'not-allowed' : 'pointer', color: '#64748b', fontWeight: 600, fontSize: 13 }}
            >
              Clear ({selectedLeadIds.length})
            </button>
            <button
              onClick={runCampaign}
              disabled={campaignRunning || selectedLeadIds.length === 0}
              style={{ padding: '12px 18px', borderRadius: 10, border: 'none', background: campaignRunning || selectedLeadIds.length === 0 ? '#e2e8f0' : '#16a34a', color: campaignRunning || selectedLeadIds.length === 0 ? '#94a3b8' : 'white', fontWeight: 700, fontSize: 13, cursor: campaignRunning || selectedLeadIds.length === 0 ? 'not-allowed' : 'pointer', boxShadow: campaignRunning || selectedLeadIds.length === 0 ? 'none' : '0 6px 16px rgba(22,163,74,0.35)' }}
            >
              {campaignRunning ? 'Starting...' : 'Run Campaign'}
            </button>
            <button
              onClick={deleteSelectedLeads}
              style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid #fee2e2', background: '#fff1f2', cursor: 'pointer', color: '#b91c1c', fontWeight: 700, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 8 }}
            >
              <Trash2 style={{ width: 16, height: 16 }} />
              Delete
            </button>
            <button
              onClick={exportLeadsToCsv}
              style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid #dbeafe', background: '#eff6ff', cursor: 'pointer', color: '#1d4ed8', fontWeight: 700, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 8 }}
            >
              <Download style={{ width: 16, height: 16 }} />
              Export CSV
            </button>
          </div>
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
            const isSelected = selectedLeadIds.includes(lead._id);

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
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#0f172a', fontWeight: 600, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectLead(lead._id)}
                      style={{ width: 16, height: 16, accentColor: '#16a34a' }}
                    />
                    Select
                  </label>
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
                  <button
                    onClick={() => {
                      setSelectedLeadForDetail(lead);
                      setLeadDetailOpen(true);
                    }}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 16px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(99,102,241,0.3)', transition: 'all 0.2s' }}
                  >
                    <Sparkles style={{ width: 16, height: 16 }} /> Website Pitch
                  </button>
                  <a href={getWhatsAppLink(lead.phone || '')} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 12, border: '1px solid #dcfce7', background: '#f0fdf4', color: '#16a34a', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
                    <MessageSquare style={{ width: 16, height: 16 }} />
                  </a>
                  <a href={`/demo/${lead._id}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 12, border: '1px solid #e2e8f0', background: 'white', color: '#0f172a', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
                    <ExternalLink style={{ width: 16, height: 16 }} /> Demo
                  </a>
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

        {/* Lead Detail / Pitch Modal */}
        {leadDetailOpen && selectedLeadForDetail && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(12px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ background: 'white', width: '100%', maxWidth: 1000, maxHeight: '90vh', borderRadius: 28, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)' }}>
              {/* Close Button */}
              <button onClick={() => setLeadDetailOpen(false)} style={{ position: 'absolute', top: 24, right: 24, zIndex: 10, background: 'white', border: '1px solid #e2e8f0', width: 44, height: 44, borderRadius: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', transition: 'transform 0.2s' }}>
                <X style={{ width: 22, height: 22, color: '#0f172a' }} />
              </button>

              <div style={{ flex: 1, overflowY: 'auto', padding: '40px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 40 }}>
                  
                  {/* Left Side: Preview & AI Insights */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                      <span style={{ background: '#fef2f2', color: '#dc2626', padding: '6px 14px', borderRadius: 20, fontSize: 10, fontWeight: 800, letterSpacing: 1 }}>{selectedLeadForDetail.isHotLead ? 'HIGH PRIORITY 🔥' : 'READY TO PITCH'}</span>
                      <span style={{ color: '#64748b', fontSize: 14, fontWeight: 500 }}>{selectedLeadForDetail.category} · {selectedLeadForDetail.city}</span>
                    </div>

                    <h2 style={{ fontSize: 36, fontWeight: 900, color: '#0f172a', marginBottom: 16, lineHeight: 1.1, letterSpacing: -1 }}>{selectedLeadForDetail.businessName || selectedLeadForDetail.fullName}</h2>
                    <p style={{ fontSize: 16, color: '#475569', lineHeight: 1.6, marginBottom: 28 }}>{selectedLeadForDetail.aiPotential || 'This business has great ratings but no modern landing page. They are missing out on mobile-first customers in their local area.'}</p>

                    {/* Image Preview Block */}
                    {selectedLeadForDetail.heroImagePath && (
                      <div style={{ marginBottom: 32, borderRadius: 20, overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 12px 30px -10px rgba(0,0,0,0.15)' }}>
                        <div style={{ background: '#f8fafc', padding: '10px 20px', fontSize: 11, fontWeight: 800, color: '#64748b', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
                          <span>🎨 GENERATED HERO BANNER</span>
                          <span style={{ color: '#6366f1' }}>PREMIUM QUALITY</span>
                        </div>
                        <img
                          src={`${API_URL.replace(/\/api$/, '')}${selectedLeadForDetail.heroImagePath}`}
                          alt="AI Mockup"
                          style={{ width: '100%', height: 'auto', display: 'block' }}
                        />
                      </div>
                    )}

                    {/* AI Strategy Pills */}
                    <div style={{ background: '#f0fdf4', borderRadius: 20, padding: 24, border: '1px solid #bbf7d0' }}>
                      <h4 style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 800, color: '#166534', letterSpacing: 0.5 }}>🎯 WHY THEY NEED A WEBSITE</h4>
                      <div style={{ display: 'grid', gap: 12 }}>
                        {(selectedLeadForDetail.aiPainPoints || ['Boost conversion from Google Maps', 'Automate WhatsApp inquiries']).map((p, i) => (
                          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 14, color: '#14532d', fontWeight: 500 }}>
                            <Zap style={{ width: 14, height: 14, color: '#16a34a', flexShrink: 0 }} /> {p}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right Side: Pitch Templates */}
                  <div>
                    <div style={{ padding: '0 0 24px' }}>
                      <h3 style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', marginBottom: 8 }}>Website Pitch Options</h3>
                      <p style={{ fontSize: 14, color: '#64748b' }}>Pick a strategy to reach out to this lead.</p>
                    </div>

                    <div style={{ display: 'grid', gap: 20 }}>
                      
                      {/* Pitch 1: ROI Focus */}
                      <div style={{ background: '#faf5ff', borderRadius: 24, padding: 24, border: '1px solid #e9d5ff', position: 'relative' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                           <span style={{ background: '#7c3aed', color: 'white', padding: '4px 12px', borderRadius: 8, fontSize: 10, fontWeight: 800 }}>GROWTH FACTOR 📈</span>
                          <TrendingUp style={{ width: 20, height: 20, color: '#7c3aed' }} />
                        </div>
                        <h4 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 800 }}>Option 1: The "Digital Growth" Pitch</h4>
                        <p style={{ margin: '0 0 20px', fontSize: 13, color: '#5b21b6', lineHeight: 1.5 }}>Show them how a modern website acts as an automated growth engine, capturing local leads 24/7 while they sleep.</p>
                        <button
                          onClick={() => {
                            const msg = `Hi ${selectedLeadForDetail.businessName}! I'm a local web strategist helping ${selectedLeadForDetail.category} in ${selectedLeadForDetail.city} modernize. I've designed a modern growth-focused mockup for you — check the preview below 👇: ${window.location.origin}/demo/${selectedLeadForDetail._id}. It's built specifically to turn your map views into booked appointments. Worth a quick chat?`;
                            window.open(`https://wa.me/${(selectedLeadForDetail.phone || '').replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
                          }}
                          style={{ width: '100%', padding: '14px', borderRadius: 14, border: 'none', background: '#7c3aed', color: 'white', fontWeight: 800, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 12px rgba(124,58,237,0.3)' }}
                        >
                          Send Growth Pitch
                        </button>
                      </div>

                      {/* Pitch 2: Trust Builder */}
                      <div style={{ background: '#fffbeb', borderRadius: 24, padding: 24, border: '1px solid #fde68a' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                          <span style={{ background: '#d97706', color: 'white', padding: '4px 12px', borderRadius: 8, fontSize: 10, fontWeight: 800 }}>TRUST FACTOR ⭐</span>
                          <Star style={{ width: 20, height: 20, color: '#d97706' }} />
                        </div>
                        <h4 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 800 }}>Option 2: The "Modern Authority" Pitch</h4>
                        <p style={{ margin: '0 0 20px', fontSize: 13, color: '#92400e', lineHeight: 1.5 }}>Focus on bringing their {selectedLeadForDetail.rating} star reputation into the modern era with a professional digital presence.</p>
                        <button
                          onClick={() => {
                            const msg = `Hi ${selectedLeadForDetail.businessName}! I love the ${selectedLeadForDetail.rating} star service you provide. Quality like yours deserves a professional digital home to match. I've already started a modern website layout for you — check the mockup preview below 👇: ${window.location.origin}/demo/${selectedLeadForDetail._id}. Let me know if you'd like to modernize your presence together!`;
                            window.open(`https://wa.me/${(selectedLeadForDetail.phone || '').replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
                          }}
                          style={{ width: '100%', padding: '14px', borderRadius: 14, border: 'none', background: '#d97706', color: 'white', fontWeight: 800, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 12px rgba(217,119,6,0.3)' }}
                        >
                          Send Authority Pitch
                        </button>
                      </div>

                      {/* Pitch 3: Modern Look */}
                      <div style={{ background: '#f0fdfa', borderRadius: 24, padding: 24, border: '1px solid #99f6e4' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                          <span style={{ background: '#0d9488', color: 'white', padding: '4px 12px', borderRadius: 8, fontSize: 10, fontWeight: 800 }}>EFFICIENCY FACTOR 🎨</span>
                          <Layout style={{ width: 20, height: 20, color: '#0d9488' }} />
                        </div>
                        <h4 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 800 }}>Option 3: The "Streamlined Business" Pitch</h4>
                        <p style={{ margin: '0 0 20px', fontSize: 13, color: '#115e59', lineHeight: 1.5 }}>Sell the efficiency of a website that handles inquiries while they focus on their core business work.</p>
                        <button
                          onClick={() => {
                            const msg = `Hi ${selectedLeadForDetail.businessName}! I'm helping local firms streamline their business with modern landing pages. A good site handles the FAQs so you can focus on the work. Check out this custom mockup I built for you 👇: ${window.location.origin}/demo/${selectedLeadForDetail._id}. Would love to help you modernize!`;
                            window.open(`https://wa.me/${(selectedLeadForDetail.phone || '').replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
                          }}
                          style={{ width: '100%', padding: '14px', borderRadius: 14, border: 'none', background: '#0d9488', color: 'white', fontWeight: 800, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 12px rgba(13,148,136,0.3)' }}
                        >
                          Send Efficiency Pitch
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div style={{ background: '#f8fafc', padding: '24px 40px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ fontSize: 13, color: '#64748b' }}>
                    Dashboard powered by <strong>Studiovyn AI</strong>
                  </div>
                  <div style={{ height: 16, width: 1, background: '#e2e8f0' }} />
                  <a href={`/demo/${selectedLeadForDetail._id}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: '#6366f1', fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                    Open Live Demo <ChevronRight style={{ width: 14, height: 14 }} />
                  </a>
                </div>
                <button
                  onClick={() => setLeadDetailOpen(false)}
                  style={{ padding: '10px 28px', borderRadius: 12, border: '1px solid #e2e8f0', background: 'white', color: '#0f172a', fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setScrapeForm({ ...scrapeForm, source: 'google' })}
                    style={{
                      padding: '16px 8px',
                      borderRadius: 12,
                      border: scrapeForm.source === 'google' ? '2px solid #667eea' : '2px solid #e2e8f0',
                      background: scrapeForm.source === 'google' ? 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)' : 'white',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ fontSize: 20, marginBottom: 4 }}>🗺️</div>
                    <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13 }}>Google Maps</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setScrapeForm({ ...scrapeForm, source: 'india' })}
                    style={{
                      padding: '16px 8px',
                      borderRadius: 12,
                      border: scrapeForm.source === 'india' ? '2px solid #f59e0b' : '2px solid #e2e8f0',
                      background: scrapeForm.source === 'india' ? 'linear-gradient(135deg, #fffbev 0%, #fef3c7 100%)' : 'white',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ fontSize: 20, marginBottom: 4 }}>🇮🇳</div>
                    <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13 }}>JD & Mart</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setScrapeForm({ ...scrapeForm, source: 'yelp' })}
                    style={{
                      padding: '16px 8px',
                      borderRadius: 12,
                      border: scrapeForm.source === 'yelp' ? '2px solid #ef4444' : '2px solid #e2e8f0',
                      background: scrapeForm.source === 'yelp' ? 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)' : 'white',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ fontSize: 20, marginBottom: 4 }}>🌎</div>
                    <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13 }}>Yelp (Intl)</div>
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
                  background: scrapeForm.query ? '#667eea' : '#e2e8f0',
                  color: scrapeForm.query ? 'white' : '#94a3b8',
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: scrapeForm.query ? 'pointer' : 'not-allowed',
                  boxShadow: scrapeForm.query ? '0 8px 20px rgba(102,126,234,0.4)' : 'none'
                }}
              >
                {scrapeForm.source === 'google' ? '🗺️ Scrape Google Maps' :
                  scrapeForm.source === 'india' ? '🇮🇳 Scrape JD & Mart' :
                    '🌎 Scrape Yelp (Intl)'}
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
