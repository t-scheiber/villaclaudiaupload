import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Image from "next/image";
import Link from "next/link";
import PrivacyLinks from '@/components/privacy-links';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://documents.villa-claudia.eu'),
  title: "Villa Claudia",
  description: "Guest registration guidance for Villa Claudia",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <header className="bg-[#fff4d8] p-4 shadow-sm border-b border-amber-300">
          <div className="container mx-auto flex justify-between items-center">
            <Link href="/" className="flex items-center">
              <Image
                src="/Logo.png"
                alt="Villa Claudia"
                width={60}
                height={60}
                priority
                style={{ width: "auto", height: "auto" }}
              />
            </Link>
          </div>
        </header>
        <main>{children}</main>
        <footer className="bg-[#fff4d8] p-4 text-center text-amber-800 text-sm mt-20 border-t border-amber-300">
          <p>
            © {new Date().getFullYear()} Villa Claudia. All rights reserved.
          </p>
          <nav className="mt-2" aria-label="Privacy information"><PrivacyLinks /></nav>
        </footer>
      </body>
    </html>
  );
}
