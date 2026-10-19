import { describe, expect, it } from 'vitest';
import { canEditEvent, canEditTree, isTreeOwner, personPermissions } from './permissions';

const person = (extra: Partial<{ created_by: string | null; pending_delete_by: string | null }> = {}) => ({ created_by: 'bt1', pending_delete_by: null, ...extra });

describe('quyền theo Vai trò', () => {
  it('Chủ sở hữu và Biên tập viên sửa được gia phả; Người xem và người ngoài thì không', () => {
    expect(canEditTree('owner') && canEditTree('editor')).toBe(true);
    expect(canEditTree('viewer') || canEditTree(undefined)).toBe(false);
    expect(isTreeOwner('owner') && !isTreeOwner('editor')).toBe(true);
  });
});

describe('personPermissions (khớp luật RLS của persons)', () => {
  it('Chủ sở hữu: sửa và xoá ngay mọi Người, không gửi yêu cầu', () => {
    expect(personPermissions('owner', 'chu', person())).toMatchObject({ edit: true, deleteNow: true, requestDelete: false });
  });

  it('Biên tập viên: chỉ Người mình tạo; xoá phải gửi yêu cầu, một lần', () => {
    expect(personPermissions('editor', 'bt1', person())).toMatchObject({ edit: true, deleteNow: false, requestDelete: true });
    expect(personPermissions('editor', 'bt2', person())).toMatchObject({ edit: false, requestDelete: false });
    expect(personPermissions('editor', 'bt1', person({ pending_delete_by: 'bt1' }))).toMatchObject({ edit: true, requestDelete: false, involvedInDeletion: true });
  });

  it('Người xem và người chưa đăng nhập không có quyền nào', () => {
    for (const rights of [personPermissions('viewer', 'bt1', person()), personPermissions('editor', null, person({ created_by: null }))]) {
      expect(rights).toMatchObject({ edit: false, deleteNow: false, requestDelete: false, reviewDeletion: false });
    }
  });

  it('duyệt yêu cầu xoá: chỉ Chủ sở hữu, và chỉ khi có yêu cầu; người khác không "dính" vào yêu cầu', () => {
    expect(personPermissions('owner', 'chu', person({ pending_delete_by: 'bt1' }))).toMatchObject({ reviewDeletion: true, involvedInDeletion: true });
    expect(personPermissions('owner', 'chu', person())).toMatchObject({ reviewDeletion: false });
    expect(personPermissions('editor', 'bt2', person({ pending_delete_by: 'bt1' })).involvedInDeletion).toBe(false);
  });
});

describe('canEditEvent (khớp RLS tree_events)', () => {
  it('Chủ sở hữu mọi Sự kiện; Biên tập viên chỉ Sự kiện mình tạo; Người xem không', () => {
    expect(canEditEvent('owner', 'chu', { created_by: 'bt1' })).toBe(true);
    expect(canEditEvent('editor', 'bt1', { created_by: 'bt1' })).toBe(true);
    expect(canEditEvent('editor', 'bt2', { created_by: 'bt1' })).toBe(false);
    expect(canEditEvent('viewer', 'bt1', { created_by: 'bt1' })).toBe(false);
    expect(canEditEvent('editor', null, { created_by: null })).toBe(false);
  });
});
