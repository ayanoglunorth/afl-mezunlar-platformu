export const runtime = 'nodejs';

export async function POST() {
  // NIST: Eski tarayıcı tetikli zamanlama akışını kapatır. Saldırı senaryosu:
  // istemci eski endpoint'i kullanarak çift e-posta veya tutarsız bildirim işi
  // oluşturur. Mesaj e-postaları artık yalnızca DB outbox + cron ile işlenir.
  return Response.json(
    { error: 'deprecated_notification_flow', message: 'Bildirim zamanlama akışı devre dışı.' },
    { status: 410 },
  );
}
