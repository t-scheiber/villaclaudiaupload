import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  // Extract bookingId from the URL query parameters
  const url = new URL(request.url);
  const bookingId = url.searchParams.get('id');

  if (!bookingId) {
    return NextResponse.json(
      { error: "Booking ID is required" },
      { status: 400 }
    );
  }

  try {
    // In a real implementation, you would fetch the booking data from MotoPress via WordPress API
    // This is a simplified example that will be replaced with an actual API call to your WordPress site
    
    // For development purposes, return mock data
    const mockBookingData = getMockBookingData(bookingId);
    
    // Add a small delay to simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return NextResponse.json(mockBookingData);
  } catch (error) {
    console.error("Error fetching booking:", error);
    return NextResponse.json(
      { error: "Failed to fetch booking information" },
      { status: 500 }
    );
  }
}

// This function would be replaced with an actual API call to MotoPress plugin
function getMockBookingData(bookingId: string) {
  // For testing, generate different data based on booking ID
  const bookingNumber = parseInt(bookingId.replace(/\D/g, '')) || 123;
  
  return {
    id: bookingId,
    guestName: `Guest ${bookingNumber}`,
    guestEmail: `guest${bookingNumber}@example.com`,
    guestCount: (bookingNumber % 5) + 1, // Between 1-5 guests
    checkInDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
    checkOutDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days from now
    roomType: "Villa Claudia",
    status: "confirmed",
    totalPrice: 1200.00,
    currency: "EUR",
  };
} 