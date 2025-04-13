"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function SearchParamsHandler({ onParamsLoaded }: { onParamsLoaded: (token: string | null) => void }) {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  
  useEffect(() => {
    onParamsLoaded(token);
  }, [token, onParamsLoaded]);
  
  return null;
}

export default function VerifyPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  
  const [status, setStatus] = useState<"loading" | "error" | "success">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  
  const handleParamsLoaded = (tokenParam: string | null) => {
    setToken(tokenParam);
  };
  
  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMessage("No verification token found. Please check your email link.");
      return;
    }
    
    const verifyToken = async () => {
      try {
        const response = await fetch("/api/auth/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token }),
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Verification failed");
        }
        
        setStatus("success");
        
        // Redirect to admin page after successful verification
        setTimeout(() => {
          router.push("/admin/documents");
        }, 3000);
      } catch (error) {
        setStatus("error");
        setErrorMessage(error instanceof Error ? error.message : "Verification failed");
      }
    };
    
    verifyToken();
  }, [token, router]);
  
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <Suspense fallback={null}>
        <SearchParamsHandler onParamsLoaded={handleParamsLoaded} />
      </Suspense>
      
      <div className="container mx-auto py-10 max-w-md">
        <div className="bg-white p-8 rounded-lg shadow-md text-center">
          {status === "loading" && (
            <div className="animate-pulse">
              <h1 className="text-2xl font-bold text-blue-800 mb-4">Verifying...</h1>
              <p className="text-gray-600">Please wait while we verify your access.</p>
            </div>
          )}
          
          {status === "error" && (
            <div>
              <h1 className="text-2xl font-bold text-red-600 mb-4">Verification Failed</h1>
              <p className="text-gray-600 mb-4">{errorMessage}</p>
              <button
                onClick={() => router.push("/")}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
              >
                Return Home
              </button>
            </div>
          )}
          
          {status === "success" && (
            <div>
              <h1 className="text-2xl font-bold text-green-600 mb-4">Verification Successful!</h1>
              <p className="text-gray-600 mb-4">You now have access to the admin area.</p>
              <p className="text-gray-500 text-sm">Redirecting you automatically...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 