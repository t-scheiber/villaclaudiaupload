import React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Guest registration | Villa Claudia",
  description: "Bring your original identity document for guest registration at Villa Claudia",
};

export default function DocumentsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-[#fff4d8]">
      {children}
    </div>
  );
}
