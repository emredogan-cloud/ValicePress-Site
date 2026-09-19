# VALICE PRESS — MASTER YAYINCILIK YOL HARİTASI

**Tarih:** 2 Eylül 2026 · **Durum:** araştırma + mimari + yol haritası; **bu fazda
hiçbir kitap üretilmedi, hiçbir kitap yayımlanmadı** · **Dal:** `feat/production-readiness`
· **Founder-facing sürüm:** `VALICE_PRESS_MASTER_ROADMAP_TR.html`

Bu belge çalışma sürümüdür: makine-okunur, tablo ağırlıklı, her fazın kapısı
yazılı. Uzmanlık belgeleri:

| Konu | Belge |
|---|---|
| AI yayın fabrikası (topoloji, 20 adım, 12 kapı, fabrika hafızası) | `PUBLISHING_FACTORY_MASTER_ARCHITECTURE.md` |
| Amazon baskı üretimi (KDP kuralları 2026, format merdiveni, fiyat motoru) | `KDP_PRODUCTION_MASTER_PLAN_TR.md` |
| E-kitap üretimi (dijital edisyon standardı, kaynak boru hattı, paketler) | `VALICE_EBOOK_PRODUCTION_MASTER_PLAN_TR.md` |
| Kamu malı edinme (kaynak havuzları, haklar kapısı, keşif motoru, aday havuzu) | `PUBLIC_DOMAIN_ACQUISITION_MASTER_PLAN_TR.md` + `PUBLIC_DOMAIN_CANDIDATE_DATABASE.csv` |
| SEO (denetim, mimari, Search Console, içerik fabrikası) | `SEO_MASTER_IMPLEMENTATION_PLAN_TR.md` |
| Amazon Ads (ürün seçimi, ekonomi, lansman sistemi) | `AMAZON_ADS_MASTER_PLAN_TR.md` |
| Amazon → Valice köprüsü (companion, QR/URL, e-posta, doğrudan değer) | `AMAZON_TO_VALICE_CUSTOMER_BRIDGE_TR.md` |
| Yaşam döngüsü, bakım otomasyonu, haklar sistemi, QA, lansman | `CATALOG_LIFECYCLE_AND_MAINTENANCE_TR.md` |
| Hesaplar (yeniden üretilebilir) | `scripts/strategy/price-engine.mjs` · `revenue-targets.mjs` · `catalog-economics.mjs` · `unit-economics.mjs` |

Kanıt etiketleri — **[V]** birincil kaynaktan doğrulandı · **[O]** canlı sistemde
gözlendi · **[A]** varsayım · **[R]** öneri · **[S]** senaryo. Karıştırılmaz.

Bu belge `RULE_SET_INDEX.md`'deki aktif kurallara uyar: `memory/PAST_DECISIONS.md`
(kilitli mimari), `VALICE_PRESS_MASTER_PUBLISHING_STRATEGY_TR.md` (iş modeli),
`CATALOG_ECONOMICS_FINAL.md` (ekonomi), `CLAUDE.md`. Hiçbir arşivlenmiş strateji
diriltilmedi. Master stratejiyle iki noktada **kanıtla** ayrışıyor (§1.3).

---

## 1 · Yönetici özeti

### 1.1 Tek paragraf

Valice Press'in gerçek varlığı katalog değil, **çalışan bir mağaza + basılı
kitaptan okura giden köprü**dür. Amazon'da 18 baskı canlı, mağazada 5 e-kitap
satılabilir, satın alma 7 saniyede karşılanıyor, alan adı 1 Eylül'de alındı.
Eksik olan üretim kapasitesi değil; **ölçüm, bakım otomasyonu ve seri
disiplini**. Bu yol haritası ayda 5 içerik projesi (Lane A 3 + Lane C 1–2, çeyrekte
1 Lane B) sürdürülebilir hızını, 12 ayda 36–45 içerik projesi (~110 başlık-format
kaydı), 36 ayda 180–220 projeyi (~550 kayıt) hedefler. 8–10/ay teknik olarak
mümkün, **şablonlu Lane A içinde ve en fazla 2 ay üst üste** izinlidir.

### 1.2 Bu hafta yapılmazsa gerisi anlamsız — P0

| # | Bulgu [O, 1–2 Eylül 2026] | Sonuç | Düzeltme | Kim |
|---|---|---|---|---|
| P0-1 | `valicepress.com` → **308 → `www.valicepress.com`**. Canonical, sitemap, robots `Host:`, basılı adresler ve **Paddle webhook hedefi** apex'i kullanıyor. `POST https://valicepress.com/api/webhooks/paddle` → **308**. Paddle 200 dışındaki her yanıtı hata sayar, 3 günde 60 kez dener, sonra düşürür [V]. | **Bugün bir müşteri ödeme yaparsa sipariş oluşmaz, dosya gitmez, kayıt bulunmaz.** Faz 4'te bulunan "müşteri öder, hiçbir şey almaz" hatası farklı bir nedenle geri geldi. | Vercel → Project → Domains → `valicepress.com` birincil; `www` → apex redirect. **Alternatif:** Paddle webhook URL'sini `www`'ya taşı — ama basılı adresler apex olduğu için apex-birincil doğru karar. | Founder (2 dk) |
| P0-2 | `enterprise-web-site.vercel.app` 200 dönüyor, yönlendirme yok; Vercel üretim alias'ına noindex koymaz [V] | Tüm katalog kopya olarak indekslenebilir | `src/proxy.ts` host kontrolü → 308 apex (kod; 20 dk) | ajan + Founder onayı |
| P0-3 | Vercel Web Analytics **etkin değil** ("Web Analytics not found") | Sıfır trafik ölçümü; hiçbir dönüşüm ölçülemez | Vercel → Analytics → Enable (custom events için Pro gerekir [V]) | Founder (1 dk) |
| P0-4 | Google Search Console'da mülk yoktu; **Domain mülkü `valicepress.com` 1 Eylül'de oluşturuldu, doğrulanmadı** | Google verisi birikmiyor | Namecheap Advanced DNS → TXT `@` → `google-site-verification=o99ifmNUCFgIatG65vnRUxQ-2yMAIDo-xj805KnpUWU` → Verify → sitemap gönder | Founder (5 dk + DNS yayılımı) |
| P0-5 | Hangul paperback + hardcover **KDP incelemesinde**, haklar sorusu açık (S-0017/18 CC BY-SA, S-0019 CC BY-NC) [O] | İnceleme geçerse lisans sorunu açıkken satışa çıkar | Kaynağı değiştir **veya** gönderimi geri çek (§6 ve `CATALOG_LIFECYCLE…` §5) | Founder (hukuki karar) |

### 1.3 Master stratejiden iki ayrışma (kanıtla)

1. **Birim başına harmanlanmış katkı $16.29 değil, $8.20–$9.38** [O hesap,
   `revenue-targets.mjs`]. $16.29, henüz var olmayan Lane B flagship
   ($74–141/birim) ve $10.75'lik hatalı hardcover varsayımını içeriyordu
   (gerçek hc net $5.44–$12.62, `CATALOG_ECONOMICS_FINAL.md`). $10.000/ay
   için gereken adet 614 değil **~1.400/ay**dır. Bu, "hacim değil katkı"
   tezini değiştirmez; hedef takvimini gerçekçileştirir.
2. **Founder'ın en aktif projesi (Before You Cut, dikiş kalıp serisi) niş
   matrisinde yoktu.** Cycle 2 araştırması onu 7.02 ile seçti [O]; ekonomisi
   iyi ($11.18/birim), uzman kapısı yok, ama insan doğrulaması "YAPILAMAZ"
   kaydedildi ve isim marka temizliği bekliyor. Bu belge onu **Yıl 1 Lane B
   adayı #2 (Kitap 12)** olarak, ön koşullarıyla listeler; çekirdek motor
   yapmaz.

### 1.4 On karar

1. **Çekirdek motor:** hibrit — Amazon baskı keşif için, Valice doğrudan marj ve sahiplik için, companion köprüsü ikisini bağlar.
2. **Üç şerit:** A Franchise (şablonlu seri, Amazon baskı-öncelikli, 3/ay) · B Flagship (çeyrekte 1, direct-first) · C Public Domain (annotated, direct-first, 1–2/ay).
3. **İlk 5 kitap:** Hangul (hakları çöz + lansman) · Greek Alphabet Workbook · Dudeney (Annotated·Illustrated) · Codex Mythologica: The Puzzle Book · Epictetus (Annotated).
4. **Ay 1 katalog işleri:** World Games / Enigmatica / Field Book **large print**; $4.99 e-kitaplarda $6.99 testi; Bestiarium 120→112; Bestiarium LP $34.99; Mythologica Select auto-renew kapalı.
5. **Fiyat:** hiçbir e-kitap $4.99'da kalmaz; Lane A pb $12.99–14.99; LP sayfa başına; doğrudan PD $7.99–9.99; paketler toplamın %70–75'i.
6. **SEO:** gerçek kataloğa göre 13 sayfa tipi; referans dizinleri (bestiary/oyun/mit) insan editörlü ve `validate:seo` eşikli; GSC boşluk döngüsü ajanlaştırılır; FAQPage/Book actions/Indexing API kullanılmaz [V].
7. **Ads:** lansman-sıralama aracı; bugün ALWAYS-ON hak eden başlık yok (0 yorum); ilk dolar Bestiarium hc + World Games hc; PD ve $4.99 asla.
8. **E-posta:** tek audience, kaynak etiketleri, 6 akış; DMARC eklenir; satın alma abonelik değildir.
9. **Bakım:** `validate:catalog` + `validate:seo` + aylık KDP/Ads içe aktarma Ay 1–4'te kurulur; 100 kayıtta bakım ≤ 10 saat/ay.
10. **Yapılmayacaklar:** pazar yeri, abonelik, sayfa-okuma, sert DRM, premium renk, $4.99, ayrı imprint, PD Amazon-only, jenerik low-content seli, rastgele PD dökümü, ince SEO sayfaları, kanıtsız reklam.

---

## 2 · Founder hedefi ve testi

Hedef: **ana gelir**. Bir modelin ana gelir olabilmesi için aynı anda: yeterli
pazar, yeterli marj, tekrar satın alma, ölçeklenebilir edinim, tek kişinin
yönetebileceği operasyon, tek platforma bağımlı olmama (master strateji §43).
Bu belge her fazı bu altı teste bağlar; §28 hedef modelleri, §31 yapılmayacaklar
listesi bu testten türer.

