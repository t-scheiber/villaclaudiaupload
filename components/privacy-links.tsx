import Link from 'next/link';

export default function PrivacyLinks() {
  return <>
    <Link href="/privacy" lang="en" className="underline underline-offset-2 hover:text-amber-950 focus-visible:outline-2 focus-visible:outline-offset-4">Privacy policy</Link>
    <span aria-hidden="true"> · </span>
    <Link href="/privacy/de" lang="de" className="underline underline-offset-2 hover:text-amber-950 focus-visible:outline-2 focus-visible:outline-offset-4">Datenschutzerklärung</Link>
  </>;
}
