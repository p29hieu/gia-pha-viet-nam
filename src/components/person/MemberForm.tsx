import { useState, type FormEvent } from 'react';
import { diffMember } from '../../domain/edit';
import type { Gender, Member } from '../../domain/types';

export type Relation = 'con' | 'vo-chong' | 'anh-chi-em' | 'bo' | 'me';

export interface MemberDraft {
  fullName: string;
  gender: Gender;
  birthDate?: string;
  deathDate?: string;
  birthOrder?: number;
  address?: string;
  occupation?: string;
}

export type FormMode = { kind: 'create'; anchor: Member } | { kind: 'edit'; member: Member };

interface Props {
  mode: FormMode;
  busy: boolean;
  error: string;
  onCancel: () => void;
  onCreate: (relation: Relation, draft: MemberDraft) => void;
  onSave: (patch: Partial<Member>) => void;
}

const RELATIONS: Array<{ value: Relation; label: string }> = [
  { value: 'con', label: 'Con' },
  { value: 'vo-chong', label: 'Vợ / chồng' },
  { value: 'anh-chi-em', label: 'Anh / chị / em' },
  { value: 'bo', label: 'Bố' },
  { value: 'me', label: 'Mẹ' },
];

export function MemberForm({ mode, busy, error, onCancel, onCreate, onSave }: Props) {
  const editing = mode.kind === 'edit' ? mode.member : null;

  const [relation, setRelation] = useState<Relation>('con');
  const [fullName, setFullName] = useState(editing?.fullName ?? '');
  const [gender, setGender] = useState<Gender>(editing?.gender ?? 'M');
  const [birthDate, setBirthDate] = useState(editing?.birthDate ?? '');
  const [deathDate, setDeathDate] = useState(editing?.deathDate ?? '');
  const [birthOrder, setBirthOrder] = useState(
    editing?.birthOrder != null ? String(editing.birthOrder) : '',
  );
  const [address, setAddress] = useState(editing?.address ?? '');
  const [occupation, setOccupation] = useState(editing?.occupation ?? '');

  const lockedGender = !editing && relation === 'bo' ? 'M' : !editing && relation === 'me' ? 'F' : null;
  const effectiveGender = lockedGender ?? gender;

  function buildDraft(): MemberDraft {
    const order = Number(birthOrder);
    return {
      fullName: fullName.trim(),
      gender: effectiveGender,
      birthDate: birthDate.trim() || undefined,
      deathDate: deathDate.trim() || undefined,
      birthOrder: Number.isFinite(order) && order > 0 ? order : undefined,
      address: address.trim() || undefined,
      occupation: occupation.trim() || undefined,
    };
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const draft = buildDraft();
    if (editing) onSave(diffMember(editing, draft));
    else onCreate(relation, draft);
  }

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label={editing ? 'Sửa thông tin' : 'Thêm thành viên'}>
      <button className="sheet__backdrop" type="button" onClick={onCancel} aria-label="Đóng" />
      <form className="sheet__panel" onSubmit={submit}>
        <div className="sheet__grip" aria-hidden="true" />

        <header className="sheet__head">
          <h2 className="sheet__title">{editing ? 'Sửa thông tin' : 'Thêm người thân'}</h2>
          <p className="sheet__lead">
            {editing ? (
              <>
                Đang sửa <strong>{editing.fullName}</strong>.
              </>
            ) : (
              <>
                Người mới sẽ nối vào gia phả qua <strong>{mode.kind === 'create' ? mode.anchor.fullName : ''}</strong>.
              </>
            )}
          </p>
        </header>

        <div className="sheet__body">
          {!editing && mode.kind === 'create' && (
            <fieldset className="chips">
              <legend className="field__label">Quan hệ với {mode.anchor.fullName}</legend>
              {RELATIONS.map((r) => (
                <label className={`chip${relation === r.value ? ' chip--on' : ''}`} key={r.value}>
                  <input
                    type="radio"
                    name="relation"
                    value={r.value}
                    checked={relation === r.value}
                    onChange={() => setRelation(r.value)}
                  />
                  {r.label}
                </label>
              ))}
            </fieldset>
          )}

          <label className="field">
            <span className="field__label">Họ và tên</span>
            <input
              className="field__input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              autoComplete="off"
            />
          </label>

          <fieldset className="chips">
            <legend className="field__label">Giới tính</legend>
            {(['M', 'F'] as Gender[]).map((g) => (
              <label
                className={`chip${effectiveGender === g ? ' chip--on' : ''}${lockedGender ? ' chip--locked' : ''}`}
                key={g}
              >
                <input
                  type="radio"
                  name="gender"
                  checked={effectiveGender === g}
                  disabled={Boolean(lockedGender)}
                  onChange={() => setGender(g)}
                />
                {g === 'M' ? 'Nam' : 'Nữ'}
              </label>
            ))}
          </fieldset>

          <label className="field">
            <span className="field__label">Con thứ mấy trong nhà</span>
            <input
              className="field__input"
              value={birthOrder}
              onChange={(e) => setBirthOrder(e.target.value)}
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="1"
            />
            <span className="field__hint">
              Quan trọng hơn năm sinh khi tính vai anh/chị/em.
            </span>
          </label>

          <label className="field">
            <span className="field__label">Ngày sinh</span>
            <input
              className="field__input"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              placeholder="1960 · 1960-05 · 1960-05-12"
              autoComplete="off"
            />
            <span className="field__hint">Chỉ nhớ năm cũng được.</span>
          </label>

          <label className="field">
            <span className="field__label">Ngày mất</span>
            <input
              className="field__input"
              value={deathDate}
              onChange={(e) => setDeathDate(e.target.value)}
              placeholder="để trống nếu còn sống"
              autoComplete="off"
            />
          </label>

          <label className="field">
            <span className="field__label">Địa chỉ hiện tại</span>
            <input
              className="field__input"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              autoComplete="off"
            />
          </label>

          <label className="field">
            <span className="field__label">Công việc hiện tại</span>
            <input
              className="field__input"
              value={occupation}
              onChange={(e) => setOccupation(e.target.value)}
              autoComplete="off"
            />
          </label>

          {error && (
            <p className="alert alert--danger" role="alert">
              {error}
            </p>
          )}
        </div>

        <footer className="sheet__actions">
          <button className="btn" type="button" onClick={onCancel}>
            Huỷ
          </button>
          <button className="btn btn--primary" type="submit" disabled={busy || !fullName.trim()}>
            {busy ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : 'Thêm vào gia phả'}
          </button>
        </footer>
      </form>
    </div>
  );
}
