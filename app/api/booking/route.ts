import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const bookingId = searchParams.get('id');
    
    if (!bookingId) {
        return NextResponse.json({ error: 'Missing booking ID' }, { status: 400 });
    }
    
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