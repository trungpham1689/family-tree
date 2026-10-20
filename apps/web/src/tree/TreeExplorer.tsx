import { DEFAULT_BOX, layoutTree, MARRIAGE_LINE_HEIGHT, marriageExtraLines, outsideGenerationsFilter, type Orientation } from '@gia-pha/tree-layout';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { usePersonAvatars } from '../data/tree-queries';
import type { Person } from '../data/trees';
import type { FamilyGraph } from '../family/family-graph';
import { OUTSIDE_OPTIONS, outsideLabel } from '../family/outside-generations';
import { Button } from '../ui/Button';
import { ErrorBanner, Select } from '../ui/fields';
import { AVATAR_GAP, AVATAR_SIZE, FamilyTreeCanvas, type FocusRequest } from './FamilyTreeCanvas';
import { initialCollapsed } from './initial-collapsed';
import { PersonSearch } from './PersonSearch';
import { toCanvasPersons } from './canvas-persons';
import { planReveal } from './tree-search';
import { describeReveal, readOrientation, saveOrientation } from './tree-view-state';

export type SaveDefaultControl = {
  busy: boolean;
  error: string | null;
  save: (outsideGenerations: number, onSaved: () => void) => void;
};

type TreeExplorerProps<P extends Person> = {
  graph: FamilyGraph<P>;
  /** Cách hiện Cháu ngoại mặc định của Gia phả. */
  defaultOutside: number;
  personHref: (personId: string) => string;
  /** Chỉ Chủ sở hữu mới lưu được mặc định; không truyền thì ẩn nút. */
  saveDefault?: SaveDefaultControl | undefined;
  /** Cho hiện tuỳ chọn ảnh đại diện (ảnh cần vai trò mới tải được, nên trang công khai không truyền). */
  allowAvatars?: boolean | undefined;
};

/** Cây tương tác: tìm người, lọc Cháu ngoại, đổi hướng, thu/mở nhánh. Dùng cho cả trang có vai trò và trang công khai. */
export const TreeExplorer = <P extends Person>({
  graph,
  defaultOutside,
  personHref,
  saveDefault,
  allowAvatars = false,
}: TreeExplorerProps<P>) => {
  const navigate = useNavigate();
  const root = graph.persons.find((person) => person.is_progenitor);

  const [collapsed, setCollapsed] = useState<Set<string>>(() =>
    root ? initialCollapsed(root.id, graph.parentLinks) : new Set(),
  );
  const [orientation, setOrientation] = useState<Orientation>(readOrientation);
  // null = theo mặc định của Gia phả; người xem đổi tạm thì không lưu.
  const [outsideOverride, setOutsideOverride] = useState<number | null>(null);
  const outsideGenerations = outsideOverride ?? defaultOutside;
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(() => (root ? { personId: root.id, preferFit: true } : null));
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showAvatars, setShowAvatars] = useState(false);
  const avatars = usePersonAvatars(graph.persons, allowAvatars && showAvatars);

  const marriageLines = useMemo(() => marriageExtraLines(graph), [graph]);
  const layout = useMemo(
    () =>
      root
        ? layoutTree(graph, {
            rootId: root.id,
            collapsed,
            orientation,
            includeChild: outsideGenerationsFilter(outsideGenerations),
            box: { ...DEFAULT_BOX, height: DEFAULT_BOX.height + (showAvatars ? AVATAR_SIZE + AVATAR_GAP : 0) + marriageLines * MARRIAGE_LINE_HEIGHT },
          })
        : null,
    [graph, root, collapsed, orientation, outsideGenerations, showAvatars, marriageLines],
  );

  const canvasPersons = useMemo(
    () => toCanvasPersons(graph, showAvatars ? (id) => avatars.data?.get(id) : undefined),
    [graph, showAvatars, avatars.data],
  );

  const toggle = useCallback((personId: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(personId)) next.delete(personId);
      else next.add(personId);
      return next;
    });
  }, []);
  const open = useCallback((personId: string) => navigate(personHref(personId)), [navigate, personHref]);

  if (!root || !layout) {
    return <p className="text-ink-muted">Gia phả chưa có Thuỷ tổ, chưa vẽ được cây.</p>;
  }

  const reveal = (personId: string) => {
    const plan = planReveal({
      targetId: personId,
      rootId: root.id,
      genderOf: (id) => graph.person(id)?.gender ?? null,
      parentLinks: graph.parentLinks,
      unions: graph.unions,
      collapsed,
      outsideGenerations,
    });
    const outcome = describeReveal(plan, graph.person(personId)?.full_name, outsideGenerations);
    setNotice(outcome.notice);
    if (outcome.collapsed) setCollapsed(outcome.collapsed);
    if (outcome.outsideOverride !== null) setOutsideOverride(outcome.outsideOverride);
    if (outcome.focus) {
      setHighlightedId(personId);
      setFocusRequest({ personId });
    }
  };

  const changeOrientation = () => {
    const next: Orientation = orientation === 'top-down' ? 'left-right' : 'top-down';
    setOrientation(next);
    saveOrientation(next);
    setFocusRequest({ personId: highlightedId ?? root.id });
  };

  const differsFromDefault = outsideGenerations !== defaultOutside;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-64 flex-1">
          <PersonSearch persons={graph.persons} placement={graph.placement} onPick={reveal} />
        </div>
        <label className="flex flex-col">
          <span className="mb-1 font-medium">Hiển thị</span>
          <Select value={outsideGenerations} onChange={(event) => setOutsideOverride(Number(event.target.value))}>
            {OUTSIDE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {outsideLabel(n)}
                {n === defaultOutside ? ' (mặc định)' : ''}
              </option>
            ))}
          </Select>
        </label>
        {saveDefault && differsFromDefault && (
          <Button
            variant="ghost"
            disabled={saveDefault.busy}
            onClick={() => saveDefault.save(outsideGenerations, () => setOutsideOverride(null))}
          >
            Đặt làm mặc định
          </Button>
        )}
        {allowAvatars && (
          <label className="flex min-h-12 items-center gap-2">
            <input type="checkbox" className="size-5 accent-son" checked={showAvatars} onChange={(event) => setShowAvatars(event.target.checked)} />
            Ảnh đại diện
          </label>
        )}
        <Button variant="secondary" onClick={changeOrientation}>
          {orientation === 'top-down' ? 'Xếp trái → phải' : 'Xếp trên → dưới'}
        </Button>
      </div>

      {saveDefault?.error && <ErrorBanner>{saveDefault.error}</ErrorBanner>}
      {notice && (
        <p role="status" className="rounded-xl bg-kim/10 px-4 py-2">
          {notice}
        </p>
      )}

      <div className="min-h-0 flex-1">
        <FamilyTreeCanvas
          layout={layout}
          persons={canvasPersons}
          highlightedId={highlightedId}
          onOpenPerson={open}
          onToggleCollapse={toggle}
          focusRequest={focusRequest}
        />
      </div>
    </div>
  );
};
