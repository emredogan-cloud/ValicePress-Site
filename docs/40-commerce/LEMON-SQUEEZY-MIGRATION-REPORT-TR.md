# Paddle → Lemon Squeezy Göç Raporu

**Tarih:** 13 Eylül 2026 · **Dal:** `commerce/lemon-squeezy-migration` ·
**Durum:** `PARTIALLY READY` — kod tamam, mağaza aktivasyonu bekliyor.

**Etiketler:** **GÖZLEM** = bu oturumda ölçüldü · **BELGE** = yazılı kaynaktan okundu ·
**DOĞRULANMIŞ** = canlı sistemde test edildi · **MODEL** = çıkarım · **ENGEL** = ilerlemeyi durduran.

> **Bu rapor yapılan işi belgeler, satış yapıldığını değil.** Hiçbir gerçek
> ödeme alınmadı ve hiçbir uçtan uca ödeme testi çalıştırılmadı — mağaza
> henüz canlı satış yapamıyor. *"Lemon Squeezy çalışıyor"* cümlesi bu raporda
> geçmiyor ve panelin açılması o cümleyi kurmaya yetmez.

---

## 1. Paddle mimarisi denetimi

Tam envanter: **`PADDLE-RETIREMENT-INVENTORY.md`**. Özet:

**GÖZLEM** — Paddle, kaynak ağacında 80'den fazla dosyaya değiyordu; ama
**para alan** yüzey dörttü: SDK istemcisi, webhook rotası, sepet aksiyonu,
sepet özeti düğmesi. Geri kalanı ya tarihsel yorum ya veritabanı sütunuydu.

Ayrımı yapmak raporun ilk işiydi: **para alan** her şey bugün duracak,
**alınmış parayı kaydeden** her şey sonsuza kadar çalışmaya devam edecek.

---

## 2. Emekli edilenler

**GÖZLEM** — Silinen: `src/lib/paddle.ts`, `src/app/api/webhooks/paddle/route.ts`.
Yeniden yazılan: `src/app/cart/actions.ts`, `src/components/cart/cart-summary.tsx`.
Boşaltılan: 27 kitabın `paddlePriceId` alanı.

**Gizli geri dönüş yolu bırakılmadı.** `PAYMENT_PROVIDER=paddle` yazılsa bile
kayıtlı bir adaptör olmadığı için `getPaymentProvider()` açık bir hata
fırlatır — sessizce Paddle'a düşmez.

**Korunanlar:** `books.paddle_price_id` sütunu, 27 Paddle fiyat kimliğinin
donmuş arşivi (`RETIRED_PADDLE_PRICE_IDS`), dört Paddle betiği ve
`commerce_events` tablosundaki tüm Paddle satırları.

---

## 3. Lemon Squeezy hesap denetimi

**GÖZLEM** — Hesap gerçekten canlı ve ödeme alabiliyor: kimlik doğrulaması
*Active*, 2FA *Active*, banka hesabı bağlı (TRY), vergi bilgisi *Submitted*,
altı canlı webhook ve gerçek abonelik siparişleri akıyor.

**GÖZLEM** — Ama hesapta Valice Press yoktu. İki mağaza vardı:
*Ehliyet Akademi* (`#323133`, sürücü kursu, 3 ilgisiz ürün) ve
*Vibingcoderai* (`#376767`). Mağaza adı **her makbuz ve faturada** yazdığı
için, kitap alan okuyucuya bir sürücü kursundan makbuz gitmesi kabul
edilemezdi.

**Founder kararı** → aynı hesap içinde üçüncü bir mağaza:

| | |
|---|---|
| Mağaza | **Valice Press** |
| Kimlik | `#473583` · `valicepress.lemonsqueezy.com` |
| Para birimi | **USD** — mağaza TRY olarak açıldı, düzeltildi (**GÖZLEM**) |
| Ülke | Türkiye (banka TRY, vergi bilgisi verilmiş — tahmin değil, okundu) |
| İletişim | `emre30283@gmail.com` |
| Apple Pay / Google Pay | Açık |

**ENGEL** — Yeni mağaza **test modunda** doğuyor ve çıkışı iki Founder
işlemine bağlı: **kimlik doğrulama** ve **banka hesabı bağlama**. İkisi de
bir ajanın yapmaması gereken işlemler (kişisel kimlik ve finansal kimlik
bilgisi girişi).

