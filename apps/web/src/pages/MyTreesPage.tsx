import { useAuth } from '../auth/auth-context';
import { AppHeader } from '../ui/AppHeader';

export const MyTreesPage = () => {
  const { state } = useAuth();
  const email = state.status === 'signed-in' ? state.session.user.email : undefined;

  return (
    <>
      <AppHeader email={email} />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="font-serif text-3xl font-bold">Gia phả của tôi</h1>
        <section className="mt-8 rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center">
          <p className="text-lg">Bạn chưa có gia phả nào.</p>
          <p className="mt-2 text-ink-muted">
            Gia phả bạn tạo hoặc được mời vào sẽ hiện ở đây.
          </p>
        </section>
      </main>
    </>
  );
};
