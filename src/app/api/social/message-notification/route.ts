export const runtime = 'nodejs';

export async function POST() {
  // NIST: Eski sosyal mesaj e-posta endpoint'i kapalıdır. Saldırı senaryosu:
  // istemci mesaj e-postasını kalıcı outbox dışında doğrudan tetikler.
  return Response.json(
    { error: 'deprecated_notification_flow', message: 'Bildirim akışı devre dışı.' },
    { status: 410 },
  );
}