---

## 3 · Faz 0 — Mevcut durum kilidi (1–2 Eylül 2026)

### 3.1 Sistem envanteri [O]

| Alan | Durum | Kanıt |
|---|---|---|
| Repo | Next.js 16 App Router, Neon+Drizzle, Clerk, R2, Paddle MoR, Inngest, Resend, Sentry; 143 test, lint/tsc/build yeşil (1 Eylül) | `PHASE_1_EXECUTION_COMPLETION_TR.md` |
| Katalog | 8 kitap (7 published, 1 draft), 22 format satırı, 18 doğrulanmış ASIN, 5 doğrudan satılabilir e-kitap, 5 gerçek Paddle fiyatı, 5 master R2'de | `CATALOG_MASTER_INVENTORY_FINAL.md`, `provision-paddle.mjs` dry-run 2 Eylül |
| Satışlar | **1 sipariş (ömür boyu), 0 yorum, KDP raporu dışa aktarılmamış** | Faz 4 raporu; KDP hesabı bu oturumda okunamadı |
| Alan adı | `valicepress.com` Namecheap'te, Vercel'e bağlı; apex → www 308 (P0-1) | `dig`, `curl`, `vercel domains inspect` |
| HTTPS/HSTS/CSP | var; `strict-transport-security` preload | başlıklar |
| `NEXT_PUBLIC_APP_URL` | `https://valicepress.com`; 1 Eylül 21:38 UTC yeniden dağıtım | `vercel env pull` |
| Sitemap/robots | apex URL'leri; blog/kategori/yazar/kitap var; **eksik:** `/ebooks`, `/companion/*`, `/about`, `/categories`, `/authors`, tag hub'ları; `lastmod` üretim zamanı | `curl sitemap.xml` |
| Paddle | LIVE; 5 ürün+fiyat; webhook `ntfset_01m1br7x…` → **apex** (P0-1), 4 event; vergi kategorisi `standard` (`ebooks` onaylı değil) | dry-run |
| Inngest | `PUT https://www.valicepress.com/api/inngest` → "Successfully registered", modified:true | curl |
| Resend | newsletter `subscribed`, `consentRecorded:true`; DKIM kaydı var; `send.` alt alan adı **Resend'in belgelediği SES kayıtları değil** (`send.forge.rmta.net`) — Resend panelinde "Verified" kontrolü; **DMARC yok** | `dig`, Resend docs |
| Codex Enigmatica doğrulama | endpoint 200 `no-match` | curl |
| Companion | `/companion/hangul` kod var, production 404 (commit edilmemiş) | curl |
| Analitik | Web Analytics **kapalı**; Speed Insights bilinmiyor; GA4 yok; GSC mülkü **oluşturuldu, doğrulanmadı** | Vercel API, GSC UI |
| Görsel üretim | `OPENAI_API_KEY` yok (repo, .env, Vercel) | grep, env ls |
| Kitap repo'ları | 9 KDP projesi Python+ReportLab; `project_config.json`, `.gate`, `kill_gate.py`, `selftest.py`, `DECISIONS.md`; **AI beyanı her projede `false`** (beyan KDP panelinde yapılıyor, kayıt yok) | envanter ajanı |
| Açık kill-gate'ler | Enigmatica 0 dış çözücü; World Games 0/100 oyun testi, kapsam 56/100; Field Book 0 çocuk testi, görseller 0/~150 üretilmiş (canlı kitabın iç bloğu doğrulanmalı); Hangul REVISE + A7; Before You Cut doğrulama "yapılamaz" + marka | envanter ajanı |

### 3.2 Bloklayıcılar ve bağımlılıklar

| Bloklayıcı | Bloke ettiği | Çözüm |
|---|---|---|
| P0-1 apex/www | ödeme karşılama, canonical, GSC | Vercel 1 tık |
| Hangul hakları | Kitap 01, Hangul 2, seri şablonunun kanıtı | kaynak değişimi |
| Ölçüm yokluğu (analytics, GSC, KDP raporu) | fiyat testleri, reklam kararı, sınıflandırma | P0-3/4 + Faz 16 |
| Paddle `ebooks` kategorisi | doğru KDV | destek talebi |
| Yazar biyografisi (null) | Author Central, ProfilePage, KDP metadata | Founder yazar |
| "Vâliçe" vs "Valice" | marka tutarlılığı (kitaplar birincisini basıyor) | Founder kararı |
| Bestiarium "120" ilanı | metadata güveni | KDP düzenleme |

### 3.3 Mevcut KPI'lar (başlangıç çizgisi)

| KPI | Değer | Kaynak |
|---|---|---|
| Aylık ziyaretçi | **ölçülmüyor** | analytics kapalı |
| Doğrudan sipariş (ömür boyu) | 1 | DB (Faz 4) |
| Amazon adet | **bilinmiyor** — KDP raporu dışa aktarılmadı | — |
| Yorum | 0 | Amazon |
| Abone | bilinmiyor (Resend paneli); test kayıtları temizlendi | — |
| Google impressions | 0 (mülk doğrulanmadı) | GSC |
| Canlı başlık-format kaydı | 22 (18 Amazon + 5 doğrudan; çakışmalar var) | katalog |

**Kural:** İlk çeyrek ölçümü (Aralık 2026) bu belgedeki her kıyastan daha
değerlidir. 20/30/50 dağılım ve hız varsayımları o ölçümle değiştirilir.

---

## 4 · Faz 1 — Yayın fabrikası (özet)

Tam tasarım: `PUBLISHING_FACTORY_MASTER_ARCHITECTURE.md`.

- **9 rol, 17 değil:** Slate Researcher · Architect · Author · Verifier · Editor · Rights Clerk · Designer · Metadata+Compliance · Publisher. Doğrulayıcı asla yazan değildir.
- **Aşama-bazlı paralel:** slate birlikte ilerler; kapı geçilmeden sonraki aşama yok; 10 kitap 3. kapıda birlikte ucuza düşer.
- **20 adım**, her biri girdi/çıktı/sorumlu/insan kontrol/süre/başarısızlık/otomatik test ile.
- **12 kapı**; 2 (haklar), 5 (olgu), 7 (kapak), 10 (KDP politikası), 12 (yayın) Founder imzası.
- **Fabrika hafızası** `valice-house/`: house-style, seri bible'ları, verified/rejected facts, rights ledger, kapak/metadata standartları, KDP checklist, proje şablonu, isimlendirme.
- **Mevcut konvansiyonun üstüne** (ReportLab boru hattı, `.gate`, `DECISIONS.md`) inşa edilir; yeni framework yok.

