import { NextRequest, NextResponse } from "next/server";

/**
 * API route to check if documents have been uploaded for a booking
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const bookingId = searchParams.get('bookingId');
  
  if (!bookingId) {
    return NextResponse.json({ error: 'Missing booking ID' }, { status: 400 });
  }
  
  try {
    // In a server-based setup, we would check a database or filesystem
    // Since we're using a serverless approach, we'll check any submissions in our database
    
    // For this implementation, we're assuming no documents have been uploaded
    // as we're not storing files but just emailing them
    
    // We could implement a simple tracking system if needed:
    // - Create a small database table or JSON file to track successful uploads
    // - Check that record when this endpoint is called
    
    const hasDocuments = await checkForExistingDocuments(bookingId);
    
    return NextResponse.json({
      bookingId,
      hasDocuments,
      message: hasDocuments ? 'Documents found for this booking' : 'No documents found for this booking'
    });
  } catch (error) {
    console.error('Error checking for documents:', error);
    return NextResponse.json(
      { error: 'Failed to check document status' },
      { status: 500 }
    );
  }
}

async function checkForExistingDocuments(bookingId: string): Promise<boolean> {
  try {
    const response = await fetch(`${process.env.WORDPRESS_API_URL}/has-documents/${bookingId}`, {
      headers: {
        'x-api-key': process.env.WORDPRESS_API_KEY || ''
      }
    });
    
    if (!response.ok) {
      return false;
    }
    
    const data = await response.json();
    return data.hasDocuments;
  } catch (error) {
    console.error(`Error checking documents for booking ${bookingId}:`, error);
    return false;
  }
} 