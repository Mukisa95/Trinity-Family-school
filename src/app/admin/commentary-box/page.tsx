import { redirect } from 'next/navigation';

export default function CommentaryBoxPageRedirect() {
  redirect('/academic-years?tab=commentary');
}