import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { sign } from "jsonwebtoken";
import { createHash } from "crypto";

// Secret key for signing tokens - should be stored in environment variables
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-this-in-production";

// Create email transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp.hostinger.com",
  port: parseInt(process.env.EMAIL_PORT || "587"),
  secure: process.env.EMAIL_SECURE === "true",
  auth: {
    user: process.env.EMAIL_USER || "your-email@villaclaudia.com",
    pass: process.env.EMAIL_PASSWORD || "your-password",
  },
});

export async function POST(request: NextRequest) {
  try {
    const { email, bookingId, name } = await request.json();

    if (!email || !bookingId) {
      return NextResponse.json(
        { error: "Email and booking ID are required" },
        { status: 400 }
      );
    }

    // Create a token that expires in 24 hours
    const token = sign(
      { 
        email, 
        bookingId,
        name: name || "Guest" 
      },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    // Hash the token for the URL to avoid exposing it directly
    const hashedToken = createHash("sha256").update(token).digest("hex");
    
    // Create the magic link URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const magicLink = `${baseUrl}/documents/verify?token=${encodeURIComponent(hashedToken)}`;

    // Email content with styling
    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #1e40af; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">Villa Claudia</h1>
        </div>
        <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
          <p>Hello${name ? ` ${name}` : ""},</p>
          <p>Thank you for booking your stay at Villa Claudia!</p>
          <p>For legal requirements, we need a copy of your passport or travel ID document.</p>
          <p>Please click the button below to securely upload your documents:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${magicLink}" style="background-color: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Upload Documents</a>
          </div>
          <p>This link will expire in 24 hours for security reasons.</p>
          <p>If you didn't request this email, please ignore it.</p>
          <p>Best regards,<br>Villa Claudia Team</p>
        </div>
        <div style="background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280;">
          <p>© ${new Date().getFullYear()} Villa Claudia. All rights reserved.</p>
        </div>
      </div>
    `;

    // Send the email
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || "Villa Claudia <no-reply@villaclaudia.com>",
      to: email,
      subject: "Document Upload Request - Villa Claudia",
      html: emailContent,
    });

    // Store the token in the database for verification (in a real app)
    // This would be used to validate the token when the user clicks the link
    // ...

    return NextResponse.json({ 
      success: true, 
      message: "Magic link sent successfully",
    });
  } catch (error) {
    console.error("Error sending magic link:", error);
    return NextResponse.json(
      { error: "Failed to send magic link" },
      { status: 500 }
    );
  }
} 