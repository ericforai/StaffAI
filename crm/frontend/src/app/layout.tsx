import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'CRM Dashboard',
  description: 'Customer Relationship Management',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f4f4f8' }}>
        {children}
      </body>
    </html>
  );
}
