import type { Person } from '../data/trees';
import type { FamilyGraph } from '../family/family-graph';
import { CUSTOM_CM_MAX, CUSTOM_CM_MIN, FONT_PX_MAX, MEMBER_FONT_PX_MIN, type PhaDoConfig } from './config';
import { layoutDecoration } from './decoration';
import { MM_PER_PX } from './drawing';
import { LAYOUT_NAME_SIZE, legendHeightMm, legendWidthMm, renderPhaDo, scopeRoot, treeLayout } from './render';

/** Cỡ chữ tên tối đa trước đây (28 pt ≈ 37 px), dùng làm trần khi tự suy cỡ chữ cho một khổ giấy cố định. */
const LEGACY_MAX_NAME_PX = 28 / 0.75;

/**
 * Khổ cố định: cỡ chữ tên lớn nhất còn vừa khổ đó (làm tròn xuống số nguyên px, tối đa ~37 px như trước đây). Dùng làm cỡ chữ mặc định
 * lúc mở Phả đồ lần đầu và để chỉnh lại cỡ chữ mỗi khi nội dung đổi mà khổ giấy do người dùng chọn.
 */
export const autoMemberFontPx = (
  graph: FamilyGraph<Person>,
  config: PhaDoConfig,
  treeName = '',
  avatarUrls?: ReadonlyMap<string, string>,
): number => {
  const { namePx, personCount } = renderPhaDo(graph, { ...config, memberFontPx: LEGACY_MAX_NAME_PX }, treeName, avatarUrls);
  if (personCount === 0) return config.memberFontPx;
  // Nhỏ hơn 4 px (cây rất đông) thì giữ một chữ số thập phân để số hiện ra đúng với chữ đang vẽ, không nâng lên mức không chứa nổi.
  const fit = namePx >= 4 ? Math.floor(namePx) : Math.floor(namePx * 10) / 10;
  return Math.min(FONT_PX_MAX, Math.max(MEMBER_FONT_PX_MIN, fit));
};

const REF_SHORT_MM = 1000;
/** Tỉ lệ cạnh dài / cạnh ngắn được thử: vuông đến 4:1, quét thô rồi quét mịn quanh tỉ lệ tốt nhất (ít lần dựng khung hơn quét mịn cả khoảng). */
const COARSE_ASPECTS = Array.from({ length: 31 }, (_, index) => 1 + index * 0.1);
const FINE_STEP = 0.02;
const FINE_SPAN = 0.1;
/** Quá 2:1 thành dải băng khó in, khó treo nên bị phạt nặng; chỉ được chọn khi tiêu đề/câu đối dài không còn cách nào khác. */
const WIDE_ASPECT = 2;
const WIDE_PENALTY = 3;
const IDEAL_ASPECT = Math.SQRT2;

const roundUpCm = (mm: number) => Math.ceil(mm / 10 * 10 - 1e-9) / 10;

/**
 * Khổ giấy tự tính cho vừa khít nội dung ở cỡ chữ tên `memberFontPx`: cây (mọi ô), tiêu đề, phụ đề, câu đối và chú giải đều nằm gọn trong
 * khung trang trí, không chữ nào phải co lại, không còn khoảng trống thừa. Cả tỉ lệ khung cũng được chọn: thử các tỉ lệ cạnh dài/ngắn từ 1 đến 4
 * (giữ hướng ngang/dọc người dùng chọn), lấy tỉ lệ cho khổ nhỏ nhất, hơi ưu tiên tỉ lệ khổ A. Mọi kích thước trang trí tỉ lệ theo cạnh ngắn nên
 * mỗi tỉ lệ chỉ cần tính một lần ở trang tham chiếu rồi nhân. Kết quả luôn là khổ "Tự nhập", Rộng/Cao tính bằng cm (làm tròn lên 0,1) trong 10–500 cm.
 */
