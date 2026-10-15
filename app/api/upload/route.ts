import { NextRequest, NextResponse } from 'next/server';
import { createEmailTransporter } from '@/lib/email-config';
import { copyExceptionAvailable, privateHeaders, resolveBooking, wordpress, WorkflowError } from '@/lib/wordpress';

interface StoredResult { success: boolean; storedCount: number; bookingId: number }
interface DocumentInfo { travelerName: string; documentType: string }

async function boundedFormData(request: NextRequest) {
  const limit = 27 * 1024 * 1024;
  if (Number(request.headers.get('content-length') || 0) > limit) throw new WorkflowError(413, 'Upload exceeds the 25 MiB document limit.');
  if (!request.body) throw new WorkflowError(400, 'Missing upload.');
  const reader = request.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) { await reader.cancel(); throw new WorkflowError(413, 'Upload exceeds the 25 MiB document limit.'); }
      chunks.push(new Uint8Array(value));
    }
    return await new Response(new Blob(chunks), { headers: { 'Content-Type': request.headers.get('content-type') || '' } }).formData();
  } catch (error) {
    if (error instanceof WorkflowError) throw error;
    throw new WorkflowError(400, 'Invalid upload form.');
  } finally { reader.releaseLock(); }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('x-booking-token');
    const booking = await resolveBooking(token);
    if (!copyExceptionAvailable(booking.copyException)) throw new WorkflowError(403, 'No active document-copy exception. Please show your original identity document on arrival.');
    if (booking.copyException.hasCopies === true) throw new WorkflowError(409, 'Your temporary copy is already saved. Please do not upload it again. You can withdraw and delete it from your private page.');
    if (request.headers.get('x-copy-case-id') !== booking.copyException.caseId) throw new WorkflowError(403, 'This registration exception has changed. Please reload the private page before deciding.');
    if (request.headers.get('x-copy-agreement') !== 'true') throw new WorkflowError(403, 'Your voluntary agreement is required for this optional document copy. You can show the original on arrival instead.');
    const form = await boundedFormData(request);
    if (form.get('bookingId') !== token || form.get('copyAgreement') !== 'true' || form.get('copyCaseId') !== booking.copyException.caseId) throw new WorkflowError(403, 'The booking, exception and voluntary agreement must match this private link.');
    const files = form.getAll('files');
    if (files.length !== 1 || files.some(file => !(file instanceof File))) {
      throw new WorkflowError(400, 'Upload one file containing only your own adult identity document.');
    }
    const documents = files as File[];
    if (documents.reduce((sum, file) => sum + file.size, 0) > 25 * 1024 * 1024) throw new WorkflowError(413, 'Total document size exceeds 25 MiB.');
    const upstream = new FormData();
    upstream.set('uploadToken', token as string);
    upstream.set('copyAgreement', 'true');
    upstream.set('copyCaseId', booking.copyException.caseId);
    for (const [index, file] of documents.entries()) {
      if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.type) || !file.size || file.size > 10 * 1024 * 1024) {
        throw new WorkflowError(400, 'Use JPEG, PNG or PDF files no larger than 10 MiB each.');
      }
      let info: DocumentInfo;
      try { info = JSON.parse(String(form.get(`fileMetadata[${index}]`))); }
      catch { throw new WorkflowError(400, 'Invalid document details.'); }
      if (!info || typeof info.travelerName !== 'string' || !info.travelerName.trim() || info.travelerName.length > 200 ||
          !['passport', 'id_card'].includes(info.documentType)) {
        throw new WorkflowError(400, 'Please complete the details for each traveler.');
      }
      if (info.travelerName !== booking.copyException.travelerName) throw new WorkflowError(400, 'Only the named adult guest\'s own document can be uploaded for this exception.');
      upstream.append(`file_${index}`, file);
      upstream.set(`file_info_file_${index}`, JSON.stringify({ travelerName: booking.copyException.travelerName, documentType: info.documentType }));
    }
    const result = await wordpress<StoredResult>('/upload-documents', { method: 'POST', body: upstream });
    if (!result || typeof result !== 'object' || Array.isArray(result) || result.success !== true ||
        result.storedCount !== documents.length || result.bookingId !== booking.bookingId) {
      throw new WorkflowError(502, 'Document storage was not confirmed. Please contact us before retrying.');
    }
    let notificationSent = false;
    try {
      const mail = await createEmailTransporter().sendMail({
        from: process.env.EMAIL_FROM || 'Villa Claudia <administration@villa-claudia.eu>',
        to: process.env.ADMIN_EMAIL || 'administration@villa-claudia.eu',
        subject: `[Villa Claudia] Registration exception - Booking ${booking.bookingId}`,
        text: `A document copy is saved for booking VC-${booking.bookingId}.\nReview it in WordPress: ${new URL(`/wp-admin/post.php?post=${booking.bookingId}&action=edit`, process.env.WORDPRESS_API_URL).toString()}`,
      });
      notificationSent = Boolean(mail.accepted?.length);
    } catch { console.error('Documents stored; admin notification failed.', { bookingId: booking.bookingId }); }
    return NextResponse.json({
      success: true, wordpressStorage: true, storedCount: result.storedCount, notificationSent,
      message: notificationSent ? 'Your documents have been saved.' : 'Your documents have been saved, but the email notification could not be sent. Please contact Villa Claudia; you do not need to upload again.',
    }, { status: 201, headers: privateHeaders });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof WorkflowError ? error.message : 'Documents could not be uploaded. Please try again.' },
      { status: error instanceof WorkflowError ? error.status : 500, headers: privateHeaders });
  }
}
