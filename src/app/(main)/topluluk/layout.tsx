import { ForumPrivacyProvider } from '@/components/forum/ForumPrivacyProvider';

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return <ForumPrivacyProvider>{children}</ForumPrivacyProvider>;
}