export const fitPaperToFont = (
  graph: FamilyGraph<Person>,
  config: PhaDoConfig,
  treeName = '',
  avatarUrls?: ReadonlyMap<string, string>,
): PhaDoConfig => {
  const scope = scopeRoot(graph, config);
  if (!scope) return config;
  const layout = treeLayout(graph, config, scope.rootId, scope.maxDepth);
  const mmPerUnit = (config.memberFontPx * MM_PER_PX) / LAYOUT_NAME_SIZE;
  const treeWidth = layout.width * mmPerUnit;
  const treeHeight = layout.height * mmPerUnit;
  const landscape = config.orientation === 'landscape';

  type Candidate = { cost: number; fit: number; aspect: number; shortMm: number };
  const evaluate = (aspect: number): Candidate | null => {
    const page = landscape ? { width: aspect * REF_SHORT_MM, height: REF_SHORT_MM } : { width: REF_SHORT_MM, height: aspect * REF_SHORT_MM };
    const deco = layoutDecoration(page, config.decoration, treeName);
    const width = deco.content.width;
    const height = deco.content.height - legendHeightMm(page);
    if (width <= legendWidthMm(page) || height <= 0) return null;
    const shortMm = REF_SHORT_MM * Math.max(treeWidth / width, treeHeight / height);
    const cost = aspect * shortMm * shortMm * (1 + 0.03 * Math.abs(Math.log(aspect / IDEAL_ASPECT))) * (aspect > WIDE_ASPECT ? WIDE_PENALTY : 1);
    return { cost, fit: deco.fit, aspect, shortMm };
  };
  // Ưu tiên tỉ lệ không chữ trang trí nào bị co; nếu không tỉ lệ nào được thì chọn tỉ lệ co ít nhất.
  const isBetter = (candidate: Candidate, current: Candidate | null) =>
    !current || (candidate.fit >= 0.999 ? current.fit < 0.999 || candidate.cost < current.cost : current.fit < 0.999 && candidate.fit > current.fit);

  let best: Candidate | null = null;
  for (const aspect of COARSE_ASPECTS) {
    const candidate = evaluate(aspect);
    if (candidate && isBetter(candidate, best)) best = candidate;
  }
  if (best) {
    const center = best.aspect;
    for (let aspect = Math.max(1, center - FINE_SPAN); aspect <= Math.min(4, center + FINE_SPAN) + 1e-9; aspect += FINE_STEP) {
      const candidate = evaluate(aspect);
      if (candidate && isBetter(candidate, best)) best = candidate;
    }
  }
  if (!best) return config;

  // Giữ trong khoảng khổ tự nhập mà không đổi tỉ lệ.
  const clamp = (shortMm: number, aspect: number) =>
    Math.min((CUSTOM_CM_MAX * 10) / aspect, Math.max(CUSTOM_CM_MIN * 10, shortMm));
  const build = (shortMm: number, aspect: number): PhaDoConfig => {
    const short = clamp(shortMm, aspect);
    const long = Math.min(CUSTOM_CM_MAX, roundUpCm(short * aspect));
    const shortCm = Math.min(CUSTOM_CM_MAX, roundUpCm(short));
    return { ...config, paper: 'custom', customWidthCm: landscape ? long : shortCm, customHeightCm: landscape ? shortCm : long };
  };

  // Làm tròn 0,1 cm và các phép đo gần đúng có thể lệch chút ít: đo lại bằng bản vẽ thật rồi bù cho tới khi vừa khít.
  let result = build(best.shortMm, best.aspect);
  let shortMm = best.shortMm;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { fitNamePx, personCount } = renderPhaDo(graph, result, treeName, avatarUrls);
    if (personCount === 0 || (fitNamePx >= config.memberFontPx - 0.01 && fitNamePx <= config.memberFontPx * 1.01)) break;
    shortMm *= config.memberFontPx / fitNamePx;
    const next = build(shortMm, best.aspect);
    if (next.customWidthCm === result.customWidthCm && next.customHeightCm === result.customHeightCm) break;
    result = next;
  }
  return result;
};

/**
 * Một thay đổi cấu hình cần co giãn lại khi nào:
 * - `none`: không đụng tới bố cục (màu ô, phông chữ);
 * - `later`: chỉ đổi chữ tiêu đề/phụ đề/câu đối (gõ từng phím), chờ gõ xong mới tính lại;
 * - `now`: mọi thay đổi khác.
 */
export const refitTiming = (config: PhaDoConfig, patch: Partial<PhaDoConfig>): 'none' | 'later' | 'now' => {
  const keys = Object.keys(patch) as (keyof PhaDoConfig)[];
  if (keys.every((key) => key === 'memberTextColor' || key === 'memberFillColor' || key === 'fontFamily')) return 'none';
  const next = patch.decoration;
  if (keys.length === 1 && next) {
    // Chỉ khác ở các chữ (không khác khung, cỡ chữ): so các trường còn lại.
    const sameLayout = (['frame', 'titleSize', 'subtitleSize', 'coupletSize'] as const).every((key) => next[key] === config.decoration[key]);
    if (sameLayout) return 'later';
  }
  return 'now';
};

/**
 * Áp một thay đổi lên cấu hình: tính lại khổ giấy/cỡ chữ ngay (`now`), hoặc giữ nguyên bố cục (`none`), hoặc chờ gõ xong (`later`, `deferred` = true:
 * bên gọi lên lịch gọi `refit` sau một lúc).
 */
export const applyConfigChange = (
  config: PhaDoConfig,
  patch: Partial<PhaDoConfig>,
  refit: (next: PhaDoConfig) => PhaDoConfig,
): { next: PhaDoConfig; deferred: boolean } => {
  const next = { ...config, ...patch };
  const timing = refitTiming(config, patch);
  return timing === 'now' ? { next: refit(next), deferred: false } : { next, deferred: timing === 'later' };
};
