import { NextRequest, NextResponse } from "next/server";
import { createEmailTransporter } from "@/lib/email-config";

interface FileMetadata {
  travelerIndex: number;
  travelerName: string;
  documentType: string;
  documentNumber: string;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const secureBookingId = formData.get("bookingId") as string;
    const guestName = formData.get("guestName") as string;
    const email = formData.get("email") as string;
    const travelersJson = formData.get("travelers") as string;
    const travelers = travelersJson ? JSON.parse(travelersJson) : [];
    
    if (!secureBookingId) {
      return NextResponse.json(
        { error: "Missing booking ID" },
        { status: 400 }
      );
    }

    // Validate the secure booking ID format
    const bookingIdMatch = secureBookingId.match(/^(\d+?)(\d{8})(\d{8})?$/);
    if (!bookingIdMatch) {
      return NextResponse.json(
        { error: "Invalid booking ID format" },
        { status: 400 }
      );
    }
    
    // Extract the actual booking ID for database lookup
    const bookingId = bookingIdMatch[1];

    if (!guestName) {
      return NextResponse.json(
        { error: "Missing guest name" },
        { status: 400 }
      );
    }

    const files = formData.getAll("files") as File[];
    
    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "No files provided" },
        { status: 400 }
      );
    }

    // Calculate total file size
    const totalFileSize = files.reduce((total, file) => total + file.size, 0);
    const maxTotalSize = 25 * 1024 * 1024; // 25MB
    
    if (totalFileSize > maxTotalSize) {
      return NextResponse.json(
        { error: `Total file size (${(totalFileSize / (1024 * 1024)).toFixed(2)}MB) exceeds 25MB limit. Please reduce file sizes or upload fewer files.` },
        { status: 400 }
      );
    }

    // Process file metadata
    const fileMetadataEntries = Array.from(formData.entries())
      .filter(([key]) => key.startsWith('fileMetadata['))
      .map(([key, value]) => {
        const metadata = JSON.parse(value as string) as FileMetadata;
        const match = key.match(/fileMetadata\[(\d+)\]/);
        if (match) {
          const index = parseInt(match[1]);
          return { index, metadata };
        }
        return null;
      })
      .filter(item => item !== null)
      .sort((a, b) => a!.index - b!.index);

    // Define the FileInfo type
    type FileInfo = {
      originalName: string;
      arrayBuffer: ArrayBuffer;
      size: number;
      type: string;
      travelerName: string;
      documentType: string;
      documentNumber: string;
    };

    // Process files in memory
    const fileInfos: FileInfo[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // Get associated metadata
      const fileInfo = fileMetadataEntries.find(entry => entry?.index === i);
      const travelerName = fileInfo?.metadata.travelerName || "Unknown";
      
      // Validate file type
      const validTypes = ["image/jpeg", "image/png", "application/pdf"];
      if (!validTypes.includes(file.type)) {
        return NextResponse.json(
          { error: `File type ${file.type} is not supported. Please upload JPG, JPEG, PNG, or PDF files only.` },
          { status: 400 }
        );
      }

      // Validate file size (10MB max)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        return NextResponse.json(
          { error: "File size exceeds 10MB limit" },
          { status: 400 }
        );
      }
      
      const documentType = fileInfo?.metadata.documentType || "passport";
      const documentNumber = fileInfo?.metadata.documentNumber || "";
      
      // Get file buffer in memory
      const buffer = await file.arrayBuffer();
      
      fileInfos.push({
        originalName: file.name,
        arrayBuffer: buffer,
        size: file.size,
        type: file.type,
        travelerName: travelerName,
        documentType: documentType,
        documentNumber: documentNumber
      });
    }

    // Upload documents to WordPress
    const wpUploadResult = await uploadToWordPress(bookingId, fileInfos);
    
    if (!wpUploadResult.success) {
      console.error("WordPress upload failed:", wpUploadResult.error);
      // Continue to email the documents even if WordPress upload fails
    }

    // Send notification email to administrator
    await sendAdminNotification({
      bookingId,
      guestName,
      guestEmail: email || "Not provided",
      travelers: travelers,
      files: fileInfos
    });

    return NextResponse.json({ 
      success: true, 
      message: "Files uploaded successfully",
      files: fileInfos.map(f => ({
        originalName: f.originalName,
        size: f.size,
        type: f.type,
        travelerName: f.travelerName,
        documentType: f.documentType,
        documentNumber: f.documentNumber
      })),
      bookingId,
      guestName,
      wordpressStorage: wpUploadResult.success,
      travelers: travelers
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload files" },
      { status: 500 }
    );
  }
}

/**
 * Upload documents to WordPress via the API
 */
