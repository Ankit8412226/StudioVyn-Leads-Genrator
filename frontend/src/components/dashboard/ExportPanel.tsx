'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { importApi } from '@/lib/api';
import { Download, Calendar, Filter, Sparkles, ShieldCheck } from 'lucide-react';

export function ExportPanel() {
  const [filter, setFilter] = useState<'today' | 'last7' | 'last30' | 'custom' | 'all'>('all');
  const [qualificationStatus, setQualificationStatus] = useState<'HOT' | 'WARM' | 'COLD' | 'qualified' | 'all'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    setSuccess(false);
    try {
      const params: any = {
        filter,
        qualificationStatus,
      };

      if (filter === 'custom') {
        params.startDate = startDate;
        params.endDate = endDate;
      }

      const response = await importApi.exportLeadsCsv(params);
      
      // Handle file download from binary blob response
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `studiovyn-leads-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to export leads:', error);
      alert('Failed to generate export file. Please check if backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card hover className="bg-gradient-to-br from-indigo-500/5 via-transparent to-transparent">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5 text-indigo-500" />
          Lead Intelligence Export
        </CardTitle>
        <CardDescription>
          Download structured business leads with AI qualification, estimated project value, and contact validations.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 items-end">
          {/* Timeframe Filter */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Timeframe
            </label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none dark:border-gray-800 dark:bg-gray-950 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">All Time Leads</option>
              <option value="today">Created Today</option>
              <option value="last7">Last 7 Days</option>
              <option value="last30">Last 30 Days</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {/* Qualification Filter */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-yellow-500" />
              Lead Quality Segment
            </label>
            <select
              value={qualificationStatus}
              onChange={(e) => setQualificationStatus(e.target.value as any)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none dark:border-gray-800 dark:bg-gray-950 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">All leads (incl. COLD)</option>
              <option value="qualified">HOT & WARM Leads Only</option>
              <option value="HOT">🔥 HOT Leads Only</option>
              <option value="WARM">⚡ WARM Leads Only</option>
              <option value="COLD">❄️ COLD Leads Only</option>
            </select>
          </div>

          {/* Export Action */}
          <div>
            <Button
              onClick={handleExport}
              disabled={loading || (filter === 'custom' && (!startDate || !endDate))}
              className="w-full bg-indigo-600 text-white hover:bg-indigo-700 font-medium flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/10 h-[38px] rounded-lg"
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Generating CSV...
                </>
              ) : success ? (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  Downloaded!
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Export CSV Sheet
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Custom date pickers if selected */}
        {filter === 'custom' && (
          <div className="grid gap-4 sm:grid-cols-2 mt-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 animate-fadeIn">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Start Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-white dark:bg-gray-950"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">End Date</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-white dark:bg-gray-950"
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
