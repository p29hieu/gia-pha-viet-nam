import { useState, type FormEvent } from 'react';
import type { Gender, Member } from '../../domain/types';

export type Relation = 'con' | 'vo-chong' | 'anh-chi-em' | 'bo' | 'me';

export interface MemberDraft {
  fullName: string;
  gender: Gender;
  birthDate?: string;
  birthOrder?: number;
  address?: string;
  occupation?: string;
}

interface Props {
  anchor: Member;
  busy: boolean;
  error: string;
  onCancel: () => void;
  onSubmit: (relation: Relation, draft: MemberDraft) => void;
}

const RELATIONS: Array<{ value: Relation; label: string }> = [
  { value: 'con', label: 'Con' },
  { value: 'vo-chong', label: 'Vợ / chồng' },
  { value: 'anh-chi-em', label: 'Anh / chị / em' },
  { value: 'bo', label: 'Bố' },
  { value: 'me', label: 'Mẹ' },
];

export function MemberForm({ anchor, busy, error, onCancel, onSubmit }: Props) {
  const [relation, setRelation] = useState<Relation>('con');
  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState<Gender>('M');
  const [birthDate, setBirthDate] = useState('');
  const [birthOrder, setBirthOrder] = useState('');
  const [address, setAddress] = useState('');
  const [occupation, setOccupation] = useState('');

  const lockedGender = relation === 'bo' ? 'M' : relation === 'me' ? 'F' : null;
  const effectiveGender = lockedGender ?? gender;

  function submit(e: FormEvent) {
    e.preventDefault();
    const order = Number(birthOrder);
    onSubmit(relation, {
      fullName: fullName.trim(),
      gender: effectiveGender,
      birthDate: birthDate.trim() || undefined,
      birthOrder: Number.isFinite(order) && order > 0 ? order : undefined,
      address: address.trim() || undefined,
      occupation: occupation.trim() || undefined,
    });
  }

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Thêm thành viên">
      <div className="modal__backdrop" onClick={onCancel} />
      <form className="modal__panel" onSubmit={submit}>
        <h2 className="modal__title">Thêm người thân</h2>
        <p className="modal__lead">
          Người mới sẽ được nối vào gia phả qua <strong>{anchor.fullName}</strong>.
        </p>

        <fieldset className="chips">
          <legend className="field__label">Quan hệ với {anchor.fullName}</legend>
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

        <label className="field">
          <span className="field__label">Họ và tên</span>
          <input
            className="field__input"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            autoFocus
          />
        </label>

        <div className="field-row">
          <fieldset className="chips chips--tight">
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

          <label className="field field--narrow">
            <span className="field__label">Con thứ mấy</span>
            <input
              className="field__input"
              value={birthOrder}
              onChange={(e) => setBirthOrder(e.target.value)}
              inputMode="numeric"
              placeholder="1"
            />
          </label>
        </div>

        <label className="field">
          <span className="field__label">Ngày sinh</span>
          <input
            className="field__input"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            placeholder="1960 hoặc 1960-05 hoặc 1960-05-12"
          />
          <span className="field__hint">
            Chỉ nhớ năm cũng được — thứ tự sinh quan trọng hơn cho việc tính vai vế.
          </span>
        </label>

        <label className="field">
          <span className="field__label">Địa chỉ hiện tại</span>
          <input className="field__input" value={address} onChange={(e) => setAddress(e.target.value)} />
        </label>

        <label className="field">
          <span className="field__label">Công việc hiện tại</span>
          <input
            className="field__input"
            value={occupation}
            onChange={(e) => setOccupation(e.target.value)}
          />
        </label>

        {error && (
          <p className="login__error" role="alert">
            {error}
          </p>
        )}

        <div className="modal__actions">
          <button className="btn btn--ghost" type="button" onClick={onCancel}>
            Huỷ
          </button>
          <button className="btn btn--primary" type="submit" disabled={busy || !fullName.trim()}>
            {busy ? 'Đang lưu…' : 'Thêm vào gia phả'}
          </button>
        </div>
      </form>
    </div>
  );
}
