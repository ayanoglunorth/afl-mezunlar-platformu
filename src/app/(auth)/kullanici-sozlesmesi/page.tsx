/* eslint-disable react/no-unescaped-entities */
import Link from 'next/link';

export const metadata = {
  title: 'Kullanıcı Sözleşmesi | AFL Mezunlar Platformu',
  description: 'Macide-Ramiz Taşkınlar Fen Lisesi (AFL) Mezunlar Platformu kullanıcı sözleşmesi ve kullanım koşulları.',
};

export default function UserAgreementPage() {
  return (
    <div className="min-h-[100dvh] bg-surface-50 py-12 md:py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-6">
          <Link 
            href="/kayit" 
            className="inline-flex items-center gap-2 text-sm font-medium text-surface-500 hover:text-brand-600 transition-colors bg-white/50 px-4 py-2 rounded-full border border-surface-200 backdrop-blur-sm w-fit shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Kayıt Sayfasına Dön
          </Link>
          
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-surface-900">
              Kullanıcı Sözleşmesi
            </h1>
            <p className="mt-4 text-lg text-surface-500">
              Son güncelleme tarihi: {new Date().toLocaleDateString('tr-TR')}
            </p>
          </div>
        </div>

        {/* Content Container */}
        <div className="bg-white rounded-3xl shadow-xl shadow-brand-900/5 border border-surface-200 overflow-hidden">
          <div className="p-8 md:p-12 space-y-12">
            
            {/* Section 1 */}
            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-surface-900 flex items-center gap-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-100 text-brand-700 text-sm font-bold shrink-0">1</span>
                Taraflar ve Konu
              </h2>
              <div className="prose prose-surface max-w-none text-surface-600 space-y-4 leading-relaxed">
                <p>
                  Bu Kullanıcı Sözleşmesi ("Sözleşme"), <strong>Macide-Ramiz Taşkınlar Fen Lisesi (AFL) Mezunlar Platformu</strong> ("Platform") 
                  ile Platform'a kayıt olan tüm kullanıcılar ("Kullanıcı") arasında, Kullanıcı'nın Platform'a kayıt olması anında akdedilmiş ve yürürlüğe girmiştir.
                </p>
                <p>
                  Platformun amacı, Macide-Ramiz Taşkınlar Fen Lisesi mezunları, mevcut öğrencileri ve öğretmenleri arasında profesyonel ve sosyal iletişim kurmak, mentorluk süreçlerini yönetmek ve yardımlaşmayı teşvik etmektir.
                </p>
              </div>
            </section>

            {/* Section 2 */}
            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-surface-900 flex items-center gap-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-100 text-brand-700 text-sm font-bold shrink-0">2</span>
                Kayıt ve Kullanıcı Yükümlülükleri
              </h2>
              <div className="prose prose-surface max-w-none text-surface-600 space-y-4 leading-relaxed">
                <ul className="list-disc pl-5 space-y-2">
                  <li>Kullanıcılar kayıt olurken gerçek, doğru ve güncel bilgilerini vermekle yükümlüdür. Yanlış veya yanıltıcı bilgi verilmesi durumunda Platform, hesabı tek taraflı olarak askıya alma veya silme hakkına sahiptir.</li>
                  <li>Platforma yalnızca Macide-Ramiz Taşkınlar Fen Lisesi öğrencileri, mezunları ve öğretmenleri kayıt olabilir. Platform yönetimi, kayıtları onaylama veya reddetme hakkını saklı tutar.</li>
                  <li>Kullanıcılar, Platform üzerinde gerçekleştirdikleri tüm işlemlerden bizzat ve münhasıran sorumludur.</li>
                  <li>Hesap bilgileri ve şifre güvenliği tamamen kullanıcının kendi sorumluluğundadır. Hesabın yetkisiz kullanımı durumunda Platform sorumlu tutulamaz.</li>
                </ul>
              </div>
            </section>

            {/* Section 3 */}
            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-surface-900 flex items-center gap-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-100 text-brand-700 text-sm font-bold shrink-0">3</span>
                Kullanım Kuralları ve İçerik
              </h2>
              <div className="prose prose-surface max-w-none text-surface-600 space-y-4 leading-relaxed">
                <ul className="list-disc pl-5 space-y-2">
                  <li>Platform üzerinden yapılan tüm iletişimlerde saygı, dürüstlük ve profesyonellik esastır.</li>
                  <li>Hakaret, tehdit, taciz içeren, ayrımcı, nefret söylemi barındıran veya genel ahlaka aykırı herhangi bir içerik paylaşımı kesinlikle yasaktır ve derhal hesap iptali ile sonuçlanabilir.</li>
                  <li>Kullanıcılar, diğer kullanıcıların iletişim bilgilerini platformun amacı (mentorluk, kariyer gelişimi vb.) dışında kullanamaz, spam yapamaz veya ticari/siyasi reklam amacıyla kitle mesajları gönderemez.</li>
                  <li>Platform yönetimi, kurallara aykırı olduğunu tespit ettiği içerikleri önceden haber vermeksizin silme hakkına sahiptir.</li>
                </ul>
              </div>
            </section>

            {/* Section 4 */}
            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-surface-900 flex items-center gap-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-100 text-brand-700 text-sm font-bold shrink-0">4</span>
                Fikri Mülkiyet Hakları
              </h2>
              <div className="prose prose-surface max-w-none text-surface-600 space-y-4 leading-relaxed">
                <p>
                  Platformun tasarımı, yazılımı, alan adı ve bunlara ilişkin olarak oluşturulan her türlü marka, tasarım, logo, ticari takdim şekli ve içerik Platform yönetimine aittir. Kullanıcılar, Platform'un fikri mülkiyet haklarını ihlal edecek hiçbir eylemde bulunamazlar.
                </p>
                <p>
                  Kullanıcıların Platform'da paylaştıkları içeriklerin sorumluluğu kendilerine aittir, ancak Kullanıcılar bu içeriklerin Platform tarafından hizmetin sunulması amacıyla kullanılmasına izin vermiş sayılırlar.
                </p>
              </div>
            </section>

            {/* Section 5 */}
            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-surface-900 flex items-center gap-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-100 text-brand-700 text-sm font-bold shrink-0">5</span>
                Sorumluluk Reddi ve Sınırlamalar
              </h2>
              <div className="prose prose-surface max-w-none text-surface-600 space-y-4 leading-relaxed">
                <p>
                  AFL Mezunlar Platformu, gönüllülük esasına dayanan bir ağdır. Platform, kullanıcılar arasındaki iletişimin içeriğinden, mentorluk süreçlerinin sonuçlarından veya kullanıcıların birbirleriyle olan kişisel/profesyonel anlaşmazlıklarından hiçbir şekilde sorumlu tutulamaz.
                </p>
                <p>
                  Platform yönetimi, teknik arızalar, siber saldırılar, altyapı sorunları veya mücbir sebeplerden dolayı hizmetin kesintiye uğramasından ya da veri kaybından sorumlu değildir. Platform "olduğu gibi" sunulmaktadır ve kesintisiz veya hatasız olacağı garanti edilmez.
                </p>
              </div>
            </section>

            {/* Section 6 */}
            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-surface-900 flex items-center gap-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-100 text-brand-700 text-sm font-bold shrink-0">6</span>
                Sözleşme Değişiklikleri ve Fesih
              </h2>
              <div className="prose prose-surface max-w-none text-surface-600 space-y-4 leading-relaxed">
                <p>
                  Platform yönetimi, gerekli gördüğü durumlarda bu sözleşme üzerinde ve kullanım koşullarında tek taraflı olarak değişiklik yapma hakkını saklı tutar. Değişiklikler Platform üzerinden duyurulduğu veya yayınlandığı andan itibaren geçerli sayılır.
                </p>
                <p>
                  Kullanıcı, hesabını dilediği zaman silebilir. Platform, sözleşmeyi ihlal eden kullanıcıların hesaplarını askıya alabilir veya tamamen kapatabilir.
                </p>
              </div>
            </section>

            {/* Section 7 */}
            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-surface-900 flex items-center gap-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-100 text-brand-700 text-sm font-bold shrink-0">7</span>
                Uyuşmazlıkların Çözümü
              </h2>
              <div className="prose prose-surface max-w-none text-surface-600 space-y-4 leading-relaxed">
                <p>
                  Bu sözleşmenin uygulanmasından ve yorumlanmasından doğabilecek her türlü uyuşmazlığın çözümünde Türk Hukuku uygulanacak olup, Akhisar Mahkemeleri ve İcra Daireleri yetkilidir.
                </p>
              </div>
            </section>

          </div>
          
          <div className="bg-surface-50 p-6 md:p-8 border-t border-surface-200 text-center">
            <p className="text-surface-600 text-sm md:text-base font-medium">
              Platforma kayıt olarak bu sözleşmedeki tüm maddeleri okuduğunuzu, anladığınızı ve kabul ettiğinizi beyan etmiş olursunuz.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
