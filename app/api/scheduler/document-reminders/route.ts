import { NextRequest, NextResponse } from "next/server";
import { processDocumentReminders } from "@/lib/document-scheduler";

// API key validation - should be stored in env vars
const API_KEY = process.env.SCHEDULER_API_KEY || "change-this-in-production";

export async function POST(request: NextRequest) {
  try {
    // Check for API key in Authorization header
    const authHeader = request.headers.get("Authorization");
    const providedKey = authHeader?.replace("Bearer ", "");

    if (!providedKey || providedKey !== API_KEY) {
      return NextResponse.json(
        { error: "Unauthorized - Invalid API key" },
        { status: 401 }
      );
    }

    // Process document reminders
    const result = await processDocumentReminders();

    return NextResponse.json({
      success: true,
      message: "Document reminders processed successfully",
      ...result
    });
  } catch (error) {
    console.error("Error running document reminder scheduler:", error);
    return NextResponse.json(
      { error: "Failed to process document reminders" },
      { status: 500 }
    );
  }
}

// Also allow GET requests for easier testing
export async function GET(request: NextRequest) {
  // Check for debug parameter and API key
  const url = new URL(request.url);
  const debug = url.searchParams.get("debug") === "true";
  const providedKey = url.searchParams.get("key");

  if (!providedKey || providedKey !== API_KEY) {
    return NextResponse.json(
      { error: "Unauthorized - Invalid API key" },
      { status: 401 }
    );
  }

  try {
    // Process document reminders
    const result = await processDocumentReminders();

    return NextResponse.json({
      success: true,
      message: "Document reminders processed successfully",
      debug,
      ...result
    });
  } catch (error) {
    console.error("Error running document reminder scheduler:", error);
    return NextResponse.json(
      { 
        error: "Failed to process document reminders",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
} 