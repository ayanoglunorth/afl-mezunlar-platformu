import { redirect } from 'next/navigation';

type ForumCategoryRedirectProps = {
  params: Promise<{ categorySlug: string }>;
};

export default async function ForumCategoryRedirectPage({ params }: ForumCategoryRedirectProps) {
  const { categorySlug } = await params;
  redirect(`/topluluk/${categorySlug}`);
}
