"use client";

import React, { useState } from "react";
import { FileUpload } from "@/components/ui/file-upload";

interface DocumentUploadFormProps {
  bookingId: string;
  bookingData: {
    checkInDate: string;
    checkOutDate?: string;
  };
  email?: string;
}

export default function DocumentUploadForm({
  bookingId,
  bookingData,
  email = ''
}: DocumentUploadFormProps) {
  const [guestName, setGuestName] = useState('');
  const [emailValue, setEmailValue] = useState(email);
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const handleFilesSelected = (selectedFiles: File[]) => {
    setFiles(selectedFiles);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (files.length === 0) {
      setSubmitError("Please upload at least one document");
      return;
    }
    
    if (!guestName) {
      setSubmitError("Please enter your name");
      return;
    }
    
    setIsSubmitting(true);
    setSubmitError("");
    
    try {
      const formData = new FormData();
      formData.append("bookingId", bookingId);
      formData.append("guestName", guestName);
      formData.append("email", emailValue);
      
      // Add files
      files.forEach((file, index) => {
        formData.append("files", file);
        
        // Add metadata for each file
        formData.append(`fileMetadata[${index}]`, JSON.stringify({
          travelerIndex: index,
          travelerName: guestName,
          documentType: "passport",
          documentNumber: ""
        }));
      });
      
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Upload failed");
      }
      
      setSubmitSuccess(true);
    } catch (error) {
      console.error("Upload error:", error);
      setSubmitError(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitSuccess) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8">
        <h2 className="text-2xl font-semibold text-green-600 mb-4">Documents Uploaded Successfully!</h2>
        <p className="mb-4">Thank you for uploading your travel documents.</p>
        <p>We look forward to welcoming you at Villa Claudia.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      {bookingData && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded text-left">
          <h2 className="text-lg font-semibold mb-2">Booking Details</h2>
          <p className="mb-1">
            <span className="font-medium">Check-in:</span> {bookingData.checkInDate}
          </p>
          {bookingData.checkOutDate && (
            <p>
              <span className="font-medium">Check-out:</span> {bookingData.checkOutDate}
            </p>
          )}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="text-left">
        {submitError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded text-red-700">
            {submitError}
          </div>
        )}
        
        <div className="mb-6">
          <label htmlFor="guestName" className="block mb-2 font-medium">
            Your Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="guestName"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded"
            required
          />
        </div>
        
        <div className="mb-6">
          <label htmlFor="email" className="block mb-2 font-medium">
            Email Address
          </label>
          <input
            type="email"
            id="email"
            value={emailValue}
            onChange={(e) => setEmailValue(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded"
          />
          <p className="mt-1 text-sm text-gray-500">
            Optional, but recommended to receive confirmation
          </p>
        </div>
        
        <div className="mb-6">
          <label className="block mb-2 font-medium">
            Upload Documents <span className="text-red-500">*</span>
          </label>
          <FileUpload 
            onFilesSelected={handleFilesSelected}
            maxFiles={10}
            acceptedFileTypes={["image/jpeg", "image/png", "application/pdf"]}
            maxSizeInMB={10}
          />
          <p className="mt-2 text-sm text-gray-500">
            Please upload scans or photos of passports or ID cards for all travelers
          </p>
        </div>
        
        <div className="text-center">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-3 bg-amber-600 text-white font-medium rounded hover:bg-amber-700 disabled:bg-gray-400"
          >
            {isSubmitting ? "Uploading..." : "Submit Documents"}
          </button>
        </div>
      </form>
    </div>
  );
}
