import { sendDocumentRequestEmail } from './email-config';

interface Booking {
  id: string;
  bookingId: string;
  guestEmail: string;
  guestName: string;
  checkInDate: string;
  checkOutDate?: string;
  hasUploadedDocuments: boolean;
  status: string;
}

/**
 * Checks for upcoming bookings that need document reminders
 * This would be called by a cron job daily
 */
export async function processDocumentReminders() {
  try {
    // Get upcoming bookings from WordPress API
    const upcomingBookings = await fetchUpcomingBookings();
    
    const now = new Date();
    
    // Find bookings that start approximately one week from now
    const bookingsNeedingReminders = upcomingBookings.filter(booking => {
      // Skip if documents already uploaded
      if (booking.hasUploadedDocuments) {
        return false;
      }
      
      // Skip if booking status is not confirmed
      if (booking.status !== 'confirmed') {
        return false;
      }
      
      const bookingStartDate = new Date(booking.checkInDate);
      const daysDifference = Math.floor((bookingStartDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      // Check if the booking starts between 6.5 and 7.5 days from now
      // This ensures we only send one reminder per booking
      return daysDifference >= 6.5 && daysDifference <= 7.5;
    });
    
    console.log(`Found ${bookingsNeedingReminders.length} bookings needing document reminders`);
    
    // Send reminder emails
    const emailResults = await Promise.all(
      bookingsNeedingReminders.map(booking => 
        sendDocumentRequestEmail(
          booking.bookingId,
          booking.guestEmail, 
          booking.guestName,
          new Date(booking.checkInDate),
          booking.checkOutDate ? new Date(booking.checkOutDate) : undefined
        )
      )
    );
    
    // Log results
    const successCount = emailResults.filter(result => result.success).length;
    console.log(`Successfully sent ${successCount} of ${emailResults.length} document reminders`);
    
    return {
      processed: bookingsNeedingReminders.length,
      sent: successCount,
      failed: emailResults.length - successCount,
    };
  } catch (error) {
    console.error('Error processing document reminders:', error);
    throw error;
  }
}

/**
 * Fetch upcoming bookings from WordPress API
 */
async function fetchUpcomingBookings(): Promise<Booking[]> {
  try {
    const response = await fetch(`${process.env.WORDPRESS_API_URL}/bookings/upcoming`, {
      headers: {
        'x-api-key': process.env.WORDPRESS_API_KEY || ''
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch upcoming bookings: ${response.status}`);
    }
    
    const bookings = await response.json();
    
    // Check uploads directory to see which bookings already have documents
    const processedBookings = await Promise.all(
      bookings.map(async (booking: Booking) => {
        // Here we would check if documents exist for this booking
        // For now, assume no documents have been uploaded
        const hasUploadedDocuments = await checkForExistingDocuments(booking.bookingId);
        
        return {
          ...booking,
          hasUploadedDocuments
        };
      })
    );
    
    return processedBookings;
  } catch (error) {
    console.error('Error fetching upcoming bookings:', error);
    return [];
  }
}

/**
 * Check if documents have been uploaded for a booking
 */
async function checkForExistingDocuments(bookingId: string): Promise<boolean> {
  try {
    if (!process.env.WORDPRESS_API_URL || !process.env.WORDPRESS_API_KEY) {
      console.warn('WordPress API configuration missing, defaulting to no documents');
      return false;
    }
    
    // Check WordPress API if documents exist for this booking
    const response = await fetch(`${process.env.WORDPRESS_API_URL}/has-documents/${bookingId}`, {
      headers: {
        'x-api-key': process.env.WORDPRESS_API_KEY
      }
    });
    
    if (!response.ok) {
      console.error(`Error checking documents: ${response.status}`);
      return false;
    }
    
    const data = await response.json();
    return data.hasDocuments === true;
  } catch (error) {
    console.error(`Error checking documents for booking ${bookingId}:`, error);
    return false;
  }
} 