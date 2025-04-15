import { notFound } from 'next/navigation';
import DocumentUploadForm from '@/components/document-upload-form';

async function validateBooking(secureBookingId: string) {
  try {
    console.log('Validating booking with secure ID:', secureBookingId);
    
    // Extract the booking ID and dates from the secure booking ID
    // The format is: bookingId + checkindate + checkoutdate (all dates in YYYYMMDD format)
    const bookingIdMatch = secureBookingId.match(/^(\d+?)(\d{8})(\d{8})?$/);
    console.log('Regex match result:', bookingIdMatch);
    
    if (!bookingIdMatch) {
      console.log('Invalid booking ID format, no match found');
      return null;
    }
    
    // Extract the actual booking ID (just the numeric part before the dates)
    const bookingId = bookingIdMatch[1];
    console.log('Extracted booking ID:', bookingId);
    
    // Log the full match array to see all captured groups
    if (bookingIdMatch.length > 2) {
      console.log('Check-in date:', bookingIdMatch[2]);
    }
    if (bookingIdMatch.length > 3 && bookingIdMatch[3]) {
      console.log('Check-out date:', bookingIdMatch[3]);
    }
    
    const apiUrl = `${process.env.WORDPRESS_API_URL}/booking/${bookingId}`;
    console.log('Calling API at:', apiUrl);
    
    // Call the API endpoint with just the booking ID
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.WORDPRESS_API_KEY || ''
      },
      cache: 'no-store'
    });
    
    console.log('API response status:', response.status);
    
    if (!response.ok) {
      console.log('API response not OK');
      return null;
    }
    
    const data = await response.json();
    console.log('API response data:', data);
    
    return data;
  } catch (error) {
    console.error('Error validating booking:', error);
    return null;
  }
}

export default async function BookingUploadPage({
  params,
  searchParams,
}: {
  params: Promise<{ secureBookingId: string }>,
  searchParams: Promise<{ email?: string }>
}) {
  try {
    // Await both params and searchParams Promises
    const { secureBookingId } = await params;
    console.log('Page received secureBookingId:', secureBookingId);
    
    const { email = '' } = await searchParams;
    console.log('Page received email:', email);
    
    // Validate the booking
    console.log('Calling validateBooking function');
    const bookingData = await validateBooking(secureBookingId);
    
    // If booking is not valid, show 404 page
    if (!bookingData) {
      console.log('Booking validation failed, showing 404');
      notFound();
    }
    
    console.log('Booking validation successful, rendering page');
    
    // Add booking reference to the booking data
    const bookingDataWithReference = {
      ...bookingData,
      bookingReference: `VC-${bookingData.bookingId}` // Format the booking reference as needed
    };
    
    return (
      <div className="container mx-auto py-20">
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Upload Documents</h1>
          <p className="mb-6">Please upload your travel documents for your stay at Villa Claudia</p>
          
          <DocumentUploadForm 
            bookingId={secureBookingId} 
            bookingData={bookingDataWithReference}
            email={email} 
            maxTravelers={8}
          />
        </div>
      </div>
    );
  } catch (error) {
    console.error('Error in BookingUploadPage:', error);
    return <div className="container mx-auto py-20 text-center">
      <h1 className="text-3xl font-bold mb-6 text-red-600">Error Loading Page</h1>
      <p>Something went wrong while loading this page. Please try again or contact support.</p>
      <pre className="mt-8 p-4 bg-gray-100 rounded text-left overflow-auto max-w-3xl mx-auto">
        {error instanceof Error ? error.message : 'Unknown error'}
      </pre>
    </div>;
  }
}
