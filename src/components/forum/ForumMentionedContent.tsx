import Link from 'next/link';
import { At } from '@phosphor-icons/react/dist/ssr';
import type React from 'react';
import type { Profile } from '@/types/database';

export type ForumMentionDisplay = Pick<Profile, 'id' | 'full_name' | 'role'> & {
  thread_id: string;
  post_id: string | null;
};

type ForumMentionedContentProps = {
  content: string;
  mentions: ForumMentionDisplay[];
  className?: string;
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function profileHref(userId: string) {
  return `/profil/${userId}`;
}

export function ForumMentionedContent({ content, mentions, className = '' }: ForumMentionedContentProps) {
  const uniqueMentions = Array.from(
    new Map(mentions.filter((mention) => mention.full_name).map((mention) => [mention.id, mention])).values(),
  );

  if (!uniqueMentions.length) {
    return <p className={className}>{content}</p>;
  }

  const mentionByName = new Map(uniqueMentions.map((mention) => [mention.full_name.toLocaleLowerCase('tr-TR'), mention]));
  const pattern = uniqueMentions
    .map((mention) => escapeRegExp(mention.full_name))
    .sort((left, right) => right.length - left.length)
    .join('|');
  const regex = new RegExp(`@(${pattern})(?=$|\\s|[.,!?;:;\\-)\\]])`, 'giu');
  const nodes: React.ReactNode[] = [];
  const linkedMentionIds = new Set<string>();
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const mention = mentionByName.get(match[1].toLocaleLowerCase('tr-TR'));
    if (!mention) continue;

    if (match.index > lastIndex) {
      nodes.push(content.slice(lastIndex, match.index));
    }

    linkedMentionIds.add(mention.id);
    nodes.push(
      <Link
        key={`${mention.id}-${match.index}`}
        href={profileHref(mention.id)}
        className="inline-flex items-center rounded-md bg-brand-50 px-1.5 py-0.5 font-semibold text-brand-700 transition-colors hover:bg-brand-100 hover:text-brand-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/25"
        aria-label={`${mention.full_name} profilini aç`}
      >
        @{mention.full_name}
      </Link>,
    );
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < content.length) {
    nodes.push(content.slice(lastIndex));
  }

  return (
    <div>
      <p className={className}>{nodes.length ? nodes : content}</p>
      {uniqueMentions.some((mention) => !linkedMentionIds.has(mention.id)) && (
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Etiketlenen kullanıcılar">
          {uniqueMentions.filter((mention) => !linkedMentionIds.has(mention.id)).map((mention) => (
            <Link
              key={mention.id}
              href={profileHref(mention.id)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-brand-100 bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 transition-colors hover:border-brand-200 hover:bg-brand-100 hover:text-brand-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/25"
              aria-label={`${mention.full_name} profilini aç`}
            >
              <At className="h-3.5 w-3.5" weight="bold" />
              {mention.full_name}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
