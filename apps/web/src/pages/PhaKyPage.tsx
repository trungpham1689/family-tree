import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { todayInVietnam } from '../calendar/month-grid';
import { firstPhotoOfEvents, useEventPhotoImages, useEventPhotos, useTreeEvents } from '../data/calendar-queries';
import { useAvatarDataUrl, usePersonAvatars } from '../data/tree-queries';
import { personLabel } from '../people/person-label';
import type { Person, TreeWithRole } from '../data/trees';
import type { FamilyGraph } from '../family/family-graph';
import { TreePageShell } from '../tree/TreePageShell';
import { kindLabel } from '../family/labels';
import { useTreeExport } from '../export/use-tree-export';
import { FieldOptions } from '../pha-ky/FieldOptions';
import { browserStorage, readStoredFields, writeStoredFields } from '../pha-ky/stored-fields';
import { branchSummaries, buildNarrative, closingNote, notablePersons, originSummary, type NarrativeField } from '../pha-ky/narrative';
import { buildFrontSections, phaKyEvents, type PhaKySection } from '../pha-ky/sections';
import { Button } from '../ui/Button';
import { ErrorBanner } from '../ui/fields';

/** Phả ký: văn bản tường thuật từng đời (khác Phả đồ, vốn là sơ đồ hình). */
export const PhaKyPage = () => {
  const { treeId = '' } = useParams();
  return (
    <TreePageShell treeId={treeId}>
      {({ tree, graph }) => <PhaKyBody tree={tree} graph={graph} />}
    </TreePageShell>
  );
};

