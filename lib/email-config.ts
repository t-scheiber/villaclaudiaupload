import nodemailer from 'nodemailer';

// Email configuration
export const emailConfig = {
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || "587"),
  secure: false, // Use STARTTLS
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
  tls: {
    // Do not fail on invalid certs
    rejectUnauthorized: false
  },
  fromName: process.env.EMAIL_FROM_NAME || "Villa Claudia",
  fromAddress: process.env.EMAIL_FROM_ADDRESS || "no-reply@villa-claudia.eu",
  // Generate a proper "from" field that combines name and address
  get from() {
    return `${this.fromName} <${this.fromAddress}>`;
  }
};

// Validate email configuration
export function validateEmailConfig() {
  const requiredFields = ['EMAIL_HOST', 'EMAIL_USER', 'EMAIL_PASSWORD'];
  const missingFields = requiredFields.filter(field => !process.env[field]);
  
  if (missingFields.length > 0) {
    throw new Error(`Missing required email configuration: ${missingFields.join(', ')}`);
  }
  
  return true;
}

// Create email transporter with debug logging
export function createEmailTransporter() {
  validateEmailConfig();
  const transporter = nodemailer.createTransport({
    host: emailConfig.host,
    port: emailConfig.port,
    secure: emailConfig.secure,
    auth: emailConfig.auth,
    tls: emailConfig.tls,
    debug: true,
    logger: true,
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 10000,   // 10 seconds
    socketTimeout: 10000      // 10 seconds
  });

  // Verify the connection configuration
  transporter.verify(function(error) {
    if (error) {
      console.error('SMTP Connection Error:', error);
    } else {
      console.log('SMTP Server is ready to take our messages');
    }
  });

  return transporter;
}

// Create magic link for document upload
export function createDocumentUploadLink(bookingId: string, guestEmail: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const encodedBookingId = encodeURIComponent(bookingId);
  const encodedEmail = encodeURIComponent(guestEmail);
  
  return `${baseUrl}/uploads/${encodedBookingId}?email=${encodedEmail}`;
}

/**
 * Send document request email to guest
 */
export async function sendDocumentRequestEmail(
  bookingId: string,
  guestEmail: string,
  guestName: string,
  checkInDate: Date,
  checkOutDate?: Date
): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = createEmailTransporter();
    
    // Format check-in date for URL (DDMMYYYY)
    const checkInFormatted = checkInDate.toISOString().split('T')[0].replace(/-/g, '');
    
    // Format check-out date for URL (DDMMYYYY) if available
    const checkOutFormatted = checkOutDate 
      ? checkOutDate.toISOString().split('T')[0].replace(/-/g, '')
      : '';
    
    // Create secure upload URL with combined ID + dates
    const secureUploadId = `${bookingId}${checkInFormatted}${checkOutFormatted}`;
    
    // Check-in date formatted for display (e.g. May 15, 2025)
    const checkInDisplay = checkInDate.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric', 
      year: 'numeric'
    });
    
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const uploadUrl = `${baseUrl}/uploads/${secureUploadId}?email=${encodeURIComponent(guestEmail)}`;
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'Villa Claudia <no-reply@villa-claudia.eu>',
      to: guestEmail,
      subject: 'Please Upload Your Travel Documents for Your Stay at Villa Claudia',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #ffffff; color: white; padding: 20px; text-align: center;">
            <img src="${baseUrl}/Logo.png" alt="Villa Claudia" width="200" style="max-width: 100%;" />
          </div>
          <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
            <p>Dear ${guestName},</p>
            
            <p>We hope you're looking forward to your upcoming stay at Villa Claudia starting on <strong>${checkInDisplay}</strong>.</p>
            
            <p>As required by Croatian law, we need to register all foreign guests with the authorities within 24 hours of arrival. To make your check-in process smoother, please upload your travel documents (passport or ID) before arrival.</p>
            
            <p style="margin: 30px 0; text-align: center;">
              <a href="${uploadUrl}" style="background-color: #4a8b96; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
                Upload Your Documents
              </a>
            </p>
            
            <p><strong>Note:</strong> We need documents for all travelers, not just the person who made the booking.</p>
            
            <p>If you have any questions, please don't hesitate to contact us.</p>
            
            <p>Looking forward to welcoming you to Villa Claudia!</p>
            
            <p>Best regards,<br>Villa Claudia Team</p>
          </div>
          <div style="background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280;">
            <p>© ${new Date().getFullYear()} Villa Claudia. All rights reserved.</p>
            <p><a href="https://villa-claudia.eu" style="color: #6b7280; text-decoration: underline;">villa-claudia.eu</a></p>
          </div>
        </div>
      `
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log('Document request email sent:', info.messageId);
    
    return { success: true };
  } catch (error) {
    console.error('Email error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to send email' 
    };
  }
} 