import { randomFamily } from '@gia-pha/tree-layout';
import { describe, expect, it } from 'vitest';
import { buildFamilyGraph } from '../family/family-graph';
import { blankPerson } from '../test-support/person';
import { autoMemberFontPx, fitPaperToFont } from './auto-fit';
import { defaultPhaDoConfig, pageSizeMm, type PhaDoConfig } from './config';
import { FRAME_LABELS, layoutDecoration, type FrameStyle } from './decoration';
import { decorationScaleOf } from './config';
import { changeDesign, refitTiming, settleDesign, type DesignChange, type DesignContext } from './design';
import { fitNamePxFor, renderPhaDo, treeLayout } from './render';

const familyOf = (size: number, seed = 5) => {
  const family = randomFamily(seed, size);
  return buildFamilyGraph({
    persons: family.persons.map((person) =>
      blankPerson({ id: person.id, full_name: person.full_name, gender: person.gender, birth_year: person.birth_year, is_progenitor: person.id === family.rootId }),
    ),
    parentLinks: family.parentLinks.map((link) => ({ ...link, kind: 'ruot' })),
    unions: family.unions.map((union, index) => ({ ...union, id: `u${index}`, status: 'con' })),
    positions: [],
  });
};

const graph = familyOf(40);
const context: DesignContext = { graph, treeName: 'họ Phạm' };
const base = defaultPhaDoConfig(1);
const decorated: PhaDoConfig = {
  ...base,
  decoration: { ...base.decoration, subtitle: 'Kính dâng tổ tiên – năm 2026', coupletLeft: 'Uống nước nhớ nguồn', coupletRight: 'Ăn quả nhớ kẻ trồng cây' },
};

/** Bộ sinh số giả ngẫu nhiên có hạt giống: cùng hạt giống cho cùng chuỗi sự kiện, lỗi tái hiện được. */
const prng = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = <T>(random: () => number, items: readonly T[]): T => items[Math.floor(random() * items.length)]!;

const FRAMES = Object.keys(FRAME_LABELS) as FrameStyle[];
const randomChange = (random: () => number, config: PhaDoConfig): DesignChange => {
  switch (Math.floor(random() * 11)) {
    case 0:
      return { kind: 'content', patch: { outsideGenerations: Math.floor(random() * 6) } };
    case 1:
      return { kind: 'content', patch: { showAvatars: random() < 0.5 } };
    case 2:
      return { kind: 'content', patch: { extraLines: pick(random, [[], ['gio'], ['que', 'doi'], ['doi']] as const).slice() as PhaDoConfig['extraLines'] } };
    case 3:
      return { kind: 'content', patch: { decoration: { ...config.decoration, frame: pick(random, FRAMES) } } };
    case 4:
      return { kind: 'content', patch: { decoration: { ...config.decoration, title: pick(random, ['', 'Gia phả họ Phạm', 'Phạm tộc phả đồ dòng họ Phạm ở Nghệ An']) } } };
    case 5:
      return { kind: 'content', patch: { decoration: { ...config.decoration, coupletLeft: pick(random, ['', 'Uống nước nhớ nguồn', 'Công đức tổ tông muôn đời sáng rạng ngời']) } } };
    case 6:
      return { kind: 'content', patch: { orientation: pick(random, ['landscape', 'portrait'] as const) } };
    case 7:
      return { kind: 'content', patch: { memberFillColor: pick(random, [null, '#ffeecc']) } };
    case 8:
      return { kind: 'paper', patch: { paper: pick(random, ['A3', 'A2', 'A1', 'A0'] as const) } };
    case 9:
      return { kind: 'auto' };
    default:
      return { kind: 'font', px: pick(random, [8, 12, 14, 20, 30]) };
  }
};

const paperOf = (config: PhaDoConfig) => JSON.stringify([config.paper, config.customWidthCm, config.customHeightCm, config.orientation]);

