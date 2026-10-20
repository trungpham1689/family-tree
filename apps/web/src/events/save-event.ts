/** Việc ngoài mà luồng lưu cần: lưu Sự kiện (trả id) và tải một ảnh lên Sự kiện đó. Ném lỗi khi thất bại. */
export type SaveEventPorts<Fields> = {
  saveEvent: (eventId: string | null, fields: Fields) => Promise<string>;
  uploadPhoto: (eventId: string, file: File) => Promise<void>;
};

export type SaveEventOutcome =
  /** Sự kiện và mọi ảnh đã lưu. */
  | { status: 'saved'; eventId: string }
  /** Sự kiện không lưu được, chưa tải ảnh nào. */
  | { status: 'event-failed'; error: string }
  /** Sự kiện đã lưu (dùng lại `eventId` ở lần Lưu sau để cập nhật chứ không tạo thêm); `remaining` là ảnh chưa tải lên, theo thứ tự cũ. */
  | { status: 'photos-failed'; eventId: string; remaining: File[]; error: string };

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Lưu một Sự kiện rồi tải lần lượt các ảnh chọn kèm. Sự kiện lưu trước và không bị huỷ khi ảnh lỗi: tải dừng ở ảnh lỗi đầu tiên, trả về
 * ảnh chưa tải để bấm Lưu thử lại (với `eventId` đã có). Không bao giờ ném lỗi — mọi kết cục là một `SaveEventOutcome`.
 */
export const saveEventWithPhotos = async <Fields>(
  ports: SaveEventPorts<Fields>,
  input: { eventId: string | null; fields: Fields; files: readonly File[] },
): Promise<SaveEventOutcome> => {
  let eventId: string;
  try {
    eventId = await ports.saveEvent(input.eventId, input.fields);
  } catch (error) {
    return { status: 'event-failed', error: messageOf(error) };
  }
  for (const [index, file] of input.files.entries()) {
    try {
      await ports.uploadPhoto(eventId, file);
    } catch (error) {
      return { status: 'photos-failed', eventId, remaining: input.files.slice(index), error: messageOf(error) };
    }
  }
  return { status: 'saved', eventId };
};
