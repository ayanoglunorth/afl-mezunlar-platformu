<div align="center">
  <img src="public/afl-logo.svg" alt="AFL Mezunlar Platformu" width="128" />

  # AFL Mezunlar Platformu

  **Akhisar Fen Lisesi mezunlarını ve öğrencilerini güvenli, sürdürülebilir bir dijital toplulukta buluşturan platform.**

  [![Next.js](https://img.shields.io/badge/Next.js-16-18181b?style=flat-square&logo=next.js)](https://nextjs.org/)
  [![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-1c6033?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com/)
  [![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=flat-square&logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-Strict-2563eb?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

  [Platformu ziyaret et](https://aflmezunlar.org)
</div>

---

## Platform

AFL Mezunlar Platformu; okul topluluğundaki bilgi, deneyim ve dayanışmayı mezuniyet sonrasında da canlı tutmak için geliştirildi. Doğrulanmış üyeler güvenli biçimde iletişim kurabilir, öğrencilere mentorluk verebilir ve ortak ilgi alanlarında içerik paylaşabilir.

### Öne çıkan özellikler

- **Doğrulanmış topluluk:** Mezun ve öğrenci kayıtlarını kontrollü üyelik akışıyla doğrular.
- **YKS mentorluğu:** Öğrencileri uygun mezunlarla eşleştirir ve mentorluk sürecini yönetir.
- **Gerçek zamanlı iletişim:** Birebir sohbet, topluluk odaları ve anlık bildirimler sunar.
- **Topluluk forumu:** Kategoriler, etiketler, yanıtlar, tepkiler ve anonim paylaşım desteği sağlar.
- **Yönetim araçları:** Üyelik inceleme, moderasyon, denetim kayıtları ve CSV tabanlı veri yönetimi içerir.
- **E-posta bildirimleri:** AWS SES ve Cloudflare Cron ile zamanlanmış bildirimleri işler.

## Teknik yapı

| Katman | Teknoloji |
| --- | --- |
| Uygulama | Next.js 16 App Router, React 19, TypeScript |
| Arayüz | Tailwind CSS 4, Phosphor Icons |
| Veri ve kimlik | Supabase, PostgreSQL, Row Level Security |
| E-posta | AWS SES |
| Dağıtım | Cloudflare Workers, OpenNext |

## Yerel geliştirme

### Gereksinimler

- Node.js 20 veya üzeri
- npm
- Supabase projesi
- E-posta bildirimleri için isteğe bağlı AWS SES yapılandırması

### Kurulum

```bash
git clone https://github.com/ayanoglunorth/afl-mezunlar-platformu.git
cd afl-mezunlar-platformu
npm install
cp .env.example .env.local
npm run dev
```

Uygulama varsayılan olarak [http://localhost:3000](http://localhost:3000) adresinde çalışır.

### Ortam değişkenleri

| Değişken | Kullanım |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase proje adresi |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | İstemci tarafında kullanılabilen Supabase anahtarı |
| `SUPABASE_SERVICE_ROLE_KEY` | Yalnız sunucu tarafındaki yönetim işlemleri |
| `NEXT_PUBLIC_SITE_URL` | Uygulamanın genel adresi |
| `AWS_SES_REGION` | AWS SES bölgesi |
| `AWS_SES_ACCESS_KEY_ID` | AWS SES erişim anahtarı |
| `AWS_SES_SECRET_ACCESS_KEY` | AWS SES gizli anahtarı |
| `EMAIL_FROM` | Bildirimlerin gönderici adresi |
| `NOTIFICATION_CRON_SECRET` | Zamanlanmış bildirim uçlarının doğrulama anahtarı |

`SUPABASE_SERVICE_ROLE_KEY`, AWS anahtarları ve `NOTIFICATION_CRON_SECRET` hiçbir zaman istemci koduna veya Git geçmişine eklenmemelidir.

## Komutlar

| Komut | Açıklama |
| --- | --- |
| `npm run dev` | Yerel geliştirme sunucusunu başlatır |
| `npm run lint` | ESLint denetimini çalıştırır |
| `npm run build` | Next.js ve OpenNext production çıktısını üretir |
| `npm run preview` | Cloudflare uyumlu çıktıyı yerelde önizler |
| `npm run deploy` | Uygulamayı Cloudflare Workers'a dağıtır |

## Veritabanı

Supabase şeması ve güvenlik politikaları [`supabase/migrations`](supabase/migrations) altında sürümlenir. Yeni bir ortam kurarken migration dosyalarını numara sırasıyla uygulayın; üretim verilerini veya yerel bağlantı bilgilerini repoya eklemeyin.

## Katkı

Hata bildirimleri ve geliştirme önerileri için issue açabilirsiniz. Büyük değişikliklerde uygulamaya başlamadan önce kapsamı issue üzerinden netleştirin. Pull request'lerde lint, TypeScript ve production build kontrollerinin başarılı olması beklenir.

---

<div align="center">
  <sub>AFL ruhunu dijitalde yaşatmak için geliştirildi.</sub>
</div>
