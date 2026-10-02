'use client';

import { useState } from 'react';
import { CheckCircle, PaperPlaneTilt, SpinnerGap, WarningCircle } from '@phosphor-icons/react';

type Status = {
  type: 'success' | 'error';
  message: string;
};

type DashboardContactBoxProps = {
  mode?: 'dashboard' | 'registration';
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function DashboardContactBox({ mode = 'dashboard' }: DashboardContactBoxProps) {
  const isRegistration = mode === 'registration';
  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<Status | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanMessage = message.trim();
    const cleanSenderName = senderName.trim();
    const cleanSenderEmail = senderEmail.trim().toLocaleLowerCase('tr-TR');

    if (isRegistration && cleanSenderName.length < 2) {
      setStatus({ type: 'error', message: 'Ad soyad alanını doldurmalısın.' });
      return;
    }

    if (isRegistration && !EMAIL_PATTERN.test(cleanSenderEmail)) {
      setStatus({ type: 'error', message: 'Geçerli bir e-posta adresi yazmalısın.' });
      return;
    }

    if (cleanMessage.length < 8) {
      setStatus({ type: 'error', message: 'Mesaj biraz daha açıklayıcı olmalı.' });
      return;
    }

    setSubmitting(true);
    setStatus(null);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: cleanMessage,
          ...(isRegistration
            ? { senderName: cleanSenderName, senderEmail: cleanSenderEmail, source: 'registration' }
            : {}),
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || 'Mesaj iletilemedi.');
      }

      setMessage('');
      if (isRegistration) {
        setSenderName('');
        setSenderEmail('');
      }
      setStatus({ type: 'success', message: 'Mesajın yönetime iletildi.' });
    } catch (error) {
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Mesaj iletilemedi.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-5xl px-6">
      <div className="rounded-[2rem] border border-surface-200/80 bg-white p-6 shadow-xl shadow-surface-900/5 sm:p-8">
        <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-700">İletişim</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-surface-900">
            {isRegistration ? 'Bize ulaş.' : 'Yönetime hızlıca ulaş.'}
          </h2>
          <p className="mt-3 max-w-prose text-sm leading-6 text-surface-600">
            {isRegistration
              ? 'Görüş, öneri ve geri bildirimlerini bize iletebilirsin. Mesajın bilgilerinle birlikte yönetime gönderilir.'
              : 'Görüş, öneri ve geri bildirimlerini bize iletebilirsin. Mesajın, bilgilerinle birlikte yönetime gönderilir.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {isRegistration && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="registration-contact-name" className="label">
                  Ad Soyad
                </label>
                <input
                  id="registration-contact-name"
                  value={senderName}
                  onChange={(event) => setSenderName(event.target.value)}
                  className="input bg-surface-50 focus:bg-white"
                  maxLength={120}
                  placeholder="Adın soyadın"
                  disabled={submitting}
                  required
                />
              </div>
              <div>
                <label htmlFor="registration-contact-email" className="label">
                  E-posta
                </label>
                <input
                  id="registration-contact-email"
                  type="email"
                  value={senderEmail}
                  onChange={(event) => setSenderEmail(event.target.value)}
                  className="input bg-surface-50 focus:bg-white"
                  maxLength={254}
                  placeholder="ornek@email.com"
                  disabled={submitting}
                  required
                />
              </div>
            </div>
          )}
          <label htmlFor="dashboard-contact-message" className="label">
            Mesajın
          </label>
          <textarea
            id="dashboard-contact-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className="input min-h-28 resize-none bg-surface-50 focus:bg-white"
            maxLength={1200}
            placeholder="Kısaca neye ihtiyacın olduğunu yaz..."
            disabled={submitting}
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-surface-500">{message.length}/1200</p>
            <button
              type="submit"
              className="btn-primary w-full sm:w-auto"
              disabled={
                submitting
                || message.trim().length < 8
                || (isRegistration && (senderName.trim().length < 2 || !EMAIL_PATTERN.test(senderEmail.trim())))
              }
            >
              {submitting ? <SpinnerGap className="h-4 w-4 animate-spin" weight="bold" /> : <PaperPlaneTilt className="h-4 w-4" weight="bold" />}
              Gönder
            </button>
          </div>

          {status && (
            <div
              className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-sm ${
                status.type === 'success'
                  ? 'border-brand-100 bg-brand-50 text-brand-800'
                  : 'border-red-100 bg-red-50 text-red-700'
              }`}
              role="status"
            >
              {status.type === 'success' ? <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" weight="fill" /> : <WarningCircle className="mt-0.5 h-4 w-4 shrink-0" weight="fill" />}
              <span>{status.message}</span>
            </div>
          )}
        </form>
        </div>
      </div>
    </section>
  );
}
