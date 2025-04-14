import { NextRequest, NextResponse } from "next/server";
import { processDocumentReminders } from "@/lib/document-scheduler";

// API endpoint that will be triggered by Hostinger cron job
export async function GET(request: NextRequest) {
  try {
    // Verify the request is from authorized source
    const authHeader = request.headers.get("Authorization");
    
    // Check if the cron job secret is provided and matches
    if (process.env.CRON_SECRET && (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`)) {
      console.error("Unauthorized access attempt");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    console.log("Starting document reminders process");
    
    // Process document reminders
    const result = await processDocumentReminders();
    
    console.log("Document reminders completed", result);

    return NextResponse.json({
      success: true,
      message: "Document reminders processed successfully",
      ...result
    });
  } catch (error) {
    console.error("Error running document reminder scheduler:", error);
    return NextResponse.json(
      { error: "Failed to process document reminders", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
} 