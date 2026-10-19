import type { TreeRole } from './trees';

/** Quyền theo Vai trò, dùng để ẩn/hiện nút trên giao diện. Quyền thật do RLS trong database quyết định (ADR 0001). */
export const canEditTree = (role: TreeRole | undefined): boolean => role === 'owner' || role === 'editor';
export const isTreeOwner = (role: TreeRole | undefined): boolean => role === 'owner';
