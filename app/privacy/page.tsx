import PrivacyPolicyDocument from '@/components/privacy-policy-document';

export const metadata = {
  title: 'Privacy policy | Villa Claudia',
  description: 'How Villa Claudia handles guest and website information.',
  alternates: { canonical: '/privacy', languages: { en: '/privacy', de: '/privacy/de' } },
};

export default function PrivacyPage() {
  return <PrivacyPolicyDocument language="en" />;
}
