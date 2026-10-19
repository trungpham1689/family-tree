import { useMemo } from 'react';
import { useParams } from 'react-router';
import { toIsoDate, todayInVietnam } from '../calendar/month-grid';
import { loadFontBinary } from '../data/pha-do';
import { useAvatarDataUrl, useFamily, usePersonAvatars, useTree } from '../data/tree-queries';
import { kindLabel } from '../family/labels';
import { exportFileName } from '../lib/download';
import { useExport } from '../lib/use-export';
import { branchSummaries, buildNarrative, closingNote, notablePersons, originSummary } from '../pha-ky/narrative';
import { buildFrontSections, toPdfSections, type PhaKySection } from '../pha-ky/sections';
import { TreeTabs } from '../tree/TreeTabs';
import { AppHeader } from '../ui/AppHeader';
import { Button } from '../ui/Button';
import { ErrorBanner } from '../ui/fields';
import { Footer } from '../ui/Footer';
import { FullPageMessage } from '../ui/FullPageMessage';

/** Phả ký: văn bản tường thuật từng đời (khác Phả đồ, vốn là sơ đồ hình). */
export const PhaKyPage = () => {
  const { treeId = '' } = useParams();
  const tree = useTree(treeId);
  const family = useFamily(treeId);
  const { running, error: exportError, run: runExport } = useExport();
  const exporting = running !== null;

  const today = todayInVietnam();
  const generations = useMemo(() => (family.data ? buildNarrative(family.data) : []), [family.data]);
  const notable = useMemo(() => (family.data ? notablePersons(family.data) : []), [family.data]);
  const origin = useMemo(() => (family.data ? originSummary(family.data) : null), [family.data]);
  const branches = useMemo(() => (family.data ? branchSummaries(family.data) : []), [family.data]);
  const description = tree.data?.description ?? null;
  const frontSections = useMemo(
    () => buildFrontSections({ description, origin, branches, notable, today }),
    [description, origin, branches, notable, today],
  );

  const cover = useAvatarDataUrl(tree.data?.photo_path ?? null);
  const avatars = usePersonAvatars(family.data?.persons ?? [], true);

  if (tree.isPending || family.isPending) return <FullPageMessage>Đang tải…</FullPageMessage>;
  const error = tree.error ?? family.error;

  const exportPdf = () => {
    const data = tree.data;
    if (!data) return Promise.resolve();
    return runExport(
      'export',
      async () => {
        const [{ narrativeToPdf }, regular, bold] = await Promise.all([
          import('../pha-ky/pdf'),
          loadFontBinary('/fonts/NotoSerif-400Regular.ttf'),
          loadFontBinary('/fonts/NotoSerif-700Bold.ttf'),
        ]);
        const after = generations.length > 0 ? [{ heading: 'Lời kết', paragraphs: [closingNote(today)] }] : [];
        narrativeToPdf(generations, { regular, bold }, `Phả ký ${data.name}`, toPdfSections(frontSections), after, {
          cover: cover.data,
          people: avatars.data,
        }).save(exportFileName('Pha-ky', data.name, toIsoDate(today), 'pdf'));
      },
      'Không tạo được file PDF. Hãy thử lại.',
    );
  };

  return (
    <>
      <AppHeader />
      <TreeTabs treeId={treeId} />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-serif text-3xl font-bold text-son">Phả ký</h1>
          {generations.length > 0 && (
            <Button disabled={exporting} onClick={exportPdf}>
              {exporting ? 'Đang tạo…' : 'Xuất PDF'}
            </Button>
          )}
        </div>
        <p className="mt-1 text-ink-muted">Nguồn gốc, các chi, nhân vật tiêu biểu và văn bản tường thuật từng đời — suy từ dữ liệu Người đã ghi.</p>
        {error && <ErrorBanner>{error.message}</ErrorBanner>}
        {exportError && <ErrorBanner>{exportError}</ErrorBanner>}

        {family.isSuccess && (
          <div className="mt-6 space-y-8">
            {generations.length === 0 && <p className="text-ink-muted">Gia phả chưa có ai.</p>}

            {cover.data && <img src={cover.data} alt={`Ảnh gia phả ${tree.data?.name ?? ''}`} className="mx-auto max-h-80 rounded-2xl border border-line object-cover" />}

            {frontSections.map((section) => (
              <FrontSection key={section.kind} section={section} />
            ))}
            {generations.map((group) => (
              <section key={group.generation}>
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-son/20 pb-2">
                  <h2 className="font-serif text-2xl font-bold text-son">Đời {group.generation}</h2>
                  <p className="text-sm text-ink-muted">
                    {group.total} người
                    {group.male + group.female > 0 ? ` · ${group.male} nam · ${group.female} nữ` : ''}
                  </p>
                </div>
                <div className="mt-4 space-y-5 border-l-2 border-line pl-6">
                  {group.items.map((item, index) => {
                    // Cùng quy ước với Phả đồ: viền vàng kim = Nam, viền đỏ son = Nữ; nét đứt = Dâu/Rể (vào họ), nét liền = huyết thống.
                    const genderBorder = item.gender === 'nam' ? 'border-kim' : item.gender === 'nu' ? 'border-son' : 'border-[#a39a8f]';
                    const dashed = item.kind === 'dau_re';
                    return (
                    <article key={item.personId} id={item.personId} className="relative -ml-px target:rounded-xl target:bg-kim-soft/40">
                      <span
                        aria-hidden="true"
                        className={`absolute -left-[1.9rem] size-3.5 rounded-full border-2 bg-paper ${genderBorder} ${dashed ? 'border-dashed' : 'border-solid'} ${index === 0 ? 'top-0' : 'top-1'}`}
                      />
                      <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                      <h3 className="flex flex-wrap items-baseline gap-2 font-serif text-lg font-bold">
                        {item.name}
                        {item.adopted && <span role="img" aria-label="Con nuôi" title="Con nuôi" className="size-2 self-center rounded-full bg-ink-muted" />}
                        {item.lifespan && <span className="text-sm font-normal text-ink-muted">({item.lifespan})</span>}
                        {item.kind !== 'dinh' && (
                          <span className="rounded-full bg-son/10 px-2 py-0.5 text-xs font-semibold text-son">
                            {kindLabel(item.kind, item.gender)}
                          </span>
                        )}
                      </h3>
                      {item.detail && <p className="mt-1 leading-relaxed text-ink">{item.detail}</p>}
                      </div>
                      {avatars.data?.get(item.personId) && (
                        <img src={avatars.data.get(item.personId)} alt={item.name} className="size-20 shrink-0 rounded-lg border border-line object-cover" />
                      )}
                      </div>
                    </article>
                    );
                  })}
                </div>
              </section>
            ))}

            {generations.length > 0 && (
              <section aria-label="Chú thích" className="rounded-2xl border border-line bg-surface px-5 py-4 text-sm text-ink-muted">
                <p>Chấm tròn trước mỗi tên dùng chung quy ước với Phả đồ:</p>
                <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="flex items-center gap-1.5">
                    <span aria-hidden="true" className="size-2.5 rounded-full border-2 border-kim bg-paper" /> Nam
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span aria-hidden="true" className="size-2.5 rounded-full border-2 border-son bg-paper" /> Nữ
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span aria-hidden="true" className="size-2.5 rounded-full border-2 border-dashed border-kim bg-paper" /> Dâu/Rể (viền đứt — vào họ, không cùng huyết thống)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span aria-hidden="true" className="size-2 rounded-full bg-ink-muted" /> Con nuôi (chấm đặc cạnh tên)
                  </span>
                </p>
              </section>
            )}

            {generations.length > 0 && (
              <section aria-label="Lời kết" className="rounded-2xl border border-dashed border-line px-5 py-4">
                <p className="leading-relaxed text-ink-muted italic">{closingNote(today)}</p>
              </section>
            )}
          </div>
        )}
      </main>
      <Footer />
    </>
  );
};

