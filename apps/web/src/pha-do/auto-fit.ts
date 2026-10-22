import type { Person } from '../data/trees';
import type { FamilyGraph } from '../family/family-graph';
import { CUSTOM_CM_MAX, CUSTOM_CM_MIN, FONT_PX_MAX, MEMBER_FONT_PX_MIN, type PhaDoConfig } from './config';
import { autoDecorationScale, layoutDecoration } from './decoration';
import { MM_PER_PX } from './drawing';
import { fitNamePxFor, LAYOUT_NAME_SIZE, legendHeightMm, legendWidthMm, scopeRoot, treeLayout } from './render';

/** Cỡ chữ tên tối đa trước đây (28 pt ≈ 37 px), dùng làm trần khi tự suy cỡ chữ cho một khổ giấy cố định. */
const LEGACY_MAX_NAME_PX = 28 / 0.75;

/**
 * Khổ cố định: cỡ chữ tên lớn nhất còn vừa khổ đó (làm tròn xuống số nguyên px, tối đa ~37 px như trước đây). Dùng làm cỡ chữ mặc định
 * lúc mở Phả đồ lần đầu và để chỉnh lại cỡ chữ mỗi khi nội dung đổi mà khổ giấy do người dùng chọn.
 */
export const autoMemberFontPx = (graph: FamilyGraph<Person>, config: PhaDoConfig, treeName = ''): number => {
  const fitPx = fitNamePxFor(graph, config, treeName);
  if (fitPx === null) return config.memberFontPx;
  const px = Math.min(fitPx, LEGACY_MAX_NAME_PX);
  // Nhỏ hơn 4 px (cây rất đông) thì giữ một chữ số thập phân để số hiện ra đúng với chữ đang vẽ, không nâng lên mức không chứa nổi.
  const fit = px >= 4 ? Math.floor(px) : Math.floor(px * 10) / 10;
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
export const fitPaperToFont = (graph: FamilyGraph<Person>, config: PhaDoConfig, treeName = ''): PhaDoConfig => {
  const scope = scopeRoot(graph, config);
  if (!scope) return config;
  const layout = treeLayout(graph, config, scope.rootId, scope.maxDepth);
  const mmPerUnit = (config.memberFontPx * MM_PER_PX) / LAYOUT_NAME_SIZE;
  const treeWidth = layout.width * mmPerUnit;
  const treeHeight = layout.height * mmPerUnit;
  const landscape = config.orientation === 'landscape';

  type Candidate = { cost: number; fit: number; aspect: number; shortMm: number };
  // `decoScale`: hệ số cỡ chữ trang trí của khổ tự động, phụ thuộc cạnh ngắn của khổ (chưa biết lúc đang tìm khổ) nên tìm lặp: xem bên dưới.
  const search = (decoScale: number): Candidate | null => {
    const evaluate = (aspect: number): Candidate | null => {
      const page = landscape ? { width: aspect * REF_SHORT_MM, height: REF_SHORT_MM } : { width: REF_SHORT_MM, height: aspect * REF_SHORT_MM };
      const deco = layoutDecoration(page, config.decoration, treeName, decoScale);
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

    let found: Candidate | null = null;
    for (const aspect of COARSE_ASPECTS) {
      const candidate = evaluate(aspect);
      if (candidate && isBetter(candidate, found)) found = candidate;
    }
    if (found) {
      const center = found.aspect;
      for (let aspect = Math.max(1, center - FINE_SPAN); aspect <= Math.min(4, center + FINE_SPAN) + 1e-9; aspect += FINE_STEP) {
        const candidate = evaluate(aspect);
        if (candidate && isBetter(candidate, found)) found = candidate;
      }
    }
    return found;
  };

  // Cỡ chữ trang trí giảm theo cạnh ngắn của khổ (khổ càng to, chữ càng nhỏ so với trang), còn cạnh ngắn lại phụ thuộc cỡ chữ trang trí: lặp vài lần
  // cho tới khi hệ số ổn định (hệ số chỉ phụ thuộc cạnh ngắn^-0,3 nên hội tụ rất nhanh).
  let decoScale = 1;
  let best = search(decoScale);
  for (let attempt = 0; config.autoPaper && best && attempt < 4; attempt += 1) {
    const next = autoDecorationScale(best.shortMm);
    if (Math.abs(next - decoScale) < 0.005) break;
    decoScale = next;
    best = search(decoScale) ?? best;
  }
  if (!best) return config;

  // Khổ tự nhập nằm trong khoảng cho phép, chiều dài theo đúng tỉ lệ đã chọn; số đo làm tròn lên 0,1 cm.
  const landscapeLong = (shortCm: number) => Math.min(CUSTOM_CM_MAX, roundUpCm(shortCm * 10 * best!.aspect));
  const buildCm = (shortCm: number): PhaDoConfig => {
    const short = Math.min(CUSTOM_CM_MAX / best!.aspect, Math.max(CUSTOM_CM_MIN, shortCm));
    const shortRounded = Math.min(CUSTOM_CM_MAX, Math.round(short * 10) / 10);
    const long = landscapeLong(shortRounded);
    return { ...config, paper: 'custom', customWidthCm: landscape ? long : shortRounded, customHeightCm: landscape ? shortRounded : long };
  };
  const shortCmOf = (candidate: PhaDoConfig) => (landscape ? candidate.customHeightCm : candidate.customWidthCm);
  const fitOf = (candidate: PhaDoConfig) => fitNamePxFor(graph, candidate, treeName);
  const enough = (candidate: PhaDoConfig) => {
    const fit = fitOf(candidate);
    return fit === null || fit >= config.memberFontPx - 0.01;
  };

  // 1) Ước lượng ban đầu, rồi đo lại bằng chính phép đo của bản vẽ và bù cho tới khi sát cỡ chữ yêu cầu (chỉ xếp cây và bố trí trang trí, đều có nhớ).
  let result = buildCm(roundUpCm(best.shortMm) );
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const fit = fitOf(result);
    if (fit === null || (fit >= config.memberFontPx - 0.01 && fit <= config.memberFontPx * 1.01)) break;
    const next = buildCm(roundUpCm(shortCmOf(result) * 10 * (config.memberFontPx / fit)));
    if (next.customWidthCm === result.customWidthCm && next.customHeightCm === result.customHeightCm) break;
    result = next;
  }
  // 2) Không bao giờ nhỏ hơn cỡ chữ yêu cầu: làm tròn 0,1 cm có thể dừng ngay dưới mức đó, nên tăng từng 0,1 cm cho tới khi đủ (hoặc chạm trần khổ tự nhập).
  for (let guard = 0; guard < 40 && !enough(result); guard += 1) {
    const next = buildCm(shortCmOf(result) + 0.1);
    if (next.customWidthCm === result.customWidthCm && next.customHeightCm === result.customHeightCm) break;
    result = next;
  }
  // 3) Và không rộng hơn mức cần: bớt từng 0,1 cm khi cỡ chữ vẫn đủ.
  for (let guard = 0; guard < 8; guard += 1) {
    const next = buildCm(shortCmOf(result) - 0.1);
    if ((next.customWidthCm === result.customWidthCm && next.customHeightCm === result.customHeightCm) || !enough(next)) break;
    result = next;
  }
  return result;
};
