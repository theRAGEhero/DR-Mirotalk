import type { Metadata } from "next";
import { Fraunces, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { AppHeader } from "@/components/AppHeader";

const sans = Space_Grotesk({ subsets: ["latin"], variable: "--font-sans" });
const serif = Fraunces({ subsets: ["latin"], variable: "--font-serif" });

export const metadata: Metadata = {
  title: "MiroTalk Manager",
  description: "Manage MiroTalk SFU meeting links"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${serif.variable}`}>
        <Providers>
          <AppHeader />
          <main className="mx-auto w-full max-w-5xl px-4 py-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
