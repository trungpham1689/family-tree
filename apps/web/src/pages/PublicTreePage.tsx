import { useCallback, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import type { PublicTree, PublicPerson } from '../data/public-tree';
import { usePublicTree, usePublicTreeCard } from '../data/tree-queries';
import { birthOrderLabel, kindLabel, spouseLabel } from '../family/labels';
import { coParentCaptions } from '../family/co-parent';
import { lifespanText } from '../people/person-display';
import { ProfileInfo } from '../people/ProfileInfo';
import { TreeExplorer } from '../tree/TreeExplorer';
import { Button } from '../ui/Button';
import { ErrorBanner, TextField } from '../ui/fields';
import { Footer } from '../ui/Footer';
import { FullPageMessage } from '../ui/FullPageMessage';
import { PublicHeader } from '../ui/PublicHeader';

const passwordKey = (token: string) => `gia-pha:public-pw:${token}`;

const readStoredPassword = (token: string): string | null => {
  try {
    return sessionStorage.getItem(passwordKey(token));
  } catch {
    return null;
  }
};

const storePassword = (token: string, password: string | null) => {
  try {
    if (password === null) sessionStorage.removeItem(passwordKey(token));
    else sessionStorage.setItem(passwordKey(token), password);
  } catch {
    // Không lưu được thì chỉ phải nhập lại mật khẩu ở lần tải sau, không mất gì khác.
  }
};

/** Tải bản công khai một lần; cả trang Cây và trang Người dùng chung. Phải nhập đúng mật khẩu mới thấy nội dung. */
const PublicShell = ({ children }: { children: (data: PublicTree, token: string) => ReactNode }) => {
  const { token = '' } = useParams();
  const card = usePublicTreeCard(token);
  const [password, setPassword] = useState<string | null>(() => readStoredPassword(token));
  const result = usePublicTree(token, password);

  if (card.isPending) return <FullPageMessage>Đang tải gia phả…</FullPageMessage>;

  const wrongPassword = result.isSuccess && result.data.status === 'wrong-password';
  const missing = (result.isSuccess && result.data.status === 'missing') || card.data === null;

  const submitPassword = (entered: string) => {
    storePassword(token, entered);
    setPassword(entered);
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      {result.isError && (
        <main className="mx-auto max-w-4xl px-4 py-8">
          <ErrorBanner>{result.error.message}</ErrorBanner>
        </main>
      )}
      {missing && (
        <main className="mx-auto max-w-xl px-4 py-16 text-center">
          <h1 className="font-serif text-3xl font-bold text-son">Link không còn hiệu lực</h1>
          <p className="mt-3 text-ink-muted">
            Có thể chủ gia phả đã tắt hoặc tạo lại link chia sẻ. Hãy xin người gửi link mới.
          </p>
        </main>
      )}
      {!missing && (password === null || wrongPassword) && (
        <PasswordGate treeName={card.data?.name ?? null} wrong={wrongPassword} onSubmit={submitPassword} />
      )}
      {!missing && password !== null && result.isPending && <FullPageMessage>Đang tải gia phả…</FullPageMessage>}
      {result.isSuccess && result.data.status === 'ok' && children(result.data.data, token)}
      <Footer />
    </div>
  );
};

const isTouchScreen = () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

const PasswordGate = ({
  treeName,
  wrong,
  onSubmit,
}: {
  treeName: string | null;
  wrong: boolean;
  onSubmit: (password: string) => void;
}) => {
  const [value, setValue] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (value.trim()) onSubmit(value);
  };

  return (
    <main className="mx-auto w-full max-w-md px-4 py-10 sm:py-16">
      <h1 className="font-serif text-3xl font-bold text-son">{treeName ? `Gia phả ${treeName}` : 'Gia phả'}</h1>
      <p className="mt-2 text-ink-muted">Gia phả này được chia sẻ riêng. Nhập mật khẩu mà chủ gia phả đã gửi kèm link để xem.</p>
      <form onSubmit={submit} className="mt-6 space-y-3 rounded-2xl border border-line bg-surface p-5 shadow-sm">
        <TextField
          label="Mật khẩu"
          type="password"
          // Màn cảm ứng: không tự focus, kẻo bàn phím ảo bật lên che mất tên gia phả và nút xem.
          autoFocus={!isTouchScreen()}
          required
          value={value}
          error={wrong ? 'Sai mật khẩu, hãy thử lại.' : undefined}
          onChange={(event) => setValue(event.target.value)}
        />
        <Button type="submit" className="w-full">
          Xem gia phả
        </Button>
      </form>
    </main>
  );
};

