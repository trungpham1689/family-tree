import { useRef, useState, type ChangeEvent } from 'react';
import { checkImageFile, IMAGE_MIME_TYPES, MAX_PHOTOS_PER_PERSON, PHOTO_SPECS, type PersonPhoto, type PhotoKind } from '../data/photos';
import {
  useAvatarDataUrl,
  usePersonPhotos,
  useRemovePhoto,
  useSetAvatarPhoto,
  useUpdatePhotoCaption,
  useUploadPhoto,
} from '../data/tree-queries';
import { Button } from '../ui/Button';
import { ErrorBanner } from '../ui/fields';

/** Nút chọn ảnh + khuyến nghị kích thước/giới hạn; kiểm file ngay khi chọn rồi gọi `onPick`. */
export const ImagePicker = ({
  kind,
  label,
  pending,
  onPick,
  error,
}: {
  kind: PhotoKind;
  label: string;
  pending: boolean;
  onPick: (file: File) => void;
  error?: string | undefined;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pickError, setPickError] = useState<string | null>(null);

  const pick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const problem = checkImageFile(file);
    setPickError(problem);
    if (!problem) onPick(file);
  };

  return (
    <div>
      <Button variant="secondary" disabled={pending} onClick={() => inputRef.current?.click()}>
        {pending ? 'Đang tải lên…' : label}
      </Button>
      <input ref={inputRef} type="file" accept={IMAGE_MIME_TYPES.join(',')} className="hidden" onChange={pick} />
      <p className="mt-1.5 text-sm text-ink-muted">{PHOTO_SPECS[kind].hint}</p>
      {(pickError ?? error) && <ErrorBanner>{pickError ?? error}</ErrorBanner>}
    </div>
  );
};

/**
 * Mục "Ảnh tư liệu": tối đa vài ảnh/người (giới hạn ở database), chú thích, chọn một ảnh làm đại diện.
 * `canEdit` bật nút tải lên/đổi/xoá — dùng trong "Sửa thông tin"; ở trang Người chỉ xem.
 */
export const PhotoGallery = ({ treeId, personId, canEdit }: { treeId: string; personId: string; canEdit: boolean }) => {
  const photos = usePersonPhotos(personId);
  const upload = useUploadPhoto(treeId, personId);

  if (!canEdit && (photos.data?.length ?? 0) === 0) return null;

  return (
    <section className={canEdit ? '' : 'mt-8'}>
      <h2 className="font-serif text-xl font-bold">Ảnh tư liệu</h2>
      {canEdit && (photos.data?.length ?? 0) >= MAX_PHOTOS_PER_PERSON && (
        <p className="mt-2 text-sm text-ink-muted">Đã đủ {MAX_PHOTOS_PER_PERSON} ảnh. Xoá bớt một ảnh nếu muốn thêm ảnh khác.</p>
      )}
      {canEdit && (photos.data?.length ?? 0) < MAX_PHOTOS_PER_PERSON && (
        <div className="mt-2">
          <ImagePicker
            kind="member"
            label={`+ Thêm ảnh (${photos.data?.length ?? 0}/${MAX_PHOTOS_PER_PERSON})`}
            pending={upload.isPending}
            error={upload.error?.message}
            onPick={(file) => upload.mutate({ treeId, personId, file, caption: null, setAsAvatar: (photos.data?.length ?? 0) === 0 })}
          />
        </div>
      )}
      {photos.isSuccess && photos.data.length === 0 && <p className="mt-2 text-ink-muted">Chưa có ảnh.</p>}
      {photos.isSuccess && photos.data.length > 0 && (
        <ul className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {photos.data.map((photo) => (
            <PhotoCard key={photo.id} treeId={treeId} personId={personId} photo={photo} canEdit={canEdit} />
          ))}
        </ul>
      )}
    </section>
  );
};

const PhotoCard = ({ treeId, personId, photo, canEdit }: { treeId: string; personId: string; photo: PersonPhoto; canEdit: boolean }) => {
  const image = useAvatarDataUrl(photo.storage_path);
  const setAvatar = useSetAvatarPhoto(treeId, personId);
  const updateCaption = useUpdatePhotoCaption(treeId, personId);
  const remove = useRemovePhoto(treeId, personId);
  const [caption, setCaption] = useState(photo.caption ?? '');
  // Đặt đại diện, sửa chú thích, xoá cùng tác động một ảnh: đang gọi cái nào thì khoá các nút còn lại.
  const busy = setAvatar.isPending || updateCaption.isPending || remove.isPending;

  return (
    <li className="space-y-1.5">
      <div className="aspect-square overflow-hidden rounded-xl border border-line bg-paper">
        {image.data && <img src={image.data} alt={photo.caption ?? ''} className="size-full object-cover" />}
      </div>
      {canEdit ? (
        <input
          aria-label="Chú thích ảnh"
          placeholder="Chú thích…"
          className="w-full rounded-lg border border-line bg-surface px-2 py-1 text-sm"
          value={caption}
          readOnly={remove.isPending}
          onChange={(event) => setCaption(event.target.value)}
          onBlur={() => {
            if (!busy && caption !== (photo.caption ?? '')) updateCaption.mutate({ photoId: photo.id, caption: caption.trim() || null });
          }}
        />
      ) : (
        photo.caption && <p className="text-sm text-ink-muted">{photo.caption}</p>
      )}
      {canEdit && (
        <div className="flex items-center justify-between text-sm">
          {photo.is_avatar ? (
            <span className="font-semibold text-son">Ảnh đại diện</span>
          ) : (
            <button
              type="button"
              className="font-semibold text-son hover:underline disabled:text-ink-muted"
              disabled={busy}
              onClick={() => setAvatar.mutate(photo.id)}
            >
              Đặt làm đại diện
            </button>
          )}
          <button
            type="button"
            className="text-danger hover:underline disabled:text-ink-muted"
            disabled={busy}
            onClick={() => remove.mutate({ photoId: photo.id, path: photo.storage_path })}
          >
            Xoá
          </button>
        </div>
      )}
      {(setAvatar.isError || updateCaption.isError || remove.isError) && (
        <p className="text-sm text-danger">{setAvatar.error?.message ?? updateCaption.error?.message ?? remove.error?.message}</p>
      )}
    </li>
  );
};
