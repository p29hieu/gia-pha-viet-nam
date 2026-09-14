import { useMemo, useState } from 'react';
import type { FamilyGraph } from '../../domain/graph';
import { resolveKinship } from '../../domain/kinship';
import { lifespan, matchesName } from '../../lib/text';

interface Props {
  graph: FamilyGraph;
  myMemberId: string;
  onSelect: (id: string) => void;
}

export function SearchBar({ graph, myMemberId, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const results = useMemo(() => {
    if (query.trim().length < 1) return [];
    return [...graph.members.values()]
      .filter((m) => matchesName(m.fullName, query))
      .slice(0, 12)
      .map((m) => ({
        member: m,
        term: m.id === myMemberId ? 'Tôi' : resolveKinship(graph, myMemberId, m.id).callThem,
      }));
  }, [graph, query, myMemberId]);

  return (
    <div className="search">
      <input
        className="search__input"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        placeholder="Tìm theo tên…"
        aria-label="Tìm người trong gia phả"
      />
      {open && results.length > 0 && (
        <ul className="search__results">
          {results.map(({ member, term }) => (
            <li key={member.id}>
              <button
                className="search__result"
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelect(member.id);
                  setOpen(false);
                }}
              >
                <span className="search__name">{member.fullName}</span>
                <span className="search__meta">{lifespan(member.birthDate, member.deathDate)}</span>
                <span className="search__term">{term}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && query.trim() && results.length === 0 && (
        <p className="search__empty">Không tìm thấy ai tên như vậy.</p>
      )}
    </div>
  );
}
