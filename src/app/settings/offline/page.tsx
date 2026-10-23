import { redirect } from 'next/navigation';

export default function OfflineSettingsPage() {
  redirect('/settings/app#storage');
}
