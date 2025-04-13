import { sendDocumentRequestEmail } from './email-config';

interface Booking {
  id: string;
  guestEmail: string;
  guestName: string;
  startDate: Date;
  hasUploadedDocuments: boolean;
}

/**
 * Checks for upcoming bookings that need document reminders
 * This would be called by a cron job daily
 * In a production environment, this would fetch data from your booking system or database
 */
export async function processDocumentReminders() {
  try {
    // Get upcoming bookings from your API or database
    // This is a placeholder - you would implement this to connect to your booking system
    const upcomingBookings = await fetchUpcomingBookings();
    
    const now = new Date();
    const oneWeekFromNow = new Date(now);
    oneWeekFromNow.setDate(now.getDate() + 7);
    
    // Find bookings that start approximately one week from now
    // We use a range of 24 hours to ensure we don't miss any bookings
    const bookingsNeedingReminders = upcomingBookings.filter(booking => {
      // Skip if documents already uploaded
      if (booking.hasUploadedDocuments) {
        return false;
      }
      
      const bookingStartDate = new Date(booking.startDate);
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
          booking.id,
          booking.guestEmail, 
          booking.guestName,
          new Date(booking.startDate)
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
 * Placeholder function to fetch upcoming bookings
 * In a real implementation, this would connect to your booking system or database
 */
async function fetchUpcomingBookings(): Promise<Booking[]> {
  // This is a placeholder - You would implement this to connect to your booking system or database
  // For example, this might call an API endpoint in your WordPress site
  
  // For testing purposes, you could return some sample data
  return [
    /* Example data for testing:
    {
      id: 'booking-123',
      guestEmail: 'guest1@example.com',
      guestName: 'John Doe',
      startDate: new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      hasUploadedDocuments: false
    }
    */
  ];
} 