import { redirect } from 'next/navigation';

export default function RequirementsPageRedirect() {
  redirect('/fees?tab=requirements');
}