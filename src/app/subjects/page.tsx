import { redirect } from 'next/navigation';

export default function SubjectsPageRedirect() {
  redirect('/academic-years?tab=subjects');
}
