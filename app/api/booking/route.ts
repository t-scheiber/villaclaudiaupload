import { NextRequest, NextResponse } from 'next/server';
import { privateHeaders, resolveBooking, WorkflowError } from '@/lib/wordpress';
export async function GET(request: NextRequest) {
  try {
    const booking = await resolveBooking(new URL(request.url).searchParams.get('id'));
    return NextResponse.json(booking, { headers: privateHeaders });
  } catch (error) {
    return NextResponse.json({ error: error instanceof WorkflowError ? error.message : 'Unable to load booking.' }, {
      status: error instanceof WorkflowError ? error.status : 500, headers: privateHeaders,
    });
  }
}
