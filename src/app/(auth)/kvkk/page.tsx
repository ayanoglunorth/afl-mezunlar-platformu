/* eslint-disable react/no-unescaped-entities */
import Link from 'next/link';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'KVKK Aydınlatma Metni | AFL Mezunlar Platformu',
  description: 'Macide-Ramiz Taşkınlar Fen Lisesi (AFL) Mezunlar Platformu kişisel verilerin korunması aydınlatma metni.',
};

export default function KvkkPage() {
  return (
    <div className="min-h-[100dvh] bg-surface-50 px-4 py-12 sm:px-6 md:py-24 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="space-y-6">
          <Link href="/kayit" className="inline-flex w-fit items-center gap-2 rounded-full border border-surface-200 bg-white/50 px-4 py-2 text-sm font-medium text-surface-500 shadow-sm backdrop-blur-sm transition-colors hover:text-brand-600">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Kayıt Sayfasına Dön
          </Link>

          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-surface-900 md:text-5xl">KVKK Aydınlatma Metni</h1>
            <p className="mt-4 text-lg text-surface-500">Son güncelleme tarihi: 30.07.2026</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-surface-200 bg-white shadow-xl shadow-brand-900/5">
          <div className="space-y-12 p-8 md:p-12">
            <div className="rounded-2xl border border-brand-100 bg-brand-50 p-6 text-sm leading-relaxed text-brand-800 shadow-sm md:text-base">
              <p>
                <strong>Macide-Ramiz Taşkınlar Fen Lisesi (AFL) Mezunlar Platformu</strong> olarak kişisel verilerinizin güvenliğine önem veriyoruz. Bu metin, platforma kayıt olurken ve platformu kullanırken hangi kişisel verilerin hangi amaçlarla işlendiğini sade ve anlaşılır şekilde açıklar.
              </p>
            </div>

            <Section index="1" title="Veri Sorumlusu">
              KVKK uyarınca Macide-Ramiz Taşkınlar Fen Lisesi Mezunlar Platformu ("Platform"), kişisel verilerinizi aşağıdaki amaçlar ve hukuki sebepler kapsamında veri sorumlusu sıfatıyla işlemektedir.
            </Section>

            <section className="space-y-4">
              <SectionTitle index="2" title="İşlenen Kişisel Veriler" />
              <div className="space-y-4 leading-relaxed text-surface-600">
                <p>Platforma kayıt olurken ve kullanım sırasında aşağıdaki veri kategorileri işlenebilir:</p>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <InfoCard title="Kimlik & İletişim" items={['Ad ve soyad', 'E-posta adresi']} />
                  <InfoCard title="Eğitim & Kariyer" items={['Okul numarası ve mezuniyet yılı', 'Üniversite, bölüm ve sınıf bilgileri', 'Çalışılan kurum, unvan ve mentorluk tercihleri']} />
                  <InfoCard
                    title="Platform Kullanımı & Güvenlik"
                    items={[
                      'Platform içi mesaj, şikâyet, değerlendirme ve geri bildirim kayıtları',
                      'Oturum, işlem güvenliği ve teknik hata kayıtları',
                      'Yetkisiz erişim ve suistimal incelemesi için gerekli sınırlı işlem kayıtları',
                    ]}
                    wide
                  />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <SectionTitle index="3" title="İşleme Amaçları" />
              <ul className="list-disc space-y-2 pl-5 leading-relaxed text-surface-600">
                <li><strong>Kayıt ve doğrulama:</strong> Platforma yalnızca AFL mensuplarının katılmasını sağlamak, okul numarası ve mezuniyet bilgileri üzerinden kimlik/üyelik uygunluğunu kontrol etmek.</li>
                <li><strong>Hizmetlerin yürütülmesi:</strong> Mezun ağı, mentorluk eşleştirmeleri, mesajlaşma ve platform içi bildirimleri çalıştırmak.</li>
                <li><strong>Güvenlik ve suistimal incelemesi:</strong> Sahte hesap, başkası adına kayıt, spam, taciz, yetkisiz erişim ve benzeri güvenlik olaylarını tespit etmek ve gerektiğinde yetkili yöneticiler tarafından incelemek.</li>
                <li><strong>İletişim ve geri bildirim:</strong> Platformla ilgili duyuru, destek, hata bildirimi ve kullanıcı geri bildirimlerini yönetmek.</li>
                <li><strong>Yasal yükümlülükler:</strong> Yetkili kamu kurum ve kuruluşlarından gelen hukuka uygun talepleri karşılamak ve muhtemel uyuşmazlıklarda hakları korumak.</li>
              </ul>
            </section>

            <section className="space-y-4">
              <SectionTitle index="4" title="Aktarım ve Saklama" />
              <div className="space-y-4 leading-relaxed text-surface-600">
                <p>Kişisel verileriniz ticari amaçlarla satılmaz, kiralanmaz veya pazarlama için üçüncü kişilere devredilmez.</p>
                <p>
                  Veriler; platformun çalışması için kullanılan bulut barındırma, veritabanı, güvenlik, e-posta iletimi ve benzeri teknik hizmet sağlayıcılarla sınırlı olarak paylaşılabilir. Bu sağlayıcıların altyapıları Türkiye dışında bulunabileceğinden, teknik hizmetlerin niteliğine göre yurt dışına aktarım söz konusu olabilir.
                </p>
                <p>
                  Veriler yalnızca platformun işleyişi, güvenliği, yasal yükümlülükler ve kullanıcı taleplerinin karşılanması için gerekli süre boyunca saklanır; gereklilik ortadan kalktığında silinir, yok edilir veya anonimleştirilir.
                </p>
              </div>
            </section>

            <section className="space-y-4">
              <SectionTitle index="5" title="Toplama Yöntemi ve Hukuki Sebep" />
              <div className="space-y-4 leading-relaxed text-surface-600">
                <p>Kişisel verileriniz kayıt formları, profil güncellemeleri, mesajlaşma ve platform kullanımınız sırasında elektronik ortamda, otomatik veya kısmen otomatik yöntemlerle toplanır.</p>
                <ul className="list-disc space-y-2 pl-5">
                  <li>Üyelik ve platform hizmetleri için sözleşmenin kurulması veya ifası,</li>
                  <li>Güvenlik, doğrulama ve kötüye kullanımın önlenmesi için meşru menfaat,</li>
                  <li>Yasal talepler ve saklama yükümlülükleri için hukuki yükümlülük,</li>
                  <li>Açık rıza gereken hallerde ayrıca ve açıkça alınacak açık rıza.</li>
                </ul>
                <p>Aydınlatma metni bilgilendirme amacı taşır; açık rıza gerektiren işlemler için aydınlatmadan ayrı bir onay metni ve ayrı bir beyan alınmalıdır.</p>
              </div>
            </section>

            <Section index="6" title="İlgili Kişi Hakları">
              KVKK'nın 11. maddesi kapsamındaki haklarınız doğrultusunda kişisel verilerinizin işlenip işlenmediğini öğrenebilir, düzeltme/silme talep edebilir, aktarıldığı üçüncü kişilere ilişkin bilgi isteyebilir ve mevzuatta tanınan diğer haklarınızı kullanabilirsiniz. Hesap silme talebinizi platformdaki ayarlar sayfasından başlatabilirsiniz.
            </Section>
          </div>

          <div className="flex flex-col items-center justify-center gap-4 border-t border-surface-200 bg-surface-50 p-8">
            <div className="rounded-full border border-surface-200 bg-white p-3 shadow-sm">
              <svg className="h-8 w-8 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <p className="max-w-lg text-center text-sm font-medium leading-relaxed text-surface-600">
              Platform, kişisel verileri korumak için erişim kontrolü, yetki ayrımı, kayıt izleri ve güvenli varsayılan davranış ilkelerini uygular.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ index, title, children }: { index: string; title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <SectionTitle index={index} title={title} />
      <p className="leading-relaxed text-surface-600">{children}</p>
    </section>
  );
}

function SectionTitle({ index, title }: { index: string; title: string }) {
  return (
    <h2 className="flex items-center gap-3 text-2xl font-bold text-surface-900">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-100 text-sm font-bold text-surface-700">{index}</span>
      {title}
    </h2>
  );
}

function InfoCard({ title, items, wide = false }: { title: string; items: string[]; wide?: boolean }) {
  return (
    <div className={`rounded-2xl border border-surface-100 bg-surface-50 p-5 ${wide ? 'sm:col-span-2' : ''}`}>
      <h3 className="mb-3 font-semibold text-surface-900">{title}</h3>
      <ul className="list-disc space-y-2 pl-5 text-sm text-surface-600">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}
