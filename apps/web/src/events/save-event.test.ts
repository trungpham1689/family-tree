import { describe, expect, it } from 'vitest';
import { saveEventWithPhotos } from './save-event';

const file = (name: string) => new File(['x'], name, { type: 'image/png' });

const ports = (options: { saveFails?: boolean; failOn?: string } = {}) => {
  const calls: string[] = [];
  return {
    calls,
    saveEvent: async (eventId: string | null, fields: { title: string }) => {
      calls.push(`save:${eventId ?? 'new'}:${fields.title}`);
      if (options.saveFails) throw new Error('không lưu được');
      return eventId ?? 'sk-1';
    },
    uploadPhoto: async (eventId: string, photo: File) => {
      calls.push(`upload:${eventId}:${photo.name}`);
      if (photo.name === options.failOn) throw new Error('ảnh lỗi');
    },
  };
};

describe('saveEventWithPhotos', () => {
  it('lưu Sự kiện rồi tải lần lượt từng ảnh vào Sự kiện vừa tạo', async () => {
    const p = ports();
    const outcome = await saveEventWithPhotos(p, { eventId: null, fields: { title: 'Giỗ' }, files: [file('a'), file('b')] });
    expect(outcome).toEqual({ status: 'saved', eventId: 'sk-1' });
    expect(p.calls).toEqual(['save:new:Giỗ', 'upload:sk-1:a', 'upload:sk-1:b']);
  });

  it('Sự kiện không lưu được thì không tải ảnh nào', async () => {
    const p = ports({ saveFails: true });
    const outcome = await saveEventWithPhotos(p, { eventId: null, fields: { title: 'Giỗ' }, files: [file('a')] });
    expect(outcome).toEqual({ status: 'event-failed', error: 'không lưu được' });
    expect(p.calls).toEqual(['save:new:Giỗ']);
  });

  it('ảnh lỗi giữa chừng: dừng ở ảnh đó, trả ảnh chưa tải và id để Lưu lại không tạo thêm Sự kiện', async () => {
    const p = ports({ failOn: 'b' });
    const files = [file('a'), file('b'), file('c')];
    const outcome = await saveEventWithPhotos(p, { eventId: null, fields: { title: 'Giỗ' }, files });
    expect(outcome.status).toBe('photos-failed');
    if (outcome.status !== 'photos-failed') return;
    expect(outcome).toMatchObject({ eventId: 'sk-1', error: 'ảnh lỗi' });
    expect(outcome.remaining).toEqual([files[1], files[2]]);
    expect(p.calls).toEqual(['save:new:Giỗ', 'upload:sk-1:a', 'upload:sk-1:b']);

    // Lưu lại với id đã có: cập nhật Sự kiện cũ, tải tiếp các ảnh còn lại.
    const retry = ports();
    const again = await saveEventWithPhotos(retry, { eventId: outcome.eventId, fields: { title: 'Giỗ' }, files: outcome.remaining });
    expect(again).toEqual({ status: 'saved', eventId: 'sk-1' });
    expect(retry.calls).toEqual(['save:sk-1:Giỗ', 'upload:sk-1:b', 'upload:sk-1:c']);
  });

  it('không có ảnh: chỉ lưu Sự kiện', async () => {
    const p = ports();
    expect(await saveEventWithPhotos(p, { eventId: 'sk-9', fields: { title: 'x' }, files: [] })).toEqual({ status: 'saved', eventId: 'sk-9' });
    expect(p.calls).toEqual(['save:sk-9:x']);
  });
});
