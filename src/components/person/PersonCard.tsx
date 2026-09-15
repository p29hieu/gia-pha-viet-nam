import type { FamilyGraph } from '../../domain/graph';
import { resolveKinship } from '../../domain/kinship';
import type { Member } from '../../domain/types';
import { lifespan } from '../../lib/text';
import { Avatar } from '../ui/Avatar';

interface Props {
  member: Member;
  graph: FamilyGraph;
  myMemberId: string;
  selected?: boolean;
  /** Thẻ nhắc lại của người đã có nhánh riêng ở chỗ khác trong cây */
  echo?: boolean;
  onSelect: (id: string) => void;
  /** Thêm nhanh người thân. Chỉ hiện trên máy có chuột. */
  onQuickAdd?: (id: string) => void;
}

export function PersonCard({
  member,
  graph,
  myMemberId,
  selected,
  echo,
  onSelect,
  onQuickAdd,
}: Props) {
  const isMe = member.id === myMemberId;
  const kin = isMe ? null : resolveKinship(graph, myMemberId, member.id);
  const years = lifespan(member.birthDate, member.deathDate);

  const classes = [
    'person-card',
    isMe && 'person-card--me',
    selected && 'is-selected',
    echo && 'person-card--echo',
    member.deathDate && 'person-card--departed',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="person-card-wrap">
      <button
        className={classes}
        type="button"
        data-member-id={member.id}
        onClick={() => onSelect(member.id)}
      >
        <Avatar member={member} size={38} />
        <span className="person-card__body">
          <span className="person-card__name">{member.fullName}</span>
          {years && <span className="person-card__years">{years}</span>}
        </span>
        <span className={`person-card__tag${isMe ? ' person-card__tag--me' : ''}`}>
          {isMe ? 'Tôi' : kin?.callThem}
        </span>
        {echo && (
          <span className="person-card__echo" title="Người này có nhánh riêng ở nơi khác trong cây">
            ↗
          </span>
        )}
      </button>

      {onQuickAdd && (
        <button
          className="person-card__add"
          type="button"
          onClick={() => onQuickAdd(member.id)}
          title={`Thêm người thân cho ${member.fullName}`}
          aria-label={`Thêm người thân cho ${member.fullName}`}
        >
          +
        </button>
      )}
    </div>
  );
}
