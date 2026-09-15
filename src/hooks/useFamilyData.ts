import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as api from '../api/client';
import { buildGraph } from '../domain/graph';
import * as opt from '../domain/optimistic';
import type { FamilySnapshot } from '../domain/optimistic';
import { findMarriage, marriagesOf, orderCouple } from '../domain/marriage';
import type { Marriage, Member, Note } from '../domain/types';

interface State {
  status: 'idle' | 'loading' | 'ready' | 'error';
  /** Đang tải lại ngầm — KHÁC với 'loading' là lần mở đầu tiên. */
  refreshing: boolean;
  /** Số thao tác ghi đang bay tới máy chủ. */
  saving: number;
  members: Member[];
  marriages: api.ClanData['marriages'];
  notes: Note[];
  error: string;
}

const EMPTY: State = {
  status: 'idle',
  refreshing: false,
  saving: 0,
  members: [],
  marriages: [],
  notes: [],
  error: '',
};

/** Tải lại nếu lần tải gần nhất đã quá cũ — dùng khi quay lại app. */
const STALE_AFTER_MS = 30_000;

export function useFamilyData(ready: boolean) {
  const [state, setState] = useState<State>(EMPTY);
  const lastLoadedAt = useRef(0);

  // Giữ bản mới nhất để chụp ảnh trước khi sửa, phục vụ việc hoàn nguyên khi lỗi.
  const stateRef = useRef(state);
  stateRef.current = state;

  const snapshot = useCallback((): FamilySnapshot => {
    const s = stateRef.current;
    return { members: s.members, marriages: s.marriages, notes: s.notes, myMemberId: '' };
  }, []);

  /**
   * Biến đổi trạng thái hiện tại, KHÔNG ghi đè bằng một ảnh chụp cũ.
   *
   * Trước đây mỗi thao tác chụp ảnh trạng thái rồi ghi đè toàn bộ. Hai thao tác
   * chạy sát nhau thì cái sau chụp phải ảnh cũ (React chưa kịp render) và hồi
   * sinh lại thứ cái trước vừa xoá. Truyền hàm biến đổi vào setState thì React
   * luôn đưa cho ta trạng thái mới nhất, nên các thao tác chồng lên nhau an toàn.
   */
  const apply = useCallback((change: (s: FamilySnapshot) => FamilySnapshot) => {
    setState((s) => {
      const next = change({
        members: s.members,
        marriages: s.marriages,
        notes: s.notes,
        myMemberId: '',
      });
      return { ...s, members: next.members, marriages: next.marriages, notes: next.notes };
    });
  }, []);

  /** Trả màn hình về đúng ảnh chụp trước thao tác, dùng khi ghi hỏng. */
  const restore = useCallback((snap: FamilySnapshot) => {
    setState((s) => ({
      ...s,
      members: snap.members,
      marriages: snap.marriages,
      notes: snap.notes,
    }));
  }, []);

  const load = useCallback(async (silent = false) => {
    setState((s) =>
      silent ? { ...s, refreshing: true, error: '' } : { ...s, status: 'loading', error: '' },
    );
    try {
      const data = await api.loadClanData();
      lastLoadedAt.current = Date.now();
      setState((s) => ({
        ...s,
        status: 'ready',
        refreshing: false,
        members: data.members,
        marriages: data.marriages,
        notes: data.notes,
        error: '',
      }));
    } catch (err) {
      if (silent) {
        setState((s) => ({ ...s, refreshing: false }));
        throw err;
      }
      setState({ ...EMPTY, status: 'error', error: (err as Error).message });
    }
  }, []);

  useEffect(() => {
    if (ready) void load();
    else setState(EMPTY);
  }, [ready, load]);

  /**
   * Gửi một thao tác ghi trong lúc giao diện đã đổi sẵn.
   * Hỏng thì trả màn hình về đúng ảnh chụp trước đó rồi ném lỗi ra ngoài.
   */
  const send = useCallback(
    async <T>(before: FamilySnapshot, work: () => Promise<T>): Promise<T> => {
      setState((s) => ({ ...s, saving: s.saving + 1 }));
      try {
        return await work();
      } catch (err) {
        restore(before);
        throw err;
      } finally {
        setState((s) => ({ ...s, saving: Math.max(0, s.saving - 1) }));
      }
    },
    [restore],
  );

  const addMember = useCallback(
    async (input: api.NewMemberInput) => {
      const before = snapshot();
      const draft: Member = { ...input, id: opt.tempId() };
      apply((cur) => opt.addMember(cur, draft, input.spouseId));

      return send(before, async () => {
        const realId = await api.addMember(input);
        apply((cur) => opt.commitId(cur, draft.id, realId));
        return realId;
      });
    },
    [snapshot, apply, send],
  );

  const updateMember = useCallback(
    async (id: string, patch: Partial<Member>) => {
      const before = snapshot();
      apply((cur) => opt.updateMember(cur, id, patch));
      await send(before, () => api.updateMember(id, patch));
    },
    [snapshot, apply, send],
  );

  const deleteMember = useCallback(
    async (id: string) => {
      const before = snapshot();
      apply((cur) => opt.removeMember(cur, id));
      await send(before, () => api.deleteMember(id));
    },
    [snapshot, apply, send],
  );

  const unlinkMarriage = useCallback(
    async (id: string) => {
      const before = snapshot();
      apply((cur) => opt.removeMarriage(cur, id));
      await send(before, () => api.deleteMarriage(id));
    },
    [snapshot, apply, send],
  );

  /**
   * Noi hai nguoi thanh vo chong.
   *
   * Theo tuc Viet Nam, moi nguoi chi giu MOT day hon phoi tai mot thoi diem.
   * Day la cho duy nhat tao lien ket, nen dat quy tac o day thi moi duong them
   * deu tuan thu: huy het day cu cua ca hai ben roi moi noi.
   * Tra ve nhung lien ket da bi huy de noi goi bao cho nguoi dung.
   */
  const linkSpouses = useCallback(
    async (a: Pick<Member, 'id' | 'gender'>, b: Pick<Member, 'id' | 'gender'>) => {
      if (findMarriage(stateRef.current.marriages, a.id, b.id)) return [];

      // Doc mot lan cho ca hai ben: doc hai lan thi lan sau co the chua thay
      // thay doi cua lan truoc, tuy thoi diem React render.
      const cu = stateRef.current.marriages;
      const phaiHuy = [...marriagesOf(cu, a.id), ...marriagesOf(cu, b.id)];
      const duyNhat = [...new Map(phaiHuy.map((m) => [m.id, m])).values()];
      for (const m of duyNhat) await unlinkMarriage(m.id);

      const before = snapshot();
      const { husbandId, wifeId } = orderCouple(a, b);
      const draft: Marriage = { id: opt.tempId('tmpw'), husbandId, wifeId, status: 'married' };
      apply((cur) => opt.addMarriage(cur, draft));

      await send(before, async () => {
        const realId = await api.addMarriage(husbandId, wifeId);
        apply((cur) => opt.commitId(cur, draft.id, realId));
      });
      return duyNhat;
    },
    [snapshot, apply, send, unlinkMarriage],
  );

  /** Huỷ mọi liên kết vợ chồng hiện có của một người. Trả về những gì đã huỷ. */
  const unlinkAllSpouses = useCallback(
    async (memberId: string) => {
      const existing = marriagesOf(stateRef.current.marriages, memberId);
      for (const m of existing) await unlinkMarriage(m.id);
      return existing;
    },
    [unlinkMarriage],
  );

  /** Kiểm tra đã nối chưa, đọc từ trạng thái mới nhất. */
  const alreadyLinked = useCallback(
    (a: string, b: string) => Boolean(findMarriage(stateRef.current.marriages, a, b)),
    [],
  );

  const addNote = useCallback(
    async (memberId: string, content: string) => {
      const before = snapshot();
      const draft: Note = {
        id: opt.tempId('tmpn'),
        memberId,
        authorName: 'Bạn',
        content,
        createdAt: new Date().toISOString(),
        mine: true,
      };
      apply((cur) => opt.addNote(cur, draft));

      await send(before, async () => {
        const saved = await api.addNote(memberId, content);
        apply((cur) => opt.commitId(cur, draft.id, saved.id));
      });
    },
    [snapshot, apply, send],
  );

  const deleteNote = useCallback(
    async (id: string) => {
      const before = snapshot();
      apply((cur) => opt.removeNote(cur, id));
      await send(before, () => api.deleteNote(id));
    },
    [snapshot, apply, send],
  );

  const refresh = useCallback(
    async (onlyIfStale = false) => {
      if (!ready) return;
      if (onlyIfStale && Date.now() - lastLoadedAt.current < STALE_AFTER_MS) return;
      if (stateRef.current.saving > 0) return;
      await load(true);
    },
    [ready, load],
  );

  const graph = useMemo(
    () => buildGraph(state.members, state.marriages),
    [state.members, state.marriages],
  );

  const notesByMember = useMemo(() => {
    const map = new Map<string, Note[]>();
    state.notes.forEach((n) => {
      const list = map.get(n.memberId);
      if (list) list.push(n);
      else map.set(n.memberId, [n]);
    });
    return map;
  }, [state.notes]);

  return {
    ...state,
    busy: state.refreshing || state.saving > 0,
    graph,
    notesByMember,
    addMember,
    updateMember,
    deleteMember,
    linkSpouses,
    unlinkMarriage,
    unlinkAllSpouses,
    alreadyLinked,
    addNote,
    deleteNote,
    refresh,
  };
}
