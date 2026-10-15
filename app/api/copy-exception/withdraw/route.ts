import { NextRequest, NextResponse } from 'next/server';
import { privateHeaders, resolveBooking, wordpress, WorkflowError } from '@/lib/wordpress';

interface Withdrawal { success: boolean; withdrawn: boolean; deletedCount: number }

export async function POST(request: NextRequest) {
  try {
    const uploadToken = request.headers.get('x-booking-token');
    const booking = await resolveBooking(uploadToken);
    const copyCaseId = request.headers.get('x-copy-case-id');
    if (!booking.copyException || !copyCaseId || booking.copyException.caseId !== copyCaseId) {
      throw new WorkflowError(403, 'This registration exception has changed. Please reload your private page.');
    }
    const receipt = await wordpress<Withdrawal>('/copy-exception/withdraw', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uploadToken, copyCaseId }),
    });
    if (!receipt || receipt.success !== true || receipt.withdrawn !== true || !Number.isInteger(receipt.deletedCount) || receipt.deletedCount < 0) {
      throw new WorkflowError(502, 'Withdrawal was not confirmed. Please contact Villa Claudia to remove the copy.');
    }
    return NextResponse.json(receipt, { headers: privateHeaders });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof WorkflowError ? error.message : 'Withdrawal was not confirmed. Please contact Villa Claudia to remove the copy.' },
      { status: error instanceof WorkflowError ? error.status : 500, headers: privateHeaders });
  }
}
