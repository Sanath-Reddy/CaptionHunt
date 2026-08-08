import { Sidebar } from '@/components/Sidebar';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/auth/login');

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <div className="page-container">
          {children}
        </div>
      </main>
    </div>
  );
}
