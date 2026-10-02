export const runtime = 'nodejs';

export async function POST() {
  // NIST: Eski Resend scheduled-email iptal akışı artık no-op. Saldırı senaryosu:
  // eski tabloya bağlı iptal endpoint'i gereksiz servis-role sorguları yapar.
  // Yeni mesaj e-postaları okundu bilgisini DB trigger'larıyla atomik iptal eder.
  return Response.json({ cancelled: 0, deprecated: true });
}
