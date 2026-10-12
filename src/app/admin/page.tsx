import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/supabase';
import { AdminDashboard } from '@/components/admin-dashboard';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Business management', robots: { index: false, follow: false } };
export default async function Page() {
  try {
    await requireAdmin();
  } catch {
    redirect('/admin/login');
  }
  return <AdminDashboard />;
}
