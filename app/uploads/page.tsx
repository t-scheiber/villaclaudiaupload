export default function UploadsIndexPage() {
  return (
    <div className="container mx-auto py-20">
      <div className="text-center max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Villa Claudia guest registration</h1>
        <div className="bg-[#fff4d8] border border-amber-300 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-3">Important Information</h2>
          <p className="text-lg mb-4">
            Please use the <span className="font-bold">personalized link</span> from the email you received to access your private guest-registration guidance.
          </p>
          <p className="mb-2">
            No advance identity-document copy is required. Please bring your original identity document for inspection on arrival.
          </p>
          <p>
            If you cannot find the email, please check your spam folder or contact our reception at <a href="mailto:info@villa-claudia.eu" className="text-amber-700 underline">info@villa-claudia.eu</a>.
          </p>
        </div>
        <p className="text-sm text-gray-500">
          For security reasons, access to booking-specific guidance without your personalized link is not possible.
        </p>
      </div>
    </div>
  );
}