'use client';

import DashboardLayout from '../components/DashboardLayout';
import { AppWebSocketProvider } from './AppWebSocketProvider';

export default function ClientShell({ children }: { children: React.ReactNode }) {
  return (
    <AppWebSocketProvider>
      <DashboardLayout>{children}</DashboardLayout>
    </AppWebSocketProvider>
  );
}
