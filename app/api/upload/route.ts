import { NextRequest, NextResponse } from 'next/server';
import { createEmailTransporter } from '@/lib/email-config';
import { privateHeaders, resolveBooking, wordpress, WorkflowError } from '@/lib/wordpress';

interface StoredResult { success: boolean; storedCount: number; bookingId: number }
interface DocumentInfo { travelerName: string; documentType: string; documentNumber: string }

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
    const form = await boundedFormData(request);
    const token = form.get('bookingId');
    const booking = await resolveBooking(token);
    const files = form.getAll('files');
    if (files.length < 1 || files.length > 8 || files.some(file => !(file instanceof File))) {
      throw new WorkflowError(400, 'Please upload between one and eight documents.');
    }
    const documents = files as File[];
    if (documents.reduce((sum, file) => sum + file.size, 0) > 25 * 1024 * 1024) throw new WorkflowError(413, 'Total document size exceeds 25 MiB.');
    const upstream = new FormData();
    upstream.set('uploadToken', token as string);
    const metadata: DocumentInfo[] = [];
    for (const [index, file] of documents.entries()) {
      if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.type) || !file.size || file.size > 10 * 1024 * 1024) {
        throw new WorkflowError(400, 'Use JPEG, PNG or PDF files no larger than 10 MiB each.');
      }
      let info: DocumentInfo;
      try { info = JSON.parse(String(form.get(`fileMetadata[${index}]`))); }
      catch { throw new WorkflowError(400, 'Invalid document details.'); }
      if (!info || typeof info.travelerName !== 'string' || !info.travelerName.trim() || info.travelerName.length > 200 ||
          typeof info.documentNumber !== 'string' || info.documentNumber.length > 100 ||
          !['passport', 'id_card', 'residence_permit', 'drivers_license'].includes(info.documentType)) {
        throw new WorkflowError(400, 'Please complete the details for each traveler.');
      }
      metadata.push(info);
      upstream.append(`file_${index}`, file);
      upstream.set(`file_info_file_${index}`, JSON.stringify(info));
    }
    const result = await wordpress<StoredResult>('/upload-documents', { method: 'POST', body: upstream });
    if (result.success !== true || result.storedCount !== documents.length || result.bookingId !== booking.bookingId) {
      throw new WorkflowError(502, 'Document storage was not confirmed. Please contact us before retrying.');
    }
    let notificationSent = false;
    try {
      const mail = await createEmailTransporter().sendMail({
        from: process.env.EMAIL_FROM || 'Villa Claudia <administration@villa-claudia.eu>',
        to: process.env.ADMIN_EMAIL || 'administration@villa-claudia.eu',
        subject: `[Villa Claudia] Travel Documents Uploaded - Booking ${booking.bookingId}`,
        text: `Documents are saved in WordPress for booking ${booking.bookingId}.\nGuest: ${booking.guestName}\nEmail: ${booking.guestEmail}\n\n` +
          metadata.map(info => `${info.travelerName}: ${info.documentType} ${info.documentNumber}`).join('\n'),
        attachments: await Promise.all(documents.map(async file => ({
          filename: file.name, content: Buffer.from(await file.arrayBuffer()), contentType: file.type,
        }))),
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