---

## 4. API kimlik bilgisi

**GÖZLEM** — `Valice Press Site (test)` adlı anahtar oluşturuldu (13 Eylül
2026, son kullanma 13 Mart 2027). **Değeri kaydedilemedi:** sayfadan kimlik
bilgisi okuma girişimi güvenlik sınıflandırıcısı tarafından engellendi. Bu
doğru davranıştır ve etrafından dolaşılmadı.

**Yapılması gereken:** panelden yeni bir anahtar oluşturup `.env.local`
dosyasına yapıştırmak; eskisini silmek.

`API KEY CREATED` · `VALUE NOT CAPTURED` · `STORED IN — henüz hiçbir yerde`

**Not (BELGE):** Lemon Squeezy anahtarları **mod kapsamlıdır**. Test modunda
üretilen anahtar yalnızca test verisi görür. Mağaza aktive edildikten sonra
**canlı modda yeni bir anahtar** üretilmelidir.

---

## 5. Webhook mimarisi

**BELGE** — Sözleşme, 13 Eylül 2026'da sağlayıcının kendi belgelerinden
okundu:

| | |
|---|---|
| İmza | `X-Signature` — ham gövde üzerinde **HMAC-SHA256 hex** |
| Olay adı | `X-Signature` dışında `X-Event-Name`; **imzalı** kopyası `meta.event_name` |
| Yeniden deneme | 200 dışında yanıt → 3 deneme daha (5 sn, 25 sn, 125 sn), sonra **kalıcı vazgeçme** |

**Uygulama:** `src/app/api/webhooks/lemonsqueezy/route.ts` +
`src/lib/payments/lemonsqueezy/webhook.ts`.

**Güvenlik kararı (GÖZLEM):** olay dağıtımı `X-Event-Name` başlığına değil,
**imzalı gövdedeki** `meta.event_name` alanına bakar. Başlık imzanın dışında;
sahte bir başlık gerçek bir ödemeyi iade gibi işletebilirdi. Bunu ölçen bir
test var: *"dispatches on the SIGNED event name, not on the X-Event-Name
header"*.

**Abone olunan olaylar — ve yalnızca bunlar:** `order_created`,
`order_refunded`. Abonelik olayları bu mağazada kullanılmıyor; olmayan bir
olayı dinleyen kod yazılmadı.

---

## 6. Idempotency

**GÖZLEM** — Idempotency anahtarı `lemonsqueezy:<olay>:<sipariş kimliği>`
biçiminde ve **teslimattan değil olaydan** türetiliyor. Sebebi kritik: Lemon
Squeezy'nin belgelenmiş yükünde teslimat başına benzersiz bir kimlik yok, ve
teslimat kimliğine dayanan bir anahtar her yeniden denemede *yeni* görünüp
kitabı ikinci kez teslim ederdi.

İki kat koruma:

1. `orders.mor_order_ref` **UNIQUE** — `onConflictDoNothing().returning()`
   kalıbı veritabanına atomik olarak "bu ilk kez mi?" diye sorar.
2. `commerce_events.provider_event_id` **UNIQUE** — denetim izi de tekilleşir.

**DOĞRULANMIŞ** — `webhook.test.ts` → *"DUPLICATE — a re-delivery produces a
byte-identical idempotency key"*. 30 testin tamamı geçiyor.

---

## 7. Ürün modeli

**BİR KİTAP → BİR ÜRÜN → BİR VARYANT.** Ayrıntı ve tam eşleme:
`LEMON-SQUEEZY-PRODUCT-MASTER.md`.

**BELGE** — Lemon Squeezy bir kasayı **tek bir varyanta** bağlar
(`relationships.variant`, tekil). Çok ürünlü sepet **yoktur**.

---

## 8. Web sitesi göçü — ve sepetin dürüst hâli

Bu, göçün en görünür sonucu.

**Paddle'da:** sepet → tek işlem → çok satır → tek ödeme.
**Lemon Squeezy'de:** böyle bir istek yok.

**GÖZLEM** — Seçilen çözüm: satın alma düğmesi **her kitabın kendi satırına**
taşındı. `<CartSummary>` içindeki tek "Checkout securely" düğmesi kaldırıldı
ve yerine okuyucunun gördüğü bir cümle kondu: *"Digital editions are bought
one at a time."*