async function uploadToWordPress(
  bookingId: string, 
  files: {
    originalName: string;
    arrayBuffer: ArrayBuffer;
    size: number;
    type: string;
    travelerName: string;
    documentType: string;
    documentNumber: string;
  }[]
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!process.env.WORDPRESS_API_URL || !process.env.WORDPRESS_API_KEY) {
      throw new Error("WordPress API configuration missing");
    }

    const formData = new FormData();
    formData.append('bookingId', bookingId);
    
    // Add each file to the form data
    files.forEach((file, index) => {
      const fileKey = `file_${index}`;
      const fileBlob = new Blob([file.arrayBuffer], { type: file.type });
      const fileObject = new File([fileBlob], file.originalName, { type: file.type });
      
      formData.append(fileKey, fileObject);
      formData.append(`file_info_${fileKey}`, JSON.stringify({
        travelerName: file.travelerName,
        documentType: file.documentType,
        documentNumber: file.documentNumber
      }));
    });
    
    const response = await fetch(`${process.env.WORDPRESS_API_URL}/upload-documents`, {
      method: 'POST',
      headers: {
        'x-api-key': process.env.WORDPRESS_API_KEY
      },
      body: formData
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`WordPress API error (${response.status}): ${errorText}`);
    }
    
    // Successful response
    return { success: true };
  } catch (error) {
    console.error("Error uploading to WordPress:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
}

/**
 * Send notification email to administrator with the uploaded documents
 */
async function sendAdminNotification({
  bookingId,
  guestName,
  guestEmail,
  travelers,
  files
}: {
  bookingId: string;
  guestName: string;
  guestEmail: string;
  travelers: {
    name: string;
    documentType: string;
    documentNumber: string;
  }[];
  files: {
    originalName: string;
    arrayBuffer: ArrayBuffer;
    size: number;
    type: string;
    travelerName: string;
    documentType: string;
    documentNumber: string;
  }[];
}) {
  try {
    const transporter = createEmailTransporter();
    
    // Format file sizes for display
    const formatFileSize = (bytes: number) => {
      if (bytes < 1024) return bytes + " B";
      else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
      else return (bytes / 1048576).toFixed(1) + " MB";
    };
    
    // Create HTML for the files table
    const filesHtml = files.map(file => `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;">${file.travelerName}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${getDocumentTypeName(file.documentType)}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${file.documentNumber}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${file.originalName}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${file.type}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${formatFileSize(file.size)}</td>
      </tr>
    `).join('');
    
    // Create HTML for travelers list
    const travelersHtml = travelers.map(traveler => 
      `<li style="margin-bottom: 5px;">${traveler.name} (${getDocumentTypeName(traveler.documentType)}: ${traveler.documentNumber})</li>`
    ).join('');
    
    // Email content with booking and document details
    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #1e40af; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">Villa Claudia - Document Upload Notification</h1>
        </div>
        <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
          <h2>New Documents Uploaded</h2>
          
          <h3>Booking Information</h3>
          <p><strong>Booking ID:</strong> ${bookingId}</p>
          <p><strong>Lead Guest Name:</strong> ${guestName}</p>
          <p><strong>Contact Email:</strong> ${guestEmail}</p>
          
          <h3>Travelers</h3>
          <ul style="padding-left: 20px;">
            ${travelersHtml}
          </ul>
          
          <h3>Documents</h3>
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <thead>
              <tr>
                <th style="padding: 8px; text-align: left; border: 1px solid #ddd; background-color: #f2f2f2;">Traveler Name</th>
                <th style="padding: 8px; text-align: left; border: 1px solid #ddd; background-color: #f2f2f2;">Document Type</th>
                <th style="padding: 8px; text-align: left; border: 1px solid #ddd; background-color: #f2f2f2;">Document Number</th>
                <th style="padding: 8px; text-align: left; border: 1px solid #ddd; background-color: #f2f2f2;">Filename</th>
                <th style="padding: 8px; text-align: left; border: 1px solid #ddd; background-color: #f2f2f2;">Type</th>
                <th style="padding: 8px; text-align: left; border: 1px solid #ddd; background-color: #f2f2f2;">Size</th>
              </tr>
            </thead>
            <tbody>
              ${filesHtml}
            </tbody>
          </table>
          
          <p style="margin-top: 20px;">
            The uploaded documents are attached to this email and also securely stored in the WordPress admin system.
            You can view them in the WordPress admin by editing the booking.
          </p>
          
          <p>This is an automated notification. Please do not reply to this email.</p>
        </div>
        <div style="background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280;">
          <p>© ${new Date().getFullYear()} Villa Claudia. All rights reserved.</p>
          <p><a href="https://villa-claudia.eu" style="color: #6b7280; text-decoration: underline;">villa-claudia.eu</a></p>
        </div>
      </div>
    `;

    // Build email attachments from in-memory files
    const attachments = files.map(file => ({
      filename: `${file.travelerName} - ${getDocumentTypeName(file.documentType)} ${file.documentNumber ? '(' + file.documentNumber + ')' : ''} - ${file.originalName}`,
      content: Buffer.from(file.arrayBuffer),
      contentType: file.type
    }));

    // Send the email
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || "Villa Claudia <no-reply@villa-claudia.eu>",
      to: process.env.ADMIN_EMAIL || "administration@villa-claudia.eu",
      subject: `[Villa Claudia] Travel Documents Uploaded - Booking ${bookingId}`,
      html: emailContent,
      attachments // Attach the uploaded files
    });
    
    console.log(`Admin notification email sent for booking ${bookingId}`);
    return true;
  } catch (error) {
    console.error("Failed to send admin notification email:", error);
    // Don't throw the error, as we don't want to fail the upload if just the notification fails
    return false;
  }
}

// Add a helper function to get human-readable document type names
function getDocumentTypeName(type: string): string {
  const types: Record<string, string> = {
    passport: "Passport",
    id_card: "National ID Card",
    residence_permit: "Residence Permit",
    drivers_license: "Driver's License"
  };
  return types[type] || type;
} 