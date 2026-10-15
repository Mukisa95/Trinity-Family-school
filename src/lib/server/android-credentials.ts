import { androidReleaseForSite, websiteFirebaseProjectId } from '@/lib/android/download';

export function androidCredentialAssociation(origin: string) {
  const release = androidReleaseForSite(origin, websiteFirebaseProjectId());
  const fingerprint = release?.signingCertificateSha256;
  if (!release || !fingerprint || !/^(?:[A-F0-9]{2}:){31}[A-F0-9]{2}$/.test(fingerprint)) return null;
  return {
    relation: ['delegate_permission/common.handle_all_urls', 'delegate_permission/common.get_login_creds'],
    target: { namespace: 'android_app', package_name: release.applicationId, sha256_cert_fingerprints: [fingerprint] },
  };
}

/** Allow only this school's signed native origin alongside its web origin. */
export function passkeyExpectedOrigins(origin: string): string[] {
  const association = androidCredentialAssociation(origin);
  if (!association) return [origin];
  const certificate = association.target.sha256_cert_fingerprints[0].replaceAll(':', '');
  return [origin, `android:apk-key-hash:${Buffer.from(certificate, 'hex').toString('base64url')}`];
}
