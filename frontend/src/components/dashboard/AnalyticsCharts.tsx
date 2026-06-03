'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

interface AnalyticsChartsProps {
  data: {
    dayWise: Array<{ date: string; count: number }>;
    leadScoreDistribution: Array<{ range: string; count: number }>;
    industryDistribution: Array<{ name: string; value: number }>;
    cityDistribution: Array<{ city: string; count: number }>;
    agencyFitDistribution: Array<{ name: string; count: number }>;
    pipelineGrowth: Array<{ date: string; value: number }>;
    qualificationTrends: Array<{ date: string; HOT: number; WARM: number; COLD: number }>;
  };
  loading?: boolean;
}

const COLORS = ['#6366f1', '#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#f43f5e'];
const QUAL_COLORS: Record<string, string> = {
  HOT: '#ef4444',
  WARM: '#f59e0b',
  COLD: '#3b82f6'
};

export function AnalyticsCharts({ data, loading }: AnalyticsChartsProps) {
  if (loading) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="h-20 bg-gray-100/50 dark:bg-gray-800/50 rounded-t-xl" />
            <CardContent className="h-64 bg-gray-50/50 dark:bg-gray-900/50 rounded-b-xl" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* 1. Day-wise Lead Generation */}
      <Card hover>
        <CardHeader>
          <CardTitle>Lead Acquisition Trend</CardTitle>
          <CardDescription>Daily volume of scraped and added leads over the last 30 days</CardDescription>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.dayWise} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="date" tickFormatter={(str) => str.substring(5)} stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" fontSize={12} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: '8px', border: '1px solid #e5e7eb' }}
                labelClassName="text-gray-900 font-semibold"
              />
              <Area type="monotone" dataKey="count" name="Leads" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorCount)" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 2. Pipeline Growth */}
      <Card hover>
        <CardHeader>
          <CardTitle>Pipeline Value Growth (INR)</CardTitle>
          <CardDescription>Cumulative estimated project value progression</CardDescription>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.pipelineGrowth} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="date" tickFormatter={(str) => str.substring(5)} stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={(val) => `₹${val >= 100000 ? `${(val/100000).toFixed(1)}L` : val}`} />
              <Tooltip 
                formatter={(val) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Pipeline Value']}
                contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: '8px', border: '1px solid #e5e7eb' }}
                labelClassName="text-gray-900 font-semibold"
              />
              <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 3. Lead Score Distribution */}
      <Card hover>
        <CardHeader>
          <CardTitle>Lead Score Distribution</CardTitle>
          <CardDescription>Frequency histogram of leads scored 0-100</CardDescription>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.leadScoreDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="range" stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" fontSize={12} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: '8px', border: '1px solid #e5e7eb' }}
                labelClassName="text-gray-900 font-semibold"
              />
              <Bar dataKey="count" name="Leads Count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 4. Qualification Daily Trends */}
      <Card hover>
        <CardHeader>
          <CardTitle>Lead Quality Segment Breakdown</CardTitle>
          <CardDescription>Daily stacked composition of HOT, WARM, and COLD leads</CardDescription>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.qualificationTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="date" tickFormatter={(str) => str.substring(5)} stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" fontSize={12} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: '8px', border: '1px solid #e5e7eb' }}
                labelClassName="text-gray-900 font-semibold"
              />
              <Legend verticalAlign="top" height={36} iconType="circle" />
              <Bar dataKey="HOT" stackId="a" fill={QUAL_COLORS.HOT} />
              <Bar dataKey="WARM" stackId="a" fill={QUAL_COLORS.WARM} />
              <Bar dataKey="COLD" stackId="a" fill={QUAL_COLORS.COLD} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 5. Industry Breakdown */}
      <Card hover>
        <CardHeader>
          <CardTitle>Top Industries</CardTitle>
          <CardDescription>Distribution across top 10 niche business categories</CardDescription>
        </CardHeader>
        <CardContent className="h-80 flex items-center justify-center">
          <div className="w-full h-full flex flex-col md:flex-row items-center gap-4">
            <div className="w-full md:w-3/5 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.industryDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {data.industryDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} leads`, 'Count']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full md:w-2/5 flex flex-wrap md:flex-col justify-start gap-2 max-h-64 overflow-y-auto text-xs">
              {data.industryDistribution.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-2 mr-4 md:mr-0">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="font-medium text-gray-700 dark:text-gray-300 truncate max-w-[120px]">{entry.name}</span>
                  <span className="text-gray-400">({entry.value})</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 6. City Location Distribution */}
      <Card hover>
        <CardHeader>
          <CardTitle>Top City Locations</CardTitle>
          <CardDescription>Locations of extracted and verified business operations</CardDescription>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.cityDistribution} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
              <XAxis type="number" stroke="#9ca3af" fontSize={12} />
              <YAxis dataKey="city" type="category" stroke="#9ca3af" fontSize={11} width={80} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: '8px', border: '1px solid #e5e7eb' }}
                labelClassName="text-gray-900 font-semibold"
              />
              <Bar dataKey="count" name="Leads" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
