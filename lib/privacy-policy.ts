import content from '@/content/privacy-policy.json';

export type PolicyLanguage = 'en' | 'de';
export interface PolicyTranslation { title: string; html: string }
export interface PrivacyPolicy {
  status: 'draft' | 'published';
  updatedAt: string;
  languages: Record<PolicyLanguage, PolicyTranslation>;
}

export function assertPrivacyPolicy(value: unknown): asserts value is PrivacyPolicy {
  if (!value || typeof value !== 'object') throw new Error('Privacy policy content is missing.');
  const policy = value as Partial<PrivacyPolicy>;
  if (!['draft', 'published'].includes(policy.status || '') ||
      typeof policy.updatedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(policy.updatedAt) ||
      !Number.isFinite(Date.parse(`${policy.updatedAt}T00:00:00Z`)) ||
      new Date(`${policy.updatedAt}T00:00:00Z`).toISOString().slice(0, 10) !== policy.updatedAt) {
    throw new Error('Privacy policy publication details are invalid.');
  }
  for (const language of ['en', 'de'] as const) {
    const translation = policy.languages?.[language];
    if (!translation || typeof translation.title !== 'string' || !translation.title.trim() ||
        typeof translation.html !== 'string' || (policy.status === 'published' && !translation.html.trim())) {
      throw new Error(`Privacy policy translation is missing: ${language}.`);
    }
    // This is reviewed repository content, never guest-supplied HTML.
    if (/<\s*(?:script|iframe|object|embed|form|input|style)\b|\son\w+\s*=|\b(?:href|src)\s*=\s*["']\s*(?:javascript|data)\s*:/i.test(translation.html)) {
      throw new Error('Privacy policy must contain static document content only.');
    }
  }
}

assertPrivacyPolicy(content);
export const privacyPolicy: PrivacyPolicy = content;

export function getPublishedPrivacyPolicy(language: PolicyLanguage): PolicyTranslation | null {
  return privacyPolicy.status === 'published' ? privacyPolicy.languages[language] : null;
}
