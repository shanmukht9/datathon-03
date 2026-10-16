import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AppProvider } from '@/context/AppContext';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'CivicPriority — Evidence-Based City Action',
  description:
    'CivicPriority is an explainable civic-issue prioritization and resolution platform. From Citizen Reports to Evidence-Based City Action.',
  keywords: ['civic', 'smart city', 'pothole', 'infrastructure', 'municipal', 'priority'],
};

/**
 * Root layout — wraps every page with the AppProvider context.
 * Applies the Inter font and dark background.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        {/* Leaflet CSS loaded globally */}
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          crossOrigin=""
        />
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css"
          crossOrigin=""
        />
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css"
          crossOrigin=""
        />
      </head>
      <body style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
        <AppProvider>
          {children}
        </AppProvider>
      </body>
    </html>
  );
}
