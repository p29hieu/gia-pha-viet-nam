import { useCallback, useState } from 'react';
import { IS_DEMO } from './api/client';
import { LoginCard } from './components/auth/LoginCard';
import { PositionPicker } from './components/auth/PositionPicker';
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
import { checkCanDelete } from './domain/edit';
import { getSpouses } from './domain/graph';
import type { Member } from './domain/types';
import { useFamilyData } from './hooks/useFamilyData';
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

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

  const handleCreate = useCallback(
    async (relation: Relation, draft: MemberDraft) => {
      if (formMode?.kind !== 'create') return;
      const anchor = formMode.anchor;
      setBusy(true);
      setActionError('');
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
          await data.addMember({ ...draft, fatherId: anchor.fatherId, motherId: anchor.motherId });
        } else {
          const newId = await data.addMember(draft);
          if (newId) {
            await data.updateMember(
              anchor.id,
              relation === 'bo' ? { fatherId: newId } : { motherId: newId },
            );
          }
        }
        closeForm();
      } catch (err) {
        setActionError((err as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [data, formMode, closeForm],
  );

  const handleSave = useCallback(
    async (patch: Partial<Member>) => {
      if (formMode?.kind !== 'edit') return;
      if (Object.keys(patch).length === 0) {
        closeForm();
        return;
      }
      setBusy(true);
      setActionError('');
      try {
        await data.updateMember(formMode.member.id, patch);
        closeForm();
      } catch (err) {
        setActionError((err as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [data, formMode, closeForm],
  );

  const handleDelete = useCallback(async () => {
    if (!deleteId) return;
    setBusy(true);
    setActionError('');
    try {
      await data.deleteMember(deleteId);
      if (selectedId === deleteId) setSelectedId(null);
      setDeleteId(null);
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, [data, deleteId, selectedId]);

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
    return <PositionPicker members={data.members} onPick={(id) => void data.chooseMyPosition(id)} />;
  }

  const me = data.graph.members.get(data.myMemberId);
  const selected = selectedId ? data.graph.members.get(selectedId) : null;
  const pendingDelete = deleteId ? data.graph.members.get(deleteId) : null;
  const deleteCheck = pendingDelete
    ? checkCanDelete(data.graph, pendingDelete.id, data.notesByMember.get(pendingDelete.id)?.length ?? 0)
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
          <button className="btn btn--icon-lg" type="button" onClick={handleLogout} aria-label="Thoát">
            ⎋
          </button>
        </div>
        <SearchBar graph={data.graph} myMemberId={data.myMemberId} onSelect={setSelectedId} />
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
          onAddNote={data.addNote}
          onDeleteNote={data.deleteNote}
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
          busy={busy}
          error={actionError}
          onCancel={closeForm}
          onCreate={(relation, draft) => void handleCreate(relation, draft)}
          onSave={(patch) => void handleSave(patch)}
        />
      )}

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
          busy={busy}
          error={actionError}
          onConfirm={() => {
            if (deleteCheck.allowed) void handleDelete();
            else setDeleteId(null);
          }}
          onCancel={() => {
            setDeleteId(null);
            setActionError('');
          }}
        />
      )}
    </div>
  );
}