describe('khổ tự động với liễn câu đối', () => {
  const couplets = { coupletLeft: 'Công đức tổ tiên soi sáng muôn đời rạng', coupletRight: 'Nghĩa tình con cháu giữ gìn vạn thuở bền' };
  it.each(FRAMES.flatMap((frame) => (['portrait', 'landscape'] as const).map((orientation) => [frame, orientation] as const)))(
    '%s · %s: tìm được khổ vừa khít (liễn không chiếm hết chỗ của chú giải)',
    (frame, orientation) => {
      const config: PhaDoConfig = { ...decorated, autoPaper: true, orientation, decoration: { ...decorated.decoration, ...couplets, frame } };
      const fitted = fitPaperToFont(graph, config, context.treeName);
      expect(fitted.paper).toBe('custom');
      expect(fitNamePxFor(graph, fitted, context.treeName)!).toBeGreaterThanOrEqual(config.memberFontPx - 0.01);
    },
  );
});

describe('settleDesign', () => {
  it('lũy đẳng: đã vừa khít thì settle lần nữa không đổi gì (khổ tự động và khổ cố định)', () => {
    for (const config of [
      { ...decorated, autoPaper: true, memberFontPx: 16 },
      { ...decorated, autoPaper: false, paper: 'A2' as const },
      { ...decorated, autoPaper: true, memberFontPx: 30, orientation: 'portrait' as const },
    ]) {
      const once = settleDesign(context, config);
      expect(settleDesign(context, once)).toEqual(once);
    }
  });

  it('khổ tự động: cây vừa khít ở đúng cỡ chữ yêu cầu, trang trí không bị co', () => {
    const settled = settleDesign(context, { ...decorated, autoPaper: true, memberFontPx: 30 });
    expect(settled.paper).toBe('custom');
    const fit = fitNamePxFor(graph, settled, context.treeName)!;
    expect(fit).toBeGreaterThanOrEqual(30 - 0.01);
    expect(fit).toBeLessThan(30 * 1.01);
    expect(layoutDecoration(pageSizeMm(settled), settled.decoration, context.treeName, decorationScaleOf(settled)).fit).toBeGreaterThanOrEqual(0.999);
    expect(renderPhaDo(graph, settled, context.treeName).namePx).toBeCloseTo(30, 1);
  });

  it('khổ cố định: giữ nguyên khổ, cỡ chữ ô là cỡ vừa khổ (tối đa ~37 px)', () => {
    const settled = settleDesign(context, { ...decorated, autoPaper: false, paper: 'A2', memberFontPx: 99 });
    expect(settled.paper).toBe('A2');
    expect(settled.memberFontPx).toBe(autoMemberFontPx(graph, settled, context.treeName));
    expect(settled.memberFontPx).toBeLessThanOrEqual(37);
  });

  it('gốc đã xoá: giữ nguyên, không ném lỗi', () => {
    const config = { ...base, scope: { kind: 'branch' as const, personId: 'da-xoa' }, autoPaper: true };
    expect(settleDesign(context, config)).toEqual(config);
    expect(settleDesign(context, { ...config, autoPaper: false })).toEqual({ ...config, autoPaper: false });
  });
});

