const uncertainStorage = 'We could not confirm whether your documents were saved. Please contact Villa Claudia before uploading again.';

export async function submitDocuments(form: FormData): Promise<string> {
  let response: Response;
  let payload: unknown;
  try {
    response = await fetch('/api/upload', { method: 'POST', body: form, headers: {
      'x-booking-token': String(form.get('bookingId') || ''),
      'x-copy-agreement': form.get('copyAgreement') === 'true' ? 'true' : 'false',
      'x-copy-case-id': String(form.get('copyCaseId') || ''),
    } });
    payload = await response.json();
  } catch {
    throw new Error(uncertainStorage);
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error(uncertainStorage);
  const data = payload as Record<string, unknown>;
  if (!response.ok || data.success !== true || data.wordpressStorage !== true) {
    throw new Error(typeof data.error === 'string' && data.error ? data.error : uncertainStorage);
  }
  return typeof data.message === 'string' && data.message ? data.message : 'Your documents have been saved.';
}
