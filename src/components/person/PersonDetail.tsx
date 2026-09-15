import { useState, type FormEvent } from 'react';
import { checkCanDelete } from '../../domain/edit';
import type { FamilyGraph } from '../../domain/graph';
import { resolveKinship } from '../../domain/kinship';
import { readRelations } from '../../domain/relations';
import type { Member, Note } from '../../domain/types';
import { formatVnDate, lifespan } from '../../lib/text';
import { Avatar } from '../ui/Avatar';

export type RelationAction =
  | { kind: 'pick-father'; memberId: string }
  | { kind: 'pick-mother'; memberId: string }
  | { kind: 'pick-spouse'; memberId: string }
  | { kind: 'clear-father'; memberId: string }
  | { kind: 'clear-mother'; memberId: string }
  | { kind: 'clear-spouse'; memberId: string; marriageId: string };

interface Props {
  member: Member;
  graph: FamilyGraph;
  myMemberId: string;
  notes: Note[];
  canEdit: boolean;
  isAdmin: boolean;
  onSelect: (id: string) => void;
  onAddNote: (memberId: string, content: string) => Promise<void>;
  onDeleteNote: (noteId: string) => Promise<void>;
  onAddRelative: (memberId: string) => void;
  onEdit: (memberId: string) => void;
  onEditRelation: (action: RelationAction) => void;
  onDelete: (memberId: string) => void;
  onClose: () => void;
}

