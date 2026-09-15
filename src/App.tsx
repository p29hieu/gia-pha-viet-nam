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
import { MemberPicker } from './components/person/MemberPicker';
import { PersonDetail, type RelationAction } from './components/person/PersonDetail';
import { SearchBar } from './components/search/SearchBar';
import { FamilyTree } from './components/tree/FamilyTree';
import { ConfirmDialog } from './components/ui/ConfirmDialog';
import { ToastStack } from './components/ui/Toast';
import { checkCanDelete } from './domain/edit';
import { getSpouses } from './domain/graph';
import { marriagesOf, spouseIn } from './domain/marriage';
import {
  SLOTS,
  canSetParent,
  canSetSibling,
  canSetSpouse,
  sharedBloodParents,
  siblingPatch,
  type ParentSlot,
} from './domain/relations';
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
  const [relationEdit, setRelationEdit] = useState<RelationAction | null>(null);
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
      const huy = await data.linkSpouses(
        { id: father.id, gender: father.gender },
        { id: mother.id, gender: mother.gender },
      );
      const ten = (id: string) => data.graph.members.get(id)?.fullName ?? 'người mới';
      return { ten: `${ten(fatherId)} và ${ten(motherId)}`, huy: huy.length };
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
            // Không dùng spouseId của addMember nữa: cho mọi đường nối đi chung
            // một cửa linkSpouses để quy tắc một dây hôn phối luôn được áp dụng.
            const newId = await data.addMember(draft);
            if (newId) {
              const huy = await data.linkSpouses(anchor, { id: newId, gender: draft.gender });
              if (huy.length > 0) toast('info', `Đã huỷ dây hôn phối cũ của ${anchor.fullName}`);
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
              if (linked) {
                toast(
                  'info',
                  linked.huy > 0
                    ? `Đã nối ${linked.ten} thành vợ chồng, và huỷ dây hôn phối cũ`
                    : `Đã nối ${linked.ten} thành vợ chồng`,
                );
              }
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

  // ------------------------------------------------------- sửa quan hệ hai chiều

  const tenCua = useCallback(
    (id: string) => data.graph.members.get(id)?.fullName ?? 'người này',
    [data.graph],
  );

  const chay = useCallback(
    async (viec: () => Promise<void>, thanhCong: string, hongThi: string) => {
      setRelationEdit(null);
      try {
        await viec();
        toast('success', thanhCong);
      } catch (err) {
        toast('error', `${hongThi} ${(err as Error).message}`);
      }
    },
    [toast],
  );

  const datChaMe = useCallback(
    (childId: string, slot: ParentSlot, parentId: string) => {
      const nhan = SLOTS[slot].label.toLowerCase();
      void chay(
        () => data.updateMember(childId, { [SLOTS[slot].field]: parentId }),
        `Đã đặt ${tenCua(parentId)} làm ${nhan} của ${tenCua(childId)}`,
        `Không đặt được ${nhan}.`,
      );
    },
    [chay, data, tenCua],
  );

  const goChaMe = useCallback(
    (childId: string, slot: ParentSlot) => {
      const nhan = SLOTS[slot].label.toLowerCase();
      void chay(
        () => data.updateMember(childId, { [SLOTS[slot].field]: '' }),
        `Đã gỡ ${nhan} của ${tenCua(childId)}`,
        `Không gỡ được ${nhan}.`,
      );
    },
    [chay, data, tenCua],
  );

  const datVoChong = useCallback(
    (aId: string, bId: string) => {
      const a = data.graph.members.get(aId);
      const b = data.graph.members.get(bId);
      if (!a || !b) return;
      void chay(
        async () => {
          const huy = await data.linkSpouses(a, b);
          if (huy.length > 0) toast('info', 'Đã huỷ dây hôn phối cũ');
        },
        `Đã nối ${a.fullName} và ${b.fullName} thành vợ chồng`,
        'Không nối được.',
      );
    },
    [chay, data, toast],
  );

  const goVoChong = useCallback(
    (marriageId: string, memberId: string) => {
      void chay(
        () => data.unlinkMarriage(marriageId),
        `Đã gỡ dây hôn phối của ${tenCua(memberId)}`,
        'Không gỡ được dây hôn phối.',
      );
    },
    [chay, data, tenCua],
  );

  /**
   * Anh chị em không có cạnh riêng trong dữ liệu — nó suy ra từ cha mẹ chung.
   * Nối tức là chép cha mẹ ruột của người neo sang người kia, và chỉ chép vào
   * ô còn trống để không bao giờ ghi đè cha mẹ ai đó đã ghi nhận.
   */
  const datAnhEm = useCallback(
    (anchorId: string, candidateId: string) => {
      const patch = siblingPatch(data.graph, anchorId, candidateId);
      if (patch.length === 0) return;
      const fields = Object.fromEntries(patch.map((p) => [SLOTS[p.slot].field, p.parentId]));
      void chay(
        () => data.updateMember(candidateId, fields),
        `${tenCua(candidateId)} và ${tenCua(anchorId)} đã thành anh chị em`,
        'Không nối được anh chị em.',
      );
    },
    [chay, data, tenCua],
  );

  const goAnhEm = useCallback(
    (anchorId: string, siblingId: string) => {
      const chung = sharedBloodParents(data.graph, anchorId, siblingId);
      if (chung.length === 0) return;
      const fields = Object.fromEntries(chung.map((s) => [SLOTS[s].field, '']));
      void chay(
        () => data.updateMember(siblingId, fields),
        `${tenCua(siblingId)} và ${tenCua(anchorId)} thôi là anh chị em`,
        'Không gỡ được quan hệ anh chị em.',
      );
    },
    [chay, data, tenCua],
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
          onEditRelation={setRelationEdit}
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

      {relationEdit?.kind === 'pick-parent' && (
        <MemberPicker
          title={`Chọn ${SLOTS[relationEdit.slot].label.toLowerCase()}`}
          lead={`Chọn người trong gia phả làm ${SLOTS[relationEdit.slot].label.toLowerCase()} của ${tenCua(relationEdit.memberId)}.`}
          members={data.members}
          check={(c) => canSetParent(data.graph, relationEdit.memberId, c.id, relationEdit.slot)}
          onPick={(id) => datChaMe(relationEdit.memberId, relationEdit.slot, id)}
          onCancel={() => setRelationEdit(null)}
        />
      )}

      {relationEdit?.kind === 'pick-spouse' && (
        <MemberPicker
          title="Chọn vợ / chồng"
          lead={`Chọn người trong gia phả làm vợ/chồng của ${tenCua(relationEdit.memberId)}. Mỗi người chỉ giữ một dây hôn phối, nên dây cũ sẽ bị huỷ.`}
          members={data.members}
          check={(c) => canSetSpouse(data.graph, relationEdit.memberId, c.id)}
          onPick={(id) => datVoChong(relationEdit.memberId, id)}
          onCancel={() => setRelationEdit(null)}
        />
      )}

      {relationEdit?.kind === 'pick-sibling' && (
        <MemberPicker
          title="Chọn anh/chị/em"
          lead={`Chọn người trong gia phả làm anh/chị/em của ${tenCua(relationEdit.memberId)}. Người đó sẽ nhận cùng bố mẹ, nên chỉ chọn được người chưa ghi bố mẹ khác.`}
          members={data.members}
          check={(c) => canSetSibling(data.graph, relationEdit.memberId, c.id)}
          onPick={(id) => datAnhEm(relationEdit.memberId, id)}
          onCancel={() => setRelationEdit(null)}
        />
      )}

      {relationEdit?.kind === 'clear-sibling' && (
        <ConfirmDialog
          title="Gỡ quan hệ anh chị em?"
          message={(() => {
            const chung = sharedBloodParents(
              data.graph,
              relationEdit.memberId,
              relationEdit.siblingId,
            );
            const ten = chung.map((s) => `${SLOTS[s].label.toLowerCase()} ${tenCua(
              data.graph.members.get(relationEdit.siblingId)?.[SLOTS[s].field] ?? '',
            )}`);
            return `Hai người là anh chị em vì cùng ${ten.join(' và ')}. Gỡ sẽ xoá phần đó khỏi thẻ của ${tenCua(relationEdit.siblingId)}, nên hai người thôi là anh chị em. ${tenCua(relationEdit.siblingId)} vẫn ở trong gia phả.`;
          })()}
          confirmLabel="Gỡ"
          danger
          onConfirm={() => goAnhEm(relationEdit.memberId, relationEdit.siblingId)}
          onCancel={() => setRelationEdit(null)}
        />
      )}

      {relationEdit?.kind === 'clear-parent' && (
        <ConfirmDialog
          title={`Gỡ ${SLOTS[relationEdit.slot].label.toLowerCase()}?`}
          message={`${tenCua(relationEdit.memberId)} sẽ không còn ghi nhận ${SLOTS[relationEdit.slot].label.toLowerCase()} nữa. Người kia vẫn ở trong gia phả.`}
          confirmLabel="Gỡ"
          danger
          onConfirm={() => goChaMe(relationEdit.memberId, relationEdit.slot)}
          onCancel={() => setRelationEdit(null)}
        />
      )}

      {relationEdit?.kind === 'clear-spouse' && (
        <ConfirmDialog
          title="Gỡ dây hôn phối?"
          message={`Hai người sẽ không còn là vợ chồng trong gia phả. Cả hai vẫn ở nguyên, con cái vẫn giữ cha mẹ như cũ.`}
          confirmLabel="Gỡ"
          danger
          onConfirm={() => goVoChong(relationEdit.marriageId, relationEdit.memberId)}
          onCancel={() => setRelationEdit(null)}
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