export const PublicTreePage = () => (
  <PublicShell>{(data, token) => <PublicTreeView data={data} token={token} />}</PublicShell>
);

const PublicTreeView = ({ data, token }: { data: PublicTree; token: string }) => {
  const personHref = useCallback((personId: string) => `/p/${token}/nguoi/${personId}`, [token]);
  const hasRoot = data.graph.persons.some((person) => person.is_progenitor);

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-4">
      <div>
        <h1 className="font-serif text-3xl font-bold text-son">{data.tree.name}</h1>
        {data.tree.description && <p className="mt-1 text-ink-muted">{data.tree.description}</p>}
      </div>
      {hasRoot ? (
        <div className="flex h-[75dvh] min-h-0 flex-col">
          <TreeExplorer graph={data.graph} defaultOutside={data.tree.outside_generations} personHref={personHref} />
        </div>
      ) : (
        <p className="text-ink-muted">Gia phả chưa có Thuỷ tổ nên chưa vẽ được cây.</p>
      )}
    </main>
  );
};

export const PublicPersonPage = () => (
  <PublicShell>{(data, token) => <PublicPersonView data={data} token={token} />}</PublicShell>
);

const PublicPersonView = ({ data, token }: { data: PublicTree; token: string }) => {
  const { personId = '' } = useParams();
  const { graph } = data;
  const person = graph.person(personId);

  if (!person) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Link to={`/p/${token}`} className="inline-flex min-h-11 items-center text-ink-muted hover:text-son">
          ← {data.tree.name}
        </Link>
        <ErrorBanner>Không tìm thấy người này trong gia phả.</ErrorBanner>
      </main>
    );
  }

  const placement = graph.placement(person.id);
  const relative = (other: PublicPerson, caption: string) => (
    <li key={`${caption}-${other.id}`}>
      <Link to={`/p/${token}/nguoi/${other.id}`} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-paper">
        <span className="font-semibold">{other.full_name}</span>
        <span className="text-sm text-ink-muted">{[caption, lifespanText(other)].filter(Boolean).join(' · ')}</span>
      </Link>
    </li>
  );
  const parents = graph.parentsOf(person.id);
  const spouses = graph.spousesOf(person.id);
  const children = graph.childrenOf(person.id);
  const captions = coParentCaptions(graph, person.id);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <Link to={`/p/${token}`} className="inline-flex min-h-11 items-center text-ink-muted hover:text-son">
        ← {data.tree.name}
      </Link>
      <h1 className="mt-3 font-serif text-3xl font-bold">{person.full_name}</h1>
      {person.anonymous ? (
        <p className="mt-2 text-ink-muted">Thông tin người này không được hiển thị công khai.</p>
      ) : (
        <>
          <p className="mt-1 text-lg text-ink-muted">{lifespanText(person) || 'Chưa rõ năm sinh'}</p>
          <p className="mt-3 flex flex-wrap gap-2 text-sm">
            <span className="rounded-full bg-paper px-3 py-1">{kindLabel(placement.kind, person.gender)}</span>
            {placement.generation !== null && <span className="rounded-full bg-paper px-3 py-1">Đời {placement.generation}</span>}
            {person.birth_order !== null && (
              <span className="rounded-full bg-paper px-3 py-1">{birthOrderLabel(person.birth_order)}</span>
            )}
          </p>
          <ProfileInfo person={person} graph={graph} />
        </>
      )}

      {[
        ['Cha mẹ', parents.map(({ person: parent }) => relative(parent, parent.gender === 'nu' ? 'Mẹ' : 'Cha'))],
        ['Vợ / chồng', spouses.map((spouse) => relative(spouse.person, spouseLabel(spouse.person.gender, spouse.order)))],
        ['Con', children.map(({ person: child }) => relative(child, [birthOrderLabel(child.birth_order), captions.get(child.id)].filter(Boolean).join(' · ')))],
      ].map(([title, items]) =>
        Array.isArray(items) && items.length > 0 ? (
          <section key={String(title)} className="mt-8">
            <h2 className="font-serif text-xl font-bold">{title}</h2>
            <ul className="mt-2 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">{items}</ul>
          </section>
        ) : null,
      )}
    </main>
  );
};
