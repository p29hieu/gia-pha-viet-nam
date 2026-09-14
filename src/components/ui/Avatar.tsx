import type { Member } from '../../domain/types';

interface Props {
  member: Member;
  size?: number;
}

/** Ảnh đại diện. Chưa có ảnh thì dùng chữ cái đầu của tên. */
export function Avatar({ member, size = 40 }: Props) {
  const initial = member.fullName.trim().split(/\s+/).pop()?.charAt(0).toUpperCase() ?? '?';
  const style = { width: size, height: size, fontSize: size * 0.42 };

  if (member.photoUrl) {
    return (
      <img
        className="avatar"
        src={member.photoUrl}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        style={style}
      />
    );
  }
  return (
    <span
      className={`avatar avatar--letter avatar--${member.gender === 'M' ? 'nam' : 'nu'}`}
      style={style}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}
