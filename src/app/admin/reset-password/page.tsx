import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/supabase';
import { AdminAuth } from '@/components/admin-auth';
export const dynamic = 'force-dynamic';
export default async function Page() {
  try {
    await requireAdmin();
  } catch {
    redirect('/admin/login');
  }
  return <AdminAuth reset />;
}
