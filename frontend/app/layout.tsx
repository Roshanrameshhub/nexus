import type { Metadata, Viewport } from 'next'
import { Space_Grotesk, Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { AppProviders } from '@/components/providers/app-providers'
import './globals.css'

const spaceGrotesk = Space_Grotesk({ 
  subsets: ["latin"],
  variable: '--font-sans',
  display: 'swap',
})

const inter = Inter({ 
  subsets: ["latin"],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'RConnectX | The Future of Startup Networking',
  description: 'Join the next-generation startup ecosystem. Connect with founders, developers, mentors, and build the future together.',
  keywords: ['startup', 'networking', 'founders', 'developers', 'AI', 'collaboration', 'ecosystem', 'RConnectX'],
  authors: [{ name: 'RConnectX' }],
  icons: {
    icon: [
      { url: '/rconnectx-icon.png', type: 'image/png' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/rconnectx-icon.png',
  },
  openGraph: {
    title: 'RConnectX | The Future of Startup Networking',
    description: 'Join the next-generation startup ecosystem.',
    type: 'website',
  },
}

export const viewport: Viewport = {
  themeColor: '#0f0d1a',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark bg-background">
      <body className={`${spaceGrotesk.variable} ${inter.variable} font-sans antialiased min-h-screen bg-background text-foreground`}>
        <AppProviders>{children}</AppProviders>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