/** Một khối trước phần theo Đời, vẽ từ dữ liệu của `buildFrontSections` (cùng nguồn với file PDF). */
const FrontSection = ({ section }: { section: PhaKySection }) => {
  switch (section.kind) {
    case 'intro':
      return (
        <section aria-label={section.heading} className="rounded-2xl border border-son/30 bg-son/5 p-5">
          <h2 className="font-serif text-xl font-bold text-son">{section.heading}</h2>
          <p className="mt-2 whitespace-pre-line leading-relaxed italic">{section.text}</p>
        </section>
      );
    case 'origin':
      return (
        <section aria-label={section.heading} className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="font-serif text-xl font-bold">{section.heading}</h2>
          <p className="mt-2 leading-relaxed">
            {section.before}
            <a href={`#${section.progenitorId}`} className="font-semibold text-son hover:underline">
              {section.progenitorName}
            </a>
            {section.after}
          </p>
          {section.facts.length > 0 && (
            <ul className="mt-3 space-y-1 text-ink-muted">
              {section.facts.map((fact) => (
                <li key={fact}>{fact}</li>
              ))}
            </ul>
          )}
        </section>
      );
    case 'branches':
      return (
        <section aria-label={section.heading} className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="font-serif text-xl font-bold">{section.heading}</h2>
          <p className="mt-1 text-sm text-ink-muted">Mỗi chi do một người con của Thuỷ tổ (Đời 2) lập ra.</p>
          <ul className="mt-3 space-y-2">
            {section.items.map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`} className="font-semibold text-son hover:underline">
                  {item.name}
                </a>
                <span className="text-ink-muted"> — {item.memberCount} người</span>
              </li>
            ))}
          </ul>
        </section>
      );
    case 'notable':
      return (
        <section aria-label={section.heading} className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="font-serif text-xl font-bold">{section.heading}</h2>
          <p className="mt-1 text-sm text-ink-muted">Theo ô "Chức vụ / danh hiệu" trong hồ sơ từng người.</p>
          <ul className="mt-3 space-y-2">
            {section.items.map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`} className="font-semibold text-son hover:underline">
                  {item.name}
                </a>
                <span className="text-ink-muted"> — {item.title}</span>
              </li>
            ))}
          </ul>
        </section>
      );
  }
};
