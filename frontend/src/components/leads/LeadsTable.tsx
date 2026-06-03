'use client';

import React, { useState } from 'react';
import { Lead } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Search,
  Sparkles,
  Phone,
  Mail,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Globe,
  SlidersHorizontal,
  FolderOpen
} from 'lucide-react';

interface LeadsTableProps {
  leads: Lead[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  filters: {
    search: string;
    status: string;
    source: string;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
  };
  onFiltersChange: (newFilters: any) => void;
  onPageChange: (newPage: number) => void;
  onSelectLead: (lead: Lead) => void;
  loading?: boolean;
}

export function LeadsTable({
  leads,
  pagination,
  filters,
  onFiltersChange,
  onPageChange,
  onSelectLead,
  loading
}: LeadsTableProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const getQualBadgeColor = (status?: string) => {
    switch (status) {
      case 'HOT': return 'bg-rose-500 hover:bg-rose-600 text-white';
      case 'WARM': return 'bg-amber-500 hover:bg-amber-600 text-white';
      case 'COLD': return 'bg-blue-500 hover:bg-blue-600 text-white';
      default: return 'bg-gray-100 dark:bg-gray-800 text-gray-400 hover:bg-gray-200';
    }
  };

  const handleSort = (column: string) => {
    const isCurrent = filters.sortBy === column;
    const nextOrder = isCurrent && filters.sortOrder === 'desc' ? 'asc' : 'desc';
    onFiltersChange({
      ...filters,
      sortBy: column,
      sortOrder: nextOrder
    });
  };

  const getValidationIcon = (val?: string) => {
    if (val === 'valid') return <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />;
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-white dark:bg-gray-950 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search business name, phone, email..."
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            className="pl-9 bg-gray-50/50 dark:bg-gray-900/50 border-gray-200 focus:bg-white"
          />
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 border-gray-200 dark:border-gray-800"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
          </Button>

          {/* Quick status selector */}
          <select
            value={filters.status}
            onChange={(e) => onFiltersChange({ ...filters, status: e.target.value })}
            className="rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950 px-3 py-1.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Statuses</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="interested">Interested</option>
            <option value="qualified">Qualified</option>
            <option value="won">Won</option>
            <option value="lost">Lost</option>
          </select>
        </div>
      </div>

      {/* Advanced Filter drawer */}
      {showAdvanced && (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 bg-gray-50 dark:bg-gray-900/40 p-4 rounded-xl border border-gray-200 dark:border-gray-800 animate-fadeIn">
          {/* Source Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500">Source Platform</label>
            <select
              value={filters.source}
              onChange={(e) => onFiltersChange({ ...filters, source: e.target.value })}
              className="w-full rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950 px-3 py-1.5 text-sm outline-none"
            >
              <option value="">All Sources</option>
              <option value="google_maps">Google Maps</option>
              <option value="justdial">JustDial</option>
              <option value="indiamart">IndiaMART</option>
              <option value="yelp">Yelp (Int'l)</option>
              <option value="csv_import">CSV Import</option>
              <option value="manual">Manual Entry</option>
            </select>
          </div>
        </div>
      )}

      {/* Leads Table Card */}
      <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 cursor-pointer hover:bg-gray-100/50" onClick={() => handleSort('businessName')}>
                  Business & Category
                </th>
                <th className="px-6 py-4">Contact Info</th>
                <th className="px-6 py-4 cursor-pointer hover:bg-gray-100/50" onClick={() => handleSort('qualificationStatus')}>
                  AI Qualification
                </th>
                <th className="px-6 py-4 cursor-pointer hover:bg-gray-100/50 text-center" onClick={() => handleSort('leadScore')}>
                  Lead Score
                </th>
                <th className="px-6 py-4 cursor-pointer hover:bg-gray-100/50 text-center" onClick={() => handleSort('agencyFitScore')}>
                  Agency Fit
                </th>
                <th className="px-6 py-4 cursor-pointer hover:bg-gray-100/50 text-right" onClick={() => handleSort('estimatedProjectValue.totalMax')}>
                  Est. Max Value (INR)
                </th>
                <th className="px-6 py-4 cursor-pointer hover:bg-gray-100/50 text-right" onClick={() => handleSort('createdAt')}>
                  Date Added
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {[...Array(7)].map((_, col) => (
                      <td key={col} className="px-6 py-4.5"><div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-24" /></td>
                    ))}
                  </tr>
                ))
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                    <FolderOpen className="h-10 w-10 mx-auto text-gray-300 mb-2" />
                    No leads found matching current criteria.
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr
                    key={lead._id}
                    onClick={() => onSelectLead(lead)}
                    className="cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-900/50 transition-colors group"
                  >
                    {/* Business Column */}
                    <td className="px-6 py-4.5">
                      <div className="space-y-1 max-w-[220px]">
                        <p className="font-bold text-gray-900 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                          {lead.businessName || lead.fullName}
                        </p>
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <span className="capitalize px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-850 text-gray-600 font-medium">
                            {(typeof lead.source === 'object' ? lead.source.platform : lead.source || '').replace('_', ' ')}
                          </span>
                          {lead.category && (
                            <>
                              <span>•</span>
                              <span className="truncate max-w-[100px]">{lead.category}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Contact Info */}
                    <td className="px-6 py-4.5 text-xs space-y-1">
                      {lead.phone && (
                        <p className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                          <Phone className="h-3 w-3 text-gray-400" />
                          {lead.phone}
                          {getValidationIcon(lead.validation?.phone)}
                        </p>
                      )}
                      {lead.email && (
                        <p className="text-gray-500 flex items-center gap-1 truncate max-w-[160px]">
                          <Mail className="h-3 w-3 text-gray-400" />
                          {lead.email}
                          {getValidationIcon(lead.validation?.email)}
                        </p>
                      )}
                      {!lead.phone && !lead.email && <span className="text-gray-400">No contact info</span>}
                    </td>

                    {/* AI Qualification Badge */}
                    <td className="px-6 py-4.5">
                      <Badge className={getQualBadgeColor(lead.qualificationStatus)}>
                        {lead.qualificationStatus || 'UNQUALIFIED'}
                      </Badge>
                    </td>

                    {/* Lead Score */}
                    <td className="px-6 py-4.5 text-center font-bold text-sm text-gray-900 dark:text-gray-100">
                      <span className="px-2 py-1 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-black">
                        {lead.leadScore !== undefined ? lead.leadScore : '--'}
                      </span>
                    </td>

                    {/* Agency Fit */}
                    <td className="px-6 py-4.5 text-center font-bold text-sm text-gray-900 dark:text-gray-100">
                      <span className="px-2 py-1 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-black">
                        {lead.agencyFitScore !== undefined ? lead.agencyFitScore : '--'}
                      </span>
                    </td>

                    {/* Estimated Max Value */}
                    <td className="px-6 py-4.5 text-right font-black text-gray-900 dark:text-gray-100 text-sm">
                      {lead.estimatedProjectValue?.totalMax !== undefined
                        ? `₹${lead.estimatedProjectValue.totalMax.toLocaleString('en-IN')}`
                        : '--'}
                    </td>

                    {/* Date Created */}
                    <td className="px-6 py-4.5 text-right text-xs text-gray-400">
                      {new Date(lead.createdAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900/10">
          <p className="text-xs text-gray-500">
            Showing <span className="font-semibold text-gray-900 dark:text-gray-100">{leads.length}</span> leads of{' '}
            <span className="font-semibold text-gray-900 dark:text-gray-100">{pagination.total}</span> total
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => onPageChange(pagination.page - 1)}
              className="p-2 h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs font-semibold px-3 py-1 bg-white dark:bg-gray-850 border border-gray-200 dark:border-gray-700 rounded-lg">
              {pagination.page} / {pagination.pages || 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.pages}
              onClick={() => onPageChange(pagination.page + 1)}
              className="p-2 h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