describe('changeDesign', () => {
  it('nội dung đổi bố cục: tính lại ngay', () => {
    const start = settleDesign(context, { ...decorated, autoPaper: true, memberFontPx: 30 });
    const { config, pending } = changeDesign(context, start, { kind: 'content', patch: { decoration: { ...start.decoration, frame: 'gam-hoa' } } });
    expect(pending).toBe('clear');
    expect(config.decoration.frame).toBe('gam-hoa');
    expect(config).toEqual(settleDesign(context, config));
    expect(paperOf(config)).not.toBe(paperOf(start)); // khung dày hơn chiếm chỗ → khổ đổi
  });

  it('màu và phông chữ: không đụng bố cục, không tính lại', () => {
    const start = settleDesign(context, { ...decorated, autoPaper: true, memberFontPx: 30 });
    const { config, pending } = changeDesign(context, start, { kind: 'content', patch: { memberFillColor: '#ffeecc', fontFamily: 'be-vietnam-pro' } });
    expect(pending).toBe('keep');
    expect(config).toEqual({ ...start, memberFillColor: '#ffeecc', fontFamily: 'be-vietnam-pro' });
  });

  it('gõ chữ trang trí: hiện chữ ngay, hoãn; settle sau đó bằng đúng kết quả áp dụng ngay', () => {
    const start = settleDesign(context, { ...decorated, autoPaper: true, memberFontPx: 30 });
    const patch = { decoration: { ...start.decoration, title: 'Phạm tộc phả đồ dòng họ Phạm ở Nghệ An, Việt Nam' } };
    const typed = changeDesign(context, start, { kind: 'content', patch });
    expect(typed.pending).toBe('schedule');
    expect(typed.config.decoration.title).toBe(patch.decoration.title);
    expect(paperOf(typed.config)).toBe(paperOf(start)); // chưa tính lại
    const immediate = settleDesign(context, { ...start, ...patch });
    expect(settleDesign(context, typed.config)).toEqual(immediate);
  });

  it('chọn khổ cụ thể: sang khổ cố định; chọn tự động: quay lại khổ tự tính; đổi cỡ chữ: sang tự động', () => {
    const start = settleDesign(context, { ...decorated, autoPaper: true, memberFontPx: 30 });
    const fixed = changeDesign(context, start, { kind: 'paper', patch: { paper: 'A1' } }).config;
    expect(fixed.autoPaper).toBe(false);
    expect(fixed.paper).toBe('A1');
    const auto = changeDesign(context, fixed, { kind: 'auto' }).config;
    expect(auto.autoPaper).toBe(true);
    expect(auto.paper).toBe('custom');
    const bigger = changeDesign(context, fixed, { kind: 'font', px: 24 }).config;
    expect(bigger.autoPaper).toBe(true);
    expect(fitNamePxFor(graph, bigger, context.treeName)!).toBeGreaterThanOrEqual(24 - 0.01);
  });

  it('refitTiming', () => {
    expect(refitTiming(base, { memberFillColor: '#ffffff' })).toBe('none');
    expect(refitTiming(base, { memberTextColor: null, fontFamily: 'be-vietnam-pro' })).toBe('none');
    expect(refitTiming(base, { decoration: { ...base.decoration, title: 'x' } })).toBe('later');
    expect(refitTiming(base, { decoration: { ...base.decoration, frame: 'moc' } })).toBe('now');
    expect(refitTiming(base, { decoration: { ...base.decoration, titleSize: 80 } })).toBe('now');
    expect(refitTiming(base, { extraLines: ['gio'] })).toBe('now');
    expect(refitTiming(base, { memberFillColor: '#fff', showAvatars: true })).toBe('now');
  });
});

describe('chuỗi sự kiện ngẫu nhiên: bất biến giữ nguyên sau từng bước', () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8])('hạt giống %i', (seed) => {
    const random = prng(seed);
    let config = settleDesign(context, decorated);
    // Có lần settle hoãn đang chờ (chữ vừa gõ chưa co giãn)? Mô phỏng đúng cách giao diện dùng `pending`.
    let dirty = false;
    for (let step = 0; step < 16; step += 1) {
      const before = config;
      let label: string;
      if (random() < 0.15) {
        // Hết giờ chờ: settle lần cuối.
        config = settleDesign(context, config);
        dirty = false;
        label = `bước ${step}: hết giờ chờ`;
      } else {
        const change = randomChange(random, config);
        const result = changeDesign(context, config, change);
        config = result.config;
        if (result.pending === 'clear') dirty = false;
        if (result.pending === 'schedule') dirty = true;
        label = `bước ${step}: ${JSON.stringify(change)} → ${result.pending}`;
        if (change.kind === 'content') expect(config.autoPaper, label).toBe(before.autoPaper); // đổi nội dung không đổi chế độ
        if (!config.autoPaper && change.kind === 'content') expect(config.paper, label).toBe(before.paper); // khổ cố định không tự đổi
      }
      if (dirty) continue; // chữ vừa gõ chưa vừa khít: các bất biến dưới đây chỉ đúng sau khi settle

      expect(settleDesign(context, config), label).toEqual(config); // lũy đẳng
      if (!config.autoPaper) {
        expect(config.memberFontPx, label).toBe(autoMemberFontPx(graph, config, context.treeName));
      } else {
        const fit = fitNamePxFor(graph, config, context.treeName)!;
        const page = pageSizeMm(config);
        const shortMm = Math.min(page.width, page.height);
        const atLimit = Math.max(page.width, page.height) >= 4990 || shortMm <= 101;
        if (!atLimit) {
          // Không nhỏ hơn cỡ chữ yêu cầu; không rộng hơn mức cần quá một bước làm tròn 0,1 cm (1 mm trên cạnh ngắn, có lề cho hai cạnh).
          expect(fit, label).toBeGreaterThanOrEqual(config.memberFontPx - 0.01);
          expect(fit, label).toBeLessThan(config.memberFontPx * (1 + 3 / shortMm));
        }
      }
    }
    // Cuối cùng (hết giờ chờ) luôn về đúng dạng vừa khít.
    const final = settleDesign(context, config);
    expect(settleDesign(context, final)).toEqual(final);
  });

  it('hội tụ: áp từng thay đổi một hay gộp thành một lần đều ra cùng kết quả', () => {
    const random = prng(42);
    let stepwise = settleDesign(context, { ...decorated, autoPaper: true, memberFontPx: 16 });
    const start = stepwise;
    let merged: Partial<PhaDoConfig> = {};
    for (let step = 0; step < 8; step += 1) {
      const change = randomChange(random, stepwise);
      if (change.kind !== 'content') continue;
      stepwise = settleDesign(context, changeDesign(context, stepwise, change).config);
      merged = { ...merged, ...change.patch };
    }
    expect(stepwise).toEqual(settleDesign(context, { ...start, ...merged }));
  });
});

