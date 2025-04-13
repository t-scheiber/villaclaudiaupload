import React from "react";
import type { Metadata } from "next";
import Link from 'next/link';
import Image from 'next/image';

export const metadata: Metadata = {
  title: "Travel Document Upload - Villa Claudia",
  description: "Securely upload your travel documents for your stay at Villa Claudia",
};

export default function DocumentsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-600 text-white p-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Link href="/" className="flex items-center">
              <Image src="/logo.png" alt="Villa Claudia Logo" className="h-8 mr-2" width={32} height={32} />
              <span className="font-medium">Villa Claudia</span>
            </Link>
          </div>
          <nav className="hidden md:flex space-x-6">
            <Link href="/" className="text-gray-700 hover:text-blue-600">Home</Link>
            <Link href="/documents/" className="text-gray-700 hover:text-blue-600">Documents</Link>
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="bg-gray-800 text-white py-6">
        <div className="container mx-auto text-center">
          <p>&copy; {new Date().getFullYear()} Villa Claudia. All rights reserved.</p>
          <p className="text-sm mt-2">Your documents are securely processed and stored.</p>
        </div>
      </footer>
    </div>
  );
}