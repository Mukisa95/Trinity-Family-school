import { redirect } from 'next/navigation';

export default function UniformsPageRedirect() {
  redirect('/fees?tab=uniforms');
}
