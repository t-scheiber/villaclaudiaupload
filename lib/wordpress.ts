export const privateHeaders = { 'Cache-Control': 'private, no-store, max-age=0', 'Referrer-Policy': 'no-referrer' };
export class WorkflowError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export interface Booking {
  bookingId: number; guestName: string; guestEmail: string; checkInDate: string; checkOutDate: string; status: string;
  uploadToken?: string; hasUploadedDocuments?: boolean; reminderSent?: boolean;
}
export function validToken(token: unknown): token is string {
  return typeof token === 'string' && /^vc_[a-f0-9]{64}$/.test(token);
}
export async function wordpress<T>(path: string, init: RequestInit = {}): Promise<T> {
  const base = process.env.WORDPRESS_API_URL?.replace(/\/$/, '');
  const key = process.env.WORDPRESS_API_KEY;
  if (!base || !key) throw new WorkflowError(503, 'Document service is temporarily unavailable.');
  const headers = new Headers(init.headers); headers.set('x-api-key', key);
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, { ...init, headers, cache: 'no-store', signal: AbortSignal.timeout(30000) });
  } catch { throw new WorkflowError(503, 'Document service is temporarily unavailable. Please try again.'); }
  if (!response.ok) {
    if ([400, 403, 404, 410].includes(response.status)) throw new WorkflowError(response.status, 'This upload link is invalid or has expired. Please request a new link.');
    throw new WorkflowError(502, 'Document service could not complete the request. Please try again.');
  }
  try { return await response.json() as T; }
  catch { throw new WorkflowError(502, 'Invalid response from the document service.'); }
}
export async function resolveBooking(token: unknown): Promise<Booking> {
  if (!validToken(token)) throw new WorkflowError(404, 'This upload link is invalid or has expired. Please request a new link.');
  const data = await wordpress<Booking>(`/secure-booking/${token}`);
  if (!Number.isInteger(data.bookingId) || data.status !== 'confirmed' || !data.checkInDate || !data.checkOutDate) {
    throw new WorkflowError(502, 'Invalid response from the document service.');
  }
  return data;
}

