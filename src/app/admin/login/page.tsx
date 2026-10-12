import { AdminAuth } from '@/components/admin-auth';
export const metadata = { title: 'Admin sign in', robots: { index: false, follow: false } };
export default function Page() {
  return <AdminAuth />;
}
