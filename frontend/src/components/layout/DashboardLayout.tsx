'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuthStore, useUIStore } from '@/stores';
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Kanban,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings,
  Upload,
  Users,
  Users2,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Lead Inbox', href: '/inbox', icon: Inbox },
  { name: 'Pipeline', href: '/pipeline', icon: Kanban },
  { name: 'Import', href: '/import', icon: Upload },
  { name: 'Scraper', href: '/scraper', icon: Search },
  { name: 'Automations', href: '/automations', icon: Zap },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Team', href: '/team', icon: Users2 },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebarCollapsed } = useUIStore();
  const { user, tenant, logout } = useAuthStore();

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-gray-200 bg-white transition-all duration-300 dark:border-gray-800 dark:bg-gray-950',
        sidebarCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-gray-200 px-4 dark:border-gray-800">
        {!sidebarCollapsed && (
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600">
              <Users className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Studiovyn
            </span>
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={toggleSidebarCollapsed}
          className="flex-shrink-0"
        >
          {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 dark:from-indigo-950 dark:to-purple-950 dark:text-indigo-300'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100',
                sidebarCollapsed && 'justify-center px-2'
              )}
              title={sidebarCollapsed ? item.name : undefined}
            >
              <item.icon
                className={cn(
                  'h-5 w-5 flex-shrink-0',
                  isActive ? 'text-indigo-600 dark:text-indigo-400' : ''
                )}
              />
              {!sidebarCollapsed && <span>{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-gray-200 p-3 dark:border-gray-800">
        <div
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2',
            sidebarCollapsed && 'justify-center px-2'
          )}
        >
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 text-xs font-medium text-white">
            {user?.profile.firstName?.[0]}
            {user?.profile.lastName?.[0]}
          </div>
          {!sidebarCollapsed && (
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                {user?.profile.firstName} {user?.profile.lastName}
              </p>
              <p className="truncate text-xs text-gray-500">{tenant?.name}</p>
            </div>
          )}
          {!sidebarCollapsed && (
            <Button variant="ghost" size="icon-sm" onClick={logout} title="Logout">
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </aside>
  );
}

export function Header() {
  const { sidebarCollapsed, toggleSidebar, sidebarOpen } = useUIStore();
  const { user } = useAuthStore();

  return (
    <header
      className={cn(
        'fixed top-0 right-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white/80 px-6 backdrop-blur-xl transition-all duration-300 dark:border-gray-800 dark:bg-gray-950/80',
        sidebarCollapsed ? 'left-16' : 'left-64'
      )}
    >
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={toggleSidebar}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Welcome back, {user?.profile.firstName}! 👋
        </h1>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative">
          <input
            type="text"
            placeholder="Search leads..."
            className="h-9 w-64 rounded-lg border border-gray-200 bg-gray-50 px-4 pr-10 text-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-900"
          />
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        </div>
      </div>
    </header>
  );
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { sidebarCollapsed } = useUIStore();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar />
      <Header />
      <main
        className={cn(
          'pt-16 transition-all duration-300',
          sidebarCollapsed ? 'pl-16' : 'pl-64'
        )}
      >
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
