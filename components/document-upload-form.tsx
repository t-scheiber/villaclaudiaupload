"use client";

import React, { useState } from "react";
import { FileUpload } from "@/components/ui/file-upload";

interface DocumentUploadFormProps {
  bookingId: string;
  bookingData: {
    checkInDate: string;
    checkOutDate?: string;
    bookingReference?: string;
  };
  email?: string;
  maxTravelers?: number;
}

export default function DocumentUploadForm({
  bookingId,
  bookingData,
  email = '',
  maxTravelers = 8
}: DocumentUploadFormProps) {
  const [travelers, setTravelers] = useState<{ 
    name: string; 
    documentType: string; 
    documentNumber: string;
    citizenship: string;
  }[]>([
    { name: '', documentType: 'passport', documentNumber: '', citizenship: 'other' }
  ]);
  const [emailValue, setEmailValue] = useState(email);
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // List of EU countries
  const euCountries = [
    { code: 'at', name: 'Austria' },
    { code: 'be', name: 'Belgium' },
    { code: 'bg', name: 'Bulgaria' },
    { code: 'hr', name: 'Croatia' },
    { code: 'cy', name: 'Cyprus' },
    { code: 'cz', name: 'Czech Republic' },
    { code: 'dk', name: 'Denmark' },
    { code: 'ee', name: 'Estonia' },
    { code: 'fi', name: 'Finland' },
    { code: 'fr', name: 'France' },
    { code: 'de', name: 'Germany' },
    { code: 'gr', name: 'Greece' },
    { code: 'hu', name: 'Hungary' },
    { code: 'ie', name: 'Ireland' },
    { code: 'it', name: 'Italy' },
    { code: 'lv', name: 'Latvia' },
    { code: 'lt', name: 'Lithuania' },
    { code: 'lu', name: 'Luxembourg' },
    { code: 'mt', name: 'Malta' },
    { code: 'nl', name: 'Netherlands' },
    { code: 'pl', name: 'Poland' },
    { code: 'pt', name: 'Portugal' },
    { code: 'ro', name: 'Romania' },
    { code: 'sk', name: 'Slovakia' },
    { code: 'si', name: 'Slovenia' },
    { code: 'es', name: 'Spain' },
    { code: 'se', name: 'Sweden' }
  ];
  
  // List of other common countries
  const otherCountries = [
    { code: 'us', name: 'United States' },
    { code: 'ca', name: 'Canada' },
    { code: 'gb', name: 'United Kingdom' },
    { code: 'ch', name: 'Switzerland' },
    { code: 'no', name: 'Norway' },
    { code: 'au', name: 'Australia' },
    { code: 'nz', name: 'New Zealand' },
    { code: 'jp', name: 'Japan' },
    { code: 'cn', name: 'China' },
    { code: 'in', name: 'India' },
    { code: 'br', name: 'Brazil' },
    { code: 'ru', name: 'Russia' },
    { code: 'other', name: 'Other' }
  ];

  // Check if a citizenship is an EU country
  const isEuCitizen = (citizenship: string) => {
    return euCountries.some(country => country.code === citizenship);
  };

  const handleFilesSelected = (selectedFiles: File[]) => {
    setFiles(selectedFiles);
  };

  const addTraveler = () => {
    if (travelers.length < maxTravelers) {
      setTravelers([...travelers, { name: '', documentType: 'passport', documentNumber: '', citizenship: 'other' }]);
    }
  };

  const removeTraveler = (index: number) => {
    if (travelers.length > 1) {
      setTravelers(travelers.filter((_, i) => i !== index));
    }
  };

  const updateTraveler = (index: number, field: string, value: string) => {
    const updatedTravelers = [...travelers];
    updatedTravelers[index] = { ...updatedTravelers[index], [field]: value };
    
    // If citizenship changes, update document type to passport by default
    if (field === 'citizenship') {
      const isEu = isEuCitizen(value);
      // Only reset document type if it was ID card and new citizenship is non-EU
      if (updatedTravelers[index].documentType === 'id_card' && !isEu) {
        updatedTravelers[index].documentType = 'passport';
      }
    }
    
    setTravelers(updatedTravelers);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (files.length === 0) {
      setSubmitError("Please upload at least one document");
      return;
    }
    
    if (travelers.some(t => !t.name)) {
      setSubmitError("Please enter names for all travelers");
      return;
    }
    
    setIsSubmitting(true);
    setSubmitError("");
    
    try {
      const formData = new FormData();
      formData.append("bookingId", bookingId);
      formData.append("email", emailValue);
      formData.append("travelers", JSON.stringify(travelers));
      // Add the first traveler's name as guestName for backward compatibility
      formData.append("guestName", travelers[0].name);
      
      // Add files
      files.forEach((file, index) => {
        formData.append("files", file);
        
        // Add metadata for each file
        const travelerIndex = Math.min(index, travelers.length - 1);
        formData.append(`fileMetadata[${index}]`, JSON.stringify({
          travelerIndex,
          travelerName: travelers[travelerIndex].name,
          documentType: travelers[travelerIndex].documentType,
          documentNumber: travelers[travelerIndex].documentNumber,
          citizenship: travelers[travelerIndex].citizenship
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
          {bookingData.bookingReference && (
            <p className="mb-1">
              <span className="font-medium">Booking Reference:</span> {bookingData.bookingReference}
            </p>
          )}
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
          <label className="block mb-2 font-medium">
            Traveler Information <span className="text-red-500">*</span>
          </label>
          
          {travelers.map((traveler, index) => (
            <div key={index} className="mb-4 p-4 border border-gray-200 rounded">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium">Traveler {index + 1}</h3>
                {travelers.length > 1 && (
                  <button 
                    type="button"
                    onClick={() => removeTraveler(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                )}
              </div>
              
              <div className="mb-3">
                <label htmlFor={`travelerName-${index}`} className="block mb-1 text-sm font-medium">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id={`travelerName-${index}`}
                  value={traveler.name}
                  onChange={(e) => updateTraveler(index, 'name', e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded"
                  required
                />
              </div>

              <div className="mb-3">
                <label htmlFor={`citizenship-${index}`} className="block mb-1 text-sm font-medium">
                  Citizenship/Nationality <span className="text-red-500">*</span>
                </label>
                <select
                  id={`citizenship-${index}`}
                  value={traveler.citizenship}
                  onChange={(e) => updateTraveler(index, 'citizenship', e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded"
                  required
                >
                  <option value="" disabled>Select citizenship</option>
                  <optgroup label="European Union">
                    {euCountries.map(country => (
                      <option key={country.code} value={country.code}>{country.name}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Other Countries">
                    {otherCountries.map(country => (
                      <option key={country.code} value={country.code}>{country.name}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
              
              <div className="mb-3">
                <label htmlFor={`documentType-${index}`} className="block mb-1 text-sm font-medium">
                  Document Type <span className="text-red-500">*</span>
                </label>
                <select
                  id={`documentType-${index}`}
                  value={traveler.documentType}
                  onChange={(e) => updateTraveler(index, 'documentType', e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded"
                  required
                >
                  <option value="passport">Passport</option>
                  {isEuCitizen(traveler.citizenship) && (
                    <option value="id_card">National ID Card (EU citizens only)</option>
                  )}
                </select>
                {!isEuCitizen(traveler.citizenship) && (
                  <p className="mt-1 text-xs text-amber-600">
                    Non-EU citizens must use a passport.
                  </p>
                )}
              </div>
              
              <div>
                <label htmlFor={`documentNumber-${index}`} className="block mb-1 text-sm font-medium">
                  Document Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id={`documentNumber-${index}`}
                  value={traveler.documentNumber}
                  onChange={(e) => updateTraveler(index, 'documentNumber', e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded"
                  required
                />
              </div>
            </div>
          ))}
          
          {travelers.length < maxTravelers && (
            <button
              type="button"
              onClick={addTraveler}
              className="mt-2 px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
            >
              + Add Another Traveler
            </button>
          )}
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
