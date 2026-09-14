import { useCallback, useState } from 'react';
import { IS_DEMO } from './api/client';
import { LoginCard } from './components/auth/LoginCard';
import { PositionPicker } from './components/auth/PositionPicker';
import { MemberForm, type MemberDraft, type Relation } from './components/person/MemberForm';
import { PersonDetail } from './components/person/PersonDetail';
import { SearchBar } from './components/search/SearchBar';
import { FamilyTree } from './components/tree/FamilyTree';
import { getSpouses } from './domain/graph';
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
  const [formAnchor, setFormAnchor] = useState<string | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState('');

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

  const handleCreate = useCallback(
    async (relation: Relation, draft: MemberDraft) => {
      if (!formAnchor) return;
      const anchor = data.graph.members.get(formAnchor);
      if (!anchor) return;

      setFormBusy(true);
      setFormError('');
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
        setFormAnchor(null);
      } catch (err) {
        setFormError((err as Error).message);
      } finally {
        setFormBusy(false);
      }
    },
    [data, formAnchor],
  );

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
  const anchor = formAnchor ? data.graph.members.get(formAnchor) : null;

  return (
    <div className={`shell${selected ? ' shell--with-detail' : ''}`}>
      <header className="topbar">
        <div className="topbar__brand">
          <span className="topbar__seal" aria-hidden="true">
            族
          </span>
          <div>
            <h1 className="topbar__title">{data.clanName}</h1>
            <p className="topbar__sub">
              {data.members.length} người · bạn là <strong>{me?.fullName ?? '—'}</strong>
            </p>
          </div>
        </div>

        <SearchBar graph={data.graph} myMemberId={data.myMemberId} onSelect={setSelectedId} />

        <div className="topbar__actions">
          {data.canEdit && me && (
            <button className="btn btn--ghost" type="button" onClick={() => setFormAnchor(me.id)}>
              + Thêm người
            </button>
          )}
          <button className="btn btn--ghost" type="button" onClick={handleLogout}>
            Thoát
          </button>
        </div>
      </header>

      {IS_DEMO && (
        <p className="demo-banner">
          Đang xem <strong>dữ liệu mẫu</strong> — mọi thay đổi chỉ lưu trên máy bạn, chưa nối với
          Google Sheet.
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
          onSelect={setSelectedId}
          onAddNote={data.addNote}
          onAddRelative={setFormAnchor}
          onClose={() => setSelectedId(null)}
        />
      )}

      {anchor && (
        <MemberForm
          anchor={anchor}
          busy={formBusy}
          error={formError}
          onCancel={() => {
            setFormAnchor(null);
            setFormError('');
          }}
          onSubmit={(relation, draft) => void handleCreate(relation, draft)}
        />
      )}
    </div>
  );
}
