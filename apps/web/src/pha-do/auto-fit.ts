import type { Person } from '../data/trees';
import type { FamilyGraph } from '../family/family-graph';
import { CUSTOM_CM_MAX, CUSTOM_CM_MIN, FONT_PX_MAX, FONT_PX_MIN, type PhaDoConfig } from './config';
import { layoutDecoration } from './decoration';
import { MM_PER_PX } from './drawing';
import { LAYOUT_NAME_SIZE, legendHeightMm, renderPhaDo, scopeRoot, treeLayout } from './render';

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
  return personCount === 0 ? config.memberFontPx : Math.min(FONT_PX_MAX, Math.max(FONT_PX_MIN, Math.floor(namePx)));
};

const REF_SHORT_MM = 1000;
/** Tỉ lệ cạnh dài / cạnh ngắn được thử: vuông đến 4:1. */
const ASPECTS = Array.from({ length: 151 }, (_, index) => 1 + index * 0.02);
/** Quá 2:1 thành dải băng khó in, khó treo nên bị phạt nặng; chỉ được chọn khi tiêu đề/câu đối dài không còn cách nào khác. */
const WIDE_ASPECT = 2;
const WIDE_PENALTY = 3;
const IDEAL_ASPECT = Math.SQRT2;
/** Chú giải (Nam/Nữ/…) rộng khoảng 180 mm trên khổ A1 (cạnh ngắn 594 mm); vùng cây phải rộng hơn thế. */
const LEGEND_WIDTH_RATIO = 180 / 594;

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

  let best: { cost: number; fit: number; aspect: number; shortMm: number } | null = null;
  for (const aspect of ASPECTS) {
    const page = landscape ? { width: aspect * REF_SHORT_MM, height: REF_SHORT_MM } : { width: REF_SHORT_MM, height: aspect * REF_SHORT_MM };
    const deco = layoutDecoration(page, config.decoration, treeName);
    const width = deco.content.width;
    const height = deco.content.height - legendHeightMm(page);
    if (width <= LEGEND_WIDTH_RATIO * REF_SHORT_MM || height <= 0) continue;
    const shortMm = REF_SHORT_MM * Math.max(treeWidth / width, treeHeight / height);
    const cost = aspect * shortMm * shortMm * (1 + 0.03 * Math.abs(Math.log(aspect / IDEAL_ASPECT))) * (aspect > WIDE_ASPECT ? WIDE_PENALTY : 1);
    // Ưu tiên tỉ lệ không chữ trang trí nào bị co; nếu không tỉ lệ nào được thì chọn tỉ lệ co ít nhất.
    const better = !best || (deco.fit >= 0.999 ? best.fit < 0.999 || cost < best.cost : best.fit < 0.999 && deco.fit > best.fit);
    if (better) best = { cost, fit: deco.fit, aspect, shortMm };
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
