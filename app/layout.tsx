import type { Metadata } from "next";
import Link from "next/link";
import { Navigation, ArrowUpRight } from "lucide-react";
import "./globals.css";
export const metadata: Metadata = {
  title: "Aiu2 · Find your way",
  description:
    "An accessible campus journey planner. Clearly labeled two-floor demonstration.",
};
export default function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <header className="header">
          <Link href="/" className="brand">
            <span className="brand-icon">
              <Navigation size={23} />
            </span>
            aiu<span className="brand-two">2</span>
          </Link>
          <nav aria-label="Main navigation">
            <Link href="/">Plan a journey</Link>
            <Link href="/conditions">
              Live conditions <ArrowUpRight size={14} />
            </Link>
          </nav>
          <span className="demo-pill">DEMO CAMPUS</span>
        </header>
        {children}
        <footer>
          <span>
            aiu2 <span className="muted">/ Find your way, your way.</span>
          </span>
          <span>Built for individual needs. Designed with care.</span>
        </footer>
      </body>
    </html>
  );
}
