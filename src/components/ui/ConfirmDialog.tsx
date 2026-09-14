interface Props {
  title: string;
  /** Câu hỏi chính, nói rõ chuyện gì sắp xảy ra */
  message: string;
  /** Những hệ quả kèm theo, liệt kê từng dòng */
  consequences?: string[];
  confirmLabel: string;
  busy?: boolean;
  danger?: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  consequences = [],
  confirmLabel,
  busy,
  danger,
  error,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <div className="sheet sheet--compact" role="alertdialog" aria-modal="true" aria-label={title}>
      <button className="sheet__backdrop" type="button" onClick={onCancel} aria-label="Đóng" />
      <div className="sheet__panel">
        <div className="sheet__grip" aria-hidden="true" />
        <header className="sheet__head">
          <h2 className="sheet__title">{title}</h2>
          <p className="sheet__lead">{message}</p>
        </header>

        {consequences.length > 0 && (
          <ul className="consequences">
            {consequences.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        )}

        {error && (
          <p className="alert alert--danger" role="alert">
            {error}
          </p>
        )}

        <footer className="sheet__actions">
          <button className="btn" type="button" onClick={onCancel}>
            Huỷ
          </button>
          <button
            className={`btn ${danger ? 'btn--danger' : 'btn--primary'}`}
            type="button"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Đang xử lý…' : confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}
