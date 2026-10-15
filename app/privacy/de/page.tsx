import PrivacyPolicyDocument from '@/components/privacy-policy-document';

export const metadata = {
  title: 'Datenschutzerklärung | Villa Claudia',
  description: 'Wie Villa Claudia Daten von Gästen und Websitebesuchern verarbeitet.',
  alternates: { canonical: '/privacy/de', languages: { en: '/privacy', de: '/privacy/de' } },
};

export default function GermanPrivacyPage() {
  return <PrivacyPolicyDocument language="de" />;
}
