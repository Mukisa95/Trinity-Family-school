import { createECDH } from 'crypto';

const DEFAULT_VAPID_PUBLIC_KEY =
  'BMOU7Zc7H4Kx4pgm8KBjrIxPBZcYxFYoz5kxVOmHHI4Up5mNxnXGpbc91fBEZcndzU0E9Zk7AFUAelNuD6RXnWY';
const DEFAULT_VAPID_EMAIL = 'admin@trinity-family-schools.com';

function normalizeVapidValue(value: string | undefined, fallback = '') {
  const normalized = (value || '')
    .trim()
    .replace(/^(["'])(.*)\1$/, '$2')
    .trim();

  return normalized || fallback;
}

function derivePublicKey(privateKey: string) {
  const privateKeyBytes = Buffer.from(
    privateKey.replace(/-/g, '+').replace(/_/g, '/'),
    'base64',
  );
  const ecdh = createECDH('prime256v1');
  ecdh.setPrivateKey(privateKeyBytes);
  return ecdh.getPublicKey().toString('base64url');
}

export function getServerVapidDetails() {
  const email = normalizeVapidValue(process.env.VAPID_EMAIL, DEFAULT_VAPID_EMAIL);
  const privateKey = normalizeVapidValue(process.env.VAPID_PRIVATE_KEY);
  const configuredPublicKey = normalizeVapidValue(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    DEFAULT_VAPID_PUBLIC_KEY,
  );

  return {
    subject: email.startsWith('mailto:') ? email : `mailto:${email}`,
    // The push service validates this public key against both the subscription
    // and the signature. Deriving it prevents a mismatched environment value
    // from silently breaking background delivery.
    publicKey: privateKey ? derivePublicKey(privateKey) : configuredPublicKey,
    privateKey,
  };
}
