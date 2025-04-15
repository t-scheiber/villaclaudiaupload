import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const secureBookingId = searchParams.get('id');
    
    if (!secureBookingId) {
        return NextResponse.json({ error: 'Missing booking ID' }, { status: 400 });
    }
    
    // Extract the actual booking ID from the secure format
    // The format is: bookingId + checkindate + checkoutdate (all dates in YYYYMMDD format)
    const bookingIdMatch = secureBookingId.match(/^(\d+?)(\d{8})(\d{8})?$/);
    
    // If it doesn't match the secure format pattern, reject the request
    if (!bookingIdMatch) {
        return NextResponse.json({ error: 'Invalid booking ID format' }, { status: 400 });
    }
    
    const bookingId = bookingIdMatch[1];

    console.log('Booking ID:', bookingId);
    console.log('Secure Booking ID:', secureBookingId);
    console.log('Booking ID Match:', bookingIdMatch);
    console.log('WordPress API URL:', `${process.env.WORDPRESS_API_URL}/booking/${bookingId}`);
    console.log('WordPress API Key:', process.env.WORDPRESS_API_KEY);
    
    
    try {
        const wpApiUrl = `${process.env.WORDPRESS_API_URL}/booking/${bookingId}`;
        const response = await fetch(wpApiUrl, {
            headers: {
                'x-api-key': process.env.WORDPRESS_API_KEY || ''
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('WordPress API error:', errorData);
            throw new Error(`Failed to fetch booking data (${response.status})`);
        }
        
        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error fetching booking:', error);
        return NextResponse.json({ 
            error: 'Failed to fetch booking information',
            message: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
} 