// v2: mặc định đổi (thêm Thứ tự con); lựa chọn lưu theo bản cũ không còn dùng.
const PhaKyBody = ({ tree, graph }: { tree: TreeWithRole; graph: FamilyGraph<Person> }) => {
  const { running, error: exportError, run: runExport } = useTreeExport(tree.name);
  const exporting = running !== null;

  const today = useMemo(() => todayInVietnam(), []);
  const [fields, setFields] = useState<Set<NarrativeField>>(() => readStoredFields(browserStorage()));
  const changeFields = (next: Set<NarrativeField>) => {
    setFields(next);
    writeStoredFields(browserStorage(), next);
  };
  const generations = useMemo(() => buildNarrative(graph, fields), [graph, fields]);
  const notable = useMemo(() => notablePersons(graph), [graph]);
  const origin = useMemo(() => originSummary(graph), [graph]);
  const branches = useMemo(() => branchSummaries(graph), [graph]);
  const description = tree.description;
  const treeEvents = useTreeEvents(tree.id);
  const events = useMemo(
    () => phaKyEvents(treeEvents.data ?? [], (personId) => (graph.person(personId) ? personLabel(graph, personId) : null)),
    [treeEvents.data, graph],
  );
  // Mỗi sự kiện chỉ lấy ảnh đầu tiên.
  const eventPhotos = useEventPhotos(tree.id);
  const coverPhotos = useMemo(() => {
    const shown = new Set(events.map((event) => event.id));
    return [...firstPhotoOfEvents(eventPhotos.data ?? []).values()].filter((photo) => shown.has(photo.event_id));
  }, [events, eventPhotos.data]);
  const coverImages = useEventPhotoImages(coverPhotos);
  const eventImages = useMemo(
    () => new Map(coverPhotos.flatMap((photo) => (coverImages.data?.get(photo.id) ? [[photo.event_id, coverImages.data.get(photo.id)!] as const] : []))),
    [coverPhotos, coverImages.data],
  );
  const frontSections = useMemo(
    () => buildFrontSections({ description, origin, branches, notable, today, events }),
    [description, origin, branches, notable, today, events],
  );

  const cover = useAvatarDataUrl(tree.photo_path);
  const avatars = usePersonAvatars(graph.persons, true);


  const exportPdf = () =>
    runExport('pha-ky-pdf', {
      generations,
      front: frontSections,
      closing: generations.length > 0 ? closingNote(today) : null,
      photos: { cover: cover.data, people: avatars.data, events: eventImages },
    });

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl font-bold text-son">Phả ký</h1>
        {generations.length > 0 && (
          <Button disabled={exporting} onClick={exportPdf}>
            {exporting ? 'Đang tạo…' : 'Xuất PDF'}
          </Button>
        )}
      </div>
      <p className="mt-1 text-ink-muted">Nguồn gốc, các chi, nhân vật tiêu biểu và văn bản tường thuật từng đời — suy từ dữ liệu Người đã ghi.</p>
      {exportError && <ErrorBanner>{exportError}</ErrorBanner>}
      {generations.length > 0 && <FieldOptions fields={fields} onChange={changeFields} />}

      <div className="mt-6">
        {generations.length === 0 && <p className="text-ink-muted">Gia phả chưa có ai.</p>}

        {cover.data && <img src={cover.data} alt={`Ảnh gia phả ${tree.name}`} className="mx-auto mb-9 max-h-80 border border-line object-cover" />}

        {frontSections.map((section, index) => (
          <FrontSection key={section.kind} section={section} numeral={ROMAN[index] ?? null} eventImages={eventImages} />
        ))}

        {generations.map((group) => (
          <section key={group.generation} className="mt-9">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b-[3px] border-double border-son pb-2">
              <h2 className="font-serif text-3xl font-bold text-son">Đời {group.generation}</h2>
              <p className="text-sm text-ink-muted">
                {group.total} người
                {group.male + group.female > 0 ? ` · ${group.male} nam · ${group.female} nữ` : ''}
              </p>
            </div>
            <div className="mt-3 ml-1.5">
              {group.items.map((item) => {
                const dashed = item.kind === 'dau_re';
                const photo = avatars.data?.get(item.personId);
                return (
                  <article
                    key={item.personId}
                    id={item.personId}
                    className="relative grid gap-x-3 py-2.5 pl-6 target:bg-kim-soft/40 sm:grid-cols-[1fr_auto] [&:not(:last-child)]:before:absolute [&:not(:last-child)]:before:top-6 [&:not(:last-child)]:before:-bottom-6 [&:not(:last-child)]:before:-left-0.5 [&:not(:last-child)]:before:w-0.5 [&:not(:last-child)]:before:bg-line"
                  >
                    <span aria-hidden="true" className={`absolute top-[1.125rem] -left-[7px] size-3 rounded-full border-2 ${genderDot(item.gender)} ${dashed ? 'border-dashed' : 'border-solid'}`} />
                    <div className="min-w-0">
                      <h3 className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 font-serif text-lg font-bold">
                        <Link to={`/gia-pha/${tree.id}/nguoi/${item.personId}`} className="rounded-sm hover:text-son hover:underline">
                          {item.name}
                        </Link>
                        {item.adopted && <span role="img" aria-label="Con nuôi" title="Con nuôi" className="size-2 self-center rounded-full bg-ink-muted" />}
                        {item.lifespan && <span className="text-sm font-normal text-ink-muted">({item.lifespan})</span>}
                        {item.kind !== 'dinh' && (
                          <span className="rounded-full bg-son/10 px-2 py-0.5 font-sans text-xs font-bold uppercase tracking-[0.12em] text-son">
                            {kindLabel(item.kind, item.gender)}
                          </span>
                        )}
                      </h3>
                      {item.lines.length > 0 && (
                        <div className="mt-1 space-y-0.5 text-[15px] leading-relaxed text-ink">
                          {item.lines.map((line, index) => (
                            <p key={index}>{line}</p>
                          ))}
                        </div>
                      )}
                    </div>
                    {photo && <img src={photo} alt={item.name} className="mt-2 size-[72px] border border-line object-cover sm:mt-0" />}
                  </article>
                );
              })}
            </div>
          </section>
        ))}

        {generations.length > 0 && (
          <section aria-label="Chú giải" className="mt-10">
            <p className="text-xs font-bold tracking-[0.14em] text-ink-muted uppercase">Chú giải</p>
            <ul className="mt-1.5 grid border-t border-line text-sm text-ink-muted sm:grid-cols-2 [&>li]:flex [&>li]:items-center [&>li]:gap-2.5 [&>li]:border-b [&>li]:border-line [&>li]:py-2">
              <li>
                <span aria-hidden="true" className={`size-3 rounded-full border-2 ${genderDot('nam')}`} /> Nam
              </li>
              <li>
                <span aria-hidden="true" className={`size-3 rounded-full border-2 ${genderDot('nu')}`} /> Nữ
              </li>
              <li>
                <span aria-hidden="true" className={`size-3 shrink-0 rounded-full border-2 border-dashed ${genderDot('nu')}`} /> Dâu / Rể (vào họ, không cùng huyết thống)
              </li>
              <li>
                <span aria-hidden="true" className="size-2 rounded-full bg-ink-muted" /> Con nuôi (chấm đặc cạnh tên)
              </li>
            </ul>
          </section>
        )}

        {generations.length > 0 && (
          <section aria-label="Lời kết" className="mt-9">
            <SectionHeading numeral={null} title="Lời kết" />
            <p className="mt-3.5 text-justify leading-[1.65] text-ink">{closingNote(today)}</p>
          </section>
        )}
      </div>
    </>
  );
};

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];

/** Chấm giới tính (cùng quy ước màu với Phả đồ): viền vàng kim = Nam, đỏ son = Nữ, xám = chưa rõ; nền trắng đặc để đường kẻ dọc không xuyên qua chấm. */
const genderDot = (gender: string | null) => (gender === 'nam' ? 'border-kim bg-surface' : gender === 'nu' ? 'border-son bg-surface' : 'border-[#a39a8f] bg-surface');

