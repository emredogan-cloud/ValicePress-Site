# Katalog Geri Yükleme Raporu

**Tarih:** 13 Eylül 2026 · **Dal:** `commerce/lemon-squeezy-migration` ·
**Karar:** Founder, 13 Eylül 2026 — Paddle emekli edildi; gizlenen katalog geri döndü.

**Etiketler:** **GÖZLEM** = bu oturumda ölçüldü · **BELGE** = yazılı kaynaktan okundu ·
**DOĞRULANMIŞ** = üretimde test edildi · **MODEL** = çıkarım · **ENGEL** = ilerlemeyi durduran.

---

## 1. Tek cümlede

**GÖZLEM** — Vitrin 12 kitaptan **30 kitaba** çıktı. 12 Eylül'de Paddle
incelemesi için `draft` yapılan **18 Valice Classics** başlığının tamamı
`published` durumuna döndü; hiçbiri silinmemişti, hiçbiri yeniden
oluşturulmadı, hiçbir alan kaybolmadı.

**ENGEL** — Aynı gün ödeme sağlayıcısı da değişti. Bugün itibarıyla vitrinde
**30 kitap görünüyor, 0 kitap satın alınabiliyor.** Sebep tek ve dışsal:
Lemon Squeezy mağazası henüz aktive edilmedi (kimlik doğrulama + banka hesabı
— ikisi de yalnızca Founder'ın yapabileceği işlemler). Ayrıntı:
`LEMON-SQUEEZY-PRODUCT-MASTER.md` §3.

---

## 2. Perde kalktı — ve geri dönüşün maliyeti sıfır oldu

**BELGE** — 12 Eylül commit `e9b31b8`: *"IT IS A CURTAIN, NOT A BULLDOZER"*.
O gün alınan karar, gizlemeyi **tek bir boolean** ile yapmaktı:
`HIDE_PUBLIC_DOMAIN_DURING_PADDLE_REVIEW`. Satırlar, başlıklar, açıklamalar,
kategoriler, ISBN'ler ve R2 master anahtarları olduğu gibi kaldı.

**GÖZLEM** — Bu karar bugün karşılığını verdi. Geri yükleme, o boolean'ı ve
onun bağlı olduğu kapıyı kaldırmaktan ibaretti. Hiçbir kitap yeniden
oluşturulmadı, hiçbir master yeniden yüklenmedi, hiçbir açıklama yeniden
yazılmadı. `valice-catalog.test.ts` içindeki yeni test bunu ölçüyor:

> *"has every public-domain title back on the storefront, intact"* — 18
> başlığın her biri için `websiteStatus`, ebook formatı, master anahtarı,
> başlık, açıklama ve kategoriler tek tek kontrol ediliyor. **26/26 test
> geçiyor.**

---

## 3. Geri dönen 18 başlık

| Kitap | Slug | Dijital fiyat | Teslim | Sayfa |
|---|---|---|---|---|
| Meditations | `meditations` | $9.99 | PDF | 148 |
| The Puzzles of Henry Dudeney | `the-puzzles-of-henry-dudeney` | $9.99 | PDF + EPUB | 144 |
| Epictetus: The Discourses and Enchiridion | `epictetus-discourses-and-enchiridion` | $9.99 | PDF + EPUB | 176 |
| Seneca: Selected Dialogues | `seneca-selected-dialogues` | $9.99 | PDF + EPUB | 154 |
| Myths and Legends of China | `myths-and-legends-of-china` | $9.99 | PDF + EPUB | 108 |
| Indian Myth and Legend | `indian-myth-and-legend` | $9.99 | PDF + EPUB | 94 |
| Mythical Monsters | `mythical-monsters` | $9.99 | PDF + EPUB | 74 |
| Games Ancient and Oriental: The Egyptian Games | `games-ancient-and-oriental` | $7.99 | PDF + EPUB | 78 |
| Korean Games: The Games of Chance and Divination | `korean-games` | $8.99 | PDF + EPUB | 144 |
| Kwaidan: Stories and Studies of Strange Things | `kwaidan` | $8.99 | PDF + EPUB | 142 |
| The Fairy Mythology, Volume I | `fairy-mythology-vol-1` | $9.99 | PDF + EPUB | 336 |
| The Fairy Mythology, Volume II | `fairy-mythology-vol-2` | $9.99 | PDF + EPUB | 326 |
| British Goblins | `british-goblins` | $11.99 | PDF + EPUB | 390 |
| The Book of Were-Wolves | `book-of-were-wolves` | $8.99 | PDF + EPUB | 198 |
| Sea Monsters Unmasked, and Sea Fables Explained | `sea-monsters-unmasked` | $9.99 | PDF + EPUB | 232 |
| The Singing Games of England, Scotland, and Ireland | `traditional-games` | $9.99 | PDF + EPUB | 244 |
| Chess and Playing Cards: The Chess, Divination and Card Collections | `chess-and-playing-cards` | $7.99 | PDF + EPUB | 120 |
| Mancala, the National Game of Africa | `mancala` | $4.99 | PDF + EPUB | 38 |

**GÖZLEM** — 18 başlığın 17'sinde hem PDF hem EPUB var; yalnızca
*Meditations* EPUB'suz (PDF ile satılıyor).

---

## 4. Kamu malı eserler nasıl sunuluyor — ve neyi iddia etmiyoruz

Bu, raporun en önemli bölümü. Paddle'ın gerekçesi
*"reselling/redistribution of third party content"* idi. Sağlayıcı gitti ama
**doğru sunum kuralı gitmedi** ve gitmemeli.

**Valice Press'in sahip olduğu:** dizgi, giriş yazıları, bölüm başlıkları,
sözlükler, dizinler, kronolojiler, konkordanslar — yani *baskı aygıtı*.
Fabrikanın kendi kapısı bunu her kitapta %20–22 arasında ölçüyor.

**Valice Press'in sahip OLMADIĞI:** altta yatan tarihsel metin. O kamu
malıdır. Her kitabın açıklaması kaynağı, çevirmeni ve baskı yılını adıyla
söylüyor; `rights` alanı taramanın nereden geldiğini kaydediyor.

**GÖZLEM** — Bunu koruyan üç yeni/değişmiş kontrol:

1. `valice-catalog.test.ts` → *"names the source text of every public-domain
   edition"* — 18 başlığın her birinde okuyucunun gördüğü provenans metninin
   varlığı ölçülüyor.
2. `provision-lemonsqueezy.mjs` → Valice Classics ürünlerinin Lemon Squeezy
   açıklamasına şu cümle **otomatik** ekleniyor: *"This is the Valice Press
   edition of a public-domain work: the typesetting, introduction, head-notes,
   glossary and index are ours; the underlying text is in the public domain
   and its source and translator are named in the book."*
3. `about/founder-card.tsx` → Sitede "klasikler şu an vitrinde değil" diyen
   cümle, ikisinin farkını açıklayan bir cümleyle değiştirildi.

---

## 5. Satışa kapalı kalan üç başlık — ve sebepleri

**GÖZLEM** — Yeni bir test, *emekli bir sağlayıcının* gerekçe olarak
kalmasını engelliyor: `"cites no retired payment provider as a reason not to
sell"`. 18 klasiğin engeli Paddle'dı; Paddle gidince engel de gitti. Geriye
kalan üç engelin üçü de hâlâ doğru:

| Kitap | Gerekçe | Ne zaman değişir |
|---|---|---|
| Codex Mythologica | **KDP Select münhasırlığı** — Kindle baskısı 6 Ağustos → **3 Kasım 2026** arasında Amazon'a özel. Bu bir sözleşme; eksik dosya değil. | 3 Kasım 2026 |
| The Myth Hunter's Field Book | **Tasarımı gereği dijital baskısı yok** — içine yazılan bir etkinlik kitabı. | Hiçbir zaman |
| Korean Hangul Handwriting Workbook | **Gate 2 (haklar) imzasız** — 2 Eylül'deki CC BY-SA / CC BY-NC kaynak değişimi onaylanmadı. | Founder imzalayınca |

---

## 6. Yerelde hazır ama sitede olmayan kitaplar

**GÖZLEM** — `MY-DİGİTAL-BOOK/` ağacı tarandı: yapılmış PDF/EPUB dosyaları,
üretim raporları ve kanonik kayıt (`BOOK-REGISTRY.md`) çapraz okundu.

### 6.1 Üretimi tamamlanmış, siteye eklenmeye hazır — 6 başlık

| Kitap | Yer | Durum | Neden henüz eklenmedi |
|---|---|---|---|
| Puzzles Old and New (Hoffmann) | `PUBLIC-BOOKS/PHASE-4-BOOK/01-` | 102 s · PDF + EPUB · Gate 2 PASS · 0 P0 | **Başka ajanın dalında** (`feature/public-domain-phase-4`), birleştirilmemiş |
| Modern Magic (Hoffmann) | `…/02-` | 116 s · PDF + EPUB · Gate 2 PASS · 0 P0 | aynı |
| The Twentieth Century Standard Puzzle Book (Pearson) | `…/03-` | 294 s · PDF + EPUB · Gate 2 PASS · 0 P0 | aynı |
| The Mathematical Tripos, Astrology, Ciphers and Time (Rouse Ball) | `…/04-` | 98 s · PDF + EPUB · Gate 2 PASS · 0 P0 | aynı |
| Mathematical Essays and Recreations (Schubert) | `…/05-` | 141 s · PDF + EPUB · Gate 2 PASS · 0 P0 | aynı |
| Words from the Gods (ETY-01) | `BOOK-SERIES/AJAN-A-BOOK/PHASE-4-SERIES/ETY-01` | 330 s · PDF + EPUB · 20/20 kapı GEÇTİ · KDP Kindle **DRAFT** | **Başka ajanın dalında** (`feat/ety-01-words-from-the-gods`); pazarlama belleğinde `[HOLD]` |

**BELGE** — Phase 4 ana raporu: *"Five books complete. Ten formats built,
verified and ready for handoff… 751 interior pages · 259,655 words · 75
claims, all verified · 5 rights assessments, all Gate 2 PASS · zero P0
findings across the phase."*

**Neden bu oturumda eklenmediler.** Founder direktifi §49 açık:
*"Do not touch Agent A work, Agent C work… uncommitted work from other
agents."* Altı başlığın altısı da başka ajanların açık dallarında duruyor.
Ayrıca siteye eklemek yalnızca katalog satırı yazmak değil: her biri için
**R2'ye master yükleme**, **vitrin kapak görseli** ve **companion sayfası**
gerekiyor. Bunlar o dalların kendi işi.

**MODEL** — Altısı da birleştirildiğinde katalog 30 → **36 kitaba**, satılabilir
dijital ürün 27 → **33'e** çıkar.

### 6.2 Hazır olmayan — kayda geçirildi, icat edilmedi

**BELGE** — `valice-catalog.mjs` içindeki `EXCLUDED` listesi olduğu gibi
korundu: *Before You Cut* 1–3 (kapaksız/boş iskelet), *License & Launch*
(0 soru, 0 kelime), beş Türkçe web projesi (dizgi yok, PDF/EPUB çıktısı yok).
*Greek Alphabet Workbook* hâlâ el yazısı kaynakları olmayan bir iskelet
olarak kayıtlı.

---

## 7. Katalog senkronizasyonu — nerede doğrulandı, nerede doğrulanmadı

| Yüzey | Durum |
|---|---|
| Katalog dosyası (`valice-catalog.mjs`) | **DOĞRULANMIŞ** — 30 published, 27 satışa açık, 0 kablolu |
| Sandbox veritabanı (`bookstore`) | **DOĞRULANMIŞ** — `load-catalog.mjs --commit` çalıştı, 30 kitap yüklendi |
| Üretim veritabanı (`neondb`) | **YAPILMADI** — Founder onayı bekliyor (§9) |
| Site (valicepress.com) | **YAPILMADI** — dağıtım yapılmadı |
| AI asistan | **GÖZLEM** — asistanın envanteri `listPublishedBooks()`; yeni `buyableHere` alanı eklendi, böylece asistan "satın alabilirsiniz" demeden önce gerçek bir kasa bağlantısı olup olmadığına bakıyor |
| Companion sayfaları | **GÖZLEM** — el yazısı `state` alanı 29 companion'ın 20'sinde kataloğa aykırıydı; sayfa artık vitrine doğrudan soruyor, alan yalnızca "geri çekildi" için yetkili |
| Sitemap / kategori / arama | **MODEL** — hepsi `status = 'published'` üzerinden filtreliyor; katalog yüklenince otomatik döner |

---

## 8. Hâlâ eksik olanlar

| Eksik | Sebep | Kim |
|---|---|---|
| 27 kitabın Lemon Squeezy ürünü | Mağaza test modunda | Founder (aktivasyon) |
| Üretim veritabanına yükleme | Onay bekliyor | Founder kararı |
| Phase 4 + ETY-01 (6 kitap) | Başka ajanların dalları | O dallar |
| Bundle ("The Stoic Library") | Lemon Squeezy'de çok ürünlü kasa yok | Ürünleştirme kararı |