**Reddedilen alternatif:** tek düğme arkasında döngüyle üç ayrı ödeme almak.
Bu, okuyucuya söylenmeden üç kez kart çekmek olurdu — ve Lemon Squeezy
chargeback için webhook bile göndermiyor.

`createCheckout()` çok satırlı bir sepeti **açıkça reddeder** ve sebebini
söyler. Sessizce ilk kitabı satmaz.

---

## 9. Sağlayıcı değişiminin bedeli — dürüstçe

**BELGE** — Lemon Squeezy'nin yayımlanmış sipariş olayları **ikidir**.
Paddle dördünü gönderiyordu. Kaybedilenler:

| Paddle olayı | Lemon Squeezy karşılığı |
|---|---|
| `transaction.payment_failed` | **Yok.** Yalnızca `order_created` + `status != 'paid'` olarak görülür |
| `transaction.canceled` | **Yok.** Hiç görülmez |
| `adjustment.created` (`chargeback`) | **Yok.** İtirazlar yalnızca panelden okunur |
| `adjustment.created` (`refund`) | `order_refunded` ✓ |

**GÖZLEM** — Bu kayıp `ProviderCapabilities` içinde **boolean olarak**
yazıldı (`paymentFailedWebhook: false`, `chargebackWebhook: false`), böylece
hiçbir kod asla gelmeyecek bir olayı beklemez.

---

## 10–12. Teslimat, e-posta, sipariş kaydı

**Akış:** ödeme → webhook → imza → olay çevirisi → kitap çözümleme → sipariş +
entitlement (`pending`) → Inngest filigran işi → R2 → entitlement `ready` →
e-posta.

**GÖZLEM** — Kitap çözümlemesinde **iki yol** var ve ikisi de tam eşleşme:

1. `meta.custom_data.book_ids` — kasayı biz açtığımızda koyduğumuz kimlik;
2. `first_order_item.variant_id` → `books.provider_price_id` — Lemon Squeezy
   mağaza sayfasından yapılan, bizim kasamızdan geçmeyen alışveriş için.

Hiçbiri yaklaşık eşleşme yapmaz: *World Myths* kasası hiçbir koşulda
*World Games* teslim edemez. Bunu ölçen test: *"never resolves one book's
purchase to another book"*.

**GÖZLEM** — `FULFILLED` durumu **dosya gerçekten teslim edilmeden**
yazılmaz. Entitlement `pending` doğar; `ready` yalnızca filigran işi
tamamlanınca gelir. Inngest'e gönderim başarısız olursa sipariş yine de
kaydedilir ve hata denetim günlüğüne yazılır — kuyruğa atılmış bir iş,
teslim edilmiş bir kitap sayılmaz.

**GÖZLEM — e-posta zenginleştirildi** (§16 gereği). Önceden yalnızca
selamlama + başlık + kütüphane bağlantısı vardı. Şimdi ayrıca: **kapak
görseli**, **kısa tanıtım**, **companion sayfası bağlantısı**, **Amazon
basılı baskı bağlantıları**, **kitabın kendi sayfası**, **destek adresi**.
Hepsi opsiyonel ve tek bir `try/catch` içinde: parası alınmış bir kitabın
makbuzu, kapak dosyası taşındı diye gönderilmemezlik edemez.

---

## 13. Ücretsiz kitap sistemi — korundu

**GÖZLEM** — Ücretsiz akış hiçbir zaman ödeme sağlayıcısına bağlı değildi ve
bu göçte de bağlanmadı. Kararı veren tek soru değişmedi:
`books.master_file_key is not null` — *dosyayı tutuyor muyuz?*

Fiyat testine geri dönülmedi. Bu önemli: 12 Eylül'de 18 başlık
fiyatsız ama teslim edilebilir hâle gelmişti; bugün hepsi yeniden fiyatlı ama
**hiçbiri kasaya bağlı değil**. Fiyat testi kullanılsaydı kampanya bugün 27
başlık için sessizce kapanırdı.

**İlk kitap / sonraki kitap kuralı, kampanya bitiş tarihi ve operatör
onayı akışı — değiştirilmedi.** Sağlayıcıya bağlı hiçbir bağımlılıkları
yoktu.

---

## 14–15. Katalog ve yerel kitaplar