describe('bộ nhớ: cùng kết quả, không tính lại', () => {
  it('xếp cây: cùng đầu vào dùng lại đúng kết quả cũ; đồ thị mới (dữ liệu đổi) không dùng nhầm bản của đồ thị cũ', () => {
    const rootId = graph.persons.find((person) => person.is_progenitor)!.id;
    const first = treeLayout(graph, base, rootId);
    expect(treeLayout(graph, base, rootId)).toBe(first);
    // Bố cục khác (thêm dòng) là kết quả khác; đổi màu hay khổ giấy thì không.
    expect(treeLayout(graph, { ...base, extraLines: ['gio'] }, rootId)).not.toBe(first);
    expect(treeLayout(graph, { ...base, memberFillColor: '#fff', paper: 'A3' }, rootId)).toBe(first);

    const renamed = buildFamilyGraph({
      persons: graph.persons.map((person) => (person.is_progenitor ? { ...person, full_name: 'Phạm Văn Tổ Tiên Cực Kỳ Dài Dòng Họ Phạm' } : person)),
      parentLinks: graph.parentLinks,
      unions: graph.unions,
      positions: [],
    });
    expect(treeLayout(renamed, base, rootId)).not.toBe(first);
  });

  it('bố trí trang trí: cùng đầu vào cho cùng kết quả (nhớ), khác trang hay khác chữ thì khác', () => {
    const page = { width: 841, height: 594 };
    const a = layoutDecoration(page, decorated.decoration, 'họ Phạm');
    expect(layoutDecoration(page, decorated.decoration, 'họ Phạm')).toBe(a);
    expect(layoutDecoration({ width: 594, height: 841 }, decorated.decoration, 'họ Phạm')).not.toBe(a);
    expect(layoutDecoration(page, { ...decorated.decoration, title: 'Tiêu đề khác' }, 'họ Phạm')).not.toBe(a);
    expect(layoutDecoration(page, decorated.decoration, 'họ Lê')).not.toBe(a);
  });

  it('nóng và lạnh cho cùng kết quả; tính khổ giấy cây 300 người dưới 2 giây ngay cả khi lạnh', () => {
    const large = familyOf(300, 9);
    const largeContext = { graph: large, treeName: 'họ Lê' };
    const config = { ...decorated, autoPaper: true, memberFontPx: 8, outsideGenerations: 5 };
    const startedAt = performance.now();
    const cold = settleDesign(largeContext, config);
    const coldMs = performance.now() - startedAt;
    const warmStartedAt = performance.now();
    const warm = settleDesign(largeContext, config);
    const warmMs = performance.now() - warmStartedAt;
    expect(warm).toEqual(cold);
    expect(coldMs).toBeLessThan(2000);
    expect(warmMs).toBeLessThan(coldMs);
  });
});
