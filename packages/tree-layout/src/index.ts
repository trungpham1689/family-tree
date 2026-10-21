export {
  DEFAULT_BOX,
  layoutTree,
  marriageExtraLines,
  MARRIAGE_LINE_HEIGHT,
  type ChildFilter,
  type LayoutLine,
  type LayoutNode,
  type LayoutOptions,
  type LayoutParentLink,
  type LayoutPerson,
  type LayoutUnion,
  type NodeMarriage,
  type Orientation,
  type TreeLayout,
} from './layout.ts';
export { NAME_CHARS, wrapName } from './text.ts';
export { outsideDepthOfChild, outsideGenerationsFilter } from './descent-filter.ts';
/** Chỉ dùng cho test và đo hiệu năng. */
export { randomFamily, type RandomFamily } from './random-family.ts';
