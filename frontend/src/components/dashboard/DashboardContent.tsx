'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn, formatNumber } from '@/lib/utils';
import { analyticsApi, leadsApi } from '@/lib/api';
import { Lead } from '@/types';
import { AnalyticsCharts } from './AnalyticsCharts';
import { ExportPanel } from './ExportPanel';
import { LeadsTable } from '../leads/LeadsTable';
import { LeadDetailPanel } from '../leads/LeadDetailPanel';
import {
  Users,
  Flame,
  LineChart as ChartIcon,
  CircleDollarSign,
  TrendingUp,
  RefreshCcw,
  Sparkles,
  Search,
  CheckCircle2,
  FileSpreadsheet
} from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: 'indigo' | 'emerald' | 'amber' | 'rose' | 'blue' | 'purple';
  description?: string;
}

function StatCard({ title, value, icon, color, description }: StatCardProps) {
  const colorClasses = {
    indigo: 'from-indigo-500 to-indigo-600',
    emerald: 'from-emerald-500 to-emerald-600',
    amber: 'from-amber-500 to-amber-600',
    rose: 'from-rose-500 to-rose-600',
    blue: 'from-blue-500 to-blue-600',
    purple: 'from-purple-500 to-purple-600',
  };

  const textClasses = {
    indigo: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/20',
    emerald: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20',
    amber: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20',
    rose: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20',
    blue: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20',
    purple: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/20',
  };

  return (
    <Card variant="gradient" hover className="relative overflow-hidden group">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{title}</p>
            <p className="text-3xl font-black tracking-tight text-gray-900 dark:text-gray-100 transition-colors group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
              {typeof value === 'number' ? formatNumber(value) : value}
            </p>
            {description && (
              <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
            )}
          </div>
          <div
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-300 shadow-md group-hover:scale-110',
              textClasses[color]
            )}
          >
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardContent() {
  const [activeView, setActiveView] = useState<'analytics' | 'explorer'>('analytics');
  
  // State for metrics
  const [metrics, setMetrics] = useState<any>({
    today: { total: 0, qualified: 0, hot: 0, warm: 0, cold: 0 },
    week: { total: 0, qualified: 0, pipelineValue: 0 },
    month: { total: 0, qualified: 0, pipelineValue: 0 },
    overall: { total: 0, qualified: 0, pipelineValue: 0 }
  });
  
  // State for charts
  const [charts, setCharts] = useState<any>({
    dayWise: [],
    leadScoreDistribution: [],
    industryDistribution: [],
    cityDistribution: [],
    agencyFitDistribution: [],
    pipelineGrowth: [],
    qualificationTrends: []
  });
  
  // State for leads explorer table
  const [leads, setLeads] = useState<Lead[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, pages: 0 });
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    source: '',
    sortBy: 'createdAt',
    sortOrder: 'desc' as 'asc' | 'desc'
  });
  
  // Selected lead for detail slide-out panel
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Loading states
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [loadingCharts, setLoadingCharts] = useState(true);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMetrics = async () => {
    try {
      const res = await analyticsApi.getMetrics();
      if (res.data?.success) {
        setMetrics(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching metrics:', err);
    } finally {
      setLoadingMetrics(false);
    }
  };

  const fetchCharts = async () => {
    try {
      const res = await analyticsApi.getCharts();
      if (res.data?.success) {
        setCharts(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching charts:', err);
    } finally {
      setLoadingCharts(false);
    }
  };

  const fetchLeads = useCallback(async (page: number = 1) => {
    setLoadingLeads(true);
    try {
      const params = {
        page,
        limit: pagination.limit,
        search: filters.search,
        status: filters.status,
        source: filters.source,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder
      };
      const res = await leadsApi.getAll(params);
      if (res.data?.success) {
        // Map backend response matching types
        const backendLeads = res.data.data.leads || [];
        const pag = res.data.data.pagination;
        setLeads(backendLeads);
        setPagination({
          page: pag.page,
          limit: pag.limit,
          total: pag.total,
          pages: pag.pages
        });
      }
    } catch (err) {
      console.error('Error fetching leads:', err);
    } finally {
      setLoadingLeads(false);
    }
  }, [filters, pagination.limit]);

  const refreshAllData = async () => {
    setRefreshing(true);
    await Promise.all([fetchMetrics(), fetchCharts(), fetchLeads(pagination.page)]);
    setRefreshing(false);
  };

  // Run on mount
  useEffect(() => {
    fetchMetrics();
    fetchCharts();
  }, []);

  // Run when filters or table page changes
  useEffect(() => {
    fetchLeads(1);
  }, [filters]);

  const handlePageChange = (newPage: number) => {
    fetchLeads(newPage);
  };

  const handleSelectLead = (lead: Lead) => {
    setSelectedLead(lead);
    setDetailOpen(true);
  };

  const handleEnrichComplete = (updatedLead: Lead) => {
    setSelectedLead(updatedLead);
    // Refresh table and dashboard stats in background
    fetchMetrics();
    fetchCharts();
    fetchLeads(pagination.page);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-indigo-500 animate-pulse" />
            Lead Intelligence Dashboard
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Real-time AI qualification, target validation, and pipeline estimations via Google Gemini.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={refreshAllData}
            disabled={refreshing}
            className="flex items-center gap-1.5 h-[38px] rounded-lg border-gray-200 dark:border-gray-800"
          >
            <RefreshCcw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            Refresh Data
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Leads Collected"
          value={metrics.overall.total}
          icon={<Users className="h-6 w-6" />}
          color="indigo"
          description="Total business leads scraped"
        />
        <StatCard
          title="Qualified Hot Leads"
          value={metrics.today.hot + metrics.today.warm + (metrics.overall.qualified || 0)} // fallback mapping
          icon={<Flame className="h-6 w-6" />}
          color="rose"
          description="Leads graded HOT/WARM"
        />
        <StatCard
          title="Today New Leads"
          value={metrics.today.total}
          icon={<CheckCircle2 className="h-6 w-6" />}
          color="emerald"
          description={`With ${metrics.today.qualified} pre-qualified leads`}
        />
        <StatCard
          title="Est Pipeline (INR)"
          value={`₹${(metrics.overall.pipelineValue || 0).toLocaleString('en-IN')}`}
          icon={<CircleDollarSign className="h-6 w-6" />}
          color="purple"
          description="Total estimated value max"
        />
      </div>

      {/* Export Segment Card */}
      <ExportPanel />

      {/* Section View Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-2 rounded-xl shadow-sm border">
        <button
          onClick={() => setActiveView('analytics')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-colors',
            activeView === 'analytics'
              ? 'bg-indigo-500 text-white shadow-md'
              : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-100'
          )}
        >
          <ChartIcon className="h-4 w-4" />
          Analytics Dashboard
        </button>
        <button
          onClick={() => setActiveView('explorer')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-colors',
            activeView === 'explorer'
              ? 'bg-indigo-500 text-white shadow-md'
              : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-100'
          )}
        >
          <Users className="h-4 w-4" />
          Leads Explorer & Search
        </button>
      </div>

      {/* Tab Contents */}
      {activeView === 'analytics' ? (
        <AnalyticsCharts data={charts} loading={loadingCharts} />
      ) : (
        <LeadsTable
          leads={leads}
          pagination={pagination}
          filters={filters}
          onFiltersChange={setFilters}
          onPageChange={handlePageChange}
          onSelectLead={handleSelectLead}
          loading={loadingLeads}
        />
      )}

      {/* Side Detail Slider Panel */}
      <LeadDetailPanel
        lead={selectedLead}
        isOpen={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setSelectedLead(null);
        }}
        onEnrichComplete={handleEnrichComplete}
      />
    </div>
  );
}
export default DashboardContent;
