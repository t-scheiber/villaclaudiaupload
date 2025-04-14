export default function Home() {
  return (
    <div className="container mx-auto py-20">
      <div className="text-center max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Villa Claudia Document Upload</h1>
        <div className="bg-[#fff4d8] border border-amber-300 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-3">Important Information</h2>
          <p className="text-lg mb-4">
            Please use the <span className="font-bold">personalized link</span> from the email you received to access your secure document upload page.
          </p>
          <p className="mb-2">
            The link in your email contains your unique booking reference and ensures your documents are securely attached to your reservation.
          </p>
          <p>
            If you cannot find the email, please check your spam folder.
          </p>
        </div>
        <p className="text-sm text-gray-500">
          For security reasons, direct access to the document upload system without your personalized link is not possible.
        </p>
      </div>
    </div>
  );
}
