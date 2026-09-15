import { useCallback, useEffect, useState } from 'react';
import * as fs from '../../api/firestoreClient';
import type { JoinRequest } from '../../api/firestoreClient';
import { GRANTABLE_ROLES, ROLE_LABEL } from '../../domain/perm';

interface Props {
  clanId: string;
  onClose: () => void;
  onChanged: () => void;
}

/** Chủ họ duyệt người xin vào. Không duyệt thì họ không đọc được gì. */
export function JoinRequestsPanel({ clanId, onClose, onChanged }: Props) {
  const [requests, setRequests] = useState<JoinRequest[] | null>(null);
  const [busyUid, setBusyUid] = useState('');
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    try {
      setRequests(await fs.listJoinRequests(clanId));
    } catch (err) {
      setError((err as Error).message);
      setRequests([]);
    }
  }, [clanId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function act(req: JoinRequest, action: () => Promise<void>) {
    setBusyUid(req.uid);
    setError('');
    try {
      await action();
      await reload();
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyUid('');
    }
  }

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label="Yêu cầu vào dòng họ">
      <button className="sheet__backdrop" type="button" onClick={onClose} aria-label="Đóng" />
      <div className="sheet__panel">
        <div className="sheet__grip" aria-hidden="true" />
        <header className="sheet__head">
          <h2 className="sheet__title">Yêu cầu vào dòng họ</h2>
          <p className="sheet__lead">
            Duyệt ai thì người đó mới xem được gia phả. <strong>Chỉ xem</strong> là đọc thôi;{' '}
            <strong>bình luận</strong> thì ghi chú được; <strong>sửa</strong> thì thêm và sửa người
            được.
          </p>
        </header>

        <div className="sheet__body">
          {error && (
            <p className="alert alert--danger" role="alert">
              {error}
            </p>
          )}
          {requests === null && <p className="detail__empty">Đang tải…</p>}
          {requests?.length === 0 && <p className="detail__empty">Không có yêu cầu nào.</p>}

          <ul className="requests">
            {requests?.map((r) => (
              <li className="requests__item" key={r.uid}>
                <div className="requests__who">
                  <span className="requests__name">{r.displayName || r.email}</span>
                  <span className="requests__meta">{r.email}</span>
                </div>
                <div className="requests__actions">
                  {GRANTABLE_ROLES.map((role) => (
                    <button
                      className="btn btn--small"
                      type="button"
                      key={role}
                      disabled={busyUid === r.uid}
                      onClick={() => void act(r, () => fs.approveJoinRequest(clanId, r, role))}
                    >
                      {ROLE_LABEL[role]}
                    </button>
                  ))}
                  <button
                    className="btn btn--small btn--danger-ghost"
                    type="button"
                    disabled={busyUid === r.uid}
                    onClick={() => void act(r, () => fs.rejectJoinRequest(clanId, r.uid))}
                  >
                    Từ chối
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <footer className="sheet__actions">
          <button className="btn" type="button" onClick={onClose}>
            Đóng
          </button>
        </footer>
      </div>
    </div>
  );
}
