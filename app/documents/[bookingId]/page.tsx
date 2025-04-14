"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { FileUpload } from "@/components/ui/file-upload";
import { Plus, Trash2 } from "lucide-react";
import Image from "next/image";

interface TravelerDocument {
  travelerName: string;
  files: File[];
  documentType: string;
  documentNumber: string;
}

function SearchParamsHandler({ onParamsLoaded }: { onParamsLoaded: (email: string | null) => void }) {
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email");
  
  useEffect(() => {
    onParamsLoaded(emailParam);
  }, [emailParam, onParamsLoaded]);
  
  return null;
}

export default function DocumentUploadPage() {
  const params = useParams();
  const secureBookingId = params.bookingId as string;
  
  // Extract the actual booking ID from the secure format
  // The format is: bookingId + checkindate + checkoutdate (all dates in YYYYMMDD format)
  // Example: "87020250511202505018" -> "870" is the booking ID
  const bookingIdMatch = secureBookingId.match(/^(\d+?)(\d{8})(\d{8})?$/);
  const bookingId = bookingIdMatch ? bookingIdMatch[1] : secureBookingId;
  
  const [guestName, setGuestName] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [bookingInfo, setBookingInfo] = useState<{
    checkInDate?: string;
    checkOutDate?: string;
    bookingName?: string;
    isLoading: boolean;
    error?: string;
  }>({ isLoading: true });
  
  // Track documents by traveler
  const [travelers, setTravelers] = useState<TravelerDocument[]>([
    { travelerName: "", files: [], documentType: "passport", documentNumber: "" }
  ]);

  // Fetch booking information
  useEffect(() => {
    const fetchBookingInfo = async () => {
      try {
        const response = await fetch(`/api/booking?id=${encodeURIComponent(bookingId)}`);
        
        if (!response.ok) {
          throw new Error("Failed to fetch booking information");
        }
        
        const data = await response.json();
        
        // Set booking information
        setBookingInfo({
          checkInDate: data.checkInDate,
          checkOutDate: data.checkOutDate,
          bookingName: data.guestName,
          isLoading: false
        });
        
        // Pre-fill lead guest name if available
        if (data.guestName) {
          setGuestName(data.guestName);
          
          // Initialize first traveler with lead guest name using functional update
          setTravelers(currentTravelers => {
            const updatedTravelers = [...currentTravelers];
            updatedTravelers[0].travelerName = data.guestName;
            return updatedTravelers;
          });
        }
      } catch (error) {
        console.error("Error fetching booking:", error);
        setBookingInfo({
          isLoading: false,
          error: "Could not fetch booking details. Please proceed to fill the form manually."
        });
      }
    };
    
    fetchBookingInfo();
  }, [bookingId]);

  const handleAddTraveler = () => {
    if (travelers.length < 8) { // Limit to 8 travelers total
      setTravelers([...travelers, { travelerName: "", files: [], documentType: "passport", documentNumber: "" }]);
    }
  };

  const handleRemoveTraveler = (index: number) => {
    if (travelers.length > 1) {
      const updatedTravelers = [...travelers];
      updatedTravelers.splice(index, 1);
      setTravelers(updatedTravelers);
    }
  };

  const handleTravelerNameChange = (index: number, name: string) => {
    const updatedTravelers = [...travelers];
    updatedTravelers[index].travelerName = name;
    setTravelers(updatedTravelers);
  };

  const handleDocumentNumberChange = (index: number, number: string) => {
    const updatedTravelers = [...travelers];
    updatedTravelers[index].documentNumber = number;
    setTravelers(updatedTravelers);
  };

  const handleFilesSelected = (index: number, files: File[]) => {
    const updatedTravelers = [...travelers];
    updatedTravelers[index].files = files;
    setTravelers(updatedTravelers);
  };

  const handleDocumentTypeChange = (index: number, type: string) => {
    const updatedTravelers = [...travelers];
    updatedTravelers[index].documentType = type;
    setTravelers(updatedTravelers);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    // Validate: at least one traveler with name, document number and files
    const isValid = travelers.some(t => 
      t.travelerName.trim() !== "" && 
      t.documentNumber.trim() !== "" && 
      t.files.length > 0
    );
    
    if (!isValid) {
      setErrorMessage("Please enter traveler name, document number and upload document for at least one traveler");
      return;
    }
    
    setIsSubmitting(true);
    setSubmitStatus("idle");
    setErrorMessage("");
    
    try {
      const formData = new FormData();
      formData.append("bookingId", bookingId);
      formData.append("guestName", guestName);
      
      if (email) {
        formData.append("email", email);
      }
      
      // Add all traveler names and document numbers
      formData.append("travelers", JSON.stringify(travelers.map(t => ({
        name: t.travelerName,
        documentType: t.documentType,
        documentNumber: t.documentNumber
      }))));
      
      // Add all files with metadata
      let fileIndex = 0;
      travelers.forEach((traveler, travelerIndex) => {
        traveler.files.forEach(file => {
          formData.append(`files`, file);
          formData.append(`fileMetadata[${fileIndex}]`, JSON.stringify({
            travelerIndex,
            travelerName: traveler.travelerName,
            documentType: traveler.documentType,
            documentNumber: traveler.documentNumber
          }));
          fileIndex++;
        });
      });
      
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to upload documents");
      }
      
      setSubmitStatus("success");
    } catch (error) {
      console.error("Upload error:", error);
      setSubmitStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Failed to upload documents");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTotalFilesCount = () => {
    return travelers.reduce((total, traveler) => total + traveler.files.length, 0);
  };

  const getTotalFilesSize = () => {
    return travelers.reduce((total, traveler) => 
      total + traveler.files.reduce((sum, file) => sum + file.size, 0), 0
    );
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleParamsLoaded = (emailParam: string | null) => {
    if (emailParam) {
      setEmail(emailParam);
    }
  };

  return (
    <div className="container mx-auto py-10">
      <div className="text-center mb-8">
        <Image 
          src="/Logo.png" 
          alt="Villa Claudia" 
          width={200} 
          height={100} 
          className="mx-auto mb-4" 
        />
        <h1 className="text-3xl font-bold">Upload Your Travel Documents</h1>
      </div>
      
      <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 mb-6">
        <h3 className="font-semibold text-amber-800 mb-2">Registration Requirements for Croatia</h3>
        <p className="text-sm text-amber-700">
          By law, all foreigners must be registered with local authorities in Croatia within 24 hours of arrival. 
          As your host, we are required to collect and submit these documents for each traveler:
        </p>
        <ul className="list-disc list-inside text-sm text-amber-700 mt-2">
          <li><strong>EU Citizens:</strong> Valid National ID Card or Passport</li>
          <li><strong>Non-EU Citizens:</strong> Valid Passport</li>
        </ul>
        <p className="text-sm text-amber-700 mt-2">
          Please upload documents for all travelers (regardless of the number listed in your original booking).
          We need information for every person who will be staying at the accommodation.
        </p>
      </div>
      
      <Suspense fallback={null}>
        <SearchParamsHandler onParamsLoaded={handleParamsLoaded} />
      </Suspense>
      
      {submitStatus === "success" ? (
        <div className="bg-green-50 p-6 rounded-lg border border-green-200 text-center">
          <h2 className="text-2xl font-bold text-green-700 mb-4">Documents Uploaded Successfully!</h2>
          <p className="mb-2">Thank you for uploading your travel documents. Your booking is now complete.</p>
          <p className="mb-4">For your security, the documents have been securely emailed to our administrative team and are not stored on our servers.</p>
          <p className="text-sm text-gray-600">
            If you need to make any changes, please contact our support team.
          </p>
        </div>
      ) : (
        <>
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-6">
            <p className="text-blue-800">
              <strong>Booking Reference:</strong> {secureBookingId}
            </p>
            {email && (
              <p className="text-blue-800 mt-1">
                <strong>Email:</strong> {email}
              </p>
            )}
          </div>

          {submitStatus === "idle" && bookingInfo.isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="ml-3 text-blue-600">Loading booking information...</p>
            </div>
          ) : (
            <>
              {bookingInfo.error && (
                <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 mb-6">
                  <p className="text-amber-800">{bookingInfo.error}</p>
                </div>
              )}

              {bookingInfo.checkInDate && (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-6">
                  <p className="text-blue-800">
                    <strong>Stay Duration:</strong> {new Date(bookingInfo.checkInDate).toLocaleDateString()} - {bookingInfo.checkOutDate && new Date(bookingInfo.checkOutDate).toLocaleDateString()}
                  </p>
                </div>
              )}
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="guestName" className="block text-sm font-medium text-gray-700 mb-1">
                  Lead Guest / Booking Name
                </label>
                <input
                  type="text"
                  id="guestName"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter booking name"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  The name used for the reservation
                </p>
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="your@email.com"
                  required={!email}
                />
                <p className="text-xs text-gray-500 mt-1">
                  We will use this to contact you about your stay
                </p>
              </div>
            </div>
            
            <div className="mt-8">
              <h2 className="text-xl font-semibold mb-4">Traveler Documents</h2>
              <p className="mb-4 text-gray-700">
                Please provide the name of each traveler and upload their passport or ID document.
                Accepted formats: JPG, JPEG, PNG, or PDF.
              </p>
              
              <div className="space-y-6">
                {travelers.map((traveler, index) => (
                  <div key={index} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-medium">{index === 0 ? "Lead Traveler" : `Additional Traveler #${index}`}</h3>
                      {travelers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveTraveler(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                    
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Full Name (as on Passport/ID)
                      </label>
                      <input
                        type="text"
                        value={traveler.travelerName}
                        onChange={(e) => handleTravelerNameChange(index, e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter traveler's full name"
                        required
                      />
                    </div>
                    
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Document Type
                      </label>
                      <select
                        value={traveler.documentType}
                        onChange={(e) => handleDocumentTypeChange(index, e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="passport">Passport</option>
                        <option value="id_card">National ID Card</option>
                        <option value="residence_permit">Residence Permit</option>
                        <option value="drivers_license">Driver&apos;s License</option>
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        For Croatian registration, EU citizens can use ID cards or passports; Non-EU citizens must provide passports
                      </p>
                    </div>
                    
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Document Number
                      </label>
                      <input
                        type="text"
                        value={traveler.documentNumber}
                        onChange={(e) => handleDocumentNumberChange(index, e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter ID/passport number"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Enter the unique identification number from the document
                      </p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Upload Document(s)
                      </label>
                      <FileUpload
                        onFilesSelected={(files) => handleFilesSelected(index, files)}
                        className="mb-2"
                      />
                      <p className="text-xs text-gray-500">
                        Please upload a clear image or scan of their document
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              
              {travelers.length < 8 && (
                <button
                  type="button"
                  onClick={handleAddTraveler}
                  className="mt-4 flex items-center text-blue-600 hover:text-blue-800"
                  disabled={travelers.length >= 8}
                >
                  <Plus size={16} className="mr-1" />
                  Add Another Traveler ({travelers.length}/8)
                </button>
              )}
            </div>
            
            {getTotalFilesCount() > 0 && (
              <div className={`mt-4 text-sm flex items-center 
                ${getTotalFilesSize() > 20 * 1024 * 1024 ? "text-amber-600" : "text-gray-500"}`}>
                <p>
                  Total: {getTotalFilesCount()} file(s) ({formatFileSize(getTotalFilesSize())})
                  {getTotalFilesSize() > 20 * 1024 * 1024 && (
                    <span className="ml-2 font-medium">
                      Approaching 25MB limit!
                    </span>
                  )}
                </p>
              </div>
            )}
            
            {submitStatus === "error" && (
              <div className="bg-red-50 p-4 rounded-lg border border-red-200 text-red-700">
                <p className="font-medium">Error uploading documents</p>
                <p className="text-sm">{errorMessage}</p>
              </div>
            )}
            
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting || getTotalFilesCount() === 0}
                className={`px-6 py-2 rounded-md text-white font-medium 
                  ${isSubmitting || getTotalFilesCount() === 0
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-[#4a8b96] hover:bg-[#3d7580]"
                  }`}
              >
                {isSubmitting ? "Uploading..." : "Submit Documents"}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
} 