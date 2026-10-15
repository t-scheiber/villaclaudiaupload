"use client";

import React, { useState, useRef, useEffect } from "react";
import { FileUpload } from "@/components/ui/file-upload";
import { submitDocuments } from "@/lib/submit-documents";
import { copyExceptionAvailable, type CopyException } from '@/lib/wordpress';
import PrivacyLinks from '@/components/privacy-links';

// EU countries list
const euCountries = [
  { code: 'at', name: 'Austria' },
  { code: 'be', name: 'Belgium' },
  { code: 'bg', name: 'Bulgaria' },
  { code: 'hr', name: 'Croatia' },
  { code: 'cy', name: 'Cyprus' },
  { code: 'cz', name: 'Czech Republic' },
  { code: 'dk', name: 'Denmark' },
  { code: 'ee', name: 'Estonia' },
  { code: 'fi', name: 'Finland' },
  { code: 'fr', name: 'France' },
  { code: 'de', name: 'Germany' },
  { code: 'gr', name: 'Greece' },
  { code: 'hu', name: 'Hungary' },
  { code: 'ie', name: 'Ireland' },
  { code: 'it', name: 'Italy' },
  { code: 'lv', name: 'Latvia' },
  { code: 'lt', name: 'Lithuania' },
  { code: 'lu', name: 'Luxembourg' },
  { code: 'mt', name: 'Malta' },
  { code: 'nl', name: 'Netherlands' },
  { code: 'pl', name: 'Poland' },
  { code: 'pt', name: 'Portugal' },
  { code: 'ro', name: 'Romania' },
  { code: 'sk', name: 'Slovakia' },
  { code: 'si', name: 'Slovenia' },
  { code: 'es', name: 'Spain' },
  { code: 'se', name: 'Sweden' }
];

// List of other common countries
const otherCountries = [
  { code: 'us', name: 'United States' },
  { code: 'ca', name: 'Canada' },
  { code: 'gb', name: 'United Kingdom' },
  { code: 'ch', name: 'Switzerland' },
  { code: 'no', name: 'Norway' },
  { code: 'is', name: 'Iceland' },
  { code: 'li', name: 'Liechtenstein' },
  { code: 'au', name: 'Australia' },
  { code: 'nz', name: 'New Zealand' },
  { code: 'jp', name: 'Japan' },
  { code: 'cn', name: 'China' },
  { code: 'in', name: 'India' },
  { code: 'br', name: 'Brazil' },
  { code: 'ru', name: 'Russia' },
  { code: 'other', name: 'Other' }
];

export function acceptsNationalId(citizenship: string): boolean {
  return euCountries.some(country => country.code === citizenship) || ['no', 'is', 'li', 'ch'].includes(citizenship);
}

interface DocumentUploadFormProps {
  bookingId: string;
  bookingData: { checkInDate: string; checkOutDate?: string; bookingReference?: string };
  copyException: CopyException;
}

