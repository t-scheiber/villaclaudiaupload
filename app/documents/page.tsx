import React from "react";

export default function DocumentsPage() {
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">Travel Document Upload</h1>
      <p className="mb-4">
        For your stay at Villa Claudia, we require a copy of your passport or travel ID.
        Please upload a clear image or scan of your document using the form below.
      </p>
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">Upload your documents</h2>
        <p className="text-sm text-gray-500 mb-4">
          Your documents are securely transmitted and stored. Only authorized personnel have access to them.
        </p>
        
        {/* Upload form will be implemented here */}
        <div className="h-40 border-2 border-dashed border-gray-300 rounded-md flex items-center justify-center">
          <p className="text-gray-500">Document upload component coming soon</p>
        </div>
      </div>
    </div>
  );
} 