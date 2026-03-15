"use client";

import React, { useState, useReducer, useRef } from "react";
import { FileUpload } from "@/components/ui/file-upload";

// EU countries list
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

function isEuCitizen(citizenship: string): boolean {
  return euCountries.some(country => country.code === citizenship);
}

type Traveler = {
  id: string;
  name: string;
  documentType: string;
  documentNumber: string;
  citizenship: string;
  file?: File;
};

function newTraveler(): Traveler {
  return { id: crypto.randomUUID(), name: '', documentType: 'passport', documentNumber: '', citizenship: 'other' };
}

// TravelerCard component
interface TravelerCardProps {
  traveler: Traveler;
  index: number;
  canRemove: boolean;
  onRemove: () => void;
  onUpdate: (field: string, value: string) => void;
  onFileSelected: (files: File[]) => void;
}

function TravelerCard({ traveler, index, canRemove, onRemove, onUpdate, onFileSelected }: TravelerCardProps) {
  return (
    <div className="mb-4 p-4 border border-gray-200 rounded">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium">Guest {index + 1}</h3>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-red-500 hover:text-red-700"
          >
            Remove
          </button>
        )}
      </div>

      <div className="mb-3">
        <label htmlFor={`travelerName-${traveler.id}`} className="block mb-1 text-sm font-medium">
          Full Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id={`travelerName-${traveler.id}`}
          value={traveler.name}
          onChange={(e) => onUpdate('name', e.target.value)}
          className="w-full p-2 border border-gray-300 rounded"
          required
        />
      </div>

      <div className="mb-3">
        <label htmlFor={`citizenship-${traveler.id}`} className="block mb-1 text-sm font-medium">
          Citizenship/Nationality <span className="text-red-500">*</span>
        </label>
        <select
          id={`citizenship-${traveler.id}`}
          value={traveler.citizenship}
          onChange={(e) => onUpdate('citizenship', e.target.value)}
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
        <label htmlFor={`documentType-${traveler.id}`} className="block mb-1 text-sm font-medium">
          Document Type <span className="text-red-500">*</span>
        </label>
        <select
          id={`documentType-${traveler.id}`}
          value={traveler.documentType}
          onChange={(e) => onUpdate('documentType', e.target.value)}
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

      <div className="mb-3">
        <label htmlFor={`documentNumber-${traveler.id}`} className="block mb-1 text-sm font-medium">
          Document Number <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id={`documentNumber-${traveler.id}`}
          value={traveler.documentNumber}
          onChange={(e) => onUpdate('documentNumber', e.target.value)}
          className="w-full p-2 border border-gray-300 rounded"
          required
        />
      </div>

      <div className="mb-3">
        <label htmlFor={`file-upload-${traveler.id}`} className="block mb-2 font-medium">
          Upload Document <span className="text-red-500">*</span>
        </label>
        <FileUpload
          onFilesSelected={onFileSelected}
          maxFiles={1}
          acceptedFileTypes={["image/jpeg", "image/png", "application/pdf"]}
          maxSizeInMB={10}
          id={`file-upload-${traveler.id}`}
        />
        {traveler.file && (
          <p className="mt-2 text-sm text-green-600">
            Document uploaded: {traveler.file.name}
          </p>
        )}
      </div>
    </div>
  );
}

// Submit state reducer
type SubmitState = {
  isSubmitting: boolean;
  error: string;
  success: boolean;
};

type SubmitAction =
  | { type: 'START' }
  | { type: 'SUCCESS' }
  | { type: 'ERROR'; message: string };

function submitReducer(state: SubmitState, action: SubmitAction): SubmitState {
  switch (action.type) {
    case 'START': return { isSubmitting: true, error: '', success: false };
    case 'SUCCESS': return { isSubmitting: false, error: '', success: true };
    case 'ERROR': return { isSubmitting: false, error: action.message, success: false };
    default: return state;
  }
}

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
  const [travelers, setTravelers] = useState<Traveler[]>([newTraveler()]);
  const emailRef = useRef<HTMLInputElement>(null);
  const [submitState, dispatch] = useReducer(submitReducer, {
    isSubmitting: false,
    error: '',
    success: false,
  });

  const handleFilesSelected = (files: File[], travelerIndex: number) => {
    if (files.length > 0) {
      setTravelers(prev => prev.map((t, i) => i === travelerIndex ? { ...t, file: files[0] } : t));
    }
  };

  const addTraveler = () => {
    if (travelers.length < maxTravelers) {
      setTravelers(prev => [...prev, newTraveler()]);
    }
  };

  const removeTraveler = (index: number) => {
    if (travelers.length > 1) {
      setTravelers(prev => prev.filter((_, i) => i !== index));
    }
  };

  const updateTraveler = (index: number, field: string, value: string) => {
    setTravelers(prev => prev.map((t, i) => {
      if (i !== index) return t;
      const updated = { ...t, [field]: value };
      if (field === 'citizenship' && updated.documentType === 'id_card' && !isEuCitizen(value)) {
        updated.documentType = 'passport';
      }
      return updated;
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (travelers.some(t => !t.file)) {
      dispatch({ type: 'ERROR', message: "Please upload a document for each guest" });
      return;
    }

    if (travelers.some(t => !t.name)) {
      dispatch({ type: 'ERROR', message: "Please enter names for all guests" });
      return;
    }

    dispatch({ type: 'START' });

    try {
      const formData = new FormData();
      formData.append("bookingId", bookingId);
      formData.append("email", emailRef.current?.value ?? '');
      formData.append("travelers", JSON.stringify(travelers));
      formData.append("guestName", travelers[0].name);

      travelers.forEach((traveler, index) => {
        if (traveler.file) {
          formData.append("files", traveler.file);
          formData.append(`fileMetadata[${index}]`, JSON.stringify({
            travelerIndex: index,
            travelerName: traveler.name,
            documentType: traveler.documentType,
            documentNumber: traveler.documentNumber,
            citizenship: traveler.citizenship
          }));
        }
      });

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Upload failed");
      }

      dispatch({ type: 'SUCCESS' });
    } catch (error) {
      console.error("Upload error:", error);
      dispatch({ type: 'ERROR', message: error instanceof Error ? error.message : "Upload failed" });
    }
  };

  if (submitState.success) {
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
        {submitState.error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded text-red-700">
            {submitState.error}
          </div>
        )}

        <div className="mb-6">
          <div className="block mb-2 font-medium">
            Guest Information <span className="text-red-500">*</span>
          </div>

          {travelers.map((traveler, index) => (
            <TravelerCard
              key={traveler.id}
              traveler={traveler}
              index={index}
              canRemove={travelers.length > 1}
              onRemove={() => removeTraveler(index)}
              onUpdate={(field, value) => updateTraveler(index, field, value)}
              onFileSelected={(files) => handleFilesSelected(files, index)}
            />
          ))}

          {travelers.length < maxTravelers && (
            <button
              type="button"
              onClick={addTraveler}
              className="mt-2 px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
            >
              + Add Another Guest
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
            defaultValue={email}
            ref={emailRef}
            className="w-full p-3 border border-gray-300 rounded"
          />
          <p className="mt-1 text-sm text-gray-500">
            Optional, but recommended to receive confirmation
          </p>
        </div>

        <div className="text-center">
          <button
            type="submit"
            disabled={submitState.isSubmitting}
            className="px-6 py-3 bg-amber-600 text-white font-medium rounded hover:bg-amber-700 disabled:bg-gray-400"
          >
            {submitState.isSubmitting ? "Uploading..." : "Submit Documents"}
          </button>
        </div>
      </form>
    </div>
  );
}
