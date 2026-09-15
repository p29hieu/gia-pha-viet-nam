import { useEffect, useMemo, useRef, useState } from 'react';
import type { FamilyGraph } from '../../domain/graph';
import { computeLayout } from '../../domain/layout';
import { PersonCard } from '../person/PersonCard';

interface Props {
  graph: FamilyGraph;
  myMemberId: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onQuickAdd?: (id: string) => void;
}

const ZOOM_STEP = 0.15;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 1.4;

export function FamilyTree({ graph, myMemberId, selectedId, onSelect, onQuickAdd }: Props) {
  const layout = useMemo(() => computeLayout(graph), [graph]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Gia phả rộng hơn màn hình điện thoại rất nhiều, nên mở ra là đưa thẳng
  // người dùng tới vị trí của chính họ thay vì bắt tự cuộn đi tìm.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || !myMemberId) return;
    const card = container.querySelector<HTMLElement>(`[data-member-id="${myMemberId}"]`);
    if (!card) return;
    // Đo bằng getBoundingClientRect chứ không dùng offsetLeft: cây có transform
    // scale và nhiều tầng position:relative nên offsetParent không phải khung cuộn.
    const frame = requestAnimationFrame(() => {
      const box = container.getBoundingClientRect();
      const target = card.getBoundingClientRect();
      container.scrollLeft += target.left - box.left - (box.width - target.width) / 2;
      container.scrollTop += target.top - box.top - (box.height - target.height) / 2;
    });
    return () => cancelAnimationFrame(frame);
  }, [myMemberId, layout]);

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (layout.roots.length === 0) {
    return <p className="tree__empty">Gia phả chưa có ai. Hãy thêm người đầu tiên.</p>;
  }

  return (
    <div className="tree-wrap">
      <div className="tree-toolbar">
        <button
          className="btn btn--icon"
          type="button"
          onClick={() => setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP))}
          aria-label="Thu nhỏ"
        >
          −
        </button>
        <span className="tree-toolbar__value">{Math.round(zoom * 100)}%</span>
        <button
          className="btn btn--icon"
          type="button"
          onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP))}
          aria-label="Phóng to"
        >
          +
        </button>
        <button className="btn btn--icon btn--wide" type="button" onClick={() => setCollapsed(new Set())}>
          Mở hết
        </button>
      </div>

      <div className="tree-scroll" ref={scrollRef}>
        <div className="tree" style={{ transform: `scale(${zoom})` }}>
          <ul className="tree__level tree__level--root">
            {layout.roots.map((id) => (
              <TreeNode
                key={id}
                id={id}
                graph={graph}
                layout={layout}
                myMemberId={myMemberId}
                selectedId={selectedId}
                collapsed={collapsed}
                onToggle={toggle}
                onSelect={onSelect}
                onQuickAdd={onQuickAdd}
                depth={0}
              />
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

interface NodeProps extends Props {
  id: string;
  layout: ReturnType<typeof computeLayout>;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  depth: number;
}

function TreeNode({
  id,
  graph,
  layout,
  myMemberId,
  selectedId,
  collapsed,
  onToggle,
  onSelect,
  onQuickAdd,
  depth,
}: NodeProps) {
  const person = graph.members.get(id);
  if (!person || depth > 25) return null;

  const spouses = layout.spousesOf.get(id) ?? [];
  const children = layout.childrenOf.get(id) ?? [];
  const isCollapsed = collapsed.has(id);

  return (
    <li className="tree__node">
      <div className="tree__couple">
        <PersonCard
          member={person}
          graph={graph}
          myMemberId={myMemberId}
          selected={selectedId === id}
          onSelect={onSelect}
          onQuickAdd={onQuickAdd}
        />
        {spouses.map((sid) => {
          const spouse = graph.members.get(sid);
          if (!spouse) return null;
          return (
            <div className="tree__spouse" key={sid}>
              <span className="tree__knot" aria-hidden="true" />
              <PersonCard
                member={spouse}
                graph={graph}
                myMemberId={myMemberId}
                selected={selectedId === sid}
                onSelect={onSelect}
                onQuickAdd={onQuickAdd}
                echo={layout.echoed.has(sid)}
              />
            </div>
          );
        })}
        {children.length > 0 && (
          <button
            className="tree__toggle"
            type="button"
            onClick={() => onToggle(id)}
            aria-expanded={!isCollapsed}
            aria-label={isCollapsed ? `Mở ${children.length} người con` : 'Thu gọn nhánh'}
          >
            {isCollapsed ? `+${children.length}` : '−'}
          </button>
        )}
      </div>

      {children.length > 0 && !isCollapsed && (
        <ul className="tree__level">
          {children.map((cid) => (
            <TreeNode
              key={cid}
              id={cid}
              graph={graph}
              layout={layout}
              myMemberId={myMemberId}
              selectedId={selectedId}
              collapsed={collapsed}
              onToggle={onToggle}
              onSelect={onSelect}
              onQuickAdd={onQuickAdd}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
