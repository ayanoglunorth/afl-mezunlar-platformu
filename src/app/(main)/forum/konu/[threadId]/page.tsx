import { redirect } from 'next/navigation';

type ForumThreadRedirectProps = {
  params: Promise<{ threadId: string }>;
};

export default async function ForumThreadRedirectPage({ params }: ForumThreadRedirectProps) {
  const { threadId } = await params;
  redirect(`/topluluk/konu/${threadId}`);
}
