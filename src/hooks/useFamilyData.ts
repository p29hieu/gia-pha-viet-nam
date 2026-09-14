import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as api from '../api/client';
import { buildGraph } from '../domain/graph';
import * as opt from '../domain/optimistic';
import type { FamilySnapshot } from '../domain/optimistic';
import type { Marriage, Member, Note } from '../domain/types';

interface State extends FamilySnapshot {
  status: 'idle' | 'loading' | 'ready' | 'error';
  /** Đang tải lại ngầm — KHÁC với 'loading' là lần mở đầu tiên. */
  refreshing: boolean;
  /** Số thao tác ghi đang bay tới máy chủ. */
  saving: number;
  clanName: string;
  role: api.Role;
  error: string;
}

const EMPTY: State = {
  status: 'idle',
  refreshing: false,
  saving: 0,
  members: [],
  marriages: [],
  notes: [],
  myMemberId: '',
  clanName: '',
  role: 'viewer',
  error: '',
};

/** Tải lại nếu lần tải gần nhất đã quá cũ — dùng khi quay lại app. */
const STALE_AFTER_MS = 30_000;

export function useFamilyData(token: string | null) {
  const [state, setState] = useState<State>(EMPTY);
  const lastLoadedAt = useRef(0);

  // Giữ bản mới nhất để chụp ảnh trước khi sửa, phục vụ việc hoàn nguyên khi lỗi.
  const stateRef = useRef(state);
  stateRef.current = state;

  const snapshot = useCallback((): FamilySnapshot => {
    const s = stateRef.current;
    return {
      members: s.members,
      marriages: s.marriages,
      notes: s.notes,
      myMemberId: s.myMemberId,
    };
  }, []);

  const apply = useCallback((next: FamilySnapshot) => {
    setState((s) => ({ ...s, ...next }));
  }, []);

  const load = useCallback(async (t: string, silent = false) => {
    setState((s) =>
      silent ? { ...s, refreshing: true, error: '' } : { ...s, status: 'loading', error: '' },
    );
    try {
      const data = await api.bootstrap(t);
      lastLoadedAt.current = Date.now();
      setState((s) => ({
        ...s,
        status: 'ready',
        refreshing: false,
        members: data.members,
        marriages: data.marriages,
        notes: data.notes,
        clanName: data.clanName,
        myMemberId: data.me.memberId,
        role: data.me.role,
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
    if (token) void load(token);
    else setState(EMPTY);
  }, [token, load]);

  /**
   * Gửi một thao tác ghi lên máy chủ trong lúc giao diện đã đổi sẵn.
   * Hỏng thì trả màn hình về đúng ảnh chụp trước đó rồi ném lỗi ra ngoài.
   */
  const send = useCallback(
    async <T>(before: FamilySnapshot, work: () => Promise<T>): Promise<T> => {
      setState((s) => ({ ...s, saving: s.saving + 1 }));
      try {
        return await work();
      } catch (err) {
        apply(before);
        throw err;
      } finally {
        setState((s) => ({ ...s, saving: Math.max(0, s.saving - 1) }));
      }
    },
    [apply],
  );

  const addMember = useCallback(
    async (input: api.NewMemberInput) => {
      if (!token) return '';
      const before = snapshot();
      const draft: Member = { ...input, id: opt.tempId() };
      apply(opt.addMember(before, draft, input.spouseId));

      return send(before, async () => {
        const realId = await api.addMember(token, input);
        apply(opt.commitId(snapshot(), draft.id, realId));
        return realId;
      });
    },
    [token, snapshot, apply, send],
  );

  const updateMember = useCallback(
    async (id: string, patch: Partial<Member>) => {
      if (!token) return;
      const before = snapshot();
      apply(opt.updateMember(before, id, patch));
      await send(before, () => api.updateMember(token, id, patch));
    },
    [token, snapshot, apply, send],
  );

  const deleteMember = useCallback(
    async (id: string) => {
      if (!token) return;
      const before = snapshot();
      apply(opt.removeMember(before, id));
      await send(before, () => api.deleteMember(token, id));
    },
    [token, snapshot, apply, send],
  );

  const chooseMyPosition = useCallback(
    async (memberId: string) => {
      if (!token) return;
      const before = snapshot();
      apply({ ...before, myMemberId: memberId });
      await send(before, () => api.setMyPosition(token, memberId));
    },
    [token, snapshot, apply, send],
  );

  const addNote = useCallback(
    async (memberId: string, content: string) => {
      if (!token) return;
      const before = snapshot();
      const draft: Note = {
        id: opt.tempId('tmpn'),
        memberId,
        authorName: 'Bạn',
        content,
        createdAt: new Date().toISOString(),
        mine: true,
      };
      apply(opt.addNote(before, draft));

      await send(before, async () => {
        const saved = await api.addNote(token, memberId, content);
        apply(opt.commitId(snapshot(), draft.id, saved.id));
      });
    },
    [token, snapshot, apply, send],
  );

  const deleteNote = useCallback(
    async (id: string) => {
      if (!token) return;
      const before = snapshot();
      apply(opt.removeNote(before, id));
      await send(before, () => api.deleteNote(token, id));
    },
    [token, snapshot, apply, send],
  );

  const refresh = useCallback(
    async (onlyIfStale = false) => {
      if (!token) return;
      if (onlyIfStale && Date.now() - lastLoadedAt.current < STALE_AFTER_MS) return;
      if (stateRef.current.saving > 0) return;
      await load(token, true);
    },
    [token, load],
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

  const canEdit = state.role === 'admin' || state.role === 'editor';
  const busy = state.refreshing || state.saving > 0;

  return {
    ...state,
    busy,
    graph,
    notesByMember,
    canEdit,
    chooseMyPosition,
    addMember,
    updateMember,
    deleteMember,
    addNote,
    deleteNote,
    refresh,
  };
}

export type { Marriage, Member, Note };
