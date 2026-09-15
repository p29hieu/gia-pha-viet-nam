import { useCallback, useEffect, useState } from 'react';
import { IS_DEMO } from './api/client';
import { ClanSetup } from './components/auth/ClanSetup';
import { JoinGate } from './components/auth/JoinGate';
import { JoinRequestsPanel } from './components/auth/JoinRequestsPanel';
import { PositionPicker, type SelfDraft } from './components/auth/PositionPicker';
import { SignInCard } from './components/auth/SignInCard';
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
import { marriagesOf, spouseIn } from './domain/marriage';
import type { Member } from './domain/types';
import { useFamilyData } from './hooks/useFamilyData';
import { useSession } from './hooks/useSession';
import { useToasts } from './hooks/useToasts';
import './styles/app.css';

export default function App() {
  const session = useSession();
  const isMember = session.state.status === 'member';
  const data = useFamilyData(isMember);
  const { toasts, push: toast, dismiss: dismissToast } = useToasts();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showRequests, setShowRequests] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const { refresh } = data;
  const myMemberId = session.state.status === 'member' ? session.state.membership.memberId : '';

  // Hai, ba người cùng vun một gia phả thì dữ liệu trên máy dễ cũ.
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

  const closeForm = useCallback(() => {
    setFormMode(null);
    setActionError('');
  }, []);

  /**
   * Nối hai người thành vợ chồng khi đã biết đủ cả cha lẫn mẹ.
   * `newGender` dùng cho người vừa được tạo, vì họ chưa có trong đồ thị.
   */
  const linkParents = useCallback(
    async (fatherId?: string, motherId?: string, newGender?: 'M' | 'F') => {
      if (!fatherId || !motherId) return null;
      const father = data.graph.members.get(fatherId) ?? { id: fatherId, gender: newGender ?? 'M' };
      const mother = data.graph.members.get(motherId) ?? { id: motherId, gender: newGender ?? 'F' };
      await data.linkSpouses(
        { id: father.id, gender: father.gender },
        { id: mother.id, gender: mother.gender },
      );
      const ten = (id: string) => data.graph.members.get(id)?.fullName ?? 'người mới';
      return `${ten(fatherId)} và ${ten(motherId)}`;
    },
    [data],
  );

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
            // Anh Hiếu chọn: mỗi người chỉ giữ một liên kết vợ chồng tại một thời
            // điểm, thêm người mới thì huỷ liên kết cũ đi.
            const removed = await data.unlinkAllSpouses(anchor.id);
            await data.addMember({ ...draft, spouseId: anchor.id });
            if (removed.length > 0) {
              toast('info', `Đã huỷ liên kết vợ chồng cũ của ${anchor.fullName}`);
            }
          } else if (relation === 'anh-chi-em') {
            await data.addMember({
              ...draft,
              fatherId: anchor.fatherId,
              motherId: anchor.motherId,
            });
            // Anh chị em dùng chung cha mẹ — nhân dịp này nối cha mẹ nếu chưa nối.
            await linkParents(anchor.fatherId, anchor.motherId);
          } else {
            const newId = await data.addMember(draft);
            if (newId) {
              await data.updateMember(
                anchor.id,
                relation === 'bo' ? { fatherId: newId } : { motherId: newId },
              );
              // Vừa biết đủ cả cha lẫn mẹ thì nối hai người thành cặp luôn.
              // Truyền thẳng id chứ không đọc lại trạng thái React: thao tác ghi
              // vừa xong chưa chắc đã kịp phản ánh vào trạng thái.
              const otherParentId = relation === 'bo' ? anchor.motherId : anchor.fatherId;
              const linked = await linkParents(
                relation === 'bo' ? newId : otherParentId,
                relation === 'bo' ? otherParentId : newId,
                relation === 'bo' ? 'M' : 'F',
              );
              if (linked) toast('info', `Đã nối ${linked} thành vợ chồng`);
            }
          }
          toast('success', `Đã thêm ${draft.fullName} vào gia phả`);
        } catch (err) {
          toast('error', `Không lưu được ${draft.fullName}. ${(err as Error).message}`);
        }
      })();
    },
    [data, formMode, closeForm, toast, linkParents],
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
        if (newId) await session.setMyPosition(newId);
        toast('success', `Đã bắt đầu gia phả từ ${draft.fullName}`);
      } catch (err) {
        const message = (err as Error).message;
        setActionError(message);
        toast('error', message);
      } finally {
        setBusy(false);
      }
    },
    [data, session, toast],
  );

  const handleDelete = useCallback(() => {
    if (!deleteId) return;
    const name = data.graph.members.get(deleteId)?.fullName ?? 'người này';
    const wasMe = deleteId === myMemberId;
    if (selectedId === deleteId) setSelectedId(null);
    setDeleteId(null);

    void (async () => {
      try {
        await data.deleteMember(deleteId);
        if (wasMe) await session.setMyPosition('');
        toast('success', `Đã xoá ${name} khỏi gia phả`);
      } catch (err) {
        toast('error', `Không xoá được ${name}. ${(err as Error).message}`);
      }
    })();
  }, [data, deleteId, selectedId, myMemberId, session, toast]);

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

  // ------------------------------------------------------------- định tuyến phiên

  const s = session.state;

  if (s.status === 'loading') {
    return (
      <main className="splash">
        <p className="splash__text">Đang mở gia phả…</p>
      </main>
    );
  }

  if (s.status === 'error') {
    return (
      <main className="splash">
        <h1 className="splash__title">Không mở được gia phả</h1>
        <p className="splash__text">{s.message}</p>
        <button className="btn btn--primary" type="button" onClick={() => void session.signOut()}>
          Đăng nhập lại
        </button>
      </main>
    );
  }

  if (s.status === 'signed-out') return <SignInCard onSignIn={session.signIn} />;

  if (s.status === 'no-clan') {
    return (
      <ClanSetup
        account={s.account}
        onCreate={session.createClan}
        onSignOut={() => void session.signOut()}
      />
    );
  }

  if (s.status === 'outsider' || s.status === 'pending') {
    return (
      <JoinGate
        account={s.account}
        clanName={s.clanName}
        pending={s.status === 'pending'}
        onRequest={session.requestJoin}
        onRecheck={session.recheck}
        onSignOut={() => void session.signOut()}
      />
    );
  }

  // ------------------------------------------------------------- đã vào dòng họ

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
        <h1 className="splash__title">Không tải được gia phả</h1>
        <p className="splash__text">{data.error}</p>
        <button className="btn btn--primary" type="button" onClick={handleRefresh}>
          Thử lại
        </button>
      </main>
    );
  }

  if (!myMemberId) {
    return (
      <PositionPicker
        members={data.members}
        canEdit={session.canEdit}
        busy={busy}
        error={actionError}
        onPick={(id) => void session.setMyPosition(id)}
        onCreateSelf={(draft) => void handleCreateSelf(draft)}
      />
    );
  }

  const me = data.graph.members.get(myMemberId);
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
            <h1 className="topbar__title">{s.clanName}</h1>
            <p className="topbar__sub">
              {data.members.length} người · bạn là <strong>{me?.fullName ?? '—'}</strong>
            </p>
          </div>
          {session.canEdit && me && (
            <button
              className="btn btn--icon-lg"
              type="button"
              onClick={() => setFormMode({ kind: 'create', anchor: me })}
              aria-label="Thêm người"
            >
              +
            </button>
          )}
          {session.isOwner && !IS_DEMO && (
            <button
              className="btn btn--icon-lg"
              type="button"
              onClick={() => setShowRequests(true)}
              aria-label="Yêu cầu vào dòng họ"
            >
              👤
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
            onClick={() => void session.signOut()}
            aria-label="Thoát"
          >
            ⎋
          </button>
        </div>
        <SearchBar graph={data.graph} myMemberId={myMemberId} onSelect={setSelectedId} />
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
          myMemberId={myMemberId}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onQuickAdd={
            session.canEdit
              ? (id) => {
                  const anchor = data.graph.members.get(id);
                  if (anchor) setFormMode({ kind: 'create', anchor });
                }
              : undefined
          }
        />
      </main>

      {selected && (
        <PersonDetail
          member={selected}
          graph={data.graph}
          myMemberId={myMemberId}
          notes={data.notesByMember.get(selected.id) ?? []}
          canEdit={session.canEdit}
          isAdmin={session.isOwner}
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
          currentSpouseName={
            formMode.kind === 'create'
              ? (() => {
                  const w = marriagesOf(data.marriages, formMode.anchor.id)[0];
                  if (!w) return undefined;
                  return data.graph.members.get(spouseIn(w, formMode.anchor.id))?.fullName;
                })()
              : undefined
          }
          busy={false}
          error=""
          onCancel={closeForm}
          onCreate={handleCreate}
          onSave={handleSave}
        />
      )}

      {showRequests && (
        <JoinRequestsPanel onClose={() => setShowRequests(false)} onChanged={() => undefined} />
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
