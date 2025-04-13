"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

export default function AdminDashboardPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalBookings: 0,
    upcomingBookings: 0,
    documentsUploaded: 0,
    pendingDocuments: 0
  });

  const [isSendingReminders, setIsSendingReminders] = useState(false);
  const [reminderResult, setReminderResult] = useState<{
    success?: boolean;
    message?: string;
  } | null>(null);

  // Simple admin authentication
  const authenticate = (providedPassword: string) => {
    const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "villa-claudia-admin";
    
    if (providedPassword === adminPassword) {
      setIsAuthenticated(true);
      localStorage.setItem("adminAuthenticated", "true");
      fetchStats();
    } else {
      setError("Invalid password");
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    authenticate(password);
  };

  const fetchStats = async () => {
    // In a real app, this would fetch statistics from your API
    // For this prototype, we'll use mock data
    
    // Simulate API delay
    setTimeout(() => {
      setStats({
        totalBookings: 28,
        upcomingBookings: 12,
        documentsUploaded: 15,
        pendingDocuments: 8
      });
    }, 500);
  };

  useEffect(() => {
    // Check if admin is already authenticated
    const isAdminAuthenticated = localStorage.getItem("adminAuthenticated") === "true";
    
    if (isAdminAuthenticated) {
      setIsAuthenticated(true);
      fetchStats();
    }
  }, []);

  const handleSendReminders = async () => {
    if (isSendingReminders) return;
    
    try {
      setIsSendingReminders(true);
      setReminderResult(null);
      
      const response = await fetch("/api/admin/send-reminders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // In a real app, you'd use a proper auth token
          "Authorization": `Bearer ${process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "villa-claudia-admin"}`
        }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to send reminders");
      }
      
      setReminderResult({
        success: true,
        message: data.message
      });
      
      // Refresh stats after sending reminders
      fetchStats();
      
    } catch (error) {
      console.error("Error sending reminders:", error);
      setReminderResult({
        success: false,
        message: error instanceof Error ? error.message : "Unknown error occurred"
      });
    } finally {
      setIsSendingReminders(false);
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
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Villa Claudia Admin</h1>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Bookings</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-blue-600 font-medium">Total Bookings</p>
              <p className="text-3xl font-bold text-blue-700">{stats.totalBookings}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-green-600 font-medium">Upcoming Stays</p>
              <p className="text-3xl font-bold text-green-700">{stats.upcomingBookings}</p>
            </div>
          </div>
          <div className="mt-6">
            <Link 
              href="/admin/bookings" 
              className="block w-full text-center bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700"
            >
              Manage Bookings
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Documents</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-purple-50 p-4 rounded-lg">
              <p className="text-sm text-purple-600 font-medium">Documents Uploaded</p>
              <p className="text-3xl font-bold text-purple-700">{stats.documentsUploaded}</p>
            </div>
            <div className="bg-amber-50 p-4 rounded-lg">
              <p className="text-sm text-amber-600 font-medium">Pending Documents</p>
              <p className="text-3xl font-bold text-amber-700">{stats.pendingDocuments}</p>
            </div>
          </div>
          <div className="mt-6">
            <Link 
              href="/admin/documents" 
              className="block w-full text-center bg-purple-600 text-white py-2 rounded-md hover:bg-purple-700"
            >
              View Documents
            </Link>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        
        {reminderResult && (
          <div className={`p-4 mb-4 rounded-lg ${reminderResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {reminderResult.message}
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button 
            className={`p-4 bg-blue-50 rounded-lg hover:bg-blue-100 text-left ${isSendingReminders ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={handleSendReminders}
            disabled={isSendingReminders}
          >
            <h3 className="font-medium text-blue-800">
              {isSendingReminders ? "Sending..." : "Send Document Reminders"}
            </h3>
            <p className="text-sm text-blue-600 mt-1">
              Send email reminders to guests who haven&apos;t uploaded documents
            </p>
          </button>
          
          <button className="p-4 bg-green-50 rounded-lg hover:bg-green-100 text-left">
            <h3 className="font-medium text-green-800">Download Documents</h3>
            <p className="text-sm text-green-600 mt-1">
              Download all documents for upcoming bookings
            </p>
          </button>
          
          <button className="p-4 bg-amber-50 rounded-lg hover:bg-amber-100 text-left">
            <h3 className="font-medium text-amber-800">System Settings</h3>
            <p className="text-sm text-amber-600 mt-1">
              Configure email templates and notification settings
            </p>
          </button>
        </div>
      </div>
    </div>
  );
} 