import "./globals.css";
import type { Metadata } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import Header from "@/components/Header";
import PublicSiteFooter from "@/components/PublicSiteFooter";
import ScrollReveal from "@/components/ScrollReveal";
import BackToTop from "@/components/BackToTop";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  variable: "--font-space-grotesk",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://genx.vortech.markets/"),
  title: {
    default: "GenX | Quantitative Trading Engine by Vortech Markets",
    template: "%s | GenX by Vortech Markets",
  },
  description:
    "GenX is Vortech Markets' quantitative research engine, using Market DNA, statistical analysis, and genetic algorithms to develop and evaluate trading strategies.",
  openGraph: {
    type: "website",
    siteName: "GenX by Vortech Markets",
    locale: "en_US",
    title: "GenX | Quantitative Trading Engine by Vortech Markets",
    description:
      "Explore GenX, Vortech Markets' quantitative research engine for Market DNA, statistical analysis, and evolving trading strategies.",
  },
  twitter: {
    card: "summary",
    title: "GenX | Quantitative Trading Engine by Vortech Markets",
    description:
      "Explore GenX, Vortech Markets' quantitative research engine for Market DNA, statistical analysis, and evolving trading strategies.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

const organizationAndWebsiteStructuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://vortech.markets/#organization",
      name: "Vortech Markets",
      url: "https://vortech.markets/",
      logo: "https://vortech.markets/img/logo-light-optimized.png",
      description:
        "Vortech Markets develops technology and market intelligence solutions, including GenX, its quantitative trading research engine.",
    },
    {
      "@type": "WebSite",
      "@id": "https://genx.vortech.markets/#website",
      url: "https://genx.vortech.markets/",
      name: "GenX by Vortech Markets",
      publisher: { "@id": "https://vortech.markets/#organization" },
      inLanguage: "en",
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${spaceGrotesk.variable} ${jetBrainsMono.variable} bg-[#0B0F17] text-slate-100 antialiased`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationAndWebsiteStructuredData).replace(
              /</g,
              "\\u003c"
            ),
          }}
        />
        <Header />
        <div className="pt-[var(--navbar-height)]">
          <ScrollReveal>{children}</ScrollReveal>
        </div>
        <PublicSiteFooter />
        <BackToTop />
      </body>
    </html>
  );
}