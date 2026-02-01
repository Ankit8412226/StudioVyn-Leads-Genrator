'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn, formatNumber } from '@/lib/utils';
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  DollarSign,
  Mail,
  MessageSquare,
  Phone,
  Target,
  UserPlus,
  Users
} from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
  color: 'indigo' | 'emerald' | 'amber' | 'rose' | 'blue' | 'purple';
}

function StatCard({ title, value, change, changeLabel, icon, color }: StatCardProps) {
  const colorClasses = {
    indigo: 'from-indigo-500 to-indigo-600',
    emerald: 'from-emerald-500 to-emerald-600',
    amber: 'from-amber-500 to-amber-600',
    rose: 'from-rose-500 to-rose-600',
    blue: 'from-blue-500 to-blue-600',
    purple: 'from-purple-500 to-purple-600',
  };

  const isPositive = change && change > 0;
  const isNegative = change && change < 0;

  return (
    <Card variant="gradient" hover>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
            <p className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              {typeof value === 'number' ? formatNumber(value) : value}
            </p>
            {change !== undefined && (
              <div className="flex items-center gap-1">
                {isPositive && (
                  <>
                    <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                    <span className="text-sm font-medium text-emerald-600">+{change}%</span>
                  </>
                )}
                {isNegative && (
                  <>
                    <ArrowDownRight className="h-4 w-4 text-red-500" />
                    <span className="text-sm font-medium text-red-600">{change}%</span>
                  </>
                )}
                {!isPositive && !isNegative && (
                  <span className="text-sm font-medium text-gray-500">0%</span>
                )}
                {changeLabel && (
                  <span className="text-sm text-gray-500">{changeLabel}</span>
                )}
              </div>
            )}
          </div>
          <div
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg',
              colorClasses[color]
            )}
          >
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface LeadSourceChartProps {
  data: Array<{ source: string; count: number; color: string }>;
}

function LeadSourceChart({ data }: LeadSourceChartProps) {
  const total = data.reduce((sum, item) => sum + item.count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lead Sources</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.map((item) => {
            const percentage = total > 0 ? (item.count / total) * 100 : 0;
            return (
              <div key={item.source} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {item.source}
                  </span>
                  <span className="text-gray-500">{item.count} leads</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', item.color)}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

interface RecentLeadProps {
  leads: Array<{
    id: string;
    name: string;
    email?: string;
    phone?: string;
    source: string;
    status: string;
    createdAt: string;
  }>;
}

function RecentLeads({ leads }: RecentLeadProps) {
  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
      new: 'info',
      contacted: 'warning',
      interested: 'success',
      qualified: 'primary' as any,
      won: 'success',
      lost: 'danger',
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Recent Leads</CardTitle>
        <Button variant="ghost" size="sm">
          View All
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {leads.map((lead) => (
            <div
              key={lead.id}
              className="flex items-center justify-between rounded-lg border border-gray-100 p-4 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-sm font-medium text-white">
                  {lead.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)}
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{lead.name}</p>
                  <p className="text-sm text-gray-500">{lead.email || lead.phone || 'No contact'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {getStatusBadge(lead.status)}
                <div className="flex gap-1">
                  {lead.phone && (
                    <Button variant="ghost" size="icon-sm">
                      <Phone className="h-4 w-4" />
                    </Button>
                  )}
                  {lead.email && (
                    <Button variant="ghost" size="icon-sm">
                      <Mail className="h-4 w-4" />
                    </Button>
                  )}
                  {lead.phone && (
                    <Button variant="ghost" size="icon-sm" className="text-green-600">
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardContent() {
  // Mock data - replace with API calls
  const stats = [
    {
      title: 'Total Leads',
      value: 2847,
      change: 12.5,
      changeLabel: 'vs last month',
      icon: <Users className="h-6 w-6" />,
      color: 'indigo' as const,
    },
    {
      title: 'New This Week',
      value: 156,
      change: 8.2,
      changeLabel: 'vs last week',
      icon: <UserPlus className="h-6 w-6" />,
      color: 'emerald' as const,
    },
    {
      title: 'Conversion Rate',
      value: '24.5%',
      change: 3.1,
      changeLabel: 'vs last month',
      icon: <Target className="h-6 w-6" />,
      color: 'blue' as const,
    },
    {
      title: 'Revenue',
      value: '$128,450',
      change: 18.7,
      changeLabel: 'vs last month',
      icon: <DollarSign className="h-6 w-6" />,
      color: 'purple' as const,
    },
  ];

  const sourceData = [
    { source: 'Google Maps', count: 842, color: 'bg-gradient-to-r from-blue-500 to-blue-600' },
    { source: 'Website Forms', count: 654, color: 'bg-gradient-to-r from-indigo-500 to-indigo-600' },
    { source: 'CSV Import', count: 521, color: 'bg-gradient-to-r from-purple-500 to-purple-600' },
    { source: 'LinkedIn', count: 412, color: 'bg-gradient-to-r from-cyan-500 to-cyan-600' },
    { source: 'Manual Entry', count: 218, color: 'bg-gradient-to-r from-amber-500 to-amber-600' },
  ];

  const recentLeads = [
    {
      id: '1',
      name: 'John Smith',
      email: 'john@company.com',
      phone: '+1 234 567 890',
      source: 'google_maps',
      status: 'new',
      createdAt: '2024-01-30T10:30:00Z',
    },
    {
      id: '2',
      name: 'Sarah Johnson',
      email: 'sarah@startup.io',
      phone: '+1 345 678 901',
      source: 'website_form',
      status: 'contacted',
      createdAt: '2024-01-30T09:15:00Z',
    },
    {
      id: '3',
      name: 'Michael Brown',
      email: 'michael@enterprise.com',
      phone: '+1 456 789 012',
      source: 'linkedin',
      status: 'interested',
      createdAt: '2024-01-30T08:45:00Z',
    },
    {
      id: '4',
      name: 'Emily Davis',
      email: 'emily@agency.co',
      phone: '+1 567 890 123',
      source: 'csv_import',
      status: 'qualified',
      createdAt: '2024-01-29T16:20:00Z',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      {/* Charts and Recent Leads */}
      <div className="grid gap-6 lg:grid-cols-2">
        <LeadSourceChart data={sourceData} />
        <RecentLeads leads={recentLeads} />
      </div>

      {/* Pipeline Overview */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Pipeline Overview</CardTitle>
          <Button variant="outline" size="sm">
            View Pipeline
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { stage: 'New', count: 156, icon: <Clock className="h-5 w-5" />, color: 'text-blue-600' },
              { stage: 'Contacted', count: 89, icon: <Phone className="h-5 w-5" />, color: 'text-amber-600' },
              { stage: 'Interested', count: 67, icon: <Target className="h-5 w-5" />, color: 'text-emerald-600' },
              { stage: 'Won', count: 34, icon: <CheckCircle2 className="h-5 w-5" />, color: 'text-green-600' },
            ].map((item) => (
              <div
                key={item.stage}
                className="flex items-center gap-4 rounded-xl border border-gray-100 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/50"
              >
                <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-sm dark:bg-gray-800', item.color)}>
                  {item.icon}
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{item.count}</p>
                  <p className="text-sm text-gray-500">{item.stage}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