Ayrı rapor: **`CATALOG-RESTORATION-REPORT-TR.md`**. Özet: vitrin 12 → **30**
kitap; yerelde hazır ama eklenmemiş **6 başlık** bulundu ve hepsi başka
ajanların dallarında.

---

## 16. Test

**GÖZLEM** — Tüm süit: **536 test geçiyor, 2 test kalıyor.**

Kalan 2 test bu göçle ilgisizdir ve **önceden kırıktı**:
`scripts/factory/companion-page.test.js` → World Myths iç sayfası 233'te
beklenen başlık yok. Kanıt: bu oturumun katalog değişikliği o kitabın
türetilmiş alanlarını **birebir aynı** bırakıyor (ölçüldü), ve test diskteki
PDF'i okuyor — o PDF bu depoda değil.

Yeni testler:

| Dosya | Kapsam |
|---|---|
| `src/lib/payments/lemonsqueezy/webhook.test.ts` | **30 test** — §38 teslimat matrisinin tamamı |
| `scripts/catalog/valice-catalog.test.ts` | 26 test — geri yükleme, provenans, emekli sağlayıcı gerekçesi yasağı |
| `src/lib/companions.test.ts` | +1 — companion, kataloğun sağlayamayacağı bir kitabı "mevcut" diye ilan edemez |

### §38 teslimat matrisi — beklenen sonuçlar

| Senaryo | Beklenen | Durum |
|---|---|---|
| SUCCESS | `order_paid`, kitap çözümlenir, 200 | ✓ |
| DUPLICATE | Aynı idempotency anahtarı; ikinci teslimat yazmaz | ✓ |
| INVALID SIGNATURE | **401**, hiçbir şey ayrıştırılmaz | ✓ |
| MISSING SIGNATURE | 401 | ✓ |
| UNCONFIGURED | **503** (sessiz kabul değil) | ✓ |
| UNPARSEABLE | **400**, 401 değil — yanlış sırrı döndürmeye göndermemek için | ✓ |
| UNKNOWN PRODUCT | `custom_data` yoksa varyant kimliğinden çözümlenir; o da yoksa teslim yok | ✓ |
| NOT PAID (`pending`/`failed`/`refunded`) | `order_not_paid`, sipariş satırı **yazılmaz** | ✓ |
| REFUND | `order_refunded`, ayrı anahtar, entitlement iptal | ✓ |
| FORGED HEADER | İmzalı olay adı kazanır | ✓ |
| MISSING FILE / EMAIL FAILURE | **DOĞRULANMADI** — canlı Inngest + Resend gerektirir | ENGEL |

### Canlı uç noktaya karşı çalıştırılan uçtan uca test (DOĞRULANMIŞ)

Birim testleri saf doğrulayıcıyı ölçüyor; aşağıdaki koşu **çalışan rotaya**
gerçek imzalı yükler gönderdi ve veritabanını sonradan okudu. Sandbox
(`bookstore`) üzerinde yapıldı, sonrasında tüm satırlar silindi.

| Senaryo | Gözlenen |
|---|---|
| Geçersiz imza / imza yok | `401` · hiçbir şey yazılmadı |
| Ayrıştırılamayan gövde / boş gövde / sipariş kimliği yok | `400` |
| Bilinmeyen olay | `200`, yok sayıldı |
| Ödenmemiş (`pending`) | `200` · denetim satırı yazıldı, **sipariş satırı yazılmadı** |
| **Ödendi — Kwaidan** | Sipariş + `order_items` + entitlement + filigran işi · **doğru kitap** |
| **Aynı teslimat tekrar** | **İkinci sipariş satırı oluşmadı** (2 sipariş, 3 değil) |
| **Farklı kitap — Mancala** | Mancala siparişi Mancala teslim etti · çapraz bağlantı yok |
| **İade — yalnız 910001** | O sipariş `refunded`, entitlement `revoked`; **diğer sipariş dokunulmadan `paid` kaldı** |
| Aynı iade tekrar | Ek iptal yok, ek denetim satırı yok |
| **Teslim edilemeyen ödeme** | Önce **hiçbir şey** yazmıyordu — düzeltildi; artık `UNDELIVERABLE — …` denetim satırı + Sentry uyarısı |

