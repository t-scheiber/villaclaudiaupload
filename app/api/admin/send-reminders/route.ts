import { NextRequest, NextResponse } from "next/server";
import { sendDocumentRequestEmail } from "@/lib/email-config";

// Simplified authentication check - in a real app, use a proper auth system
function isAuthenticated(request: NextRequest) {
  // In a production app, you'd verify an admin session or token
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return false;
  
  const token = authHeader.replace("Bearer ", "");
  return token === process.env.SCHEDULER_API_KEY;
}

export async function POST(request: NextRequest) {
  // Check authentication
  if (!isAuthenticated(request)) {
    return NextResponse.json(
      { error: "Unauthorized access" },
      { status: 401 }
    );
  }

  try {
    // In a real app, you would fetch this from your database
    // This is just a mock implementation
    const guestsWithoutDocuments = [
      {
        bookingId: "booking-124",
        guestEmail: "jane@example.com",
        guestName: "Jane Smith",
        checkInDate: new Date("2023-08-22")
      },
      {
        bookingId: "booking-125",
        guestEmail: "robert@example.com",
        guestName: "Robert Johnson",
        checkInDate: new Date("2023-09-01")
      }
    ];

    if (guestsWithoutDocuments.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No reminders needed, all guests have uploaded documents",
        sent: 0
      });
    }

    // Send reminders
    const results = await Promise.all(
      guestsWithoutDocuments.map(guest => 
        sendDocumentRequestEmail(
          guest.bookingId,
          guest.guestEmail,
          guest.guestName,
          guest.checkInDate
        )
      )
    );

    const successCount = results.filter(r => r.success).length;

    return NextResponse.json({
      success: true,
      message: `Sent ${successCount} of ${guestsWithoutDocuments.length} reminders successfully`,
      sent: successCount,
      total: guestsWithoutDocuments.length
    });
  } catch (error) {
    console.error("Error sending reminders:", error);
    return NextResponse.json(
      { 
        error: "Failed to send reminders",
        message: error instanceof Error ? error.message : "Unknown error" 
      },
      { status: 500 }
    );
  }
}

// Allow GET for testing in browser
export async function GET(request: NextRequest) {
  return POST(request);
} 