import { redirect } from 'next/navigation';

export default function LookAndFeelPage() {
  redirect('/settings/app#appearance');
}
