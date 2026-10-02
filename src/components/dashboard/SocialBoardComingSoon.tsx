import { LockSimple, UserCircle } from '@phosphor-icons/react/dist/ssr';

const previewPeople = ['AFL', 'MT', 'ZE', 'BK'];

export function SocialBoardComingSoon() {
  return (
    <aside
      className="group relative flex h-full min-h-[30rem] flex-col overflow-hidden rounded-2xl border border-surface-200/80 bg-white/95 p-4 shadow-[0_1px_2px_rgba(17,17,17,0.04),0_18px_42px_-36px_rgba(17,17,17,0.28)]"
      aria-label="Sosyal board yakında yeniden açılacak"
    >
      <div className="pointer-events-none select-none blur-[3px] transition duration-200 group-hover:blur-[4px]">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-surface-900">Sosyal</h2>
            <p className="mt-0.5 truncate text-xs leading-5 text-surface-500">Aktif ve son aktif kullanıcılar</p>
          </div>
          <span className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-surface-200 bg-surface-50 px-2.5 text-[11px] font-semibold text-surface-700">
            <span className="h-2 w-2 rounded-full bg-brand-500 shadow-[0_0_0_3px_rgba(31,122,77,0.12)]" />
            0
            <span className="text-surface-400">online</span>
          </span>
        </div>

        <div className="mt-4 min-h-0 flex-1 space-y-1.5 overflow-hidden pr-1">
          {previewPeople.map((initials, index) => (
            <div key={initials} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left">
              <div className="relative shrink-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-surface-200 bg-surface-50 text-xs font-bold text-surface-800">
                  {initials}
                </div>
                <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${index === 0 ? 'bg-brand-500' : 'bg-surface-300'}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <p className="h-3.5 w-28 rounded-full bg-surface-200" />
                  <span className="h-3 w-10 rounded-full bg-surface-100" />
                </div>
                <p className="mt-2 h-3 w-40 rounded-full bg-surface-100" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/45 px-6 opacity-100 backdrop-blur-[1px]">
        <div className="translate-y-1 rounded-2xl border border-surface-200 bg-white/95 px-5 py-4 text-center shadow-[0_24px_60px_-36px_rgba(17,17,17,0.55)] transition duration-200 group-hover:translate-y-0 group-hover:shadow-[0_28px_70px_-34px_rgba(17,17,17,0.65)]">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-brand-100 bg-brand-50 text-brand-700">
            <LockSimple className="h-5 w-5" weight="duotone" />
          </div>
          <div className="mt-3 max-w-56 space-y-1 text-center leading-5">
            <p className="text-sm font-bold text-surface-900">Yakında</p>
            <p className="text-sm font-normal text-surface-700">Sosyal board geliştirme aşamasında.</p>
          </div>
        </div>
      </div>
      <UserCircle className="pointer-events-none absolute -bottom-8 -left-8 h-32 w-32 text-surface-100" weight="duotone" />
    </aside>
  );
}
