import { wrapName, type LayoutNode, type TreeLayout } from '@gia-pha/tree-layout';
import { select } from 'd3-selection';
import 'd3-transition';
import { zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom';
import { memo, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { Button } from '../ui/Button';

export type CanvasPerson = { id: string; full_name: string; gender: string | null; is_deceased: boolean; lifespan: string };

type Props = {
  layout: TreeLayout;
  persons: ReadonlyMap<string, CanvasPerson>;
  highlightedId?: string | null;
  onOpenPerson: (personId: string) => void;
  onToggleCollapse: (personId: string) => void;
  /**
   * Yêu cầu đưa một Người vào giữa màn hình (gốc khi mở, kết quả tìm kiếm).
   * Mỗi yêu cầu mới là một object mới; thu/mở nhánh không làm Cây nhảy lại.
   */
  focusRequest?: FocusRequest | null;
};

export type FocusRequest = {
  personId: string;
  /** Lần mở đầu: nếu cả cây vừa màn hình mà chữ vẫn đọc được thì cho xem toàn cây. */
  preferFit?: boolean;
};

/** Dưới mức phóng này chữ trong ô quá nhỏ để đọc, nên chỉ đưa gốc vào giữa. */
const READABLE_FIT_SCALE = 0.6;

const PADDING = 48;
const MIN_SCALE = 0.05;
const MAX_SCALE = 2.5;

/** Cây gia phả vẽ bằng SVG: kéo để di chuyển, cuộn/chụm hai ngón để phóng to thu nhỏ. */
export const FamilyTreeCanvas = ({
  layout,
  persons,
  highlightedId,
  onOpenPerson,
  onToggleCollapse,
  focusRequest,
}: Props) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const groupRef = useRef<SVGGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    const group = groupRef.current;
    if (!svg || !group) return;
    const behavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([MIN_SCALE, MAX_SCALE])
      .on('zoom', (event) => {
        // Đổi transform trực tiếp trên DOM, không qua state React, để kéo mượt với hàng trăm ô.
        group.setAttribute('transform', event.transform.toString());
      });
    zoomRef.current = behavior;
    select(svg).call(behavior).on('dblclick.zoom', null);
    return () => {
      select(svg).on('.zoom', null);
    };
  }, []);

  const animateTo = useCallback((scale: number, centerX: number, centerY: number) => {
    const svg = svgRef.current;
    const behavior = zoomRef.current;
    if (!svg || !behavior) return;
    const { width, height } = svg.getBoundingClientRect();
    const transform = zoomIdentity.translate(width / 2 - centerX * scale, height / 2 - centerY * scale).scale(scale);
    select(svg).transition().duration(350).call(behavior.transform, transform);
  }, []);

  const fitToScreen = useCallback(() => {
    const svg = svgRef.current;
    if (!svg || layout.nodes.length === 0) return;
    const { width, height } = svg.getBoundingClientRect();
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.min(width / (layout.width + PADDING * 2), height / (layout.height + PADDING * 2))));
    animateTo(scale, layout.width / 2 + PADDING, layout.height / 2 + PADDING);
  }, [animateTo, layout]);

  const zoomBy = (factor: number) => {
    const svg = svgRef.current;
    const behavior = zoomRef.current;
    if (svg && behavior) select(svg).transition().duration(200).call(behavior.scaleBy, factor);
  };

  const layoutRef = useRef(layout);
  useLayoutEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  // Đưa người cần chú ý vào giữa màn hình, giữ cỡ chữ đọc được.
  useEffect(() => {
    if (!focusRequest) return;
    const current = layoutRef.current;
    const svg = svgRef.current;
    if (focusRequest.preferFit && svg) {
      const { width, height } = svg.getBoundingClientRect();
      const fit = Math.min(width / (current.width + PADDING * 2), height / (current.height + PADDING * 2), 1);
      if (fit >= READABLE_FIT_SCALE) {
        animateTo(fit, current.width / 2 + PADDING, current.height / 2 + PADDING);
        return;
      }
    }
    const { nodes } = current;
    const target =
      nodes.find((n) => n.personId === focusRequest.personId && n.role === 'blood') ??
      nodes.find((n) => n.personId === focusRequest.personId);
    if (target) animateTo(1, target.x + target.width / 2 + PADDING, target.y + target.height / 2 + PADDING);
  }, [focusRequest, animateTo]);

  return (
    <div className="relative h-full min-h-[60dvh] overflow-hidden rounded-2xl border border-line bg-paper">
      <svg
        ref={svgRef}
        className="block h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
        role="img"
        aria-label="Cây gia phả"
      >
        <g ref={groupRef}>
          <g transform={`translate(${PADDING} ${PADDING})`}>
            {layout.lines.map((line, index) => (
              <polyline
                key={index}
                points={line.points.map(([x, y]) => `${x},${y}`).join(' ')}
                fill="none"
                stroke={line.kind === 'union' ? 'var(--color-kim)' : 'var(--color-ink-muted)'}
                strokeWidth={line.kind === 'union' ? 2 : 1.5}
              />
            ))}
            {layout.nodes.map((node) => {
              const person = persons.get(node.personId);
              return person ? (
                <PersonBox
                  key={node.key}
                  node={node}
                  person={person}
                  highlighted={node.personId === highlightedId}
                  canToggle={node.role === 'blood' && node.childCount > 0}
                  onOpen={onOpenPerson}
                  onToggle={onToggleCollapse}
                />
              ) : null;
            })}
          </g>
        </g>
      </svg>

      <p className="absolute left-2 top-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-line bg-surface/95 px-3 py-1.5 text-xs text-ink-muted shadow-sm">
        <span className="flex items-center gap-1">
          <span aria-hidden="true" className="size-2.5 rounded-full border-2" style={{ borderColor: 'var(--color-kim)' }} /> Nam
        </span>
        <span className="flex items-center gap-1">
          <span aria-hidden="true" className="size-2.5 rounded-full border-2" style={{ borderColor: 'var(--color-son)' }} /> Nữ
        </span>
        <span className="flex items-center gap-1">
          <span aria-hidden="true" className="size-2.5 rounded-full border border-line" style={{ backgroundColor: 'var(--color-deceased)' }} /> Đã mất (†)
        </span>
      </p>

      {/* Một hàng sát góc dưới: chiếm ít chỗ của cây, nhất là trên điện thoại. */}
      <div
        role="toolbar"
        aria-label="Thu phóng cây"
        className="absolute bottom-2 right-2 flex items-center gap-1 rounded-2xl border border-line bg-surface/95 p-1 shadow-sm"
      >
        <Button variant="ghost" aria-label="Thu nhỏ" title="Thu nhỏ" className="size-12 text-2xl" onClick={() => zoomBy(1 / 1.3)}>
          −
        </Button>
        <Button variant="ghost" aria-label="Phóng to" title="Phóng to" className="size-12 text-2xl" onClick={() => zoomBy(1.3)}>
          +
        </Button>
        <Button variant="ghost" aria-label="Vừa màn hình" title="Vừa màn hình" className="size-12" onClick={fitToScreen}>
          <svg viewBox="0 0 24 24" className="size-6 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
          </svg>
        </Button>
      </div>
    </div>
  );
};

