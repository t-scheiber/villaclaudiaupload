"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

interface Document {
  id: string;
  bookingId: string;
  guestName: string;
  email?: string;
  fileName: string;
  originalName: string;
  uploadedAt: string;
  fileType: string;
  fileSize: number;
}

// Component to handle search params
function SearchParamsHandler({ onParamsLoaded }: { onParamsLoaded: (bookingId: string | null) => void }) {
  const searchParams = useSearchParams();
  const bookingIdParam = searchParams.get("bookingId");
  
  useEffect(() => {
    onParamsLoaded(bookingIdParam);
  }, [bookingIdParam, onParamsLoaded]);
  
  return null;
}

export default function AdminDocumentsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [filterBookingId, setFilterBookingId] = useState("");
  const [filterDocType, setFilterDocType] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const handleParamsLoaded = (bookingId: string | null) => {
    if (bookingId) {
      setFilterBookingId(bookingId);
    }
  };

  // Simple admin authentication
  const authenticate = (providedPassword: string) => {
    const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "villa-claudia-admin";
    
    if (providedPassword === adminPassword) {
      setIsAuthenticated(true);
      localStorage.setItem("adminAuthenticated", "true");
      fetchDocuments();
    } else {
      setError("Invalid password");
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    authenticate(password);
  };

  const fetchDocuments = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // In a real app, this would be an API call to get documents from the database
      // For this prototype, we'll simulate a response with more sample data
      setTimeout(() => {
        const mockDocuments: Document[] = [
          {
            id: "doc1",
            bookingId: "booking-123",
            guestName: "John Doe",
            email: "john@example.com",
            fileName: "passport-123.jpg",
            originalName: "passport.jpg",
            uploadedAt: new Date().toISOString(),
            fileType: "image/jpeg",
            fileSize: 1500000,
          },
          {
            id: "doc2",
            bookingId: "booking-123",
            guestName: "John Doe",
            email: "john@example.com",
            fileName: "id-123.pdf",
            originalName: "national_id.pdf",
            uploadedAt: new Date().toISOString(),
            fileType: "application/pdf",
            fileSize: 980000,
          },
          {
            id: "doc3",
            bookingId: "booking-456",
            guestName: "Maria Garcia",
            email: "maria@example.com",
            fileName: "passport-456.png",
            originalName: "maria_passport.png",
            uploadedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            fileType: "image/png",
            fileSize: 2100000,
          },
        ];
        
        setDocuments(mockDocuments);
        setIsLoading(false);
      }, 1000);
      
    } catch (err) {
      setError("Failed to load documents");
      setIsLoading(false);
      console.error("Error fetching documents:", err);
    }
  };

  useEffect(() => {
    // Check if admin is already authenticated
    const isAdminAuthenticated = localStorage.getItem("adminAuthenticated") === "true";
    
    if (isAdminAuthenticated) {
      setIsAuthenticated(true);
      fetchDocuments();
    } else {
      setIsLoading(false);
    }
  }, []);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    else return (bytes / 1048576).toFixed(1) + " MB";
  };

  const getFilteredDocuments = () => {
    return documents.filter(doc => {
      // Filter by booking ID
      if (filterBookingId && doc.bookingId !== filterBookingId) {
        return false;
      }
      
      // Filter by document type
      if (filterDocType === "images" && !doc.fileType.startsWith("image/")) {
        return false;
      }
      if (filterDocType === "pdf" && doc.fileType !== "application/pdf") {
        return false;
      }
      
      // Search by guest name or filename
      if (searchTerm && 
          !doc.guestName.toLowerCase().includes(searchTerm.toLowerCase()) && 
          !doc.originalName.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      
      return true;
    });
  };

  const handleDownloadDocument = (doc: Document) => {
    // In a real app, this would trigger a download of the document
    alert(`Downloading ${doc.originalName}`);
  };

  const handleDeleteDocument = (docId: string, docName: string) => {
    // In a real app, this would call an API to delete the document
    if (confirm(`Are you sure you want to delete ${docName}?`)) {
      alert(`Document ${docName} has been deleted`);
      // Remove from the local state
      setDocuments(documents.filter(doc => doc.id !== docId));
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto py-10 max-w-md">
        <h1 className="text-3xl font-bold mb-6">Admin Access</h1>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Admin Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md"
                required
              />
            </div>
            
            {error && (
              <div className="bg-red-50 p-3 rounded-md text-red-700 text-sm">
                {error}
              </div>
            )}
            
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700"
            >
              Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <Suspense fallback={null}>
        <SearchParamsHandler onParamsLoaded={handleParamsLoaded} />
      </Suspense>
      
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Guest Documents</h1>
        <div className="space-x-4">
          <Link 
            href="/admin/bookings" 
            className="px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"
          >
            View Bookings
          </Link>
          <button
            onClick={() => {
              localStorage.removeItem("adminAuthenticated");
              setIsAuthenticated(false);
            }}
            className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300"
          >
            Logout
          </button>
        </div>
      </div>
      
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Filter by Booking ID
            </label>
            <input
              type="text"
              value={filterBookingId}
              onChange={(e) => setFilterBookingId(e.target.value)}
              placeholder="Enter booking ID"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Filter by Document Type
            </label>
            <select
              value={filterDocType}
              onChange={(e) => setFilterDocType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="all">All Documents</option>
              <option value="images">Images Only</option>
              <option value="pdf">PDFs Only</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or filename"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>
        
        {filterBookingId && (
          <div className="mt-2 flex">
            <button 
              onClick={() => setFilterBookingId("")}
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear booking filter
            </button>
          </div>
        )}
      </div>
      
      {isLoading ? (
        <div className="flex justify-center my-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 p-4 rounded-lg border border-red-200 text-red-700">
          {error}
        </div>
      ) : getFilteredDocuments().length === 0 ? (
        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 text-center">
          <p className="text-gray-700">No documents match your filters.</p>
          {filterBookingId && (
            <p className="text-gray-500 mt-2">
              Try clearing the booking filter or checking for a different booking ID.
            </p>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Guest
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Booking ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  File
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Uploaded
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {getFilteredDocuments().map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{doc.guestName}</div>
                    <div className="text-sm text-gray-500">{doc.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link
                      href={`/admin/bookings?search=${doc.bookingId}`}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      {doc.bookingId}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{doc.originalName}</div>
                    <div className="text-sm text-gray-500">
                      {formatFileSize(doc.fileSize)} • {doc.fileType.split("/")[1]}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(doc.uploadedAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button 
                      className="text-blue-600 hover:text-blue-800 mr-3"
                      onClick={() => handleDownloadDocument(doc)}
                    >
                      View
                    </button>
                    <button 
                      className="text-red-600 hover:text-red-800"
                      onClick={() => handleDeleteDocument(doc.id, doc.originalName)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
} 