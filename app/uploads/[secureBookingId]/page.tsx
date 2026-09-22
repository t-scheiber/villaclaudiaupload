import DocumentUploadForm from '@/components/document-upload-form';
import { resolveBooking, WorkflowError } from '@/lib/wordpress';
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false }, referrer: 'no-referrer' as const };
export default async function BookingUploadPage({ params }: { params: Promise<{ secureBookingId: string }> }) {
  const { secureBookingId } = await params;
  let booking;
  try { booking = await resolveBooking(secureBookingId); }
  catch (error) {
    return <div className="container mx-auto py-20 text-center">
      <h1 className="text-3xl font-bold mb-6">Unable to open your upload link</h1>
      <p>{error instanceof WorkflowError ? error.message : 'Please try again or contact us for a new link.'}</p>
      <a className="underline" href="mailto:info@villa-claudia.eu">Contact Villa Claudia</a>
    </div>;
  }
  return <div className="container mx-auto py-20"><div className="text-center max-w-3xl mx-auto">
    <h1 className="text-3xl font-bold mb-6">Upload Documents</h1>
    <p className="mb-6">Please upload your travel documents for your stay at Villa Claudia</p>
    <DocumentUploadForm bookingId={secureBookingId} bookingData={{ ...booking, bookingReference: `VC-${booking.bookingId}` }} email={booking.guestEmail} maxTravelers={8} />
  </div></div>;
}
