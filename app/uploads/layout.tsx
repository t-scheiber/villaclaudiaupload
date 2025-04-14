import React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Document Upload | Villa Claudia",
  description: "Upload your travel documents for your stay at Villa Claudia",
};

export default function DocumentsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-gray-50">
      <main>{children}</main>
    </div>
  );
}