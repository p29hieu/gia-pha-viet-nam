import { useCallback, useEffect, useMemo, useState } from 'react';
import * as api from '../api/client';
import { buildGraph } from '../domain/graph';
import type { Marriage, Member, Note } from '../domain/types';

interface State {
  status: 'idle' | 'loading' | 'ready' | 'error';
  /** Đang tải lại ngầm sau khi ghi — KHÁC với 'loading' là lần mở đầu tiên. */
  refreshing: boolean;
  members: Member[];
  marriages: Marriage[];
  notes: Note[];
  clanName: string;
  myMemberId: string;
  role: api.Role;
  error: string;
}

const EMPTY: State = {
  status: 'idle',
  refreshing: false,
  members: [],
  marriages: [],
  notes: [],
  clanName: '',
  myMemberId: '',
  role: 'viewer',
  error: '',
};

export function useFamilyData(token: string | null) {
  const [state, setState] = useState<State>(EMPTY);

  /**
   * `silent` dung cho lan tai lai sau khi ghi: giu nguyen du lieu dang hien thi
   * de man hinh khong bi xoa trang, chi bat co `refreshing`. Loi duoc nem ra
   * ngoai de noi goi hien toast, thay vi thay ca man hinh bang trang bao loi.
   */
  const load = useCallback(async (t: string, silent = false) => {
    setState((s) =>
      silent ? { ...s, refreshing: true, error: '' } : { ...s, status: 'loading', error: '' },
    );
    try {
      const data = await api.bootstrap(t);
      setState({
        status: 'ready',
        refreshing: false,
        members: data.members,
        marriages: data.marriages,
        notes: data.notes,
        clanName: data.clanName,
        myMemberId: data.me.memberId,
        role: data.me.role,
        error: '',
      });
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

  const chooseMyPosition = useCallback(
    async (memberId: string) => {
      if (!token) return;
      await api.setMyPosition(token, memberId);
      setState((s) => ({ ...s, myMemberId: memberId }));
    },
    [token],
  );

  const addMember = useCallback(
    async (input: api.NewMemberInput) => {
      if (!token) return '';
      const id = await api.addMember(token, input);
      await load(token, true);
      return id;
    },
    [token, load],
  );

  const updateMember = useCallback(
    async (id: string, patch: Partial<Member>) => {
      if (!token) return;
      await api.updateMember(token, id, patch);
      await load(token, true);
    },
    [token, load],
  );

  const addNote = useCallback(
    async (memberId: string, content: string) => {
      if (!token) return;
      const note = await api.addNote(token, memberId, content);
      setState((s) => ({ ...s, notes: [...s.notes, note] }));
    },
    [token],
  );

  const deleteMember = useCallback(
    async (id: string) => {
      if (!token) return;
      await api.deleteMember(token, id);
      await load(token, true);
    },
    [token, load],
  );

  const deleteNote = useCallback(
    async (id: string) => {
      if (!token) return;
      await api.deleteNote(token, id);
      setState((s) => ({ ...s, notes: s.notes.filter((n) => n.id !== id) }));
    },
    [token],
  );

  const canEdit = state.role === 'admin' || state.role === 'editor';

  return {
    ...state,
    graph,
    notesByMember,
    canEdit,
    chooseMyPosition,
    addMember,
    updateMember,
    deleteMember,
    addNote,
    deleteNote,
    reload: load,
  };
}
