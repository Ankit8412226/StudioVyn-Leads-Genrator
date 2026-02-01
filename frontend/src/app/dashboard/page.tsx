'use client';

import { DashboardContent } from '@/components/dashboard/DashboardContent';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <DashboardContent />
    </DashboardLayout>
  );
}
