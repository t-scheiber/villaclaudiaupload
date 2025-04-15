import { notFound } from 'next/navigation';
import DocumentUploadForm from '@/components/document-upload-form';

async function validateBooking(secureBookingId: string) {
  try {
    // Extract the booking ID and dates from the secure booking ID
    // The format is: bookingId + checkindate + checkoutdate (all dates in YYYYMMDD format)
    const bookingIdMatch = secureBookingId.match(/^(\d+?)(\d{8})(\d{8})?$/);
    
    if (!bookingIdMatch) {
      return null;
    }
    
    // Extract the actual booking ID (just the numeric part before the dates)
    const bookingId = bookingIdMatch[1];
    
    // Call the API endpoint with just the booking ID
    const response = await fetch(`/api/booking?id=${bookingId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store'
    });
    
    if (!response.ok) {
      return null;
    }
    
    return response.json();
  } catch (error) {
    console.error('Error validating booking:', error);
    return null;
  }
}

export default async function BookingUploadPage({
  params,
  searchParams,
}: {
  params: Promise<{ bookingId: string }>,
  searchParams: Promise<{ email?: string }>
}) {
  // Await both params and searchParams Promises
  const { bookingId } = await params;
  const { email = '' } = await searchParams;
  
  // Validate the booking
  const bookingData = await validateBooking(bookingId);
  
  // If booking is not valid, show 404 page
  if (!bookingData) {
    notFound();
  }
  
  return (
    <div className="container mx-auto py-20">
      <div className="text-center max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Upload Documents</h1>
        <p className="mb-6">Please upload your travel documents for your stay at Villa Claudia</p>
        
        <DocumentUploadForm 
          bookingId={bookingId} 
          bookingData={bookingData}
          email={email} 
        />
      </div>
    </div>
  );
}
