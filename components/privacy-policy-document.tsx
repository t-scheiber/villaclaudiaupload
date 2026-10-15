import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublishedPrivacyPolicy, privacyPolicy, PolicyLanguage } from '@/lib/privacy-policy';
import styles from './privacy-policy-document.module.css';

export default function PrivacyPolicyDocument({ language }: { language: PolicyLanguage }) {
  const translation = getPublishedPrivacyPolicy(language);
  if (!translation) notFound();
  const updated = new Intl.DateTimeFormat(language === 'de' ? 'de-AT' : 'en-GB', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${privacyPolicy.updatedAt}T00:00:00Z`));

  return <div className={styles.page}>
    <article className={styles.article} lang={language} aria-labelledby="privacy-title">
      <nav className={styles.languages} aria-label={language === 'de' ? 'Sprache der Datenschutzerklärung' : 'Privacy policy language'}>
        <Link href="/privacy" lang="en" hrefLang="en" aria-current={language === 'en' ? 'page' : undefined}>English</Link>
        <Link href="/privacy/de" lang="de" hrefLang="de" aria-current={language === 'de' ? 'page' : undefined}>Deutsch</Link>
      </nav>
      <h1 id="privacy-title">{translation.title}</h1>
      <p className={styles.updated}>{language === 'de' ? 'Stand' : 'Last updated'} <time dateTime={privacyPolicy.updatedAt}>{updated}</time></p>
      <div id={`villa-privacy-policy-${language}`} data-policy-body={language} dangerouslySetInnerHTML={{ __html: translation.html }} />
    </article>
  </div>;
}
