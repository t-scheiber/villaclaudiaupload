import nodemailer from 'nodemailer';

// Email configuration
export const emailConfig = {
  host: process.env.EMAIL_HOST || "smtp.hostinger.com",
  port: parseInt(process.env.EMAIL_PORT || "587"),
  secure: process.env.EMAIL_SECURE === "true",
  auth: {
    user: process.env.EMAIL_USER || "no-reply@villa-claudia.eu",
    pass: process.env.EMAIL_PASSWORD || "your-password",
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

// Create email transporter
export function createEmailTransporter() {
  validateEmailConfig();
  return nodemailer.createTransport({
    host: emailConfig.host,
    port: emailConfig.port,
    secure: emailConfig.secure,
    auth: emailConfig.auth,
  });
}

// Create magic link for document upload
export function createDocumentUploadLink(bookingId: string, guestEmail: string) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const encodedEmail = encodeURIComponent(guestEmail);
  const encodedBookingId = encodeURIComponent(bookingId);
  
  return `${baseUrl}/documents/${encodedBookingId}?email=${encodedEmail}`;
}

// Function to send document upload request email
export async function sendDocumentRequestEmail(
  bookingId: string,
  guestEmail: string,
  guestName: string,
  stayStartDate: Date
) {
  const transporter = createEmailTransporter();
  const uploadLink = createDocumentUploadLink(bookingId, guestEmail);
  
  const formattedDate = stayStartDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  // Email content with styling
  const emailContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #1e40af; color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0;">Villa Claudia</h1>
      </div>
      <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
        <p>Hello${guestName ? ` ${guestName}` : ""},</p>
        <p>Thank you for booking your stay at Villa Claudia, starting on <strong>${formattedDate}</strong>!</p>
        <p>For legal requirements, we need a copy of your passport or travel ID document for all guests.</p>
        <p>Please click the button below to securely upload your documents:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${uploadLink}" style="background-color: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Upload Documents</a>
        </div>
        <p>If you have any questions, please don't hesitate to contact us.</p>
        <p>Best regards,<br>Villa Claudia Team</p>
      </div>
      <div style="background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280;">
        <p>© ${new Date().getFullYear()} Villa Claudia. All rights reserved.</p>
        <p><a href="https://villa-claudia.eu" style="color: #6b7280; text-decoration: underline;">villa-claudia.eu</a></p>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: emailConfig.from,
      to: guestEmail,
      subject: "Important: Upload Your Travel Documents - Villa Claudia",
      html: emailContent,
    });
    
    return { success: true };
  } catch (error) {
    console.error("Failed to send email:", error);
    return { success: false, error };
  }
} 