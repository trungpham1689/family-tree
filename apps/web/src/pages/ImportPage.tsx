import { useState, type ChangeEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useImportExcel, useTree } from '../data/tree-queries';
import { buildImportPreview, type ImportPreview } from '../excel/import-preview';
import { downloadTemplate, readGiaPhaSheet } from '../excel/xlsx-io';
import { AppHeader } from '../ui/AppHeader';
import { Button } from '../ui/Button';
import { ErrorBanner, TextField } from '../ui/fields';

const PAGE = 200;

/** Nhập Gia phả từ Excel: tải file mẫu, tải file đã điền, xem trước kèm lỗi, xác nhận mới lưu. */
export const ImportPage = () => {
  const [params] = useSearchParams();
  const targetTreeId = params.get('vao');

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-8">
        {targetTreeId ? <ImportIntoExisting treeId={targetTreeId} /> : <ImportFlow treeId={null} treeName={null} />}
      </main>
    </>
  );
};

const ImportIntoExisting = ({ treeId }: { treeId: string }) => {
  const tree = useTree(treeId);
  if (tree.isPending) return <p className="text-ink-muted">Đang tải…</p>;
  if (tree.isError) return <ErrorBanner>{tree.error.message}</ErrorBanner>;
  return <ImportFlow treeId={treeId} treeName={tree.data.name} />;
};

