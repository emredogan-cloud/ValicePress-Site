import type { Metadata } from "next";
import Link from "next/link";

import { LegalShell } from "@/components/cinematic/legal-shell";
import { buildPageMetadata } from "@/lib/metadata";

/**
 * /kvkk — Kişisel Verilerin Korunması Kanunu aydınlatma metni.
 *
 * Phase 1.A. The dedicated TR-jurisdiction page. The English /privacy
 * already maps the full data flow; this page expresses the
 * KVKK-specific obligations (veri sorumlusu, işleme dayanağı, Madde
 * 11 hakları, KVKK Kurumu'na başvuru) in Turkish, the language the
 * regulator expects.
 *
 * Brand voice stays the same as the other legal pages — sade,
 * editoryal, kurumsal-soğuk değil.
 */
export const metadata: Metadata = buildPageMetadata({
  title: "KVKK aydınlatma metni",
  description:
    "Valice Press'in kişisel verilerinizi nasıl işlediğini ve KVKK kapsamındaki haklarınızı açıklayan aydınlatma metni.",
  path: "/kvkk",
  ogTitle: "KVKK aydınlatma metni — Valice Press",
  type: "article",
});

export default function KvkkPage() {
  return (
    <LegalShell
      eyebrow="Yasal"
      title="KVKK aydınlatma metni"
      lastUpdated="2026-05-30"
      intro={
        <p>
          6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında,
          Valice Press olarak hangi kişisel verilerinizi neden
          işlediğimizi, kimlerle paylaştığımızı ve sahip olduğunuz hakları
          aşağıda açıklıyoruz.
        </p>
      }
    >
      <h2>1. Veri sorumlusu</h2>
      <p>
        KVKK&apos;nın 3. maddesi uyarınca veri sorumlusu sıfatıyla Emre
        Doğan, şahıs firması olarak Valice Press platformunu
        işletmektedir. İletişim:{" "}
        <a href="mailto:emre30283@gmail.com">emre30283@gmail.com</a>.
      </p>

      <h2>2. İşlenen kişisel veriler</h2>
      <p>Aşağıdaki kişisel verilerinizi işliyoruz:</p>
      <ul>
        <li>
          <strong>Kimlik ve iletişim verisi:</strong> e-posta adresiniz
          ve isteğe bağlı görünür isminiz (Clerk üzerinden alınır).
        </li>
        <li>
          <strong>Müşteri işlem verisi:</strong> sipariş geçmişiniz,
          satın aldığınız kitaplar, kütüphane kayıtlarınız (Neon
          veritabanında saklanır).
        </li>
        <li>
          <strong>Ödeme verisi:</strong> kart bilgileri ve fatura
          adresiniz doğrudan Lemon Squeezy LLC (Merchant of Record, ABD)
          tarafından işlenir; bizim sunucularımıza hiçbir zaman dokunmaz.
        </li>
        <li>
          <strong>Kullanım verisi:</strong> okuma ilerlemeniz (son sayfa
          + yüzde), yazdığınız yorumlar ve puanlar.
        </li>
        <li>
          <strong>İşlem güvenliği verisi:</strong> IP adresi tabanlı
          hız sınırlama sayaçları (10 saniyelik pencere; Upstash
          Redis&apos;te tutulur).
        </li>
        <li>
          <strong>Pazarlama verisi:</strong> isteğe bağlı bülten
          aboneliğiniz (Resend Audiences üzerinden).
        </li>
      </ul>

      <h2>3. İşleme amaçları</h2>
      <p>
        Verilerinizi yalnızca aşağıdaki amaçlarla işliyoruz:
      </p>
      <ul>
        <li>Hesap oluşturma ve oturum yönetimi</li>
        <li>Sipariş alma, ödeme süreci, dijital kitap teslimatı</li>
        <li>Kütüphanenizdeki kitapları yeniden indirme imkânı sağlama</li>
        <li>Okuma ilerlemenizi cihazlar arasında senkronize etme</li>
        <li>Yorum ve puanlama özelliği</li>
        <li>İsteğe bağlı bülten gönderimi</li>
        <li>Yasal yükümlülüklerimizi yerine getirme (faturalandırma, vergi)</li>
        <li>Güvenlik, hız sınırlama ve kötüye kullanımın önlenmesi</li>
      </ul>

      <h2>4. İşlemenin hukuki dayanağı</h2>
      <p>
        KVKK Madde 5 ve 6 kapsamında işleme dayanaklarımız:
      </p>
      <ul>
        <li>
          <strong>Sözleşmenin ifası</strong> (m. 5/2-c): hesap, sipariş,
          teslimat
        </li>
        <li>
          <strong>Yasal yükümlülük</strong> (m. 5/2-ç): vergi ve
          muhasebe kayıtlarının saklanması (Lemon Squeezy aracılığıyla)
        </li>
        <li>
          <strong>Meşru menfaat</strong> (m. 5/2-f): güvenlik, hız
          sınırlama, hizmet iyileştirme
        </li>
        <li>
          <strong>Açık rıza</strong> (m. 5/1): bülten aboneliği — her
          bülten e-postasında bulunan &ldquo;Aboneliği iptal et&rdquo;
          bağlantısıyla istediğiniz an geri alabilirsiniz
        </li>
      </ul>

      <h2>5. Aktarılan üçüncü taraflar</h2>
      <p>
        Verileriniz aşağıdaki hizmet sağlayıcılarda barınır; bunların
        her biri KVKK uyumlu sözleşmelerle işbirliği içinde çalışır:
      </p>
      <ul>
        <li><strong>Clerk</strong> — kimlik doğrulama (ABD; KVKK uyumlu)</li>
        <li><strong>Lemon Squeezy LLC</strong> — ödeme süreci ve fatura (Amerika Birleşik Devletleri, Utah; Stripe bünyesinde)</li>
        <li><strong>Neon</strong> — PostgreSQL veritabanı (AB veri bölgesi)</li>
        <li><strong>Cloudflare R2</strong> — PDF dosya depolama (küresel CDN, AB bölgesi tercih edilir)</li>
        <li><strong>Inngest</strong> — kısa ömürlü iş kuyruğu metadata&apos;sı</li>
        <li><strong>Resend</strong> — transactional + bülten e-posta</li>
        <li><strong>Upstash Redis</strong> — hız sınırlama sayaçları</li>
        <li><strong>Vercel</strong> — hosting + anonim analitik</li>
      </ul>
      <p>
        Verilerinizi pazarlama amacıyla üçüncü taraflarla
        paylaşmıyoruz, satmıyoruz ve reklam ağlarıyla eşleştirmiyoruz.
      </p>

      <h2>6. Saklama süreleri</h2>
      <ul>
        <li>
          <strong>Hesap verisi:</strong> hesabınız aktif olduğu sürece;
          silme talebi sonrasında 30 gün içinde anonimleştirilir.
        </li>
        <li>
          <strong>Sipariş kayıtları:</strong> Vergi Usul Kanunu uyarınca
          on (10) yıl boyunca saklanır.
        </li>
        <li>
          <strong>Okuma ilerlemesi, yorumlar:</strong> hesabınızla
          birlikte silinir.
        </li>
        <li>
          <strong>IP-tabanlı hız sınırlama:</strong> 10 saniyelik
          pencere; otomatik silinir.
        </li>
      </ul>

      <h2>7. KVKK Madde 11 — Haklarınız</h2>
      <p>KVKK&apos;nın 11. maddesi uyarınca aşağıdaki haklara sahipsiniz:</p>
      <ul>
        <li>Kişisel verinizin işlenip işlenmediğini öğrenme</li>
        <li>Verinin işlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme</li>
        <li>Verinin aktarıldığı üçüncü kişileri bilme</li>
        <li>Verinin eksik veya yanlış işlenmiş olması halinde düzeltilmesini isteme</li>
        <li>Verinin silinmesini veya yok edilmesini isteme</li>
        <li>Düzeltme, silme veya yok etme işlemlerinin verinin aktarıldığı üçüncü taraflara bildirilmesini isteme</li>
        <li>İşlenen verilerin otomatik sistemlerle analiz edilmesi sonucu aleyhinize bir sonuç çıkmasına itiraz etme</li>
        <li>Kanuna aykırı işleme sebebiyle zarara uğramanız halinde tazminat talep etme</li>
      </ul>

      <h2>8. Haklarınızı nasıl kullanırsınız</h2>
      <p>
        Veri taşıma ve hesap silme için iki self-servis yol vardır:
      </p>
      <ul>
        <li>
          <strong>Verilerinizi indirin:</strong>{" "}
          <Link href="/account/settings">/account/settings</Link>{" "}
          sayfasındaki &ldquo;Export data&rdquo; butonu — profiliniz,
          siparişleriniz, kütüphaneniz, okuma ilerlemeniz ve yorumlarınız
          JSON formatında size verilir.
        </li>
        <li>
          <strong>Hesabınızı silin:</strong>{" "}
          <Link href="/account/settings">/account/settings</Link>{" "}
          sayfasındaki &ldquo;Delete account&rdquo; butonu — silebileceğimiz
          her şeyi sileriz. Yasal yükümlülüklerimiz nedeniyle saklanması
          gereken sipariş/vergi kayıtları korunur.
        </li>
      </ul>
      <p>
        Diğer KVKK talepleriniz için (düzeltme, itiraz, bilgi alma):
      </p>
      <ul>
        <li>
          <strong>E-posta:</strong>{" "}
          <a href="mailto:emre30283@gmail.com">emre30283@gmail.com</a>
        </li>
      </ul>
      <p>
        KVKK Madde 13/2 uyarınca talebinize en geç otuz (30) gün içinde
        cevap veririz. Cevabımız tarafınıza yine e-posta ile iletilir.
      </p>

      <h2>9. KVKK Kurumu&apos;na başvuru hakkı</h2>
      <p>
        Bize yapılan başvurunun reddi, cevap verilmemesi veya cevabın
        yetersiz bulunması halinde KVKK Madde 14 uyarınca Kişisel
        Verileri Koruma Kurulu&apos;na şikâyette bulunma hakkınız
        bulunmaktadır.
      </p>

      <h2>10. Değişiklikler</h2>
      <p>
        Bu metni değiştirdiğimizde sayfanın üstündeki &ldquo;Son
        güncellenme&rdquo; tarihini güncelleriz. Saklama veya paylaşım
        konusunda esaslı değişiklikler için ayrıca e-posta ile bilgi
        veririz.
      </p>

      <hr />

      <p>
        Sorularınız için:{" "}
        <a href="mailto:emre30283@gmail.com">emre30283@gmail.com</a>.
        Her mesaja cevap veriyoruz.
      </p>
    </LegalShell>
  );
}
