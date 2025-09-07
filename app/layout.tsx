import type React from "react"
import type { Metadata } from "next"
import { Outfit } from "next/font/google"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import { Suspense } from "react"
import "./globals.css"

const outfit = Outfit({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-outfit",
  weight: ["400", "500", "600", "700"],
  fallback: ["sans-serif"],
})

export const metadata: Metadata = {
  title: "AI Discovery Form - Project Scoping Made Simple",
  description:
    "An intelligent discovery form that uses AI to gather comprehensive project requirements for software development proposals.",
  keywords: ["project scoping", "software development", "AI form", "discovery", "requirements gathering"],
  authors: [{ name: "Automatic.so" }],
  creator: "Automatic.so",
  publisher: "Automatic.so",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    title: "AI Discovery Form - Project Scoping Made Simple",
    description: "An intelligent discovery form that uses AI to gather comprehensive project requirements.",
    siteName: "AI Discovery Form",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Discovery Form - Project Scoping Made Simple",
    description: "An intelligent discovery form that uses AI to gather comprehensive project requirements.",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
  },
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <meta name="theme-color" content="#059669" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className={`font-sans ${outfit.variable} ${GeistMono.variable} antialiased`}>
        <Suspense fallback={<div>Loading...</div>}>{children}</Suspense>
        <Analytics />
      </body>
    </html>
  )
}
