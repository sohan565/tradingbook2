import type { Metadata } from "next";
import "./globals.css";
import TopNav from '@/components/layout/TopNav';
import { ThemeProvider } from '@/components/ThemeProvider';

export const metadata: Metadata = {
  title: "TradingBook — Backtesting & Trade Journal",
  description:
    "Professional backtesting replay engine and trade journal. Replay XAU/USD charts candle-by-candle, practice strategies, and track your trading performance.",
  keywords: ["trading", "backtesting", "journal", "forex", "gold", "XAU/USD", "MT5"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const checkAndRemove = (el) => {
                  if (el && el.removeAttribute && el.hasAttribute && el.hasAttribute('bis_skin_checked')) {
                    el.removeAttribute('bis_skin_checked');
                  }
                };
                const observer = new MutationObserver((mutations) => {
                  for (const m of mutations) {
                    if (m.type === 'attributes' && m.attributeName === 'bis_skin_checked') {
                      checkAndRemove(m.target);
                    } else if (m.type === 'childList') {
                      m.addedNodes.forEach(node => {
                        if (node.nodeType === 1) {
                          checkAndRemove(node);
                          node.querySelectorAll('[bis_skin_checked]').forEach(checkAndRemove);
                        }
                      });
                    }
                  }
                });
                observer.observe(document.documentElement, {
                  attributes: true,
                  childList: true,
                  subtree: true,
                  attributeFilter: ['bis_skin_checked']
                });
              })();
            `
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem>
          <div className="app-layout">
            <TopNav />
            <div className="app-body">
              <main className="app-main">
                {children}
              </main>
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
