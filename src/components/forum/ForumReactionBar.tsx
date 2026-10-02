'use client';

import { useEffect, useMemo, useRef, useState, useTransition, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Confetti, HandsClapping, Heart, Lightbulb, ThumbsUp } from '@phosphor-icons/react';
import { getForumReactionPeople, toggleForumReaction } from '@/app/(main)/topluluk/actions';
import { getInitials, cn } from '@/lib/utils';
import type { ForumReactionTargetType, ForumReactionType, Profile } from '@/types/database';

const REACTIONS: { type: ForumReactionType; label: string; Icon: typeof ThumbsUp }[] = [
  { type: 'like', label: 'Beğen', Icon: ThumbsUp },
  { type: 'heart', label: 'Kalp', Icon: Heart },
  { type: 'insightful', label: 'Faydalı', Icon: Lightbulb },
  { type: 'celebrate', label: 'Kutla', Icon: Confetti },
  { type: 'thanks', label: 'Teşekkür', Icon: HandsClapping },
];

type ReactionPerson = Pick<Profile, 'id' | 'full_name' | 'role'>;

type Props = {
  targetType: ForumReactionTargetType;
  targetId: string;
  counts: Partial<Record<ForumReactionType, number>>;
  activeReactions: ForumReactionType[];
  peopleByReaction?: Partial<Record<ForumReactionType, ReactionPerson[]>>;
  compact?: boolean;
};

export function ForumReactionBar({
  targetType,
  targetId,
  counts,
  activeReactions,
  peopleByReaction,
  compact = false,
}: Props) {
  const [localCounts, setLocalCounts] = useState(counts);
  const [active, setActive] = useState(new Set(activeReactions));
  const [selected, setSelected] = useState<ForumReactionType | null>(null);
  const [people, setPeople] = useState<ReactionPerson[]>([]);
  const [peopleError, setPeopleError] = useState('');
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({});
  const [isPending, startTransition] = useTransition();
  const barRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const preparedPeople = useMemo(() => peopleByReaction || {}, [peopleByReaction]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        popoverRef.current
        && !popoverRef.current.contains(target)
        && !barRef.current?.contains(target)
      ) {
        setSelected(null);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  useEffect(() => {
    if (!selected) return;
    const close = () => setSelected(null);
    const closeOnPageScroll = (event: Event) => {
      const target = event.target;
      if (
        target instanceof Node
        && (
          popoverRef.current?.contains(target)
          || barRef.current?.contains(target)
        )
      ) {
        return;
      }
      setSelected(null);
    };

    window.addEventListener('resize', close);
    window.addEventListener('scroll', closeOnPageScroll, true);
    return () => {
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', closeOnPageScroll, true);
    };
  }, [selected]);

  function toggle(type: ForumReactionType) {
    const wasActive = active.has(type);
    setActive((current) => {
      const next = new Set(current);
      if (wasActive) next.delete(type);
      else next.add(type);
      return next;
    });
    setLocalCounts((current) => ({
      ...current,
      [type]: Math.max((current[type] || 0) + (wasActive ? -1 : 1), 0),
    }));

    startTransition(async () => {
      try {
        await toggleForumReaction({ targetType, targetId, reactionType: type });
      } catch {
        setActive((current) => {
          const next = new Set(current);
          if (wasActive) next.add(type);
          else next.delete(type);
          return next;
        });
        setLocalCounts((current) => ({
          ...current,
          [type]: Math.max((current[type] || 0) + (wasActive ? 1 : -1), 0),
        }));
      }
    });
  }

  function showPeople(event: React.MouseEvent<HTMLButtonElement>, type: ForumReactionType) {
    if (!localCounts[type]) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const width = Math.min(256, window.innerWidth - 24);
    const left = Math.min(Math.max(12, rect.left), window.innerWidth - width - 12);
    const top = Math.min(rect.bottom + 8, window.innerHeight - 120);
    const readyPeople = preparedPeople[type];

    setPopoverStyle({ left, top, width });
    setSelected(type);
    setPeopleError('');

    if (readyPeople) {
      setPeople(readyPeople);
      setPeopleLoading(false);
      return;
    }

    setPeople([]);
    setPeopleLoading(true);
    startTransition(async () => {
      try {
        setPeople((await getForumReactionPeople({ targetType, targetId, reactionType: type })) as ReactionPerson[]);
      } catch (reason) {
        setPeople([]);
        setPeopleError(reason instanceof Error ? reason.message : 'Liste alınamadı.');
      } finally {
        setPeopleLoading(false);
      }
    });
  }

  return (
    <div ref={barRef} className="flex flex-wrap gap-2">
      {REACTIONS.map(({ type, label, Icon }) => {
        const isActive = active.has(type);
        const count = localCounts[type] || 0;

        return (
          <div key={type} className="relative inline-flex">
            <button
              type="button"
              onClick={() => toggle(type)}
              disabled={isPending}
              aria-pressed={isActive}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-[background-color,border-color,color,transform] active:scale-[0.98] disabled:opacity-60',
                isActive
                  ? 'border-brand-200 bg-brand-50 text-brand-700'
                  : 'border-surface-200 bg-white text-surface-600 hover:border-surface-300 hover:bg-surface-100 hover:text-surface-900',
                compact && 'px-2 py-1',
              )}
            >
              <Icon className="h-3.5 w-3.5" weight={isActive ? 'fill' : 'bold'} />
              <span>{label}</span>
            </button>

            {count > 0 && (
              <button
                type="button"
                onClick={(event) => showPeople(event, type)}
                aria-expanded={selected === type}
                aria-label={`${label} ifadesini bırakanları gör`}
                className="-ml-1 rounded-r-lg border border-l-0 border-surface-200 bg-surface-50 px-1.5 text-xs font-bold tabular-nums text-surface-500 hover:bg-surface-100"
              >
                {count}
              </button>
            )}

            {selected === type && createPortal(
              <div
                ref={popoverRef}
                style={popoverStyle}
                className="fixed z-[100] rounded-xl border border-surface-200 bg-white p-3 text-left shadow-[0_20px_42px_-28px_rgba(17,17,17,0.35)]"
                role="dialog"
                aria-label={`${label} ifadesini bırakanlar`}
              >
                <p className="text-xs font-bold text-surface-900">{label} bırakanlar</p>
                {peopleLoading && <p className="mt-2 text-xs text-surface-500">Yükleniyor...</p>}
                {!peopleLoading && peopleError && <p role="alert" className="mt-2 text-xs text-red-700">{peopleError}</p>}
                {!peopleLoading && !peopleError && people.length === 0 && <p className="mt-2 text-xs text-surface-500">Liste boş.</p>}
                {!peopleLoading && people.length > 0 && (
                  <div className="mt-2 max-h-48 overscroll-contain space-y-1 overflow-y-auto">
                    {people.map((person) => (
                      <div key={person.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
                        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-50 text-[10px] font-bold text-brand-700">
                          {getInitials(person.full_name)}
                        </span>
                        <span className="truncate text-xs font-semibold text-surface-700">{person.full_name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>,
              document.body,
            )}
          </div>
        );
      })}
    </div>
  );
}
