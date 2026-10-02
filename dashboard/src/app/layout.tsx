import type { Metadata } from "next";
import localFont from "next/font/local";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import Script from "next/script";
import { RealtimeProvider } from "@/context/RealtimeContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { AppShell } from "@/components/layout/AppShell";

// Primary Modern Tech UI Font: Plus Jakarta Sans
const plusJakartaSans = localFont({
  src: [
    {
      path: "../../public/fonts/Plus_Jakarta_Sans/PlusJakartaSans-VariableFont_wght.ttf",
      style: "normal",
    },
    {
      path: "../../public/fonts/Plus_Jakarta_Sans/PlusJakartaSans-Italic-VariableFont_wght.ttf",
      style: "italic",
    },
  ],
  variable: "--font-plus-jakarta",
  display: "swap",
});

// Editorial Luxury Serif Font: Playfair Display
const playfairDisplay = localFont({
  src: [
    {
      path: "../../public/fonts/Playfair_Display/PlayfairDisplay-VariableFont_wght.ttf",
      style: "normal",
    },
    {
      path: "../../public/fonts/Playfair_Display/PlayfairDisplay-Italic-VariableFont_wght.ttf",
      style: "italic",
    },
  ],
  variable: "--font-playfair",
  display: "swap",
});

// Clean Utilitarian Tech Font: Roboto
const roboto = localFont({
  src: [
    {
      path: "../../public/fonts/Roboto/Roboto-VariableFont_wdth,wght.ttf",
      style: "normal",
    },
    {
      path: "../../public/fonts/Roboto/Roboto-Italic-VariableFont_wdth,wght.ttf",
      style: "italic",
    },
  ],
  variable: "--font-roboto",
  display: "swap",
});

// Bespoke Calligraphic Signature: Dancing Script
const dancingScript = localFont({
  src: "../../public/fonts/Dancing_Script/DancingScript-VariableFont_wght.ttf",
  variable: "--font-dancing",
  display: "swap",
});

// Expressive Story Script: Story Script
const storyScript = localFont({
  src: "../../public/fonts/Story_Script/StoryScript-Regular.ttf",
  variable: "--font-story",
  display: "swap",
});

// Telemetry Monospace Font
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MINE MESH™ | Autonomous Mine Subsidence Telemetry & Early Warning System",
  description:
    "MINE MESH™ (Mine Infrastructure Network & Early Warning Mesh) - Mission-critical IoT geotechnical sensor telemetry mesh monitoring, real-time strata analytics, sequence gap auditing, and subsidence risk forecasting for underground mining operations.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${playfairDisplay.variable} ${roboto.variable} ${dancingScript.variable} ${storyScript.variable} ${geistMono.variable} h-full antialiased dark`}
      suppressHydrationWarning
    >
      <head>
        {/* Anti-FOUC script to synchronize saved theme immediately */}
        <Script
          id="theme-initializer"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('sih_theme_preference');
                  var theme = stored === 'light' ? 'light' : 'dark';
                  var root = document.documentElement;
                  if (theme === 'dark') {
                    root.classList.add('dark');
                    root.classList.remove('light');
                    root.setAttribute('data-theme', 'dark');
                  } else {
                    root.classList.add('light');
                    root.classList.remove('dark');
                    root.setAttribute('data-theme', 'light');
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="h-full antialiased transition-colors duration-300 selection:bg-[#fca311] selection:text-black font-sans">
        <ThemeProvider>
          <RealtimeProvider>
            <AppShell>{children}</AppShell>
          </RealtimeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
