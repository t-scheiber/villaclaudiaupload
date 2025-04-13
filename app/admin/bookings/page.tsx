"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface Booking {
  id: string;
  guestName: string;
  guestEmail: string;
  checkInDate: string;
  checkOutDate: string;
  status: string;
  hasDocuments: boolean;
  documentsCount: number;
}

export default function AdminBookingsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterDocuments, setFilterDocuments] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Simple admin authentication - in a real app, use a proper auth system
  const authenticate = (providedPassword: string) => {
    const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "villa-claudia-admin";
    
    if (providedPassword === adminPassword) {
      setIsAuthenticated(true);
      localStorage.setItem("adminAuthenticated", "true");
      fetchBookings();
    } else {
      setError("Invalid password");
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    authenticate(password);
  };

  const fetchBookings = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // In a real app, this would fetch from your API
      // For this demo, we'll use sample data
      setTimeout(() => {
        const mockBookings: Booking[] = [
          {
            id: "booking-123",
            guestName: "John Doe",
            guestEmail: "john@example.com",
            checkInDate: "2023-08-15",
            checkOutDate: "2023-08-22",
            status: "confirmed",
            hasDocuments: true,
            documentsCount: 2
          },
          {
            id: "booking-124",
            guestName: "Jane Smith",
            guestEmail: "jane@example.com",
            checkInDate: "2023-08-22",
            checkOutDate: "2023-08-29",
            status: "confirmed",
            hasDocuments: false,
            documentsCount: 0
          },
          {
            id: "booking-125",
            guestName: "Robert Johnson",
            guestEmail: "robert@example.com",
            checkInDate: "2023-09-01",
            checkOutDate: "2023-09-10",
            status: "pending",
            hasDocuments: false,
            documentsCount: 0
          }
        ];
        
        setBookings(mockBookings);
        setIsLoading(false);
      }, 1000);
      
    } catch (err) {
      setError("Failed to load bookings");
      setIsLoading(false);
      console.error("Error fetching bookings:", err);
    }
  };

  useEffect(() => {
    // Check if admin is already authenticated
    const isAdminAuthenticated = localStorage.getItem("adminAuthenticated") === "true";
    
    if (isAdminAuthenticated) {
      setIsAuthenticated(true);
      fetchBookings();
    } else {
      setIsLoading(false);
    }
  }, []);

  const getFilteredBookings = () => {
    return bookings.filter(booking => {
      // Filter by status
      if (filterStatus !== "all" && booking.status !== filterStatus) {
        return false;
      }
      
      // Filter by documents
      if (filterDocuments === "with" && !booking.hasDocuments) {
        return false;
      }
      if (filterDocuments === "without" && booking.hasDocuments) {
        return false;
      }
      
      // Search by name or email
      if (searchTerm && 
          !booking.guestName.toLowerCase().includes(searchTerm.toLowerCase()) && 
          !booking.guestEmail.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !booking.id.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      
      return true;
    });
  };

  const handleSendReminder = async (bookingId: string, guestEmail: string, guestName: string) => {
    try {
      // In a real app, this would call your API to send a reminder
      alert(`Sending reminder to ${guestName} at ${guestEmail}`);
    } catch (error) {
      console.error("Error sending reminder:", error);
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Bookings Management</h1>
        <div className="space-x-4">
          <Link 
            href="/admin/documents" 
            className="px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"
          >
            View Documents
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
              Filter by Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="all">All Statuses</option>
              <option value="confirmed">Confirmed</option>
              <option value="pending">Pending</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Filter by Documents
            </label>
            <select
              value={filterDocuments}
              onChange={(e) => setFilterDocuments(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="all">All Bookings</option>
              <option value="with">With Documents</option>
              <option value="without">Without Documents</option>
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
              placeholder="Search by name, email or booking ID"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center my-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 p-4 rounded-lg border border-red-200 text-red-700">
          {error}
        </div>
      ) : getFilteredBookings().length === 0 ? (
        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 text-center">
          <p className="text-gray-700">No bookings match your filters.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Booking Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Guest
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Dates
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Documents
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {getFilteredBookings().map((booking) => (
                <tr key={booking.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{booking.id}</div>
                    <div className="text-sm text-gray-500 capitalize">{booking.status}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{booking.guestName}</div>
                    <div className="text-sm text-gray-500">{booking.guestEmail}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      Check-in: {new Date(booking.checkInDate).toLocaleDateString()}
                    </div>
                    <div className="text-sm text-gray-500">
                      Check-out: {new Date(booking.checkOutDate).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {booking.hasDocuments ? (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        {booking.documentsCount} Documents
                      </span>
                    ) : (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                        No Documents
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {booking.hasDocuments ? (
                      <Link 
                        href={`/admin/documents?bookingId=${booking.id}`}
                        className="text-blue-600 hover:text-blue-800 mr-3"
                      >
                        View Documents
                      </Link>
                    ) : (
                      <button 
                        className="text-blue-600 hover:text-blue-800 mr-3"
                        onClick={() => handleSendReminder(booking.id, booking.guestEmail, booking.guestName)}
                      >
                        Send Reminder
                      </button>
                    )}
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