export function PersonDetail({
  member,
  graph,
  myMemberId,
  notes,
  canEdit,
  isAdmin,
  onSelect,
  onAddNote,
  onDeleteNote,
  onAddRelative,
  onEdit,
  onEditRelation,
  onDelete,
  onClose,
}: Props) {
  const isMe = member.id === myMemberId;
  const kin = resolveKinship(graph, myMemberId, member.id);
  const rel = readRelations(graph, member.id);
  // Giu rieng ra de TypeScript khong mat thu hep kieu ben trong ham mui ten.
  const spouseLink = rel.spouse;
  const deleteCheck = checkCanDelete(graph, member.id, notes.length);

  return (
    <aside className="detail" aria-label={`Thông tin ${member.fullName}`}>
      <div className="detail__grip" aria-hidden="true" />
      <button className="detail__close" type="button" onClick={onClose} aria-label="Đóng">
        ✕
      </button>

      <div className="detail__scroll">
        <header className="detail__head">
          <Avatar member={member} size={64} />
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

        {!isMe && (
          <section className="detail__section detail__section--kin">
            <h3 className="detail__section-title">Mối quan hệ với bạn</h3>
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
              <p className="alert alert--note" key={w}>
                {w}
              </p>
            ))}
          </section>
        )}

        <section className="detail__section">
          <h3 className="detail__section-title">Thông tin cá nhân</h3>
          <dl className="facts">
            <Fact label="Họ và tên" value={member.fullName} />
            <Fact label="Ngày sinh" value={formatVnDate(member.birthDate)} />
            {member.deathDate && <Fact label="Ngày mất" value={formatVnDate(member.deathDate)} />}
            <Fact label="Địa chỉ hiện tại" value={member.address} />
            <Fact label="Công việc hiện tại" value={member.occupation} />
          </dl>
        </section>

        {canEdit && (
          <section className="detail__section">
            <h3 className="detail__section-title">Quan hệ trực tiếp</h3>
            <div className="relations">
              <RelationRow
                label="Bố"
                person={rel.father}
                onChoose={() => onEditRelation({ kind: 'pick-father', memberId: member.id })}
                onClear={
                  rel.father
                    ? () => onEditRelation({ kind: 'clear-father', memberId: member.id })
                    : undefined
                }
                onOpen={onSelect}
              />
              <RelationRow
                label="Mẹ"
                person={rel.mother}
                onChoose={() => onEditRelation({ kind: 'pick-mother', memberId: member.id })}
                onClear={
                  rel.mother
                    ? () => onEditRelation({ kind: 'clear-mother', memberId: member.id })
                    : undefined
                }
                onOpen={onSelect}
              />
              <RelationRow
                label="Vợ / chồng"
                person={spouseLink?.member}
                onChoose={() => onEditRelation({ kind: 'pick-spouse', memberId: member.id })}
                onClear={
                  spouseLink
                    ? () =>
                        onEditRelation({
                          kind: 'clear-spouse',
                          memberId: member.id,
                          marriageId: spouseLink.marriageId,
                        })
                    : undefined
                }
                onOpen={onSelect}
              />
            </div>
            {rel.children.length > 0 && (
              <p className="relations__children">
                <strong>Con ({rel.children.length}):</strong>{' '}
                {rel.children.map((c) => c.fullName).join(', ')}. Sửa cha mẹ của từng người ngay
                trong thẻ của họ.
              </p>
            )}
          </section>
        )}

        {!isMe && kin.path.length > 1 && (
          <section className="detail__section">
            <h3 className="detail__section-title">Có họ thông qua ai</h3>
            <ol className="lineage">
              {kin.path.map((step, i) => {
                const person = graph.members.get(step.memberId);
                if (!person) return null;
                const first = i === 0;
                return (
                  <li className="lineage__step" key={`${step.memberId}-${i}`}>
                    <span className="lineage__label">{first ? 'Bạn' : step.label}</span>
                    {first ? (
                      <span className="lineage__name">{person.fullName}</span>
                    ) : (
                      <button
                        className="lineage__name"
                        type="button"
                        onClick={() => onSelect(step.memberId)}
                      >
                        {person.fullName}
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>
            <p className="lineage__note">{kin.explanation}</p>
          </section>
        )}

        <section className="detail__section">
          <h3 className="detail__section-title">
            Chú thích{notes.length ? ` (${notes.length})` : ''}
          </h3>
          {notes.length === 0 && <p className="detail__empty">Chưa có ghi chú nào.</p>}
          <ul className="notes">
            {notes.map((n) => (
              <li className="notes__item" key={n.id}>
                <p className="notes__content">{n.content}</p>
                <p className="notes__meta">
                  {n.authorName || 'Ẩn danh'} · {new Date(n.createdAt).toLocaleDateString('vi-VN')}
                </p>
                {(n.mine || isAdmin) && (
                  <button
                    className="notes__delete"
                    type="button"
                    onClick={() => void onDeleteNote(n.id)}
                    aria-label="Xoá ghi chú này"
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
          {canEdit && <NoteForm memberId={member.id} onAddNote={onAddNote} />}
        </section>
      </div>

      {canEdit && (
        <footer className="detail__actions">
          <button className="btn" type="button" onClick={() => onEdit(member.id)}>
            Sửa
          </button>
          <button className="btn" type="button" onClick={() => onAddRelative(member.id)}>
            + Người thân
          </button>
          <button
            className="btn btn--danger-ghost"
            type="button"
            onClick={() => onDelete(member.id)}
            title={deleteCheck.allowed ? undefined : deleteCheck.reason}
          >
            Xoá
          </button>
        </footer>
      )}
    </aside>
  );
}

function RelationRow({
  label,
  person,
  onChoose,
  onClear,
  onOpen,
}: {
  label: string;
  person?: Member;
  onChoose: () => void;
  onClear?: () => void;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="relation-row">
      <span className="relation-row__label">{label}</span>
      {person ? (
        <button className="relation-row__name" type="button" onClick={() => onOpen(person.id)}>
          {person.fullName}
        </button>
      ) : (
        <span className="relation-row__name relation-row__name--empty">chưa có</span>
      )}
      <span className="relation-row__actions">
        <button className="relation-row__btn" type="button" onClick={onChoose}>
          {person ? 'Đổi' : 'Chọn'}
        </button>
        {onClear && (
          <button className="relation-row__btn relation-row__btn--danger" type="button" onClick={onClear}>
            Gỡ
          </button>
        )}
      </span>
    </div>
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