**GÖZLEM** — `orders.payment_provider` her iki siparişte de `lemonsqueezy`
yazıldı; Haziran'dan kalan sandbox siparişi `paddle` olarak kaldı. İki
sağlayıcının kayıtları birbirine karışmıyor.

**Bu koşunun bulduğu gerçek kusur:** ödemesi alınmış ama teslim edilemeyen bir
sipariş (bilinmeyen kitap kimliği) `200` dönüyor, `console.error` yazıyor ve
**denetim izine hiçbir şey bırakmıyordu**. Operatörün asla bulamayacağı bir
kayıp satıştı. `failUndeliverable()` eklendi.

---

## 17. Güvenlik

- Hiçbir gizli değer markdown'a, koda, git'e, ekran görüntüsüne veya rapora yazılmadı.
- Webhook **imza doğrulanmadan** hiçbir ayrıştırma, veritabanı çağrısı veya yük günlüğü yapmaz.
- Karşılaştırma `timingSafeEqual`; uzunluk farkı **önce** kontrol edilir (aksi hâlde kısa imza 500 + stack trace verirdi).
- Master PDF/EPUB herkese açık hâle getirilmedi; teslimat mevcut imzalı URL + filigran yolundan gidiyor.
- **ENGEL / ÖNEMLİ:** `.env.local` bozuk satırlar içeriyor — bir Paddle sandbox anahtarı ve **bir Resend API anahtarı** `KEY=value` biçiminde olmayan satırlarda duruyor. Bu oturumda ortam değişkeni *adlarını* listelerken bu iki değer redaksiyondan kaçtı ve terminale yazıldı. **Resend anahtarının döndürülmesi (rotate) önerilir.**

---

## 18. Kalan riskler

| Risk | Etki | Azaltma |
|---|---|---|
| Mağaza aktive edilmedi | Satış yok | Founder: kimlik + banka |
| Canlı modda ürünler yeniden oluşturulmalı | Test modunda üretilen kimlikler canlıda geçersiz | Provisioning betiği idempotent; `--commit` bir kez daha |
| İtiraz (chargeback) görünmüyor | Para geri gider, biz görmeyiz | Panel kontrolü operatör rutinine girmeli |
| Kısmi iade tam iptal sayılıyor | Okuyucu erişimini kaybeder | Bilinçli seçim; elle geri verilebilir — `lifecycle.ts` içinde yazılı |
| `drizzle-kit migrate` sessiz no-op | Şema göçü "başarılı" görünüp yapılmaz | `apply-provider-migration.mjs` şemayı **yeniden okuyarak** kanıtlar |
| Bundle kayıp | Gelir fırsatı | Lemon Squeezy ürünü olarak yeniden tasarlanmalı |

---

## 19. Geri dönüş stratejisi

**Kod:** dal birleştirilmediyse bir şey yapmaya gerek yok. Birleştiyse
`git revert`; şema göçü katkısal olduğu için geri alınması gerekmez.

**Veri:** hiçbir Paddle verisi silinmedi. `books.paddle_price_id`,
`RETIRED_PADDLE_PRICE_IDS` ve tüm `commerce_events` satırları yerinde.

**Paddle'a dönüş** teknik olarak mümkün ama iki adım gerektirir: SDK'yı geri
kurmak ve adaptörü yeniden yazmak. Bilinçli olarak kolaylaştırılmadı —
"kazara Paddle'a düşmek" bu göçün engellemesi gereken şeydi.

---

## 20. Nihai üretim durumu

### `PARTIALLY READY`

**Hazır olan (DOĞRULANMIŞ):** sağlayıcıdan bağımsız ödeme katmanı, imza
doğrulama, idempotency, iade akışı, sağlayıcı-nötr şema, geri yüklenmiş 30
kitaplık katalog, zenginleştirilmiş makbuz e-postası, hukuki metinler,
provisioning betiği, 536 geçen test, temiz `lint` / `tsc` / `build`.

**Hazır olmayan (ENGEL):** Lemon Squeezy mağazası aktive edilmedi → API
anahtarı yok → ürün yok → **hiçbir kitap satın alınamıyor**. Üretim
veritabanına yükleme ve dağıtım yapılmadı.

> *"Sales are live"* denmedi ve denemez. Gerçek bir üretim ödemesi
> doğrulanana kadar bu rapordaki hiçbir cümle bunu iddia etmiyor.
