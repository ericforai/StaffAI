'use client';

import DashboardLayout from '../components/DashboardLayout';

export default function ClientShell({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
