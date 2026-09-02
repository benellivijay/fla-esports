import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FLA ESPORTS — Admin Console',
  description: 'Internal administration and tournament operations for FLA ESPORTS.',
  icons: {
    icon: '/app_logo.png?v=3',
    apple: '/app_logo.png?v=3',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased bg-[#F8FAFC] text-slate-900 selection:bg-slate-900 selection:text-white">
        {children}
      </body>
    </html>
  );
}
