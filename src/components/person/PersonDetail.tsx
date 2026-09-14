import { useState, type FormEvent } from 'react';
import type { FamilyGraph } from '../../domain/graph';
import { resolveKinship } from '../../domain/kinship';
import type { Member, Note } from '../../domain/types';
import { formatVnDate, lifespan } from '../../lib/text';
import { Avatar } from '../ui/Avatar';

interface Props {
  member: Member;
  graph: FamilyGraph;
  myMemberId: string;
  notes: Note[];
  canEdit: boolean;
  onSelect: (id: string) => void;
  onAddNote: (memberId: string, content: string) => Promise<void>;
  onAddRelative: (memberId: string) => void;
  onClose: () => void;
}

export function PersonDetail({
  member,
  graph,
  myMemberId,
  notes,
  canEdit,
  onSelect,
  onAddNote,
  onAddRelative,
  onClose,
}: Props) {
  const isMe = member.id === myMemberId;
  const kin = resolveKinship(graph, myMemberId, member.id);

  return (
    <aside className="detail" aria-label={`Thông tin ${member.fullName}`}>
      <button className="detail__close" type="button" onClick={onClose} aria-label="Đóng">
        ✕
      </button>

      <header className="detail__head">
        <Avatar member={member} size={72} />
        <div>
          <h2 className="detail__name">{member.fullName}</h2>
          <p className="detail__sub">
            {member.gender === 'M' ? 'Nam' : 'Nữ'}
            {lifespan(member.birthDate, member.deathDate) &&
              ` · ${lifespan(member.birthDate, member.deathDate)}`}
            {member.deathDate ? ' · đã mất' : ''}
          </p>
        </div>
      </header>

      <Section title="Thông tin cá nhân">
        <dl className="facts">
          <Fact label="Họ và tên" value={member.fullName} />
          <Fact label="Ngày sinh" value={formatVnDate(member.birthDate)} />
          {member.deathDate && <Fact label="Ngày mất" value={formatVnDate(member.deathDate)} />}
          <Fact label="Địa chỉ hiện tại" value={member.address} />
          <Fact label="Công việc hiện tại" value={member.occupation} />
        </dl>
      </Section>

      {!isMe && (
        <Section title="Mối quan hệ với bạn">
          <p className="kin__headline">
            Bạn gọi là <strong className="kin__term">{kin.callThem}</strong>
          </p>
          <p className="kin__line">
            {member.fullName} gọi bạn là <strong>{kin.theyCallMe}</strong>, bạn xưng{' '}
            <strong>{kin.iCallMyself}</strong>.
          </p>
          {kin.side && (
            <p className="kin__line kin__line--muted">
              {kin.side === 'noi' && 'Họ hàng bên nội.'}
              {kin.side === 'ngoai' && 'Họ hàng bên ngoại.'}
              {kin.side === 'vo' && 'Họ hàng bên vợ.'}
              {kin.side === 'chong' && 'Họ hàng bên chồng.'}
            </p>
          )}
          {kin.warnings.map((w) => (
            <p className="kin__warning" key={w}>
              {w}
            </p>
          ))}
        </Section>
      )}

      {!isMe && kin.path.length > 1 && (
        <Section title="Có họ thông qua ai">
          <ol className="lineage">
            {kin.path.map((step, i) => {
              const person = graph.members.get(step.memberId);
              if (!person) return null;
              const first = i === 0;
              return (
                <li className="lineage__step" key={`${step.memberId}-${i}`}>
                  <span className="lineage__label">{first ? 'Bạn' : step.label}</span>
                  {!first && (
                    <button
                      className="lineage__name"
                      type="button"
                      onClick={() => onSelect(step.memberId)}
                    >
                      {person.fullName}
                    </button>
                  )}
                  {first && <span className="lineage__name">{person.fullName}</span>}
                </li>
              );
            })}
          </ol>
          <p className="lineage__note">{kin.explanation}</p>
        </Section>
      )}

      <Section title={`Chú thích${notes.length ? ` (${notes.length})` : ''}`}>
        {notes.length === 0 && <p className="detail__empty">Chưa có ghi chú nào.</p>}
        <ul className="notes">
          {notes.map((n) => (
            <li className="notes__item" key={n.id}>
              <p className="notes__content">{n.content}</p>
              <p className="notes__meta">
                {n.authorName || 'Ẩn danh'} · {new Date(n.createdAt).toLocaleDateString('vi-VN')}
              </p>
            </li>
          ))}
        </ul>
        {canEdit && <NoteForm memberId={member.id} onAddNote={onAddNote} />}
      </Section>

      {canEdit && (
        <button className="btn btn--ghost btn--block" type="button" onClick={() => onAddRelative(member.id)}>
          + Thêm người thân cho {member.fullName}
        </button>
      )}
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="detail__section">
      <h3 className="detail__section-title">{title}</h3>
      {children}
    </section>
  );
}

function Fact({ label, value }: { label: string; value?: string }) {
  return (
    <>
      <dt className="facts__label">{label}</dt>
      <dd className="facts__value">{value || <span className="facts__blank">chưa có</span>}</dd>
    </>
  );
}

function NoteForm({
  memberId,
  onAddNote,
}: {
  memberId: string;
  onAddNote: (memberId: string, content: string) => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      await onAddNote(memberId, text.trim());
      setText('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="note-form" onSubmit={submit}>
      <textarea
        className="field__input note-form__input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        placeholder="Thêm ghi chú — ai cũng đọc được…"
        aria-label="Nội dung ghi chú"
      />
      <button className="btn btn--small" type="submit" disabled={busy || !text.trim()}>
        {busy ? 'Đang lưu…' : 'Lưu ghi chú'}
      </button>
    </form>
  );
}