/** Tiêu đề mục kiểu văn bản: số La Mã vàng kim, tên son đậm, gạch chân vàng kim (PDF vẽ y như vậy). */
const SectionHeading = ({ numeral, title }: { numeral: string | null; title: string }) => (
  <div className="flex items-baseline gap-3.5 border-b border-kim pb-1.5">
    {numeral && <span className="text-sm font-bold tracking-[0.1em] text-kim-text">{numeral}.</span>}
    <h2 className="font-serif text-[22px] leading-tight font-bold text-son">{title}</h2>
  </div>
);

const Note = ({ children }: { children: string }) => <p className="mt-1.5 text-sm text-ink-muted">{children}</p>;

/** Một khối trước phần theo Đời, vẽ từ dữ liệu của `buildFrontSections` (cùng nguồn với file PDF). */
const FrontSection = ({ section, numeral, eventImages }: { section: PhaKySection; numeral: string | null; eventImages: ReadonlyMap<string, string> }) => {
  const body = (() => {
    switch (section.kind) {
      case 'intro':
        return <p className="mt-3.5 whitespace-pre-line text-justify leading-[1.65]">{section.text}</p>;
      case 'origin':
        return (
          <>
            <p className="mt-3.5 text-justify leading-[1.65]">
              {section.before}
              <a href={`#${section.progenitorId}`} className="font-bold text-son hover:underline">
                {section.progenitorName}
              </a>
              {section.after}
            </p>
            {section.facts.length > 0 && (
              <dl className="mt-3 divide-y divide-line border-y border-line">
                {section.facts.map((fact) => (
                  <div key={fact.label} className="grid grid-cols-[6.5rem_1fr] items-baseline gap-3 py-2 sm:grid-cols-[9.9rem_1fr]">
                    <dt className="text-xs font-bold tracking-[0.14em] text-kim-text uppercase">{fact.label}</dt>
                    <dd>{fact.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </>
        );
      case 'branches':
        return (
          <>
            <table className="mt-3 w-full text-left">
              <thead>
                <tr className="border-t-2 border-son border-b border-line text-xs tracking-[0.14em] text-ink-muted uppercase">
                  <th scope="col" className="w-20 py-1.5 pr-3 font-bold">Chi</th>
                  <th scope="col" className="py-1.5 pr-3 font-bold">Người đứng đầu chi</th>
                  <th scope="col" className="py-1.5 text-right font-bold">Thành viên</th>
                </tr>
              </thead>
              <tbody>
                {section.items.map((item, index) => (
                  <tr key={item.id} className="border-b border-line">
                    <td className="py-2 pr-3 font-bold text-son">Chi {index + 1}</td>
                    <td className="py-2 pr-3">
                      <a href={`#${item.id}`} className="hover:text-son hover:underline">
                        {item.name}
                      </a>
                    </td>
                    <td className="py-2 text-right whitespace-nowrap">{item.memberCount} người</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        );
      case 'notable':
        return (
          <>
            <Note>Theo ô "Chức vụ / danh hiệu" trong hồ sơ từng người.</Note>
            <ul className="mt-2 divide-y divide-line border-b border-line">
              {section.items.map((item) => (
                <li key={item.id} className="flex flex-wrap items-baseline justify-between gap-x-3 py-2">
                  <a href={`#${item.id}`} className="font-bold hover:text-son hover:underline">
                    {item.name}
                  </a>
                  <span className="text-ink-muted">{item.title}</span>
                </li>
              ))}
            </ul>
          </>
        );
      case 'events':
        return (
          <ul className="mt-2 divide-y divide-line border-b border-line">
            {section.items.map((item) => (
              <li key={item.id} id={item.id} className="grid gap-x-3 py-3 target:bg-kim-soft/40 sm:grid-cols-[1fr_auto]">
                <div className="min-w-0">
                  <h3 className="font-serif text-lg font-bold">{item.title}</h3>
                  <p className="text-sm text-ink-muted">{item.when}</p>
                  {item.host && <p className="text-sm">Chủ trì: <strong>{item.host}</strong></p>}
                  {item.description && <p className="mt-1 whitespace-pre-line text-justify text-[15px] leading-relaxed">{item.description}</p>}
                </div>
                {eventImages.get(item.id) && (
                  // Ảnh không tải được thì ẩn đi, khỏi hiện chữ alt thô trong khung và đẩy bố cục.
                  <img src={eventImages.get(item.id)} alt={item.title} onError={(event) => event.currentTarget.classList.add('hidden')} className="mt-2 max-h-28 max-w-40 border border-line object-cover sm:mt-0" />
                )}
              </li>
            ))}
          </ul>
        );
    }
  })();
  return (
    <section aria-label={section.heading} className="mt-9 first:mt-0">
      <SectionHeading numeral={numeral} title={section.heading} />
      {body}
    </section>
  );
};
