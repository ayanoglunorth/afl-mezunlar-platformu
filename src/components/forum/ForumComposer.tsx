'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { At, X } from '@phosphor-icons/react';
import { searchForumMentionUsers } from '@/app/(main)/topluluk/actions';
import { getInitials } from '@/lib/utils';
import type { Profile } from '@/types/database';

type MentionUser = Pick<Profile, 'id' | 'full_name' | 'role'>;

function roleLabel(role: Profile['role']) {
  if (role === 'student') return 'Öğrenci';
  if (role === 'alumni') return 'Mezun';
  if (role === 'teacher') return 'Öğretmen';
  if (role === 'admin') return 'Yönetici';
  return 'Üye';
}

type ForumComposerProps = {
  name?: string;
  rows?: number;
  required?: boolean;
  placeholder: string;
  className?: string;
  initialValue?: string;
  initialMentions?: MentionUser[];
  resetSignal?: number;
  focusSignal?: number;
};

export function ForumComposer({
  name = 'content',
  rows = 5,
  required = true,
  placeholder,
  className = '',
  initialValue = '',
  initialMentions = [],
  resetSignal = 0,
  focusSignal = 0,
}: ForumComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(initialValue);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MentionUser[]>([]);
  const [selectedMentions, setSelectedMentions] = useState<MentionUser[]>(initialMentions);
  const [isPending, startTransition] = useTransition();

  const mentionIds = useMemo(
    () => selectedMentions.map((mention) => mention.id).join(','),
    [selectedMentions],
  );

  useEffect(() => {
    if (query.length < 2) {
      return;
    }

    startTransition(async () => {
      const users = await searchForumMentionUsers(query);
      setResults(users);
    });
  }, [query]);

  useEffect(() => {
    if (resetSignal <= 0) return;
    const resetId = window.setTimeout(() => {
      setValue('');
      setQuery('');
      setResults([]);
      setSelectedMentions([]);
    }, 0);
    return () => window.clearTimeout(resetId);
  }, [resetSignal]);

  useEffect(() => {
    if (focusSignal > 0) {
      textareaRef.current?.focus();
    }
  }, [focusSignal]);

  function handleChange(nextValue: string) {
    setValue(nextValue);
    const match = nextValue.match(/@([\p{L}\p{N}._-]{2,})$/u);
    const nextQuery = match?.[1] || '';
    setQuery(nextQuery);
    if (nextQuery.length < 2) {
      setResults([]);
    }
  }

  function insertMention(user: MentionUser) {
    const nextValue = value.replace(/@([\p{L}\p{N}._-]{2,})$/u, `@${user.full_name} `);
    setValue(nextValue);
    setQuery('');
    setResults([]);
    setSelectedMentions((current) => (
      current.some((mention) => mention.id === user.id) ? current : [...current, user]
    ));
  }

  function removeMention(userId: string) {
    setSelectedMentions((current) => current.filter((mention) => mention.id !== userId));
  }

  return (
    <div className={`relative ${className}`}>
      <textarea
        ref={textareaRef}
        name={name}
        value={value}
        onChange={(event) => handleChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        required={required}
        className="input resize-y leading-6"
      />
      <input type="hidden" name="mentionIds" value={mentionIds} />

      {selectedMentions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {selectedMentions.map((mention) => (
            <span key={mention.id} className="inline-flex items-center gap-1.5 rounded-lg border border-brand-100 bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
              <At className="h-3.5 w-3.5" weight="bold" />
              {mention.full_name}
              <button
                type="button"
                onClick={() => removeMention(mention.id)}
                className="rounded p-0.5 text-brand-500 transition hover:bg-brand-100 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/25"
                aria-label={`${mention.full_name} etiketini kaldır`}
              >
                <X className="h-3 w-3" weight="bold" />
              </button>
            </span>
          ))}
        </div>
      )}

      {query.length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-surface-200 bg-white shadow-[0_20px_42px_-28px_rgba(17,17,17,0.35)]">
          {isPending && <p className="px-4 py-3 text-sm text-surface-500">Kişiler aranıyor...</p>}
          {!isPending && results.length === 0 && <p className="px-4 py-3 text-sm text-surface-500">Eşleşen kullanıcı yok.</p>}
          {!isPending && results.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => insertMention(user)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-100"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-brand-100 bg-brand-50 text-xs font-bold text-brand-700">
                {getInitials(user.full_name)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-surface-900">{user.full_name}</span>
                <span className="block text-xs text-surface-500">{roleLabel(user.role)}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
