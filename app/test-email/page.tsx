'use client';

import { useState } from 'react';

export default function TestEmailPage() {
  const [status, setStatus] = useState<{
    loading: boolean;
    success?: boolean;
    message?: string;
    error?: string;
  }>({ loading: false });

  const sendTestEmail = async () => {
    setStatus({ loading: true });
    try {
      const response = await fetch('/api/test-email', {
        method: 'POST',
      });
      const data = await response.json();
      
      if (data.success) {
        setStatus({
          loading: false,
          success: true,
          message: `Test email sent successfully! Message ID: ${data.messageId}`
        });
      } else {
        setStatus({
          loading: false,
          success: false,
          error: data.error || 'Failed to send test email'
        });
      }
    } catch (error) {
      setStatus({
        loading: false,
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send test email'
      });
    }
  };

  return (
    <div className="container mx-auto py-20">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Test Email Configuration</h1>
        
        <div className="bg-white p-6 rounded-lg shadow-md">
          <p className="mb-4">
            This page allows you to test the email configuration. Click the button below to send a test email to the configured admin email address.
          </p>
          
          <button
            onClick={sendTestEmail}
            disabled={status.loading}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            {status.loading ? 'Sending...' : 'Send Test Email'}
          </button>
          
          {status.success && (
            <div className="mt-4 p-4 bg-green-100 text-green-700 rounded">
              {status.message}
            </div>
          )}
          
          {status.error && (
            <div className="mt-4 p-4 bg-red-100 text-red-700 rounded">
              Error: {status.error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 