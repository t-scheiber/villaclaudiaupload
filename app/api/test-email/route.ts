import { NextResponse } from 'next/server';
import { createEmailTransporter } from '@/lib/email-config';

export async function POST() {
  try {
    const transporter = createEmailTransporter();
    
    const testEmail = {
      from: process.env.EMAIL_FROM || "Villa Claudia <no-reply@villa-claudia.eu>",
      to: process.env.ADMIN_EMAIL || "administration@villa-claudia.eu",
      subject: "Test Email from Villa Claudia Document Upload System",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #1e40af; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">Villa Claudia - Test Email</h1>
          </div>
          <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
            <p>This is a test email from the Villa Claudia Document Upload system.</p>
            <p>If you are receiving this email, it means the email configuration is working correctly.</p>
            <p>Time sent: ${new Date().toLocaleString()}</p>
          </div>
          <div style="background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280;">
            <p>© ${new Date().getFullYear()} Villa Claudia. All rights reserved.</p>
            <p><a href="https://villa-claudia.eu" style="color: #6b7280; text-decoration: underline;">villa-claudia.eu</a></p>
          </div>
        </div>
      `
    };

    const info = await transporter.sendMail(testEmail);
    console.log('Test email sent:', info.messageId);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Test email sent successfully',
      messageId: info.messageId
    });
  } catch (error) {
    console.error('Error sending test email:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to send test email'
    }, { status: 500 });
  }
} 