type BoxProps = {
  node: LayoutNode;
  person: CanvasPerson;
  highlighted: boolean;
  canToggle: boolean;
  onOpen: (personId: string) => void;
  onToggle: (personId: string) => void;
};

const NAME_CHARS = 18;

const PersonBox = memo(({ node, person, highlighted, canToggle, onOpen, onToggle }: BoxProps) => {
  const lines = wrapName(person.full_name, NAME_CHARS);
  const isSpouse = node.role === 'spouse';
  // Viền theo giới tính (nam/nữ/chưa rõ) để nhận ra ngay không cần đọc chữ; nền xám khi đã mất.
  const genderColor = person.gender === 'nu' ? 'var(--color-son)' : person.gender === 'nam' ? 'var(--color-kim)' : 'var(--color-line)';
  const fill = person.is_deceased ? 'var(--color-deceased)' : isSpouse ? 'var(--color-paper)' : 'var(--color-surface)';
  const centerX = node.x + node.width / 2;
  const toggleX = node.x + 22;
  // Căn giữa theo chiều dọc: khối chữ gồm tên (1–2 dòng) và dòng năm sinh–mất nếu có.
  const blockHeight = lines.length * 18 + (person.lifespan ? 18 : 0);
  const nameTop = node.y + (node.height - blockHeight) / 2 + 14;

  return (
    <g>
      <g
        role="button"
        tabIndex={0}
        aria-label={`${person.full_name}${person.lifespan ? `, ${person.lifespan}` : ''}`}
        className="cursor-pointer focus:outline-none [&:focus-visible>rect]:stroke-[3]"
        onClick={() => onOpen(person.id)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onOpen(person.id);
          }
        }}
      >
        <rect
          x={node.x}
          y={node.y}
          width={node.width}
          height={node.height}
          rx={10}
          fill={fill}
          stroke={highlighted ? 'var(--color-son)' : genderColor}
          strokeWidth={highlighted ? 3 : 2}
        />
        {lines.map((line, index) => (
          <text
            key={index}
            x={centerX}
            y={nameTop + index * 18}
            textAnchor="middle"
            fontSize={15}
            fontWeight={isSpouse ? 500 : 700}
            fill="var(--color-ink)"
          >
            {line}
          </text>
        ))}
        {person.lifespan && (
          <text x={centerX} y={nameTop + lines.length * 18} textAnchor="middle" fontSize={13} fill="var(--color-ink-muted)">
            {person.is_deceased ? `† ${person.lifespan}` : person.lifespan}
          </text>
        )}
      </g>

      {canToggle && (
        <g
          role="button"
          tabIndex={0}
          aria-label={node.collapsed ? `Mở ${node.hiddenChildren} con của ${person.full_name}` : `Thu gọn con cháu của ${person.full_name}`}
          className="cursor-pointer"
          onClick={() => onToggle(person.id)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onToggle(person.id);
            }
          }}
        >
          {/* Đặt ở góc trái dưới để không che chỗ bắt đầu đường hôn phối và đường xuống con. */}
          <circle cx={toggleX} cy={node.y + node.height} r={13} fill="var(--color-son)" />
          <text x={toggleX} y={node.y + node.height + 5} textAnchor="middle" fontSize={node.collapsed ? 12 : 16} fontWeight={700} fill="white">
            {node.collapsed ? `+${node.hiddenChildren}` : '−'}
          </text>
        </g>
      )}
    </g>
  );
});
PersonBox.displayName = 'PersonBox';
