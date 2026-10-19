import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import {
  useAvatarDataUrl,
  useDeleteTree,
  useRemoveTreePhoto,
  useRenameTree,
  useSetTreePhoto,
  useSweepOrphanPhotos,
} from '../data/tree-queries';
import type { BackupProgress } from '../backup/download-backup';
import { ImagePicker } from '../people/PersonPhotos';
import type { Person, TreeWithRole } from '../data/trees';
import type { FamilyGraph } from '../family/family-graph';
import { toIsoDate, todayInVietnam } from '../calendar/month-grid';
import { downloadFamily } from '../excel/xlsx-io';
import { Button } from '../ui/Button';
import { ErrorBanner, TextAreaField, TextField } from '../ui/fields';

/** Dọn file ảnh mồ côi trên Google Drive (sót lại khi xoá ảnh lỗi hoặc ảnh dư khi gộp người trùng); chỉ Chủ sở hữu. */
export const SweepPhotosButton = ({ tree }: { tree: TreeWithRole }) => {
  const sweep = useSweepOrphanPhotos(tree.id);
  return (
    <>
      <Button variant="secondary" disabled={sweep.isPending} onClick={() => sweep.mutate()}>
        {sweep.isPending ? 'Đang dọn…' : 'Dọn ảnh mồ côi trên Drive'}
      </Button>
      {sweep.isError && <ErrorBanner>{sweep.error.message}</ErrorBanner>}
      {sweep.isSuccess && (
        <p role="status" className="basis-full text-sm text-ink-muted">
          {sweep.data === 0 ? 'Không có ảnh mồ côi.' : `Đã xoá ${sweep.data} file ảnh không còn được dùng.`}
        </p>
      )}
    </>
  );
};

/** Tải một file .zip chứa toàn bộ dữ liệu và ảnh của gia phả để lưu trên máy. */
export const BackupButton = ({ tree }: { tree: TreeWithRole }) => {
  const [progress, setProgress] = useState<BackupProgress | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const label = !progress
    ? `Tải tất cả dữ liệu của ${tree.name}`
    : progress.stage === 'images' && progress.total
      ? `Đang tải ảnh ${progress.done}/${progress.total}…`
      : progress.stage === 'zip'
        ? 'Đang đóng gói…'
        : 'Đang tải dữ liệu…';

  const run = async () => {
    setMessage(null);
    setProgress({ stage: 'data' });
    try {
      const { downloadFullBackup } = await import('../backup/download-backup');
      const failed = await downloadFullBackup(tree, toIsoDate(todayInVietnam()), setProgress);
      setMessage(
        failed === 0
          ? { tone: 'ok', text: 'Đã tải file sao lưu (.zip) về máy.' }
          : { tone: 'error', text: `Đã tải file sao lưu, nhưng ${failed} ảnh không tải được (xem HUONG-DAN.txt trong file).` },
      );
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Không tạo được file sao lưu. Hãy thử lại.' });
    } finally {
      setProgress(null);
    }
  };

  return (
    <>
      <Button variant="secondary" disabled={progress !== null} onClick={run}>
        {label}
      </Button>
      {message?.tone === 'error' && <ErrorBanner>{message.text}</ErrorBanner>}
      {message?.tone === 'ok' && <p role="status" className="basis-full text-sm text-ink-muted">{message.text}</p>}
    </>
  );
};

export const ExportButton = ({ tree, graph }: { tree: TreeWithRole; graph: FamilyGraph<Person> }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportNow = async () => {
    setBusy(true);
    setError(null);
    try {
      await downloadFamily(tree.name, graph, toIsoDate(todayInVietnam()));
    } catch {
      setError('Không tạo được file Excel. Hãy thử lại.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="secondary" disabled={busy} onClick={exportNow}>
        {busy ? 'Đang tạo file…' : 'Xuất Excel'}
      </Button>
      {error && <ErrorBanner>{error}</ErrorBanner>}
    </>
  );
};

export const RenameForm = ({ tree, onDone }: { tree: TreeWithRole; onDone: () => void }) => {
  const rename = useRenameTree(tree.id);
  const [name, setName] = useState(tree.name);
  const [description, setDescription] = useState(tree.description ?? '');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    rename.mutate({ name: name.trim(), description: description.trim() || null }, { onSuccess: onDone });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <TextField label="Tên" required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} />
      <TextAreaField
        label="Lời giới thiệu"
        rows={4}
        maxLength={2000}
        value={description}
        onChange={(event) => setDescription(event.target.value)}
      />
      <TreePhotoField tree={tree} />
      {rename.isError && <ErrorBanner>{rename.error.message}</ErrorBanner>}
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onDone}>
          Huỷ
        </Button>
        <Button type="submit" disabled={rename.isPending || !name.trim()}>
          Lưu
        </Button>
      </div>
    </form>
  );
};

/** Ảnh đại diện cả gia phả (hiện đầu Phả ký). Lưu ngay khi tải lên, không chờ nút Lưu của form. */
const TreePhotoField = ({ tree }: { tree: TreeWithRole }) => {
  const image = useAvatarDataUrl(tree.photo_path);
  const setPhoto = useSetTreePhoto();
  const removePhoto = useRemoveTreePhoto();

  return (
    <div>
      <span className="block font-medium">Ảnh gia phả</span>
      {image.data && <img src={image.data} alt="" className="mt-2 max-h-48 rounded-xl border border-line object-cover" />}
      <div className="mt-2 flex flex-wrap items-start gap-3">
        <ImagePicker
          kind="tree"
          label={tree.photo_path ? 'Đổi ảnh' : 'Tải ảnh lên'}
          pending={setPhoto.isPending}
          error={setPhoto.error?.message ?? removePhoto.error?.message}
          onPick={(file) => setPhoto.mutate({ treeId: tree.id, file, previousPath: tree.photo_path })}
        />
        {tree.photo_path && (
          <Button variant="ghost" className="text-danger!" disabled={removePhoto.isPending} onClick={() => removePhoto.mutate({ treeId: tree.id, path: tree.photo_path! })}>
            Xoá ảnh
          </Button>
        )}
      </div>
    </div>
  );
};

export const DeleteForm = ({ tree, onCancel }: { tree: TreeWithRole; onCancel: () => void }) => {
  const deleteTree = useDeleteTree(tree.id);
  const navigate = useNavigate();
  const [typed, setTyped] = useState('');
  const matches = typed.trim() === tree.name.trim();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!matches) return;
    deleteTree.mutate(undefined, { onSuccess: () => navigate('/gia-pha', { replace: true }) });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <p>
        Toàn bộ Người và dữ liệu trong gia phả <strong>{tree.name}</strong> sẽ bị xoá vĩnh viễn và không khôi phục được.
        Nên xuất Excel để giữ bản sao trước khi xoá.
      </p>
      <TextField
        label="Gõ lại tên gia phả để xác nhận"
        value={typed}
        autoComplete="off"
        onChange={(event) => setTyped(event.target.value)}
      />
      {deleteTree.isError && <ErrorBanner>{deleteTree.error.message}</ErrorBanner>}
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onCancel}>
          Huỷ
        </Button>
        <Button type="submit" variant="danger" disabled={!matches || deleteTree.isPending}>
          {deleteTree.isPending ? 'Đang xoá…' : 'Xoá vĩnh viễn'}
        </Button>
      </div>
    </form>
  );
};
