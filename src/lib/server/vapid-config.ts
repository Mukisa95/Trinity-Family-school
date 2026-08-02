const DEFAULT_VAPID_PUBLIC_KEY =
  'BKdPGmGr1PGvX5FgBPph5yywU7ilPtSFxSYzpNdf751UHl7dFn-Qgt_qVQWeZ4-KSCkXC1F0VrbnfJ6m7Ozc2W4';
const DEFAULT_VAPID_EMAIL = 'admin@trinity-family-schools.com';

function normalizeVapidValue(value: string | undefined, fallback = '') {
  const normalized = (value || '')
    .trim()
    .replace(/^(["'])(.*)\1$/, '$2')
    .trim();

  return normalized || fallback;
}

export function getServerVapidDetails() {
  const email = normalizeVapidValue(process.env.VAPID_EMAIL, DEFAULT_VAPID_EMAIL);

  return {
    subject: email.startsWith('mailto:') ? email : `mailto:${email}`,
    publicKey: normalizeVapidValue(
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      DEFAULT_VAPID_PUBLIC_KEY,
    ),
    privateKey: normalizeVapidValue(process.env.VAPID_PRIVATE_KEY),
  };
}