export default function DocumentUploadForm({ bookingId, copyException }: DocumentUploadFormProps) {
  const [citizenship, setCitizenship] = useState('other');
  const [documentType, setDocumentType] = useState('passport');
  const [file, setFile] = useState<File>();
  const [agreement, setAgreement] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(copyException.hasCopies);
  const [withdrawn, setWithdrawn] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const feedbackRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (feedback || error) feedbackRef.current?.focus(); }, [feedback, error]);

  async function withdraw() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/copy-exception/withdraw', { method: 'POST', headers: {
        'x-booking-token': bookingId, 'x-copy-case-id': copyException.caseId,
      } });
      const data = await response.json();
      if (!response.ok || data?.success !== true || data?.withdrawn !== true) throw new Error(typeof data?.error === 'string' ? data.error : 'Withdrawal was not confirmed. Contact Villa Claudia to remove the copy.');
      setWithdrawn(true); setFile(undefined); setAgreement(false); setSaved(false);
      setFeedback('The exception is closed and its copies have been deleted. Please show your original identity document on arrival.');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Withdrawal was not confirmed. Contact Villa Claudia to remove the copy.');
    } finally { setBusy(false); }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!agreement || !file) { setError('Choose your own document and give your voluntary agreement, or choose the original-document alternative.'); return; }
    setBusy(true); setError('');
    try {
      const form = new FormData();
      form.set('bookingId', bookingId); form.set('copyAgreement', 'true'); form.set('copyCaseId', copyException.caseId);
      form.set('files', file);
      form.set('fileMetadata[0]', JSON.stringify({ travelerName: copyException.travelerName, documentType }));
      setFeedback(await submitDocuments(form)); setSaved(true); setFile(undefined);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Upload failed.'); }
    finally { setBusy(false); }
  }

  const active = !withdrawn && copyExceptionAvailable(copyException);
  return <section className="bg-white rounded-lg shadow-md p-6 text-left" aria-busy={busy}>
    <h2 className="text-xl font-semibold mb-3">Optional registration exception</h2>
    <p className="mb-3">You can refuse or withdraw without disadvantage and show the original identity document on arrival instead.</p>
    <p className="mb-4 text-sm">Read how we handle guest information in our <PrivacyLinks />.</p>
    {(feedback || error) && <div ref={feedbackRef} tabIndex={-1} role={error ? 'alert' : 'status'} className="mb-4 p-3 border rounded">{error || feedback}</div>}
    {!withdrawn && <><p className="mb-2"><strong>Reason:</strong> {copyException.reason}</p>
      {copyException.expiresAt && <p className="mb-4">Copy permission expires at <time dateTime={copyException.expiresAt}>{new Date(copyException.expiresAt).toLocaleString('en-GB', { timeZone: 'Europe/Zagreb', timeZoneName: 'short' })}</time>. Copies are deleted when the exception ends or you withdraw.</p>}</>}
    {active && !saved && <form onSubmit={submit}>
      <fieldset disabled={busy} className="space-y-4 min-w-0">
        <p>Only the named adult guest may upload their own identity document. Provide only the identity page needed for this registration exception. Do not include other guests' documents, payment cards or unrelated pages. Use one JPEG, PNG or PDF file, up to 10 MiB.</p>
        <div><label htmlFor="exception-name" className="block">Adult guest</label><input id="exception-name" value={copyException.travelerName} readOnly className="w-full p-2 border rounded bg-gray-100" /></div>
        <div><label htmlFor="exception-citizenship" className="block">Citizenship / nationality</label><select id="exception-citizenship" value={citizenship} onChange={event => { setCitizenship(event.target.value); if (!acceptsNationalId(event.target.value)) setDocumentType('passport'); }} className="w-full p-2 border rounded">
          {[...euCountries, ...otherCountries].map(country => <option key={country.code} value={country.code}>{country.name}</option>)}
        </select></div>
        <div><label htmlFor="exception-type" className="block">Document type</label><select id="exception-type" value={documentType} onChange={event => setDocumentType(event.target.value)} className="w-full p-2 border rounded"><option value="passport">Passport</option>{acceptsNationalId(citizenship) && <option value="id_card">National ID card</option>}</select></div>
        <div><label htmlFor="exception-file" className="block">Your own identity document</label><FileUpload id="exception-file" disabled={busy} onFilesSelected={files => setFile(files[0])} maxFiles={1} acceptedFileTypes={['image/jpeg', 'image/png', 'application/pdf']} maxSizeInMB={10} />{file && <p className="break-all">Selected: {file.name}</p>}</div>
        <label className="flex gap-3 items-start"><input type="checkbox" checked={agreement} onChange={event => setAgreement(event.target.checked)} required className="mt-1" /><span>I voluntarily agree to temporary processing of my own adult identity-document copy for the reason and expiry shown above. I can refuse or withdraw without disadvantage and show the original instead.</span></label>
        <button type="submit" disabled={!agreement || busy} className="px-5 py-3 bg-amber-700 text-white rounded disabled:bg-gray-500">{busy ? 'Saving...' : 'Submit my optional copy'}</button>
      </fieldset>
    </form>}
    {!withdrawn && (active || saved || copyException.hasCopies) && <button type="button" onClick={withdraw} disabled={busy} className="mt-5 px-4 py-3 border border-amber-800 rounded underline disabled:opacity-50">{saved || copyException.hasCopies ? 'Withdraw agreement and delete my copy' : 'I will show the original on arrival instead'}</button>}
  </section>;
}
