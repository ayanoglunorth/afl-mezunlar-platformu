import {
  CalendarCheck,
  FlagCheckered,
  ShieldCheck,
  SoccerBall,
  Trophy,
  UsersThree,
} from '@phosphor-icons/react/dist/ssr';
import type { FootballTournamentContent } from '@/lib/events/footballContent';

const FLOW_STEP_META = [
  {
    tone: 'border-brand-200 bg-brand-500/10 text-surface-900',
    iconTone: 'border-brand-200 bg-white text-brand-700',
    Icon: UsersThree,
  },
  {
    tone: 'border-surface-200 bg-surface-50 text-surface-900',
    iconTone: 'border-surface-200 bg-white text-surface-700',
    Icon: SoccerBall,
  },
  {
    tone: 'border-amber-200 bg-amber-500/10 text-surface-900',
    iconTone: 'border-amber-200 bg-white text-amber-800',
    Icon: CalendarCheck,
  },
  {
    tone: 'border-surface-200 bg-surface-50 text-surface-900',
    iconTone: 'border-surface-200 bg-white text-surface-700',
    Icon: FlagCheckered,
  },
  {
    tone: 'border-brand-200 bg-brand-500/10 text-surface-900',
    iconTone: 'border-brand-200 bg-white text-brand-700',
    Icon: Trophy,
  },
];

const RULE_META = [
  {
    tone: 'border-brand-200 bg-brand-500/10 text-surface-900',
    iconTone: 'text-brand-700',
    Icon: UsersThree,
  },
  {
    tone: 'border-surface-200 bg-surface-50 text-surface-900',
    iconTone: 'text-surface-700',
    Icon: ShieldCheck,
  },
  {
    tone: 'border-surface-200 bg-surface-50 text-surface-900',
    iconTone: 'text-surface-700',
    Icon: CalendarCheck,
  },
  {
    tone: 'border-brand-200 bg-brand-500/10 text-surface-900',
    iconTone: 'text-brand-700',
    Icon: SoccerBall,
  },
];

type FootballTournamentInfoProps = {
  content: Pick<FootballTournamentContent, 'hero' | 'flowTitle' | 'flowSteps' | 'rulesTitle' | 'rules'>;
};

export function FootballTournamentInfo({ content }: FootballTournamentInfoProps) {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-surface-200 bg-white p-6 shadow-[0_18px_52px_-44px_rgba(17,17,17,0.35)] sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="max-w-3xl text-3xl font-bold tracking-tight text-surface-900 sm:text-4xl">
              {content.hero.title}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-surface-600">
              {content.hero.description}
            </p>
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-brand-100 bg-brand-50 text-brand-700">
            <SoccerBall className="h-6 w-6" weight="duotone" aria-hidden="true" />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-surface-200 bg-white p-5 shadow-[0_18px_52px_-44px_rgba(17,17,17,0.35)] sm:p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand-100 bg-brand-50 text-brand-700">
            <FlagCheckered className="h-5 w-5" weight="duotone" aria-hidden="true" />
          </div>
          <h2 className="text-lg font-bold text-surface-900">{content.flowTitle}</h2>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {content.flowSteps.map(({ title, description }, index) => {
            const { tone, iconTone, Icon } = FLOW_STEP_META[index % FLOW_STEP_META.length];

            return (
              <article key={title} className={`relative rounded-xl border p-5 ${tone}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-lg border shadow-[0_10px_24px_-18px_rgba(17,17,17,0.3)] ${iconTone}`}>
                    <Icon className="h-4 w-4" weight="duotone" aria-hidden="true" />
                  </span>
                  <span className="text-xs font-bold text-surface-500">{String(index + 1).padStart(2, '0')}</span>
                </div>
                <h3 className="mt-5 text-base font-bold leading-6">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-surface-600">{description}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-surface-200 bg-white p-5 shadow-[0_18px_52px_-44px_rgba(17,17,17,0.35)] sm:p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand-100 bg-brand-50 text-brand-700">
            <ShieldCheck className="h-5 w-5" weight="duotone" aria-hidden="true" />
          </div>
          <h2 className="text-lg font-bold text-surface-900">{content.rulesTitle}</h2>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {content.rules.map(({ title, description }, index) => {
            const { tone, iconTone, Icon } = RULE_META[index % RULE_META.length];

            return (
              <article key={title} className={`rounded-xl border p-4 ${tone}`}>
                <Icon className={`h-5 w-5 ${iconTone}`} weight="duotone" aria-hidden="true" />
                <h3 className="mt-4 text-sm font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-surface-600">{description}</p>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
