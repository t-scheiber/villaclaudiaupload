import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { processDocumentReminders } from '@/lib/document-scheduler';
import { privateHeaders } from '@/lib/wordpress';
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'Reminder service is not configured.' }, { status: 503, headers: privateHeaders });
  const received = Buffer.from(request.headers.get('authorization') || '');
  const expected = Buffer.from(`Bearer ${secret}`);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: privateHeaders });
  }
  try {
    const result = await processDocumentReminders();
    return NextResponse.json({ success: result.failed === 0, ...result }, { status: result.failed ? 502 : 200, headers: privateHeaders });
  } catch {
    console.error('Document reminder processing failed.');
    return NextResponse.json({ error: 'Failed to process document reminders.' }, { status: 502, headers: privateHeaders });
  }
}
export const POST = GET;
