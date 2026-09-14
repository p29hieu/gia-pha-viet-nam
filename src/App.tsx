import { useCallback, useEffect, useState } from 'react';
import { IS_DEMO } from './api/client';
import { LoginCard } from './components/auth/LoginCard';
import { PositionPicker, type SelfDraft } from './components/auth/PositionPicker';
import {
  MemberForm,
  type FormMode,
  type MemberDraft,
  type Relation,
} from './components/person/MemberForm';
import { PersonDetail } from './components/person/PersonDetail';
import { SearchBar } from './components/search/SearchBar';
import { FamilyTree } from './components/tree/FamilyTree';
import { ConfirmDialog } from './components/ui/ConfirmDialog';
import { ToastStack } from './components/ui/Toast';
import { checkCanDelete } from './domain/edit';
import { getSpouses } from './domain/graph';
import type { Member } from './domain/types';
import { useFamilyData } from './hooks/useFamilyData';
import { useToasts } from './hooks/useToasts';
import './styles/app.css';

const TOKEN_KEY = 'giapha_token';

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export default function App() {
  const [token, setToken] = useState<string | null>(readToken);
  const data = useFamilyData(token);
  const { toasts, push: toast, dismiss: dismissToast } = useToasts();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const { refresh } = data;

  // Hai, ba người cùng sửa một gia phả thì dữ liệu trên máy dễ cũ.
  // Quay lại app là lấy bản mới, nhưng chỉ khi lần tải trước đã đủ lâu.
  useEffect(() => {
    const sync = () => {
      if (document.visibilityState === 'visible') void refresh(true).catch(() => undefined);
    };
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('focus', sync);
    return () => {
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('focus', sync);
    };
  }, [refresh]);

  const handleLogin = useCallback((t: string) => {
    try {
      localStorage.setItem(TOKEN_KEY, t);
    } catch {
      // vẫn dùng được trong phiên hiện tại
    }
    setToken(t);
  }, []);

  const handleLogout = useCallback(() => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // bỏ qua
    }
    setToken(null);
    setSelectedId(null);
  }, []);

  const closeForm = useCallback(() => {
    setFormMode(null);
    setActionError('');
  }, []);

  /**
   * Giao diện đã đổi ngay khi bấm Lưu, nên đóng biểu mẫu luôn và để việc gửi lên
   * Google chạy ngầm. Hỏng thì hook tự hoàn nguyên, ta chỉ cần báo bằng toast.
   */
  const handleCreate = useCallback(
    (relation: Relation, draft: MemberDraft) => {
      if (formMode?.kind !== 'create') return;
      const anchor = formMode.anchor;
      closeForm();

      void (async () => {
        try {
          if (relation === 'con') {
            const spouse = getSpouses(data.graph, anchor.id)[0];
            await data.addMember({
              ...draft,
              fatherId: anchor.gender === 'M' ? anchor.id : spouse,
              motherId: anchor.gender === 'F' ? anchor.id : spouse,
            });
          } else if (relation === 'vo-chong') {
            await data.addMember({ ...draft, spouseId: anchor.id });
          } else if (relation === 'anh-chi-em') {
            await data.addMember({
              ...draft,
              fatherId: anchor.fatherId,
              motherId: anchor.motherId,
            });
          } else {
            const newId = await data.addMember(draft);
            if (newId) {
              await data.updateMember(
                anchor.id,
                relation === 'bo' ? { fatherId: newId } : { motherId: newId },
              );
            }
          }
          toast('success', `Đã thêm ${draft.fullName} vào gia phả`);
        } catch (err) {
          toast('error', `Không lưu được ${draft.fullName}. ${(err as Error).message}`);
        }
      })();
    },
    [data, formMode, closeForm, toast],
  );

  const handleSave = useCallback(
    (patch: Partial<Member>) => {
      if (formMode?.kind !== 'edit') return;
      const member = formMode.member;
      closeForm();
      if (Object.keys(patch).length === 0) return;

      void (async () => {
        try {
          await data.updateMember(member.id, patch);
          toast('success', `Đã lưu thay đổi cho ${member.fullName}`);
        } catch (err) {
          toast('error', `Không lưu được ${member.fullName}. ${(err as Error).message}`);
        }
      })();
    },
    [data, formMode, closeForm, toast],
  );

  const handleCreateSelf = useCallback(
    async (draft: SelfDraft) => {
      setBusy(true);
      setActionError('');
      try {
        const newId = await data.addMember(draft);
        if (newId) await data.chooseMyPosition(newId);
        toast('success', `Đã bắt đầu gia phả từ ${draft.fullName}`);
      } catch (err) {
        const message = (err as Error).message;
        setActionError(message);
        toast('error', message);
      } finally {
        setBusy(false);
      }
    },
    [data, toast],
  );

  const handleDelete = useCallback(() => {
    if (!deleteId) return;
    const name = data.graph.members.get(deleteId)?.fullName ?? 'người này';
    if (selectedId === deleteId) setSelectedId(null);
    setDeleteId(null);

    void (async () => {
      try {
        await data.deleteMember(deleteId);
        toast('success', `Đã xoá ${name} khỏi gia phả`);
      } catch (err) {
        toast('error', `Không xoá được ${name}. ${(err as Error).message}`);
      }
    })();
  }, [data, deleteId, selectedId, toast]);

  const handleAddNote = useCallback(
    async (memberId: string, content: string) => {
      try {
        await data.addNote(memberId, content);
        toast('success', 'Đã lưu ghi chú');
      } catch (err) {
        toast('error', `Không lưu được ghi chú. ${(err as Error).message}`);
      }
    },
    [data, toast],
  );

  const handleDeleteNote = useCallback(
    async (id: string) => {
      try {
        await data.deleteNote(id);
        toast('success', 'Đã xoá ghi chú');
      } catch (err) {
        toast('error', `Không xoá được ghi chú. ${(err as Error).message}`);
      }
    },
    [data, toast],
  );

  const handleRefresh = useCallback(() => {
    void (async () => {
      try {
        await refresh();
        toast('info', 'Đã lấy bản mới nhất');
      } catch (err) {
        toast('error', `Không làm mới được. ${(err as Error).message}`);
      }
    })();
  }, [refresh, toast]);

  if (!token) return <LoginCard onSuccess={handleLogin} />;

  if (data.status === 'loading' || data.status === 'idle') {
    return (
      <main className="splash">
        <p className="splash__text">Đang mở gia phả…</p>
      </main>
    );
  }

  if (data.status === 'error') {
    return (
      <main className="splash">
        <h1 className="splash__title">Không mở được gia phả</h1>
        <p className="splash__text">{data.error}</p>
        <button className="btn btn--primary" type="button" onClick={handleLogout}>
          Đăng nhập lại
        </button>
      </main>
    );
  }

  if (!data.myMemberId) {
    return (
      <PositionPicker
        members={data.members}
        canEdit={data.canEdit}
        busy={busy}
        error={actionError}
        onPick={(id) => void data.chooseMyPosition(id)}
        onCreateSelf={(draft) => void handleCreateSelf(draft)}
      />
    );
  }

  const me = data.graph.members.get(data.myMemberId);
  const selected = selectedId ? data.graph.members.get(selectedId) : null;
  const pendingDelete = deleteId ? data.graph.members.get(deleteId) : null;
  const deleteCheck = pendingDelete
    ? checkCanDelete(
        data.graph,
        pendingDelete.id,
        data.notesByMember.get(pendingDelete.id)?.length ?? 0,
      )
    : null;

  return (
    <div className={`shell${selected ? ' shell--with-detail' : ''}`}>
      <header className="topbar">
        <div className="topbar__row">
          <span className="topbar__seal" aria-hidden="true">
            族
          </span>
          <div className="topbar__text">
            <h1 className="topbar__title">{data.clanName}</h1>
            <p className="topbar__sub">
              {data.members.length} người · bạn là <strong>{me?.fullName ?? '—'}</strong>
            </p>
          </div>
          {data.canEdit && me && (
            <button
              className="btn btn--icon-lg"
              type="button"
              onClick={() => setFormMode({ kind: 'create', anchor: me })}
              aria-label="Thêm người"
            >
              +
            </button>
          )}
          <button
            className="btn btn--icon-lg"
            type="button"
            onClick={handleRefresh}
            disabled={data.busy}
            aria-label="Lấy bản mới nhất"
          >
            ↻
          </button>
          <button
            className="btn btn--icon-lg"
            type="button"
            onClick={handleLogout}
            aria-label="Thoát"
          >
            ⎋
          </button>
        </div>
        <SearchBar graph={data.graph} myMemberId={data.myMemberId} onSelect={setSelectedId} />
        {data.busy && <span className="refreshbar" aria-hidden="true" />}
      </header>

      {IS_DEMO && (
        <p className="demo-banner">
          Đang xem <strong>dữ liệu mẫu</strong> — thay đổi chỉ lưu trên máy bạn.
        </p>
      )}

      <main className="workspace">
        <FamilyTree
          graph={data.graph}
          myMemberId={data.myMemberId}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </main>

      {selected && (
        <PersonDetail
          member={selected}
          graph={data.graph}
          myMemberId={data.myMemberId}
          notes={data.notesByMember.get(selected.id) ?? []}
          canEdit={data.canEdit}
          isAdmin={data.role === 'admin'}
          onSelect={setSelectedId}
          onAddNote={handleAddNote}
          onDeleteNote={handleDeleteNote}
          onAddRelative={(id) => {
            const anchor = data.graph.members.get(id);
            if (anchor) setFormMode({ kind: 'create', anchor });
          }}
          onEdit={(id) => {
            const member = data.graph.members.get(id);
            if (member) setFormMode({ kind: 'edit', member });
          }}
          onDelete={setDeleteId}
          onClose={() => setSelectedId(null)}
        />
      )}

      {formMode && (
        <MemberForm
          mode={formMode}
          busy={false}
          error=""
          onCancel={closeForm}
          onCreate={handleCreate}
          onSave={handleSave}
        />
      )}

      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {pendingDelete && deleteCheck && (
        <ConfirmDialog
          title={deleteCheck.allowed ? 'Xoá khỏi gia phả?' : 'Chưa xoá được'}
          message={
            deleteCheck.allowed
              ? `${pendingDelete.fullName} sẽ bị xoá khỏi gia phả.`
              : (deleteCheck.reason ?? '')
          }
          consequences={deleteCheck.consequences}
          confirmLabel={deleteCheck.allowed ? 'Xoá' : 'Đã hiểu'}
          danger={deleteCheck.allowed}
          onConfirm={() => {
            if (deleteCheck.allowed) handleDelete();
            else setDeleteId(null);
          }}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}
