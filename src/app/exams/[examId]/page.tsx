import { redirect } from 'next/navigation';

// Keep previously shared exam links working as well as links from class details.
export default async function ExamPage({ params, searchParams }: {
  params: Promise<{ examId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { examId } = await params;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const entry of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, entry);
  }
  redirect('/exams/' + encodeURIComponent(examId) + '/view-results' + (query.size ? '?' + query.toString() : ''));
}
