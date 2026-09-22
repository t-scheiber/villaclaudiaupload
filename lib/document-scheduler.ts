import { sendDocumentRequestEmail, validateEmailConfiguration } from './email-config';
import { Booking, wordpress } from './wordpress';
const calendarDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zagreb', year: 'numeric', month: '2-digit', day: '2-digit' });
export function reminderDue(checkIn: string, now = new Date()) {
  const today = calendarDate.format(now);
  const days = (Date.parse(`${checkIn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000;
  // Catch up after an outage, without reminding after arrival.
  return Number.isInteger(days) && days >= 0 && days <= 7;
}
export async function processDocumentReminders(now = new Date()) {
  const bookings = await wordpress<Booking[]>('/bookings/upcoming');
  if (!Array.isArray(bookings)) throw new Error('Invalid upcoming bookings response.');
  const result = { processed: 0, sent: 0, failed: 0, skipped: 0 };
  for (const booking of bookings) {
    if (booking.status !== 'confirmed' || booking.hasUploadedDocuments || booking.reminderSent || !reminderDue(booking.checkInDate, now)) continue;
    if (!booking.guestEmail) { result.skipped++; continue; }
    result.processed++;
    let delivered = false;
    try {
      validateEmailConfiguration();
      const claim = await wordpress<{ claimed: boolean; pending?: boolean; claimId?: string; uploadToken?: string; booking?: Booking }>('/reminders/claim', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookingId: booking.bookingId }),
      });
      if (!claim.claimed) { if (claim.pending) result.failed++; else result.skipped++; continue; }
      if (!claim.claimId || !claim.uploadToken || !claim.booking?.guestEmail || claim.booking.bookingId !== booking.bookingId) throw new Error('Invalid reminder claim.');
      const email = await sendDocumentRequestEmail(claim.uploadToken, claim.booking.guestEmail, claim.booking.guestName, new Date(`${claim.booking.checkInDate}T12:00:00Z`));
      delivered = email.success;
      if (email.uncertain) throw new Error('Email delivery needs reconciliation.');
      await wordpress('/reminders/complete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookingId: booking.bookingId, claimId: claim.claimId, delivered }),
      });
      if (delivered) result.sent++; else result.failed++;
    } catch {
      // Keep an uncertain claim for manual reconciliation rather than duplicating mail.
      console.error('Reminder could not be completed.', { bookingId: booking.bookingId, deliveryAccepted: delivered });
      result.failed++;
    }
  }
  return result;
}
