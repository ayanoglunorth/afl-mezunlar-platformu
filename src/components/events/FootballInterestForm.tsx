'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { CheckCircle, SpinnerGap, WarningCircle } from '@phosphor-icons/react';
import {
  submitFootballInterest,
  withdrawFootballInterest,
  type FootballInterestActionState,
} from '@/app/(main)/etkinlik/actions';
import type { FootballTournamentContent } from '@/lib/events/footballContent';
import type { EventInterest } from '@/types/database';

type FootballInterestFormProps = {
  isAuthenticated: boolean;
  isVerified: boolean;
  existingInterest: Pick<EventInterest, 'interest_type' | 'team_name' | 'estimated_player_count' | 'note'> | null;
  content: FootballTournamentContent['cta'];
};

const INITIAL_STATE: FootballInterestActionState = { type: 'idle', message: '' };
const AUTH_REQUIRED_TEXT = 'Katılmak için giriş yapman gerekiyor.';
const VERIFICATION_REQUIRED_TEXT = 'Hesabın onaylandıktan sonra katılımını iletebilirsin.';

type PendingConfirmation = 'submit' | 'withdraw' | null;

export function FootballInterestForm({ isAuthenticated, isVerified, existingInterest, content }: FootballInterestFormProps) {
  const [state, setState] = useState<FootballInterestActionState>(INITIAL_STATE);
  const [hasInterest, setHasInterest] = useState(Boolean(existingInterest));
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation>(null);
  const [isPending, startTransition] = useTransition();

  if (!isAuthenticated) {
    return (
      <div className="rounded-2xl border border-surface-200 bg-white p-5 text-center shadow-[0_18px_52px_-44px_rgba(17,17,17,0.35)] sm:p-6">
        <h2 className="text-lg font-bold text-surface-900">{content.button}</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-surface-600">{AUTH_REQUIRED_TEXT}</p>
        <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
          <Link href="/giris" className="btn-primary">Giriş yap</Link>
        </div>
      </div>
    );
  }

  if (!isVerified) {
    return (
      <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5 text-center text-amber-900 sm:p-6">
        <h2 className="text-lg font-bold">{content.button}</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6">{VERIFICATION_REQUIRED_TEXT}</p>
      </div>
    );
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setPendingConfirmation(hasInterest ? 'withdraw' : 'submit');
  }

  function confirmAction() {
    if (pendingConfirmation === 'withdraw') {
      setPendingConfirmation(null);
      setState(INITIAL_STATE);

      startTransition(async () => {
        const result = await withdrawFootballInterest();
        setState(result);

        if (result.type === 'success') {
          setHasInterest(false);
        }
      });

      return;
    }

    if (pendingConfirmation !== 'submit') {
      return;
    }

    setPendingConfirmation(null);
    const formData = new FormData();
    formData.set('interestType', 'team');
    setState(INITIAL_STATE);

    startTransition(async () => {
      const result = await submitFootballInterest(formData);
      setState(result);

      if (result.type === 'success') {
        setHasInterest(true);
      }
    });
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-surface-200 bg-white p-6 text-center shadow-[0_18px_52px_-44px_rgba(17,17,17,0.35)] sm:p-8">
      <h2 className="text-xl font-bold text-surface-900">{content.title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-surface-600">
        {content.description}
      </p>

      <div className="mt-6 flex flex-col items-center gap-3">
        <button type="submit" className="btn-primary min-h-12 px-6 text-base" disabled={isPending}>
          {isPending ? <SpinnerGap className="h-4 w-4 animate-spin" weight="bold" /> : <CheckCircle className="h-4 w-4" weight="bold" />}
          {hasInterest ? content.listedButton : content.button}
        </button>

        {state.type !== 'idle' && (
          <div
            role="status"
            className={`flex max-w-xl items-start gap-2 rounded-xl border px-3 py-2 text-left text-sm ${
              state.type === 'success'
                ? 'border-brand-100 bg-brand-50 text-brand-800'
                : 'border-red-100 bg-red-50 text-red-700'
            }`}
          >
            {state.type === 'success' ? <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" weight="fill" /> : <WarningCircle className="mt-0.5 h-4 w-4 shrink-0" weight="fill" />}
            <span>{state.type === 'success' ? state.message || content.successText : state.message}</span>
          </div>
        )}
      </div>
      {pendingConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-950/45 px-4 py-6 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="football-interest-confirm-title"
            aria-describedby="football-interest-confirm-description"
            className="w-full max-w-md rounded-2xl border border-surface-200 bg-white p-5 text-left shadow-[0_24px_80px_-40px_rgba(17,17,17,0.55)] sm:p-6"
          >
            <div className="flex items-start gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                pendingConfirmation === 'withdraw'
                  ? 'border-red-100 bg-red-50 text-red-700'
                  : 'border-brand-100 bg-brand-50 text-brand-700'
              }`}
              >
                {pendingConfirmation === 'withdraw' ? (
                  <WarningCircle className="h-5 w-5" weight="duotone" aria-hidden="true" />
                ) : (
                  <CheckCircle className="h-5 w-5" weight="duotone" aria-hidden="true" />
                )}
              </div>
              <div className="min-w-0">
                <h3 id="football-interest-confirm-title" className="text-base font-bold text-surface-900">
                  {pendingConfirmation === 'withdraw' ? 'Başvuruyu geri al' : 'Başvuruyu ilet'}
                </h3>
                <p id="football-interest-confirm-description" className="mt-2 text-sm leading-6 text-surface-600">
                  {pendingConfirmation === 'withdraw'
                    ? 'Başvurunuzu geri almak istediğinizden emin misiniz?'
                    : 'Başvurunuzu iletmek istediğinizden emin misiniz?'}
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="btn-secondary min-h-11 px-4"
                onClick={() => setPendingConfirmation(null)}
                disabled={isPending}
              >
                Vazgeç
              </button>
              <button
                type="button"
                className="btn-primary min-h-11 px-4"
                onClick={confirmAction}
                disabled={isPending}
              >
                {isPending ? <SpinnerGap className="h-4 w-4 animate-spin" weight="bold" /> : null}
                Onayla
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