const ImportFlow = ({ treeId, treeName }: { treeId: string | null; treeName: string | null }) => {
  const navigate = useNavigate();
  const save = useImportExcel();
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [name, setName] = useState('');
  const [shown, setShown] = useState(PAGE);
  const [templateError, setTemplateError] = useState<string | null>(null);

  const pickFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setReading(true);
    setReadError(null);
    setPreview(null);
    save.reset();
    try {
      const rows = await readGiaPhaSheet(file);
      setPreview(buildImportPreview(rows));
      setFileName(file.name);
      setName((current) => current || file.name.replace(/\.xlsx$/i, ''));
      setShown(PAGE);
    } catch {
      setReadError('Không đọc được file. Hãy chắc chắn đây là file Excel (.xlsx), ví dụ lưu lại từ file mẫu.');
    } finally {
      setReading(false);
    }
  };

  const confirm = () => {
    if (!preview?.payload) return;
    save.mutate(
      { treeId, name: name.trim(), payload: preview.payload },
      { onSuccess: (id) => navigate(`/gia-pha/${id}`, { replace: true }) },
    );
  };

  return (
    <>
      <Link to={treeId ? `/gia-pha/${treeId}` : '/gia-pha'} className="text-ink-muted hover:text-son">
        ← {treeName ?? 'Gia phả của tôi'}
      </Link>
      <h1 className="mt-3 font-serif text-3xl font-bold text-son">Nhập gia phả từ Excel</h1>
      <p className="mt-2 text-ink-muted">
        {treeId
          ? `Dữ liệu sẽ được đổ vào gia phả “${treeName}” (đang trống).`
          : 'Một gia phả mới sẽ được tạo từ file của bạn.'}{' '}
        Chưa lưu gì cho tới khi bạn xem trước và bấm “Xác nhận & lưu”.
      </p>

      <ol className="mt-6 grid gap-4 md:grid-cols-2">
        <li className="rounded-2xl border border-line bg-surface p-5">
          <p className="font-semibold">1. Tải file mẫu</p>
          <p className="mt-1 text-sm text-ink-muted">Có sẵn một gia phả 4 đời làm ví dụ và sheet hướng dẫn cách điền.</p>
          <Button
            variant="secondary"
            className="mt-3"
            onClick={() => {
              setTemplateError(null);
              downloadTemplate().catch(() => setTemplateError('Không tạo được file mẫu. Hãy thử lại.'));
            }}
          >
            Tải file mẫu
          </Button>
          {templateError && <ErrorBanner>{templateError}</ErrorBanner>}
        </li>
        <li className="rounded-2xl border border-line bg-surface p-5">
          <p className="font-semibold">2. Tải lên file đã điền</p>
          <p className="mt-1 text-sm text-ink-muted">File .xlsx, mỗi người một dòng.</p>
          <label className="mt-3 inline-flex min-h-12 cursor-pointer items-center rounded-xl bg-son px-5 font-semibold text-white hover:bg-son-strong">
            {reading ? 'Đang đọc…' : fileName ? 'Chọn file khác' : 'Chọn file Excel'}
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              disabled={reading}
              onChange={pickFile}
            />
          </label>
          {fileName && <p className="mt-2 text-sm text-ink-muted">Đã đọc: {fileName}</p>}
        </li>
      </ol>

      {readError && (
        <div className="mt-6">
          <ErrorBanner>{readError}</ErrorBanner>
        </div>
      )}

      {preview && (
        <section className="mt-8 space-y-6" aria-labelledby="xem-truoc">
          <h2 id="xem-truoc" className="font-serif text-2xl font-bold">
            3. Xem trước
          </h2>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Số người" value={preview.total} />
            <Stat label="Số đời" value={preview.generations} />
            <Stat label="Thuỷ tổ" value={preview.progenitorName ?? '—'} />
            <Stat label="Chưa nối vào cây" value={preview.unconnected} />
          </dl>

          {preview.errors.length > 0 ? (
            <div className="rounded-2xl border border-danger bg-danger-soft p-5" role="alert">
              <p className="font-semibold text-danger">
                Còn {preview.errors.length} lỗi cần sửa trong file. Sửa xong hãy tải file lên lại.
              </p>
              <ul className="mt-3 max-h-96 space-y-1 overflow-y-auto">
                {preview.errors.map((error, index) => (
                  <li key={index}>
                    <strong>Dòng {error.row}</strong>
                    {error.column && <> · cột “{error.column}”</>}: {error.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="space-y-4 rounded-2xl border border-line bg-surface p-5">
              <p className="font-semibold text-son">Không có lỗi. Kiểm tra lại các dòng bên dưới rồi xác nhận.</p>
              {preview.unconnected > 0 && (
                <p className="text-ink-muted">
                  {preview.unconnected} người chưa nối được vào cây (không có cha/mẹ hay vợ/chồng trong cây). Họ vẫn được lưu
                  ở mục “Chưa nối vào cây” để gắn sau.
                </p>
              )}
              {!treeId && (
                <TextField label="Tên gia phả mới" maxLength={120} value={name} onChange={(event) => setName(event.target.value)} />
              )}
              {save.isError && <ErrorBanner>{save.error.message}</ErrorBanner>}
              <Button disabled={save.isPending || (!treeId && !name.trim())} onClick={confirm}>
                {save.isPending ? 'Đang lưu…' : 'Xác nhận & lưu'}
              </Button>
            </div>
          )}

          {preview.people.length > 0 && (
            <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-line text-sm text-ink-muted">
                    <th className="px-4 py-2 font-medium">Dòng</th>
                    <th className="px-4 py-2 font-medium">Mã</th>
                    <th className="px-4 py-2 font-medium">Họ và tên</th>
                    <th className="px-4 py-2 font-medium">Đời</th>
                    <th className="px-4 py-2 font-medium">Quan hệ</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.people.slice(0, shown).map((person) => (
                    <tr key={person.code} className="border-b border-line last:border-0">
                      <td className="px-4 py-2 text-ink-muted">{person.row}</td>
                      <td className="px-4 py-2">{person.code}</td>
                      <td className="px-4 py-2 font-semibold">{person.name}</td>
                      <td className="px-4 py-2">{person.generation ?? '—'}</td>
                      <td className="px-4 py-2">{person.relation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.people.length > shown && (
                <div className="p-3 text-center">
                  <Button variant="ghost" onClick={() => setShown((current) => current + PAGE)}>
                    Xem thêm ({preview.people.length - shown} dòng)
                  </Button>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </>
  );
};

const Stat = ({ label, value }: { label: string; value: string | number }) => (
  <div className="rounded-2xl border border-line bg-surface px-4 py-3">
    <dt className="text-sm text-ink-muted">{label}</dt>
    <dd className="mt-1 text-xl font-semibold">{value}</dd>
  </div>
);
