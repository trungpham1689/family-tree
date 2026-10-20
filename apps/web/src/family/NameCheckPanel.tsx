import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import type { Person } from '../data/trees';
import { PersonPicker } from '../people/PersonPicker';
import { personLabel } from '../people/person-label';
import { Button } from '../ui/Button';
import { Select, TextField } from '../ui/fields';
import { babyRelationFinder, type BabyRelation } from './baby-relation';
import type { FamilyGraph } from './family-graph';
import { kindLabel } from './labels';
import { babyGeneration, checkBabyName, resolveBabyParents } from './name-check';

/** Tra cứu trùng tên khi đặt tên cho Bé: nhập họ và tên, chọn Ba/Mẹ (suy ra Đời và quan hệ); liệt kê người trùng kèm lý do và quan hệ. */
export const NameCheckPanel = ({ treeId, graph }: { treeId: string; graph: FamilyGraph<Person> }) => {
  const [fullName, setFullName] = useState('');
  const [parentId, setParentId] = useState<string | null>(null);
  /** undefined: theo gợi ý (người duy nhất còn hôn phối); null: người dùng chọn "không chọn". */
  const [otherChoice, setOtherChoice] = useState<string | null | undefined>(undefined);
  const [includeSpouses, setIncludeSpouses] = useState(true);

  const pickParent = (personId: string | null) => {
    setParentId(personId);
    setOtherChoice(undefined);
  };

  // Người đã nhập là Ba (nam, hoặc chưa rõ giới tính) hay Mẹ (nữ); người còn lại tự tìm trong vợ/chồng của người đó.
  const spouses = useMemo(() => (parentId ? graph.spousesOf(parentId).map(({ person }) => person) : []), [graph, parentId]);
  const { chosenIsMother: parentIsMother, fatherId, motherId } = useMemo(
    () => (parentId ? resolveBabyParents(graph, parentId, otherChoice) : { chosenIsMother: false, fatherId: null, motherId: null }),
    [graph, parentId, otherChoice],
  );
  const otherId = parentIsMother ? fatherId : motherId;
  const hasParent = parentId !== null;

  const generation = useMemo(() => babyGeneration(graph, [fatherId, motherId]), [graph, fatherId, motherId]);
  const result = useMemo(
    () => (fullName.trim() && generation !== null ? checkBabyName(graph, fullName, generation, { includeSpouses }) : null),
    [graph, fullName, generation, includeSpouses],
  );
  const relationOf = useMemo(() => (hasParent ? babyRelationFinder(graph, { fatherId, motherId }) : null), [graph, hasParent, fatherId, motherId]);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <p className="font-medium">Nhập họ và tên dự định và chọn Ba/Mẹ của Bé.</p>
        <ul className="space-y-2 rounded-2xl border border-line bg-surface p-4 text-[15px]">
          <li className="flex gap-3">
            <span aria-hidden="true" className="mt-2.5 size-2 shrink-0 rounded-full bg-kim" />
            <span>
              <strong className="font-semibold text-son">Tên</strong> của Bé không nên trùng tên với thành viên đã mất cùng Đời.
            </span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden="true" className="mt-2.5 size-2 shrink-0 rounded-full bg-kim" />
            <span>
              <strong className="font-semibold text-son">Tên</strong> hoặc <strong className="font-semibold text-son">tên lót</strong> của Bé không nên trùng
              tên của thành viên ở các Đời trên.
            </span>
          </li>
        </ul>
        <p className="text-sm text-ink-muted">Tên là chữ cuối của họ và tên; tên lót là chữ kế tên. Đời của Bé và cách xưng hô được suy ra từ Ba/Mẹ.</p>
      </div>

      <TextField
        label="Họ và tên của Bé"
        placeholder="Phạm Văn A"
        autoComplete="off"
        value={fullName}
        onChange={(event) => setFullName(event.target.value)}
      />

      <section className="space-y-3 rounded-2xl border border-line p-4">
        {parentId ? (
          <div className="flex min-h-12 items-center justify-between gap-2 rounded-xl border border-line bg-surface px-4">
            <div className="min-w-0">
              <p className="text-sm text-ink-muted">{parentIsMother ? 'Mẹ' : 'Ba'} của Bé</p>
              <p className="truncate font-semibold">{personLabel(graph, parentId)}</p>
            </div>
            <Button variant="ghost" onClick={() => pickParent(null)}>
              Đổi
            </Button>
          </div>
        ) : (
          <PersonPicker graph={graph} label="Ba/Mẹ" onPick={pickParent} />
        )}
        {parentId && spouses.length > 0 && (
          <label className="block">
            <span className="mb-1 block text-sm text-ink-muted">{parentIsMother ? 'Ba' : 'Mẹ'} của Bé</span>
            <Select className="w-full" value={otherId ?? ''} onChange={(event) => setOtherChoice(event.target.value || null)}>
              <option value="">Chưa rõ / không chọn</option>
              {spouses.map((spouse) => (
                <option key={spouse.id} value={spouse.id}>
                  {spouse.full_name}
                </option>
              ))}
            </Select>
          </label>
        )}
        {hasParent && generation === null && (
          <p role="alert" className="rounded-xl bg-kim-soft px-4 py-3 font-medium">
            Ba/Mẹ đã chọn chưa nối vào cây nên chưa suy ra được Đời của Bé.
          </p>
        )}
        {generation !== null && (
          <p className="font-medium">
            Bé thuộc <span className="text-son">Đời {generation}</span>
          </p>
        )}
      </section>

      <label className="flex min-h-11 items-center gap-3">
        <input type="checkbox" className="size-5 accent-son" checked={includeSpouses} onChange={(event) => setIncludeSpouses(event.target.checked)} />
        Tính cả Dâu/Rể
      </label>

      {!hasParent && fullName.trim() !== '' && <p className="text-ink-muted">Chọn Ba/Mẹ của Bé để xem kết quả.</p>}

      {result && !result.ok && (
        <p role="alert" className="rounded-xl bg-kim-soft px-4 py-3 font-medium">
          {result.error}
        </p>
      )}

      {result?.ok && (
        <section aria-live="polite" className="space-y-4">
          <p className="rounded-2xl border border-line bg-surface px-5 py-4">
            Tên: <strong className="text-son">{result.baby.given}</strong>
            {' · '}
            Tên lót: {result.baby.middle ? <strong className="text-son">{result.baby.middle}</strong> : <span className="text-ink-muted">không có</span>}
            {' · '}Đời {result.generation}
          </p>

          {result.conflicts.length === 0 ? (
            <p className="rounded-2xl bg-la/10 px-5 py-4 font-semibold text-la">
              Không trùng với ai trong gia phả (từ Đời 1 đến Đời {result.generation}). Có thể đặt tên này.
            </p>
          ) : (
            <>
              <p className="font-semibold text-son">Có {result.conflicts.length} người trùng — nên cân nhắc đổi tên:</p>
              <ul className="space-y-3">
                {result.conflicts.map((conflict) => (
                  <li key={conflict.personId} className="rounded-2xl border border-line bg-surface p-4">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <Link to={`/gia-pha/${treeId}/nguoi/${conflict.personId}`} className="font-serif text-lg font-bold hover:text-son hover:underline">
                        {conflict.fullName}
                      </Link>
                      <span className="text-sm text-ink-muted">
                        Đời {conflict.generation}
                        {conflict.lifespan ? ` · ${conflict.lifespan}` : ''}
                        {' · '}
                        {conflict.deceased ? 'đã mất' : 'còn sống'}
                      </span>
                      {conflict.personKind === 'dau_re' && (
                        <span className="rounded-full bg-son/10 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-son">
                          {kindLabel(conflict.personKind, graph.person(conflict.personId)?.gender ?? null)}
                        </span>
                      )}
                    </div>
                    {relationOf && <RelationLine relation={relationOf(conflict.personId)} />}
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      {conflict.reasons.map((reason) => (
                        <li key={reason.kind}>{reason.text}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
    </div>
  );
};

/** "Quan hệ với Bé: Bác ruột — chị gái của Cha (Phạm Văn Bình)". */
const RelationLine = ({ relation }: { relation: BabyRelation | null }) =>
  relation ? (
    <p className="mt-2">
      Quan hệ với Bé: <strong className="text-son">{relation.term}</strong>
      {relation.via && <span className="text-ink-muted"> — {relation.via}</span>}
    </p>
  ) : (
    <p className="mt-2 text-ink-muted">Quan hệ với Bé: chưa rõ (không có quan hệ huyết thống hay hôn phối nào ghi trong gia phả).</p>
  );
