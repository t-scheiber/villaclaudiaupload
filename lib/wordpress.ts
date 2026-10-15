export const privateHeaders = { 'Cache-Control': 'private, no-store, max-age=0', 'Referrer-Policy': 'no-referrer' };
export class WorkflowError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export interface Booking {
  bookingId: number; guestName: string; guestEmail: string; checkInDate: string; checkOutDate: string; status: string;
  uploadToken?: string; hasUploadedDocuments?: boolean; reminderSent?: boolean;
  copyException?: CopyException;
}
export interface CopyException {
  active: boolean; expiresAt: string | null; reason: string; travelerName: string; hasCopies: boolean; caseId: string;
}
export function copyExceptionAvailable(value: CopyException | undefined, now = Date.now()): value is CopyException & { expiresAt: string } {
  return Boolean(value && value.active === true && typeof value.expiresAt === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value.expiresAt) &&
    Date.parse(value.expiresAt) > now && typeof value.reason === 'string' && value.reason.trim() &&
    typeof value.travelerName === 'string' && value.travelerName.trim() && typeof value.caseId === 'string' && value.caseId.trim());
}
export function validToken(token: unknown): token is string {
  return typeof token === 'string' && /^vc_[a-f0-9]{64}$/.test(token);
}
export async function wordpress<T>(path: string, init: RequestInit = {}): Promise<T> {
  const base = process.env.WORDPRESS_API_URL?.replace(/\/$/, '');
  const key = process.env.WORDPRESS_API_KEY;
  if (!base || !key) throw new WorkflowError(503, 'Document service is temporarily unavailable.');
  const headers = new Headers(init.headers); headers.set('x-api-key', key);
  const uncertainUpload = init.method === 'POST' && path === '/upload-documents';
  const uncertainMessage = 'We could not confirm whether your documents were saved. Please contact Villa Claudia before uploading again.';
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, { ...init, headers, cache: 'no-store', signal: AbortSignal.timeout(30000) });
  } catch {
    throw new WorkflowError(503, uncertainUpload
      ? uncertainMessage
      : 'Document service is temporarily unavailable. Please try again.');
  }
  if (!response.ok) {
    if (uncertainUpload && response.status >= 500) throw new WorkflowError(502, uncertainMessage);
    if (uncertainUpload && response.status === 400) throw new WorkflowError(400,
      'A document could not be validated. Please choose readable JPEG, PNG or PDF files within the size limits and check each guest\'s details.');
    if ([400, 403, 404, 410].includes(response.status)) throw new WorkflowError(response.status, 'This upload link is invalid or has expired. Please request a new link.');
    throw new WorkflowError(502, 'Document service could not complete the request. Please try again.');
  }
  try { return await response.json() as T; }
  catch { throw new WorkflowError(502, uncertainUpload ? uncertainMessage : 'Invalid response from the document service.'); }
}
export async function resolveBooking(token: unknown): Promise<Booking> {
  if (!validToken(token)) throw new WorkflowError(404, 'This upload link is invalid or has expired. Please request a new link.');
  const data = await wordpress<Booking>(`/secure-booking/${token}`);
  if (!data || typeof data !== 'object' || Array.isArray(data) || !Number.isInteger(data.bookingId) || data.bookingId < 1 ||
      data.status !== 'confirmed' || typeof data.guestName !== 'string' || typeof data.guestEmail !== 'string' ||
      !data.checkInDate || !data.checkOutDate) {
    throw new WorkflowError(502, 'Invalid response from the document service.');
  }
  return data;
}