Kapı (Phase 32): Amaç — her yeni başlığın aynı boru hattından, ölçülmüş kapılarla geçmesi · Girdi — mevcut proje konvansiyonu, ilk 5 kitap · Çıktı — `valice-house/` + proje şablonu + lint scriptleri · Bağımlılık — yok · Ajanlar — R9 (şablon), Founder (house-style) · Süre — 3 hafta (Ay 1–2'ye yayılır) · Başarı — Kitap 02 (Greek) şablondan üretilir ve 12 kapıyı ölçülmüş geçer · Başarısızlık — bir kapı "geçti" yazılır ama ölçülmemiştir · KPI — Founder saati/başlık, kapı başarısızlık oranı · Sonraki — Faz 2.

---

## 5 · Faz 2 — Ürün stratejisi ve kesin portföy

### 5.1 İlk 5 kitap — tam spesifikasyon (Phase 2A)

**Kitap 01 · Korean Hangul Handwriting Workbook** (mevcut, bloke)
- Alt başlık: *Learn to write all 40 letters with correct stroke order, build syllable blocks, and read your first 97 Korean words* (K42 onaylı)
- Kitle: Korece'ye sıfırdan başlayan yetişkin İngilizce konuşur · Kategori: Language & Learning · BISAC: FOR008000 (Korece) [R, atanmalı]
- Konsept: 30 ders, 40 harf + 16 batchim, 122 vuruş diyagramı, trace → dot-start → boş kutu; provenans sayfası
- Seri: Valice Script #1 (KDP seri metadatası 2. kitap gerçekten planlanınca açılır — K notu)
- Format: pb 8.5×11 124 s. $12.99 (net $4.69) · hc 8.25×11 $21.99 (net $5.44, TEST) · fixed-layout EPUB var (Kindle; doğrudan satılmaz — yazılan kitap) · LP hayır
- Companion: `/companion/hangul` (3 PDF hazır) + Q2'de telaffuz sesi
- Amazon yolu: KDP live → A+ 6 modül hazır → Ads TEST (başabaş ACOS %36)
- Web yolu: kitap sayfası (Amazon linki) + companion + `hangul-companion` etiketi
- Karmaşıklık: düşük (üretim bitmiş) · **Kalan saat: 15–25** — 97 kelimeyi ve glossları bağımsız yeniden türet, S-0017/18/19'u kaldır, provenansı güncelle, KDP'ye yeniden yükle, AI beyanı
- Neden ilk: %95 bitmiş; şeridin şablonu ve köprünün ilk gerçek testi

**Kitap 02 · The Greek Alphabet Handwriting Workbook: Modern and Classical**
- Alt başlık: *Learn to write all 24 letters with correct stroke order, read accents and breathings, and write your first 100 Greek words* [R çalışma]
- Kitle: Yunanca (modern veya klasik) öğrenen yetişkin; mitoloji okuru · Kategori: Language & Learning · BISAC: FOR010000
- Konsept: Hangul şablonu; 24 harf + diakritikler + ligatürler; klasik/modern telaffuz iki sütun; mitoloji kataloğundan 20 isim/kelime örneği (Codex çapraz satışı)
- Seri: Valice Script #2
- Format: pb 8.5×11 ~120 s. $14.99 [R: motor $12.99'da 160 s.'de %35 marjı kaçırıyor; 120 s.'de $12.99 net $4.69/$14.99 net $5.89] · hc $21.99 TEST · EPUB fixed-layout Kindle (opsiyonel) · LP hayır
- Companion: `/companion/greek` — vuruş kutuları, telaffuz tablosu (modern/klasik), 10 ek sayfa
- Amazon: KDP live; Ads TEST · Web: seri sayfası + Codex çapraz
- Karmaşıklık: düşük-orta · **40–60 saat** (şablon yeniden kullanımı; sözlük hakkı yok — kelime listesi özgün)
- Neden: Hangul'un hak sorunundan bağımsız; mitoloji kataloğuna köprü

**Kitap 03 · The Puzzles of Henry Dudeney (Annotated · Illustrated)** — PD Batch 1-1
- Alt başlık: *120 of the Canterbury Puzzles and Amusements in Mathematics, with worked solutions, difficulty tiers and a three-tier hint system* [R]
- Kitle: Enigmatica/Cain's Jawbone okuru; rekreasyonel matematik · Kategori: Puzzle & Challenge · BISAC: GAM007000
- Konsept: iki kitaptan seçki (PG #27635, #16713 [V]); Canterbury çerçeve anlatısı omurga; **adım adım çözümler** (özgün metin), zorluk kademeleri, yeniden çizilmiş diyagramlar (≥10 → KDP illüstrasyon şartı), yorum
- Seri: Valice Classics #2 (Puzzle hattı)
- Format: **doğrudan PDF+EPUB $9.99** (net $8.99) → Kindle $9.99 (%35, keşif) 3 ay sonra → pb 6×9 ~220 s. $16.99 sonra
- Companion: ipucu/doğrulama sayfası (Enigmatica kalıbı) `/companion/dudeney`
- Amazon: 2. dalga · Web: direct-first, Codex Enigmatica ile "Puzzle Shelf" paketi
- Karmaşıklık: orta · **90–110 saat** · Haklar: **GREEN** (her iki cilt 1931 öncesi; Dudeney ö. 1930)
- Neden: PD boru hattının en ucuz kanıtı; "kitap iyi ≠ edisyon alınır" tuzağını aparatla çözer

**Kitap 04 · Codex Mythologica: The Puzzle Book — 100 Myth Puzzles from 19 Civilizations**
- Kitle: Enigmatica + Mythologica okuru; yetişkin bulmaca · Kategori: Puzzle & Challenge · BISAC: GAM007000
- Konsept: Codex evreninde 100 bulmaca (şifre, çapraz, logic grid, harita), Mythologica/Bestiarium içeriğinden; 3 kademeli ipucu; final cevap doğrulama sayfası
- Seri: Codex (companion cilt)
- Format: pb 8.5×11 ~130 s. $14.99 · hc $24.99 TEST · e-kitap **hayır** (yazılan kitap) · LP hayır
- Companion: `/companion/codex-puzzles` (ipuçları, basılabilir ek 10 bulmaca, doğrulama)
- Amazon: KDP live; Ads TEST · Web: Codex seri sayfası
- Karmaşıklık: orta · **60–90 saat** · **Gate 1 ön koşul:** "mythology puzzle book" için anahtar kelime + BSR örneklemesi; talep ölçülmedi [O NICHE_VALIDATION]
- Neden: varlık uyumu 92; kimse hem mit içeriğine hem bulmaca zanaatına sahip değil

**Kitap 05 · Epictetus: The Enchiridion and Selected Discourses (Annotated)**
- Alt başlık: *George Long's translation, with an introduction, notes, a Stoic glossary and a reading guide* [R]
- Kitle: Meditations alıcısı; Stoa okuru · Kategori: Classics & Philosophy · BISAC: PHI011000
- Konsept: PG #45109 (Enchiridion) + #10661 (Long seçkisi) [V]; özgün giriş ≥ 2.000 kelime, bölüm notları, sözlük (Meditations ile ortak), kronoloji, okuma rehberi
- Seri: Valice Classics #3 (Stoa hattı)
- Format: **doğrudan $8.99** (net $8.04) → paket "The Stoic Library" (Meditations + Epictetus) $14.99 → Kindle sonra
- Companion: `/companion/stoic-library` okuma rehberi
- Karmaşıklık: düşük-orta · **40–50 saat** · Haklar: **GREEN** (Long ö. 1879)
- Neden: en ucuz Lane C; ilk paketi ve Meditations fiyat sorusunu çözer

### 5.2 Kitap 6–20 (Phase 26, öncelik sırasıyla)

| # | Seri | Başlık | Neden | Hedef okur | Format | Saat | Companion | Amazon | Web | Para | Lane | Öncelik |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 06 | Valice Classics | *Kwaidan* (Annotated·Illustrated) | Bestiarium çapraz referans; kısa; GREEN | Bestiarium okuru | direct PDF/EPUB $8.99 | 70–90 | yōkai dizini | sonra | direct | doğrudan | C | Ay 3 |
| 07 | Valice Script | *Hangul Book 2: Words & Phrases* | seri sürekliliği | Kitap 01 okuru | pb $14.99 · hc test | 40–60 | ses + sayfalar | KDP | seri | Amazon | A | Ay 3 (01 çözülünce) |
| 08 | Field Book | *The Myth Hunter's Field Book, Vol. 2* | kanıtlı şekil; kids | 8–12 | pb 8.5×11 $14.99 · hc test | 60–80 | sertifika | KDP | seri | Amazon | A | Ay 4 |
| 09 | Valice Classics | *Games Ancient and Oriental* (Falkener; Annotated·Illustrated) | World Games companion cildi; IA NOT_IN_COPYRIGHT | Games okuru | direct $12.99 → pb sonra | 140–170 | tahta şablonları | sonra | direct | doğrudan | C | Ay 4–5 |
| 10 | Valice Script | *Russian Cyrillic Handwriting Workbook* | şablon; düşük rekabet | yetişkin | pb $14.99 · hc test | 40–60 | vuruş sayfaları | KDP | seri | Amazon | A | Ay 5 |
| 11 | The Great Book of… | *The Great Book of Norse Myths & Legends* (Young Explorers) | World Myths şablonu; bölgesel seri #1 | 8–12 | pb 6×9 $14.99 · hc $26.99 · ebook $6.99 | 120–160 | telaffuz + kartlar | KDP | seri | her ikisi | A/B | Ay 5–7 |
| 12 | Before You Cut | *Book 1: Measure & Diagnose* | Founder'ın aktif Lane B'si; 259 s. hazır | orta seviye ev dikişçisi | pb 8.5×11 $26.99 (net $11.18) | 40–80 kalan | ölçüm formları PDF | KDP | kitap sayfası | Amazon | B | **ön koşul:** marka temizliği, 3 ücretli test dikişçisi, kapak |
| 13 | Valice Classics | *Myths and Legends of China* (Werner; Annotated·Illustrated) | en yüksek PD puanı (80.8); flagship PD | Codex okuru | direct $12.99 · pb $19.99 · hc sonra | 150–200 | dizin | KDP (etiketli) | direct | her ikisi | C | Ay 6–8 |
| 14 | Valice Classics | *Seneca: Letters from a Stoic — Selected* (Annotated) | Stoa paketi 3. kitap; Gummere 1917 IA NOT_IN_COPYRIGHT | Stoa | direct $9.99 | 50–70 | okuma rehberi | sonra | paket | doğrudan | C | Ay 7 |
| 15 | Valice Script | *Japanese Kana Handwriting Workbook* | en büyük script pazarı; ses companion farkı | yetişkin | pb $14.99 · hc test | 50–70 | ses + sayfalar | KDP (+.co.jp değerlendir) | seri | Amazon | A | Ay 8 |
| 16 | Codex | *Codex Heroica: 100 Heroes and Legendary Figures from 40 Traditions* | Yıl 1 flagship; Bestiarium formatı kanıtlı | referans okuru | pb $24.99 · hc $37.99 · LP · direct ebook $12.99 | 200–260 | dizin | KDP | direct-first | her ikisi | B | Ay 6–10 |
| 17 | The Great Book of… | *The Great Book of World Games, Vol. 2* | kilitli 100 hedefinin kalan 44'ü + kart/zar | oyun okuru | pb 8.5×11 $22.99 · hc $34.99 · ebook $11.99 | 100–140 | tahtalar | KDP | direct | her ikisi | A | Ay 9–10 |
| 18 | Valice Classics | *Meditations — The Valice Annotated Edition* | mevcut ürünü standarda çıkarır | Stoa | direct $9.99 (+EPUB) | 40–60 | rehber | Kindle (etiketli) | direct | doğrudan | C güncelleme | Ay 8 |
| 19 | Valice Classics | *Sam Loyd's Cyclopedia — The Best 120 Puzzles* (Annotated·Illustrated) | IA 1914; Dudeney kardeşi | bulmaca | direct $9.99 | 100–120 | ipuçları | sonra | Puzzle Shelf | doğrudan | C | Ay 10–11 |
| 20 | Codex | *Codex Enigmatica II* | doğrulama köprüsünün kanıtlı ürünü | Enigmatica okuru | pb $19.99 · hc $29.99 · ebook $9.99 | 150–200 | doğrulama | KDP | direct | her ikisi | A/B | Ay 11–12 (5 dış çözücü kapısı bu kez **ölçülür**) |

### 5.3 Kitap 21–50 (Phase 27, seri düzeyinde)

| Seri | Adaylar (sıra) | Adet | Not |
|---|---|---|---|
| Valice Script | Devanagari · Thai · Arabic · Hebrew · Hangul 3 (okuma) · Greek 2 (klasik okuma) · Latin primer | 7 | RTL diziler maliyet ve hendek; Latin önce validate |
| The Great Book of… | Celtic Myths (young) · Japanese Myths (young) · World Riddles · World Card Games · Field Book 3–4 | 6 | World Myths şablonu |
| Codex | Codex Arcana (semboller) · Codex Bestiarium II (bölgesel) · Codex Locorum (mitik yerler atlası) | 3 | Lane B ritmi |
| Valice Classics | Boethius (James) · Bulfinch · Lang Blue Fairy Book (seçki) · Topsell (seçki, illüstrasyonlu) · Budge Legends of the Gods · Yeats Celtic Twilight · Hesiod (Evelyn-White) · Ovid (Riley/blank verse) · Prose Edda (Brodeur) · Kojiki/Nihongi seçkisi · Culin (en son, kültürel danışma) | 11 | tümü PG/IA doğrulanmış kimlikli; çeviri haklarını tek tek kaydet |
| Before You Cut | Book 2 (Adjustment Atlas) · Book 3 (Sloper) | 2 | yalnızca Book 1 satarsa |
| Deneysel low-content | mitoloji temalı logic grid · nonogram koleksiyonu (motor doğrulamalı) | 1–2/ay, ana hat değil | talep sondajı |

Yol: 5 → 10 (Ay 4) → 20 (Ay 12) → 30–45 içerik projesi (Yıl 1, ~110 kayıt)
→ 50 (Yıl 2 ilk yarı) → 100 (Yıl 2 sonu, ~275 kayıt) → 180–220 (Yıl 3, ~550
kayıt).

### 5.4 Ürün merdivenleri (Phase 2B)

| Seri | ENTRY | CORE | ADVANCED | PREMIUM | BUNDLE |
|---|---|---|---|---|---|
| Valice Script | companion (ücretsiz sayfalar) | pb workbook $12.99–14.99 | Book 2 (kelime/ifade) | hc $21.99 (hediye) | seri paketi (baskı Amazon'da; dijital yok) |
| Codex | Kindle/direct ebook $9.99–12.99 | pb $19.99–24.99 | hc $29.99–37.99 | LP (sayfa başına) | The Codex Shelf (dijital) |
| The Great Book of… | ebook $6.99–11.99 | pb $14.99–22.99 | hc $26.99–34.99 | LP (World Games $31.03) | World Play (Games + Falkener) |
| Field Book | companion sertifika | pb $14.99 | Vol. 2 | hc TEST | — |
| Valice Classics | Kindle (%35, keşif) | direct $7.99–9.99 | premium annotated $12.99 | pb 6×9 $16.99–19.99 | The Stoic Library / Puzzle Shelf |

---

## 6 · Faz 3 — Mevcut katalog optimizasyonu (öncelik matrisi)

| Kitap | Keep | Update | Reprice | Reformat | Companion | Relaunch | Ads | Retire | Öncelik / not |
|---|---|---|---|---|---|---|---|---|---|
| Codex Bestiarium | ✅ | ilan 120→112 (**hemen**); kapak 103–116 PPI kabul | LP $29.99→$34.99 | — | `/companion/bestiarium` (yaratık dizini) | A+ tamam | **TEST ilk** (hc BE %31.4) | — | 1 |
| The Great Book of World Games | ✅ | 5 oyun testi (alt başlık iddiası) | ebook $11.99 tut | **LP $31.03 EVET** ($12.86) | tahta şablonları | LP lansmanı | TEST (hc %36.1) | — | 1 |
| Codex Enigmatica | ✅ | Kindle EPUB 46 MB → yeniden export (teslimat ücreti) | — | **LP $26.98 EVET** | doğrulama var | — | TEST | — | 2 |
| Codex Mythologica | ✅ | kapak PPI kabul | Kindle $4.99→$6.99 (KDP elle) | LP var | seri sayfası | Select auto-renew **KAPAT** → 90 gün sonra direct | TEST (hc) | — | 2 |
| The Great Book of World Myths | ✅ | AI beyanı kaydını yaz | ebook **$4.99→$6.99** (yeni Paddle fiyatı) | LP TEST ($4.17) | telaffuz/kartlar (kaldırılan harita vaadi burada) | — | henüz değil | — | 2 |
| The Myth Hunter's Field Book | ✅ | canlı iç bloğun görsellerini doğrula (0/~150 üretilmiş kaydı); PDF metadata | — | **LP $20.23 EVET**; hc TEST | sertifika | — | TEST | — | 3 |
| Meditations | ✅ | Kitap 18 aparatı | $9.99 tut, paketle | EPUB ekle | okuma rehberi | Stoic Library | asla | — | 3 |
| Korean Hangul | hold | **hakları çöz** | — | — | canlıya al | Kitap 01 | TEST | geri çek seçeneği | **0 (P0-5)** |
| Before You Cut 1 | — | marka + test + kapak | — | — | — | Kitap 12 | — | — | koşullu |
| License & Launch (CA) | — | — | — | — | — | — | — | **arşiv** (SME kapısı geçilemez) | — |
| Türkçe web kitapları (tuzun-hafizasi 64k kelime) | — | dizgi geçişi gerekir | — | — | — | — | — | beklet | Yıl 2 adayı |

---

## 7 · Faz 4 — Amazon baskı üretimi (özet)

Tam plan: `KDP_PRODUCTION_MASTER_PLAN_TR.md`. Doğrulanmış 2026 kuralları: pb
trimler, hc 75–550 s. yalnız siyah mürekkep, kapak spesifikasyonu, 7 anahtar
kelime, PD etiketleri, AI beyanı tanımı, bonus content ≤ %10, e-kitap pre-order
(baskı yok), Select şartları [V]. Format merdiveni **kitap başına** karar; LP
sayfa başına fiyat; hc küçük kitaplarda $0.75–2 ek katkı (TEST). Enigmatica'nın
gerçek KDP reddi 5 kalıcı ön-kontrol kuralına dönüştü.

---

## 8 · Faz 5–6 — Kamu malı edinme ve Valice edisyonu (özet)

Tam plan: `PUBLIC_DOMAIN_ACQUISITION_MASTER_PLAN_TR.md` + CSV. Kaynaklar: PG
(marka kuralı), Standard Ebooks (CC0), IA (`possible-copyright-status`,
`_djvu.txt`, `ocr` alanı), Wellcome (Topsell Tesseract OCR'lı), CC0 görsel
havuzları. Haklar kapısı GREEN/YELLOW/RED: ABD 1931 öncesi [V]; çeviri,
illüstrasyon, aparat ayrı eserler. Minimum farklılaştırma: özgün giriş +
kaynak notu + sözlük/kronoloji + yeni dizgi + özgün kapak; KDP'ye gidiyorsa ≥10
özgün illüstrasyon veya özgün annotation + başlık etiketi [V]. ~60 doğrulanmış
kimlikli aday; Batch 1 Dudeney/Kwaidan/Falkener (ACTIVE plan), Batch 2 Werner/
Epictetus/Seneca, Batch 3 Loyd/Topsell/Budge, Culin en son.

---

## 9 · Faz 7 — E-kitap (özet)

`VALICE_EBOOK_PRODUCTION_MASTER_PLAN_TR.md`: üç kaynak (mevcut orijinaller,
fabrika, PD); Dijital Edisyon Standardı (filigranlı PDF zorunlu, EPUB Q2, reader,
kütüphane, güncelleme, companion); 14 adımlı boru hattı; format kararları
(yazılan kitaplarda e-kitap yok); paketler (Stoic Library, World Play, Codex
Shelf); Meditations aparatının minimumun altında olduğu dürüstçe kaydedildi.

---

## 10 · Faz 8 — Kapak ve görsel üretim sistemi

### 10.1 Kapak felsefesi ve seri kimlikleri [R]

| Seri | Felsefe | Tipografi | Görsel | Palet | Baskı / e-kitap / thumbnail |
|---|---|---|---|---|---|
| Codex | gravür grimoire; "referans ama büyülü" | serif display, altın/krem üzerine | tek merkezi gravür plakası; çerçeve | koyu lacivert/siyah + krem + altın | 6×9 wrap; Kindle 1600×2560; thumbnail'da başlık ≥ %25 yükseklik |
| The Great Book of… | sıcak, resimli, çocuk-dostu ama ucuz değil | yuvarlak serif | tek kahraman sahnesi + harita hissi | krem + tek doygun renk (seri başına) | 6×9 / 8.5×11 |
| Field Book | saha defteri; damgalar, mühürler | slab/mono karışımı | rozetler, harita parçaları | kahverengi + kırmızı mühür | 8.5×11 |
| Valice Script | temiz, pedagojik, büyük tek harf | geometrik sans + script örneği | tek büyük harf/hece, vuruş okları | beyaz + tek renk (Hangul mavi, Greek terracotta, Cyrillic kırmızı, Kana çivit) | 8.5×11; hc 8.25×11 |
| Valice Classics | klasik dizgi; sakin | Noto Serif Display | tipografik + ince gravür süs | zümrüt/siyah (Meditations kalıbı) | 6×9; EPUB kapak |

Kurallar: thumbnail'da (150 px) başlık okunur; kapakta QR yok [O KDP]; AI ile
üretilmiş kapak görseli **AI-generated** sayılır ve KDP'de beyan edilir [V]; ABD
Telif Ofisi AI görselini korumaz [A — Ocak 2025 raporu; güncel kontrol] →
kapak kimliği tipografi + dizgi + marka ile savunulur.

### 10.2 OpenAI görsel üretimi (Phase 8A) — bu fazda **yürütülmedi**

- Repo'da, `.env`'lerde ve Vercel'de `OPENAI_API_KEY` **yok** [O]. Üretim yapılmadı, yapılmış gibi gösterilmedi.
- Fiyat [V]: gpt-image-2 görsel çıktı **$30 / 1M token** (giriş $8/M, önbellek $2/M; Batch %50). Boyut/kalite başına token sayısı çekilen sayfalarda yoktu → görsel başına **$0.01–0.25 [A]**. $4 tavan ≈ 133k çıktı token ≈ **15–40 kapak boyutunda görsel [A]**.
- Yetenek [V]: 16'nın katı kenarlar, ≤3840 px, ≤3:1, PNG/JPEG/WebP, şeffaf arka plan (preview), maske ile düzenleme; metin çizimi güvenilmez → **başlık asla modelde yazdırılmaz**, tipografi ReportLab/SVG ile bindirilir.
- **Bütçe koruyucusu tasarımı** (`scripts/covers/generate.mjs`, henüz yazılmadı): `OPENAI_IMAGE_BUDGET_USD=4.00` zorunlu; her çağrıdan önce `assets/covers/.ledger.json` toplamı + tahmini maliyet ≤ tavan değilse çağrı **yapılmaz** (exit 3); yanıt `usage` alanı ledger'a yazılır; `--dry-run` varsayılan, `--commit` gerekli; anahtar yalnızca env'den, log'a asla yazılmaz; `.gitignore` ledger'ı korur.

### 10.3 Kesin prompt şablonu ve ilk 5 kitap prompt'ları

Şablon: `[seri idiom] · [tek merkezi motif] · [kompozisyon: merkez, negatif alan üstte %30 başlık için] · [teknik: gravür/çizgi/düz renk] · [palet] · [yasak: metin, logo, filigran, insan yüzü (kids serisinde stilize)] · [çıktı: 2048×3072, dikey]`

| Kitap | Dosya (slot) | Prompt (özet, İngilizce üretimde) |
|---|---|---|
| 01 Hangul | `assets/korean-hangul-handwriting-workbook/cover/front-v2.png` | flat pedagogical cover, single large Hangul syllable block "한" drawn with numbered stroke arrows, cobalt on white, thin grid backdrop, no text, top 30% empty |
| 02 Greek | `assets/greek-alphabet-handwriting-workbook/cover/front-v1.png` | flat cover, large lowercase alpha with stroke arrows, terracotta on ivory, faint meander border, no text |
| 03 Dudeney | `assets/the-puzzles-of-henry-dudeney/cover/front-v1.png` | Codex engraving idiom: pilgrims on a road forming a geometric dissection puzzle, black line engraving on cream, gold accent, no text |
| 04 Codex Puzzle Book | `assets/codex-mythologica-the-puzzle-book/cover/front-v1.png` | engraved labyrinth whose walls are mythic beasts from 19 traditions, dark navy, gold, no text |
| 05 Epictetus | `assets/epictetus-enchiridion-and-discourses/cover/front-v1.png` | emerald-black typographic field with a single fine engraved lamp (Epictetus's lamp), thin emerald inner frame, no text |

Kindle/thumbnail ve wrap dosyaları aynı slotlardan türetilir (§10.4).

### 10.4 Deterministik kapak alımı (Phase 8B) [R]

- Klasör: `assets/<slug>/cover/` — `front-v<n>.png` (≥ 2400×3600, sRGB, 1:1.5 ±%5), `paperback-wrap-v<n>.pdf`, `hardcover-wrap-v<n>.pdf`, `kindle-v<n>.jpg` (1600×2560).
- Eşleme: **slug = katalog slug'ı**; kayıt defteri gerekmez; `scripts/covers/ingest-covers.mjs` en yüksek `v<n>`'i alır, `public/images/books/<slug>.webp` (yükseklik 1600, kalite 82, ≤ 400 KB) üretir, boyut/oran/renk uzayı doğrular, eksikse **test kırmızı** (yer tutucu yok).
- Founder akışı: dosyayı klasöre bırak → `node scripts/covers/ingest-covers.mjs` → commit → deploy. Kod değişikliği yok.
- Fallback: webp yoksa mevcut tipografik kapak bileşeni (var) — ama `validate:catalog` uyarır.

---

## 11 · Faz 9 — UI / katalog yayını

Her ürün sayfası (`/books/[slug]`) için bileşen listesi ve durumu [O]:

| Bileşen | Var | Eksik / değişiklik |
|---|---|---|
| Hero + gerçek kapak + başlık/alt başlık/yazar | ✅ | — |
| Edisyon açıklaması (PD: kaynak, çevirmen, yıl; orijinal: ne var/ne yok) | kısmen (description) | `editionNote` alanı [R] |
| "Neler dahil" (PDF/EPUB/reader/kütüphane/companion) | ✅ hero metni | format satırı başına liste |
| Format tablosu ve fiyat (direct / Amazon; $0 = "not sold here") | ✅ | LP satırları yeni baskılarla |
| Önizleme (gerçek 4 sayfa) | ✅ | PD'de aparatı gösteren sayfalar |
| Satın al (Paddle) / Amazon CTA (Attribution etiketli `/go/amazon/<slug>`) | ✅ / ✅ | Attribution redirect rotası [R] |
| Companion bağlantısı | ✗ | kayıt defterinden otomatik |
| İlgili kitaplar (seri → kategori → yazar) | ✅ (related-books) | seri öncelikli sıralama |
| E-kitap / baskı ayrımı (Phase 9A) | ✅ ("print goes to Amazon") | seri sayfalarında tekrar |
| SEO: canonical, OG kapak, JSON-LD `["Product","Book"]` + Offer (yalnız price>0) + ISBN-13 varsa | kısmen | co-typing, ProductGroup [R] |
| Seri sayfası `/series/[slug]` | ✗ | yeni rota (SEO planı) |

CTA kuralı (Phase 9B): doğrudan e-kitap → "Buy the ebook — yours to keep";
baskı → "Buy the paperback on Amazon" (fiyat gösterilir, Amazon kontrol eder);
Select kilitli e-kitap → "Read on Kindle"; yazılan kitap → e-kitap satırı yok.

---

## 12 · Faz 10–11 — Companion ve e-posta (özet)

`AMAZON_TO_VALICE_CUSTOMER_BRIDGE_TR.md`: 6 companion şablonu; QR = aynı
kalıcı adres + `?src=qr`; `/q/<slug>` ikincil; her QR çözülerek doğrulanır;
üçüncü taraf dinamik QR asla; 6 e-posta akışı (Inngest zamanlanmış + Resend
Broadcasts); DMARC; satın alma ≠ abonelik.

---

## 13 · Faz 12 — SEO (özet)

`SEO_MASTER_IMPLEMENTATION_PLAN_TR.md`: 20 bulgu (P0: apex/www, `.vercel.app`,
analytics, GSC); 13 sayfa tipi; 37 satırlık gerçek katalog niyet haritası;
referans dizinleri (bestiary 112 / oyunlar 56 / mitler 76) insan editörlü ve
`validate:seo` eşikli; GSC Domain mülkü + service account + `gsc-export.mjs`
(16 ay saklama [V]); FAQPage 7 Mayıs 2026'da kaldırıldı, Book actions
partner-only, Indexing API yalnız JobPosting [V] → hiçbiri kullanılmaz;
`seo.png`'deki GSC boşluk döngüsü ajanlaştırılır.

---

## 14 · Faz 13 — Amazon Ads (özet)

`AMAZON_ADS_MASTER_PLAN_TR.md`: SP herkese, SB 3+ başlık (Author Central),
Attribution ücretsiz [V]; bugün ALWAYS-ON hak eden başlık yok; ilk dolar
Bestiarium hc ve World Games hc; $4.99 e-kitaplar ve PD asla; bütçe
$150→300→600/ay (katkının ≤ %15'i); 30 günlük deney; kill/scale kuralları;
Q4 stratejisi; 60–95 gün rapor arşivi.

---

## 15 · Faz 14–15 — Köprü ve doğrudan değer (özet)

Köprü belgesi §5–7: ürün türüne göre Amazon → kitap → companion → site → e-posta
→ tekrar satın alma akışı; dönüşüm varsayımları [A] tarama %3–8, e-posta %10–20,
ikinci satın alma %10–15; Amazon'un kazandığı yerler (keşif, Kindle senkron, KU)
açıkça yazılı.

---

## 16 · Faz 16 — Analitik ve atıf

| Katman | Ölçüm | Araç | Durum → hedef |
|---|---|---|---|
| Amazon | adet, gelir, BSR (elle örnekleme), ads spend/ACOS/TACOS, yorum | KDP Reports CSV (aylık) + Ads console CSV → `data/kdp/`, `data/ads/` → `import-kdp.mjs`, `import-ads.mjs` | yok → Ay 1 |
| Web | ziyaret, kitap görüntüleme (`view_item`), önizleme (`sample_read`), sepet, **`begin_checkout` (hiç ateşlenmiyor — düzelt)**, `purchase` (transaction id ile tekilleştir), kaynak | Vercel Web Analytics (enable; custom events Pro) | kapalı → Ay 1 |
| Arama | impressions, tıklama, sorgu, sayfa | GSC UI + `gsc-export.mjs` aylık CSV | mülk doğrulanmadı → Ay 1 |
| E-posta | abone (kaynak bazlı), açılma, tıklama, satın alma | Resend events + `source` | kısmen |
| Companion | `qr_scan` (`?src=qr`), `companion_download`, `newsletter_signup{source}`, ikinci satın alma | Vercel events | yok → Ay 1 |
| Valice → Amazon | tıklama, DPV, satın alma, KENP | **Amazon Attribution** etiketleri, `/go/amazon/<slug>` | yok → Ay 2 |

**Başlık bazlı P&L** (`scripts/analytics/title-pnl.mjs`, aylık CSV →
`data/metrics/YYYY-MM.csv`): başlık, format, kanal, adet, liste, net/birim,
katkı, ad spend, TACOS, companion ziyaret, abone, doğrudan sipariş, sınıf. Yıl 1
Q3'te `/admin/metrics` sayfası. GA4 **ertelendi** (cookieless Vercel + GSC
yeterli; consent banner maliyeti yok) [R].

---

## 17 · Faz 17 — Fiyat ve ekonomi motoru

`scripts/strategy/price-engine.mjs` (yeni): girdi — sayfa, trim, mürekkep,
format, kanal, PD, dosya MB, hedef marj, CVR, saat, saat ücreti, reklam/birim;
çıktı — baskı maliyeti, KDP minimum liste, önerilen fiyat (hedef marjı geçen ilk
$X.99), minimum uygulanabilir fiyat, her adayda net/marj/başabaş ACOS/max
CPC/saat geri kazanım adedi. Örnekler [V hesap]:

| Çağrı | Sonuç |
|---|---|
| `--pages 160 --trim large --format paperback --hours 14` | önerilen $14.99 (net $5.27, BE ACOS %35.2, 67 adet 14 saati öder); $12.99 net $4.07 (%31.4) |
| `--pages 280 --format large_print --candidates 24.99,26.98,31.03,34.99` | $31.03 → net $12.86 (%41.4); $34.99 → $15.23 |
| `--format ebook --channel direct --pd --hours 100` | $9.99 → net $8.99; 279 adet 100 saati $25/s'ten öder |
| `--format ebook --channel amazon --pd` | $9.99 → $3.50 (%35) — hedef marj geçilmez |

`revenue-targets.mjs` (yeni): hedef → gereken adet/sipariş/müşteri/kayıt/proje
(§28).

---

## 18 · Faz 18–24 — Yaşam döngüsü, bakım, operasyon, hukuk, QA, lansman (özet)

`CATALOG_LIFECYCLE_AND_MAINTENANCE_TR.md`: winner/average/weak/obsolete
ölçütleri; 30/60/100/180/250/500/1000 kayıt eşikleri; `validate:catalog`
spesifikasyonu; Founder-vs-otomasyon sorumluluk tablosu; rights ledger alanları;
Hangul için hak yolu; QA otomatik/insan; 11 adımlı lansman kontrol listesi.

---

## 19 · Faz 19 — Fabrika ölçekleme modeli

Varsayımlar [A]: Lane karışımı A %60 / C %30 / B %10; kapı saati A 3.5 h, C 6 h,
B 20 h → ortalama 4.5 h/proje + yükleme/lansman 1.5 h; bakım **otomasyonla**
0.1 h/kayıt/ay (otomasyonsuz 0.5); strateji 8 h/ay; kayıt/proje 2.75 [O]; AI
maliyeti ~$25/proje [A] + OCR/görsel $10–20/ay.

| Hız | Yıl | Kümülatif proje | Kayıt | Founder h/ay (yıl sonu) | AI $/ay | Katkı run-rate — "soğuk" [S] | "taban" [S] | "güçlü" [S] |
|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 3/ay | 1 | 36 | 99 | 36 | ~$90 | $2.2K | $7.0K | $21K |
| | 2 | 72 | 198 | 46 | | $4.4K | $14K | $42K |
| | 3 | 108 | 297 | 56 | | $6.5K | $21K | $63K |
| **5/ay** | 1 | 60 | 165 | 55 | ~$140 | $3.6K | $11.7K | $35K |
| | 2 | 120 | 330 | 71 | | $7.3K | $23K | $70K |
| | 3 | 180 | 495 | **88** | | $11K | $35K | $105K |
| 8/ay | 1 | 96 | 264 | 82 | ~$220 | $5.8K | $19K | $56K |
| | 2 | 192 | 528 | 109 | | $11.6K | $37K | $112K |
| | 3 | 288 | 792 | **135** | | $17K | $56K | $168K |
| 10/ay | 1 | 120 | 330 | 101 | ~$270 | $7.3K | $23K | $70K |
| | 2 | 240 | 660 | 134 | | $14.5K | $47K | $140K |
| | 3 | 360 | 990 | **167** | | $22K | $70K | $210K |

Hız senaryoları (kayıt başına adet/ay; **hiçbiri ölçülmüş değil**): soğuk
2.7 (winner 0.3/gün, avg 0.08, weak 0.01) · taban 8.7 (1.0/0.25/0.03) · güçlü
25.8 (3.0/0.7/0.1 — master stratejinin illüstratif değeri). Katkı = adet ×
$8.20.

Okuma: **8+/ay Founder'ı Yıl 1'de tam zamanlı, Yıl 3'te imkânsız kılar**;
5/ay Yıl 3'te ~88 saat/ay ile sınıra dayanır → Yıl 2 sonunda ya bakım için
yardım ya da 20 en zayıf başlığın arşivi. "Soğuk" senaryoda 5/ay bile Yıl 1
sonunda ~$3.6K/ay run-rate verir; ana gelir "taban" senaryosunu ve köprünün
çalışmasını gerektirir. **İlk çeyrek ölçümü hangi senaryoda olduğumuzu
söyler.**

Kapasite tanımları: teknik 8–10 · kalite-kontrollü 6–8 (Lane A) · Founder-onaylı
5–6 · **sürdürülebilir 5** · peak 8–10 (≤ 2 ay).

---

## 20 · Faz 25 — İlk 12 ay, ay ay

| Ay | Kitaplar | Formatlar | Companion | SEO | Ads | E-posta | Teknik | Ölçüm | Founder kararları |
|---|---|---|---|---|---|---|---|---|---|
| **1 · Eyl 2026** | Kitap 01 hak çözümü başlar; Kitap 02 spec + Gate 1; Kitap 03 kaynak+haklar | World Games LP, Enigmatica LP, Field Book LP dizgi + KDP | Hangul companion canlı | P0 düzeltmeleri; GSC doğrula + sitemap; `.vercel.app` 308; sitemap eksikleri | hesap açılışı; Author Central claim; henüz harcama yok | DMARC; welcome doğrulaması; post-purchase opt-in kutusu | `validate:catalog`; Web Analytics; `begin_checkout`; `/go/amazon` | KDP raporu ilk dışa aktarma; GSC ilk veri | P0-1..5; Bestiarium 120→112; price test onayı; Select auto-renew |
| **2 · Eki** | Kitap 02 üretim (kapı 2–10); Kitap 03 aparat; Kitap 05 başlar; `valice-house/` + şablon | LP'ler canlı; World Myths $6.99, Mythologica $6.99 | Greek companion; Bestiarium yaratık dizini v1 | seri sayfaları `/series/*`; `["Product","Book"]`; blog 3 eski yazı yerine 4 gerçek parça | Bestiarium hc + World Games hc **TEST** $10/gün | companion dizisi (Inngest) | `validate:seo`; RSS; kategori metaları | Attribution etiketleri; ilk 30 gün fiyat testi | Kitap 04 Gate 1 sonucu (git/gitme) |
| **3 · Kas** | Kitap 02 KDP live; Kitap 03 direct live; Kitap 05 direct live + **Stoic Library** paketi; Kitap 06 Kwaidan başlar; Kitap 07 (01 çözüldüyse) | Kitap 02 hc TEST | Dudeney ipuçları; Stoic rehber | oyun dizini v1; T2 "hangi Meditations çevirisi" | Q4: Ekim konumlan, Kasım ölçekle (bütçe ≤ $300) | new-release broadcast ×3 | GSC export scripti; `import-kdp.mjs` | ilk fiyat testi kararı; ads 30 gün | Kitap 12 (BYC) marka temizliği kararı |
| **4 · Ara** | Kitap 04 üretim; Kitap 06 live; Kitap 08 Field Book 2 başlar; Kitap 09 Falkener başlar | Kitap 03 Kindle (etiketli) | Field Book sertifika | mit dizini v1; 4 parça | Q4 zirve; kill/scale | seri akışı | `title-pnl.mjs`; 100-kayıt paketi başlangıcı | **İlk çeyrek raporu: sınıflandırma + hız senaryosu seçimi** | arşiv/tut kararları; Yıl 1 hedef revizyonu |
| **5 · Oca 2027** | Kitap 04 live; Kitap 10 Cyrillic; Kitap 11 Norse başlar; Kitap 09 devam | LP kararları (World Myths TEST) | Codex puzzles doğrulama | 4 parça; içerik-boşluk döngüsü ilk çalıştırma | Ocak düşüşü: bütçe kıs | re-engagement tasarımı | EPUB doğrudan mağazaya (5 orijinal) | — | Kitap 16 Heroica spec onayı |
| **6 · Şub** | Kitap 08 live; Kitap 09 live + **World Play** paketi; Kitap 13 Werner başlar; Kitap 16 Heroica üretim | — | tahta şablonları | 4 parça | TEST sonuçlarına göre ALWAYS-ON ilk aday | — | `/admin/metrics` v0 | 2. çeyrek raporu | Kitap 12 üretim kararı (test dikişçileri) |
| **7 · Mar** | Kitap 10 live; Kitap 11 live; Kitap 14 Seneca | Norse hc/ebook | Norse telaffuz | 4 parça | — | seri akışı (Great Book of…) | — | — | — |
| **8 · Nis** | Kitap 14 live (Stoic Library 3 kitap $19.99); Kitap 15 Kana; Kitap 18 Meditations annotated | — | Kana ses | 4 parça | — | — | — | — | Hangul 2 (07) canlı mı? |
| **9 · May** | Kitap 13 Werner live; Kitap 17 Games 2 başlar; Kitap 16 Heroica illüstrasyon | Werner pb | dizin | 4 parça | Werner: Amazon keşif (35 %) — reklam yok | — | katalog dosyası seri başına bölünür (100+ kayıt) | 3. çeyrek raporu | Kitap 12 live kararı |
| **10 · Haz** | Kitap 15 live; Kitap 16 Heroica direct live; Kitap 19 Loyd | Heroica pb/hc/LP | Heroica dizini | 4 parça | Heroica lansman | lansman broadcast | — | — | — |
| **11 · Tem** | Kitap 17 live; Kitap 19 live; Kitap 20 Enigmatica II üretim (**5 dış çözücü ölçülür**) | Games 2 hc/LP | tahtalar | 4 parça | — | — | — | — | Yıl 2 plan |
| **12 · Ağu** | Kitap 20 live; Yıl 1 kapanış: 20 yeni + 8 mevcut = 28 içerik projesi, ~40 ile 45 arası kayıtlı formatla ~110 kayıt hedefi (peak ayları kullanıldıysa) | — | — | yıllık SEO denetimi | Q4 planı | — | 180-kayıt paketi | **Yıllık ölçüm; 20/30/50 varsayımı gerçekle değiştirilir** | Yıl 2: 5/ay mı 6/ay mı; bakım yardımı |

Not: Yıl 1'de ilk 20 kitap + mevcut 8 = 28 proje; 36–45 hedefi için Ay 5–12'de
Lane A slate'lerinin 3 yerine 4 olması ve deneysel low-content probe'ları (1–2/ay)
gerekir — bunlar yalnızca şablon oturduktan sonra [R].

### 20.1 24 ay ve 36 ay

| Ufuk | Katalog | Motorlar | Yeni yetenek | Ölçüt |
|---|---|---|---|---|
| 24 ay (Ağu 2028) | 90–110 proje, ~275 kayıt; Valice Script 8 dil; Codex 6 cilt; Great Book 6; Classics 20+ | Lane A 3–4/ay, C 2/ay, B çeyrekte 1 | çoklu pazar fiyat matrisi; `/admin/metrics`; DAM; ilk dış yardım (bakım/QA, saatlik) | direct gelir ≥ %35 toplam katkı [S]; e-posta listesi ≥ 5.000; 3 ALWAYS-ON başlık |
| 36 ay (Ağu 2029) | 180–220 proje, ~550 kayıt | aynı + seri devamlılığı | katalog editörü + onay akışı; çeviri edisyonları (Türkçe? — yalnız veriyle) | ana gelir testi: 6 koşul birlikte |

---

## 21 · Faz 28 — İş hedefleri ($/ay katkı, reklam sonrası)

`node scripts/strategy/revenue-targets.mjs` (hibrit karışım, $8.20/birim, AOV
1.25, tekrar %15, reklam %15) [S]:

| Hedef | Adet/ay | Adet/gün | Sipariş | Yeni müşteri | Brüt gelir | Reklam | Kayıt (taban 25.8) | Kayıt (soğuk-taban 8.7) | Proje (8.7) | Ay @5/ay |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| $1.000 | 144 | 4.8 | 115 | 100 | $2.3K | $176 | 6 | 17 | 6 | 2 |
| $3.000 | 431 | 14.4 | 345 | 300 | $6.9K | $529 | 17 | 50 | 18 | 4 |
| $5.000 | 718 | 23.9 | 575 | 500 | $11.6K | $882 | 28 | 83 | 30 | 6 |
| $10.000 | 1.436 | 47.8 | 1.149 | 999 | $23.1K | $1.765 | 56 | 165 | 60 | 12 |
| $20.000 | 2.871 | 95.7 | 2.297 | 1.998 | $46.3K | $3.529 | 112 | 330 | 120 | 24 |
| $50.000 | 7.178 | 239 | 5.742 | 4.993 | $115.7K | $8.824 | 279 | 825 | 300 | 60 |

Okuma: **$10K/ay = günde ~48 adet.** "Taban" hızda 60 içerik projesi (Yıl 1
sonu, 5/ay) yeter; "soğuk" hızda 3× katalog gerekir. Direct-heavy karışım
($9.38/birim) her satırı ~%12 iyileştirir. Founder saati, altyapı (~$100–150/ay)
ve model maliyeti bu katkının içinde değildir.

---

## 22 · Faz 29 — Karar matrisi

Puan 1–10 (10 iyi; Risk'te 10 = güvenli); ağırlıksız ortalama. [R]

| Boyut | Seçenek | Marj | Hız | Ölçek | Tekrar | Edinim | Risk | Üretim | Web sinerjisi | Sürdürülebilirlik | **Ort.** | Karar |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| Ürün modeli | Hibrit E | 8 | 6 | 7 | 8 | 7 | 8 | 7 | 9 | 9 | **7.7** | çekirdek |
| | PD direct-first | 9 | 6 | 6 | 6 | 5 | 7 | 7 | 10 | 7 | 7.0 | ikincil |
| | Workbook fabrikası | 5 | 7 | 8 | 7 | 6 | 6 | 8 | 3 | 6 | 6.2 | keşif motoru |
| | High-content | 10 | 2 | 3 | 5 | 3 | 9 | 2 | 10 | 8 | 5.8 | marj katmanı |
| Niş | Script workbook | 6 | 8 | 8 | 7 | 7 | 8 | 9 | 7 | 6 | **7.3** | Lane A #1 |
| | Mitoloji bulmaca | 6 | 7 | 7 | 6 | 5 | 8 | 7 | 8 | 7 | 6.8 | validate → Lane A #2 |
| | Çocuk mitoloji/field book | 6 | 7 | 8 | 6 | 6 | 7 | 7 | 8 | 7 | 6.9 | Lane A #3 |
| | Stoa/klasik annotated PD | 9 | 7 | 6 | 6 | 5 | 8 | 7 | 10 | 7 | **7.2** | Lane C #1 |
| | Dikiş kalıp (BYC) | 8 | 4 | 6 | 6 | 6 | 5 | 4 | 5 | 8 | 5.8 | Lane B koşullu |
| | Sigorta sınav / hemşirelik doz / satranç (Founder araştırması) | 7 | 5 | 6 | 5 | 6 | 4 | 5 | 3 | 5 | 5.1 | **yapma** (uzman kapısı / varlık uyumu yok) |
| Format | pb + LP (6×9 referans) | 7 | 8 | 8 | 5 | 7 | 8 | 9 | 5 | 8 | 7.2 | her referansta |
| | hc | 6 | 8 | 7 | 5 | 6 | 8 | 9 | 5 | 8 | 6.9 | TEST/başlık |
| | direct ebook | 10 | 9 | 9 | 8 | 4 | 8 | 9 | 10 | 8 | **8.3** | her uygun başlıkta |
| Kanal | Amazon | 5 | 8 | 9 | 4 | 9 | 5 | 8 | 3 | 6 | 6.3 | keşif |
| | Valice direct | 10 | 8 | 7 | 8 | 3 | 8 | 8 | 10 | 9 | **7.9** | marj+sahiplik |
| Edinim | companion köprüsü | 9 | 6 | 8 | 9 | 7 | 9 | 8 | 10 | 9 | **8.3** | tek moat |
| | SEO referans dizinleri | 8 | 4 | 8 | 6 | 7 | 7 | 7 | 10 | 9 | 7.3 | Ay 2–6 |
| | Amazon Ads | 5 | 8 | 7 | 4 | 8 | 6 | 8 | 2 | 5 | 5.9 | lansman aracı |
| Tutundurma | seri + paket + e-posta | 8 | 7 | 8 | 9 | 6 | 8 | 8 | 9 | 9 | **8.0** | — |

---

## 23 · Faz 30 — Nihai stratejik karar

| Alan | Karar |
|---|---|
| **Core engine** | Hibrit: Amazon baskı keşfi + Valice doğrudan dijital + companion köprüsü. Lane A (Valice Script + Codex/Field Book şablonları) hacmi ve keşfi, Lane C marjı, Lane B markayı taşır. |
| **Secondary engine** | Annotated public domain, direct-first (Valice Classics) — %90 marj, sıfır lisans maliyeti, SEO varlığı. |
| **Flagship engine** | Çeyrekte 1: Codex Heroica (Yıl 1), Werner (PD flagship), Before You Cut 1 (koşullu). |
| **Public domain role** | Marj + katalog derinliği + provenans SEO; asla çıplak yeniden basım; asla Amazon-only. |
| **Amazon role** | Keşif, baskı, güvenilirlik, yorum; Select yalnızca direct'te satılmayacak kitaplar için (bugün: hiçbiri — Mythologica çıkarılıyor). |
| **Website role** | Doğrudan dijital satış, müşteri kütüphanesi, companion, seri sayfaları, referans dizinleri, e-posta rızası. |
| **Email role** | Tek audience; companion ve satın alma opt-in kaynaklı; seri/lansman/yeniden etkileşim; CAC'sız ikinci satış. |
| **SEO role** | Kalıcı organik yüzey: kitap + seri + referans dizinleri + T2 karşılaştırmalar; GSC boşluk döngüsü. |
| **Ads role** | Lansman-sıralama aracı; bütçe katkının ≤ %15'i; ALWAYS-ON yalnız kanıtla. |
| **Factory capacity** | teknik 8–10 · kalite-kontrollü 6–8 · Founder-onaylı 5–6 · **sürdürülebilir 5** · peak 8–10 (≤ 2 ay). |
| **Normal monthly output** | 5 içerik projesi (A 3 + C 1–2) + çeyrekte 1 B. |
| **Peak monthly output** | 8–10, yalnız şablonlu Lane A, ardından 1 toparlanma ayı. |
| **Year 1 catalog target** | 36–45 içerik projesi → ~110 başlık-format kaydı (ilk 20 + mevcut 8 + 8–17 şablonlu/deneysel). |
| **Year 2** | 90–110 proje → ~275 kayıt. |
| **Year 3** | 180–220 proje → ~550 kayıt; Founder saati sınırında → bakım yardımı veya arşiv. |

---

## 24 · Faz 31 — Yapılmayacaklar (şimdi)

| Yapılmayacak | Neden |
|---|---|
| Pazar yeri (üçüncü taraf yayıncı) | kilitli ADR; farklı iş |
| Abonelik / sayfa-okuma ekonomisi | 8–12 başlık + tekrar satın alma kanıtı yok; Select çelişkisi |
| Sert DRM | kilitli ADR; müşteri düşmanı |
| Gereksiz CMS / mikroservis | katalog dosya olarak diff'lenebilir; monolit yeter |
| Jenerik low-content seli | doygun, hesap riski, $5.35/birim |
| Rastgele PD dökümü | %35 tavanı + bedava rakipler; aparatsız edisyon satmaz |
| İlgisiz nişler (sigorta, hemşirelik, satranç, mühendislik rehberleri) | uzman kapısı / Valice varlığı yok |
| Aşırı SEO sayfası (programatik kategori metni, FAQPage, "free pdf" hedefi) | scaled content abuse; FAQPage ölü [V] |
| Kanıtsız reklam (0 yorumla ALWAYS-ON, PD, $4.99) | başabaş ACOS altında |
| Premium renk baskı | $0.99/birim tuzağı |
| Ayrı imprint/pen name | marka + liste + SEO bölünür |
| Doğrudan baskı fulfilment / ikinci POD | hacim yok; operasyon yükü |
| Google Indexing API, Book actions feed, GA4+consent banner | uygun değil / partner-only / gereksiz [V] |
| Üçüncü taraf dinamik QR | basılı kitabın ömrü servise bağlanamaz |

---

## 25 · Faz 32 — Faz kapıları (özet tablo)

| Faz | Amaç | Girdi | Çıktı | Bağımlılık | Ajan | İnsan | Süre | Başarı | Başarısızlık | KPI | Sonraki |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 0 Durum kilidi | gerçek durum | repo, canlı sistemler | bu belge §3 | — | — | Founder P0 | 1 gün ✅ | P0 listesi doğru | gizli varsayım | — | 1 |
| 1 Fabrika | tekrarlanabilir üretim | konvansiyon | house + şablon + lint | 0 | R9 | house-style | 3 hafta | Kitap 02 şablondan | ölçülmemiş kapı | saat/başlık | 2 |
| 2 Portföy | kesin kuyruk | niş matrisi, PD DB | ilk 5/20/50 | 1 | R1 | onay | ✅ | Gate 1 kanıtı | talep varsayımı | go/no-go | 3 |
| 3 Katalog opt. | mevcut 8 | ekonomi | LP'ler, fiyat testleri, düzeltmeler | 0 | R7/R9 | fiyat/format | Ay 1–2 | 3 LP canlı; testler | LP fiyatı oranla | katkı/birim | 4 |
| 4 KDP | baskı fabrikası | kurallar | plan + preflight | 1 | R7/R8 | Gate 8/10 | sürekli | 0 KDP reddi | ret | ret oranı | 24 |
| 5–6 PD | edinme motoru | kaynaklar | DB + scriptler + edisyon standardı | 1 | R6 | Gate 2 | Ay 1–3 | 3 edisyon | çıplak reprint | özgün pay | 7 |
| 7 E-kitap | dijital standart | fabrika | PDF/EPUB/paket | 0 P0 | R7/R9 | Gate 12 | Q1–Q2 | epubcheck 0 | pending hak | direct adet | 9 |
| 8 Kapak | görsel sistem | standartlar | prompt + slot + ingest | — | R7 | Gate 7 | Ay 1–2 | ingest testli | yer tutucu | thumbnail okunurluğu | 9 |
| 9 UI | ürün sayfaları | katalog | seri sayfaları, co-typing | 8 | R9 | Gate 12 | Ay 2 | validate yeşil | $0.00 | CVR | 12 |
| 10–11 Köprü/e-posta | sahip olunan okur | companion kaydı | 6 şablon, 6 akış | P0 | R7/R9 | arka sayfa metni | Ay 1–3 | ölçülen tarama | forma bağlı indirme | abone/kaynak | 14 |
| 12 SEO | organik yüzey | denetim | 13 sayfa tipi, GSC, döngü | P0-4 | R1/R5 | içerik sesi | sürekli | impressions ↑ | ince sayfa | tıklama | 13 |
| 13 Ads | lansman aracı | ekonomi | portföyler | 16 | R9 | bütçe | Ay 2+ | ACOS < hedef | kanıtsız harcama | TACOS | 24 |
| 16 Analitik | ölçüm | event'ler, raporlar | P&L | P0-3 | R9 | — | Ay 1 | ilk çeyrek raporu | veri boşluğu | — | 18 |
| 17 Fiyat | motor | rate card | scriptler ✅ | — | — | fiyat | ✅ | — | — | — | 3 |
| 18–20 Yaşam döngüsü/bakım | stok kontrolü | metrikler | validate, sınıflandırma | 16 | R9 | çeyrek | Ay 1–5 | bakım ≤ 10 h | elle SQL | h/ay | 19 |
| 19 Ölçek | kapasite | ölçüm | senaryo seçimi | 18 | — | Yıl 2 kararı | Ay 12 | doğru hız | 8+/ay ile tükenme | Founder h | 27 |
| 21–24 Ops/hukuk/QA/lansman | disiplin | — | rights ledger, checklist | 1 | R6/R9 | imzalar | sürekli | 0 politika ihlali | override "geçti" | — | — |

---

## 26 · Faz 37 — Bugün ve sonrası

| | Bugün (2 Eyl 2026) | Faz 1 sonrası (Ekim) | 6 ay (Mar 2027) | 12 ay (Ağu 2027) | 24 ay | 36 ay |
|---|---|---|---|---|---|---|
| Katalog | 8 proje / 22 kayıt | 8 + LP'ler / ~26 | ~16 proje / ~45 | 28–45 / ~110 | 90–110 / ~275 | 180–220 / ~550 |
| Doğrudan ürün | 5 e-kitap, 0 paket | 5 + fiyat testleri | ~12 + 2 paket | ~28 + 3 paket | ~80 | ~160 |
| Companion | 1 (doğrulama), 1 kodda | 2 canlı | 6 | 15+ | tüm baskı kitaplar | — |
| Ölçüm | yok | analytics + GSC + KDP CSV | ilk çeyrek raporu | yıllık; kendi hız verisi | P&L panosu | — |
| SEO | 24 URL, eski blog | P0'lar + seri sayfaları | dizinler v1, 12 parça | ~180 içerik sayfası | ~500 | — |
| E-posta | welcome | + companion dizisi + DMARC | 6 akış | segmentli | ≥ 5.000 abone [S] | — |
| Ads | yok | hesap | 2 TEST kampanyası | 1–3 ALWAYS-ON | — | — |
| Founder h/ay | ? | ~40 | ~50 | ~55 | ~70 | ~88 (sınır) |
| Ödeme | **kırık (P0-1)** | çalışır | — | — | — | — |

---

## 27 · Faz 38 — FOUNDER MUST DO

| # | Aksiyon | Neden | Nerede | Süre | Bağımlılık |
|---|---|---|---|---|---|
| 1 | `valicepress.com` apex'i birincil yap (www → apex) | Paddle webhook 308 alıyor; canonical çelişkisi | Vercel → Project → Settings → Domains | 2 dk | — |
| 2 | GSC TXT kaydı: Host `@`, `google-site-verification=o99ifmNUCFgIatG65vnRUxQ-2yMAIDo-xj805KnpUWU` → Verify → sitemap gönder | arama verisi birikmiyor | Namecheap Advanced DNS; search.google.com/search-console | 5 dk + yayılım | — |
| 3 | Vercel Web Analytics **Enable** (custom events için plan kontrolü) | sıfır ölçüm | Vercel → Analytics | 1 dk | — |
| 4 | Hangul: kaynak değişimi (97 kelime) **veya** KDP gönderimini geri çek | lisans sorusu açıkken satış | KDP Bookshelf; proje repo | karar 1 saat + iş 15–25 saat | hukuki |
| 5 | Bestiarium 4 ilanı "120" → "112" | yanlış iddia | KDP Bookshelf | 10 dk | — |
| 6 | Fiyat testi onayı: World Myths $6.99 (yeni Paddle fiyatı + katalog), Mythologica Kindle $6.99 | $4.99 en kötü nokta | Paddle dashboard; KDP | 15 dk | 1 |
| 7 | Mythologica KDP Select **auto-renew kapat** | 90 gün sonra direct satış | KDP Bookshelf | 2 dk | — |
| 8 | 3 LP edisyonu (World Games $31.03, Enigmatica $26.98, Field Book $20.23) üretim onayı + AI beyanı + proof | en yüksek katkılı baskı birimleri | KDP | onay 10 dk; proof 5–10 gün | 4B |
| 9 | Paddle `ebooks` vergi kategorisi talebi | KDV fazla tahsil | Paddle support | 15 dk | — |
| 10 | DMARC: `_dmarc` TXT `v=DMARC1; p=none; rua=mailto:emre30283@gmail.com` | teslimat | Namecheap | 3 dk | — |
| 11 | Resend → Domains → `valicepress.com` "Verified" mi; 1 Eylül hoş geldin e-postası `@valicepress.com`'dan geldi mi | gönderici doğrulaması | Resend + gelen kutusu | 5 dk | — |
| 12 | Yazar biyografisi (gerçek, doğrulanabilir) | KDP ret geçmişi; ProfilePage; Author Central | metin | 30 dk | — |
| 13 | "Vâliçe Press" / "Valice Press" kararı | kitaplar vs site | karar | 5 dk | — |
| 14 | Google Cloud: proje → Search Console API → service account → JSON key (git dışı, Vercel sensitive env) → GSC'ye Full user | GSC export | console.cloud.google.com | 20 dk | 2 |
| 15 | Amazon Ads hesabı + Author Central claim (3+ başlık) + Amazon Attribution | reklam ve atıf | advertising.amazon.com | 30 dk | 12 |
| 16 | World Games 5 oyun testi ("Ready to Play Tonight") | kitabın kendi iddiası | ev/arkadaş | 5 saat | — |
| 17 | Before You Cut: marka temizliği kararı (profesyonel) + 3 ücretli test dikişçisi mi, beklet mi | Kitap 12 | hukuk/Upwork | karar | — |
| 18 | Enigmatica II için 5 dış çözücü oturumu planı (bu kez ölçülecek) | kill-gate | — | Ay 10 | — |
| 19 | `.vercel.app` → 308 kodu ve companion canlıya alma diff'ini onayla | P0-2, köprü | PR | 10 dk | 1 |
| 20 | KDP Reports aylık CSV dışa aktarma alışkanlığı (ayın 5'i) | ölçüm | KDP Reports | 5 dk/ay | — |

---

## 28 · Faz 39 — Belirsizlikler (saklanmadı)

| Belirsizlik | Etkisi | Ne yapılacak |
|---|---|---|
| Hiçbir başlık için satış hızı verisi yok (1 sipariş, 0 yorum, KDP raporu okunmadı) | tüm gelir tabloları [S] | Ay 1'de KDP CSV; Aralık'ta ilk çeyrek |
| Arama hacmi / BSR verisi yok (Publisher Rocket vb. yok) | niş sıralaması "yargı" | Kitap 04 öncesi elle BSR örneklemesi; $199 Publisher Rocket [S] değerlendir |
| Amazon Ads CPC alt kategori verisi yok; Lockscreen/SD durumu belirsiz | bütçe | küçük TEST ile kendi CPC'n |
| Web trafiği ölçülmedi | dönüşüm oranları [A] | Analytics enable |
| Resend `send.` kayıtları belgelenen SES kalıbı değil | teslimat riski | panel kontrolü |
| OpenAI görsel başına maliyet (token/görsel tablosu çekilemedi) | $4 bütçe planı [A] | ilk çağrıda `usage` ölçülür |
| GSC doğrulanmadı; Google Cloud projesi yok | SEO ölçümü | Founder #2, #14 |
| Field Book canlı iç bloğunda görsellerin durumu (repo "0/~150 üretilmiş" diyor, kitap canlı) | kalite | canlı kopya/önizleme kontrolü |
| Hangul ve BYC hukuki soruları | iki kitap | Founder kararı; bu belge hukuki görüş değildir |
| WebSearch bütçesi bu oturumda tükendi; KDP/PD/Paddle ajanları kesildi, boşluklar resmi sayfa fetch'leriyle kapatıldı | bazı ikincil ayrıntılar DOĞRULANMADI | uzmanlık belgelerinde işaretli |

---

## 29 · Kaynaklar (birincil, kontrol tarihi 1–2 Eylül 2026)

KDP: Print Options (G201834180), Set Trim Size/Bleed/Margins (GVBQ3CMEQW3W2VL6),
Keywords (G201298500), Content Guidelines (G200672390), Publishing Public Domain
Content (G200743940), Paperback Royalty (G201834330), Create a Paperback Cover
(G201953020), Bonus Content (G202018960), Proof/Author Copies (GVEG4YA9G2T7N6DR),
KDP Select (G200798990), Pre-order (G201499380), Advertising (G201499010),
Reports (GVTTXHKHVPAPBEDQ), Hyperlink Guidelines (GQ6JQ7FM6C72HE4X).
Amazon Ads: author guides, budget best practices, targeting, moderation,
Attribution, API page (bkz. Ads planı kaynak tablosu). Google: Search Console
help (34592, 9008080, 7451001, 9012289, 9370220, 7687615), Search Central
(sitemaps, redirects, canonicalization, spam policies 2026-08-28, gen-AI content,
structured data: merchant listing, book, breadcrumb, organization, article,
profile page, review snippet, search gallery 2026-06-15, changelog), Webmaster
Tools API limits, Indexing API quickstart (2026-07-16), IndexNow.org, GA4 help,
Vercel docs (analytics, custom events, pricing 2026-08-25, privacy, preview
indexing). Paddle: respond-to-webhooks, pricing, create-product API. Resend:
domains/Namecheap, DMARC, pricing, llms.txt. OpenAI: pricing, image generation
guide, gpt-image-2 model page. Public domain: gutenberg.org/policy/permission,
standardebooks.org/about, help.archive.org/help/rights, Cornell/Hirtle chart,
PG search, IA advancedsearch. OCR: tessdoc, cloud pricing pages, arXiv
1810.03436 / 1809.05501, OmniDocBench.
