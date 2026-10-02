import 'server-only';

export type FootballContentItem = {
  title: string;
  description: string;
};

export type FootballTournamentContent = {
  hero: {
    title: string;
    description: string;
  };
  flowTitle: string;
  flowSteps: FootballContentItem[];
  rulesTitle: string;
  rules: FootballContentItem[];
  cta: {
    title: string;
    description: string;
    button: string;
    listedButton: string;
    successText: string;
  };
};

const DEFAULT_CONTENT: FootballTournamentContent = {
  hero: {
    title: 'AFL Mezunlar Futbol Turnuvası',
    description:
      'AFL Mezunlar Topluluğu olarak yılda birkaç etkinlik ile adım adım platform içi bağları güçlendirmek istiyoruz. İlk etapta henüz fikir aşamasında olan Mezunlar Futbol Turnuvası için potansiyel talebi ölçüyoruz. Başvurunuzu bu sayfadan yapabilir; sorularınızı ve önerilerinizi ana sayfadaki iletişim kutucuğundan bizlere iletebilirsiniz.',
  },
  flowTitle: 'İşleyiş nasıl olacak?',
  flowSteps: [
    {
      title: 'Talep Yoklaması',
      description: 'Kaç takımın katılabileceğini gözlemleyeceğiz ve bu doğrultuda takvim-saat planlamasını yapacağız.',
    },
    {
      title: 'Gün-Saat Seçimi',
      description:
        'Talep sayısına göre bir takvim belirleyeceğiz ve katılmak isteyen Mezunlarımızdan belirlenen gün-saatlerden seçim yapmasını isteyeceğiz. Seçtikleri gün-saatte bir rakip ile eşleşip maçlarını oynayacaklar ve tur sistemi ile ilerleyecekler. Seçme şansını tek gün ile değil talep yoğunluğuna bağlı olarak birkaç gün ile esnek tutacağız.',
    },
    {
      title: 'İlk Maçlar',
      description: 'Planımız 24-30 Ağustos aralığında ilk maçları yapmak. Talep yoğunluğuna bağlı olarak 2. tur maçları da bu hafta yapılabilir.',
    },
    {
      title: 'Misafirler',
      description:
        'Turnuva süresince okulumuzu ziyaret edebilir, maçları izleyebilirsiniz. Eğer katılmak istiyor ama tam olarak takım oluşturamıyorsanız Topluluk sekmesinde paylaşım yaparak kendinize takım/takım arkadaşları bulabilirsiniz.',
    },
    {
      title: 'Ödül',
      description:
        'Turnuva sonunda kazanan takıma, okulumuz tarafından yeni dönemin ilk haftasında gerçekleşecek olan Mezunlar Buluşması ve Köfte Günü`nde ödül takdim edilecek.',
    },
  ],
  rulesTitle: 'Temel kurallar',
  rules: [
    {
      title: 'Takımlar',
      description: 'Takımlar 5 kişiden oluşmalı ve tüm takım üyeleri AFL Mezunu/Öğrencisi olmalı.',
    },
    {
      title: 'Zaman ve Konum',
      description: 'Maçlar akşam saatlerinde, 1 saatlik süreyle ve okulumuzun halısahasında oynanacak.',
    },
    {
      title: 'Uygunluk önemli',
      description:
        'Seçeceğiniz gün ve saatin sizin için uygunluğundan emin olun. Son anda yapılan değişiklikler hem karşı takımı hem de organizasyon için orada bulunacak herkesi mağdur edecektir.',
    },
    {
      title: 'Oyuncu Değişimi',
      description:
        'Turnuva süresince kadronuz sabit kalmak zorunda değildir. Yedek oyuncularla veya elenen takımlardan transferlerle kadronuzu takviminize en uygun formda şekillendirebilirsiniz.',
    },
  ],
  cta: {
    title: 'Takımınla Hazır Mısın?',
    description:
      'Eğer takımınız hazırsa ve uygunluğunuzdan eminseniz başvurabilirsiniz. Takvim ve saatler belirlendiğinde sizinle iletişime geçeceğiz. Eğer emin değilseniz lütfen başvurmayınız.',
    button: 'Katılmak İstiyorum',
    listedButton: 'Başvurunuz Alındı',
    successText: 'Başvurunuz iletildi.',
  },
};

export async function getFootballTournamentContent(): Promise<FootballTournamentContent> {
  return DEFAULT_CONTENT;
}
