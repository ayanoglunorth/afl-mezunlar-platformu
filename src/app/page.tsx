import { Newsreader } from 'next/font/google';
import { Navbar } from '@/components/layout/Navbar';
import { HomePageShell } from '@/components/home/HomePageShell';

const heroSerif = Newsreader({
  subsets: ['latin', 'latin-ext'],
  style: ['normal', 'italic'],
  weight: ['400', '500', '600'],
  display: 'swap',
});

export default function HomePage() {
  return (
    <div className="relative flex min-h-[100dvh] flex-col bg-surface-0 selection:bg-brand-200 selection:text-brand-900">
      <Navbar />
      <HomePageShell heroSerifClassName={heroSerif.className} />
    </div>
  );
}
