import { NextRequest, NextResponse } from "next/server";
import { verify } from "jsonwebtoken";

// Secret key for signing tokens - should be stored in environment variables
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-this-in-production";

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: "Token is required" },
        { status: 400 }
      );
    }

    // Verify the JWT token
    try {
      const decoded = verify(token, JWT_SECRET) as {
        email: string;
        bookingId: string;
        name: string;
      };

      // In a real app, you might check the token against a database here
      // to ensure it hasn't been used already or revoked
      // ...

      // Return the decoded information from the token
      return NextResponse.json({
        success: true,
        user: {
          email: decoded.email,
          bookingId: decoded.bookingId,
          name: decoded.name
        }
      });
    } catch (err) {
      console.error("Error verifying token:", err);
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error("Error verifying token:", error);
    return NextResponse.json(
      { error: "Failed to verify token" },
      { status: 500 }
    );
  }
} 