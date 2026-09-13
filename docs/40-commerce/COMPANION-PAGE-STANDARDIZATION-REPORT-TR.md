# Companion Sayfası Standardizasyon Raporu

**Tarih:** 13 Eylül 2026 · **Dal:** `main` · **Durum:** `READY FOR PRODUCTION`

**Etiketler:** **GÖZLEM** = bu oturumda ölçüldü · **BELGE** = yazılı kaynaktan okundu ·
**DOĞRULANMIŞ** = canlı üretimde test edildi · **ENGEL** = ilerlemeyi durduran.

---

## 1. Referans hakkında bir düzeltme

Direktif, referans görselini *"mevcut World Games companion sayfası"* olarak
tanımlıyor. **GÖZLEM** — öyle değildi. Göç öncesi canlı sayfa `max-w-3xl`
genişliğinde düz bir metin sütunuydu: hero yok, kapak yok, "FREE COMPANION"
etiketi yok, kart yok.

Bu, işi değiştirmez — tasarım yine de inşa edilip 29 rotanın tamamına
uygulandı — ama raporun ilk cümlesi doğru olmalı: referans **hedef**ti,
kopyalanacak bir ekran görüntüsü değil.

Kaynak: `images/all-companion-page.png` (13 Eylül 15:36, 1702×924). Dosyaya
dokunulmadı.

---

## 2. Ne inşa edildi

Tek bir kanonik şablon, paylaşılan bileşenlerle — 29 sayfa kopyalanmadı:

| Bileşen | İş |
|---|---|
| `CompanionHero` | Etiket, H1, altın kural + üç segmentlik satır, giriş, kitaba dönüş CTA'sı, kitabın kendi kapağı |
| `CompanionResourceGrid` | Masaüstünde 2'li, telefonda 1'li ızgara; tek sayıda kaynakta son kart tam genişlik |
| `CompanionResourceCard` | Altın dairesel ikon, serif başlık, izlenen küçük kapitaller, açıklama, zümrüt indirme düğmesi, **ölçülmüş** dosya boyutu |
| `CompanionSignup` | Referans yerleşimine getirildi; **her kelimesi, kaynak etiketi ve rıza mimarisi değişmedi** |
| `buildCompanionView` | Görünüm modeli — kapak, kapak oranı, dosya boyutları, türetilmiş satır |
| `scripts/companion/audit.mjs` | 29 rotayı çeken denetim |

---

## 3. Her sayfa KENDİ kitabını gösteriyor

Referansta World Games'in arkasında fotoğrafik bir natürmort var. Diğer 28
kitap için böyle bir fotoğraf **yok**, yeni görsel üretmek yasak (§4), ve bir
kitabın görseli başka bir kitabın sayfasında görünemez (§3).

**Çözüm:** atmosfer kitabın **kendi kapağından** türetiliyor — aynı dosya,
büyütülmüş, bulanıklaştırılmış, kendi keskin kopyasının arkasına konmuş.
Palet o kitabın paleti, yeni hiçbir şey çizilmedi, ve çapraz görsel
**yapısal olarak imkânsız**: anahtar slug'ın kendisi.

**DOĞRULANMIŞ** — denetim 29 sayfanın her birinde hero'daki `<img>`'in
`src`'sini okuyup beklenen kitap slug'ıyla karşılaştırıyor. **29/29 doğru,
0 çapraz kapak.**

### Çerçeve resme göre kesiliyor

**GÖZLEM** — İlk hero sabit `aspect-[3/4]` kutusu kullanıyordu. Bu kapaklar
1.500–1.600 oranında, dolayısıyla `object-cover` World Games'in **başlığını
üstten, yazar adını alttan kesti**. Direktifin bir companion hero'sunun asla
yapmaması gerektiğini söylediği tek şey buydu (§4).

Çerçeve artık kapağın gerçek oranını manifest'ten alıyor: hiçbir şey
kırpılmıyor, hiçbir şey letterbox olmuyor.

---

## 4. Sayfadaki hiçbir şey dekoratif değil

| Alan | Kaynak |
|---|---|
| Dosya boyutu | **Diskten ölçülüyor.** Referans 0.5 MB'lık bir dosyanın yanına "12 MB" yazıyor; bu sayfa **150 KB** yazıyor. Boyutu çalışma anına kadar bilinmeyen 3 üretilmiş sayfa için **hiçbir şey** yazmıyor |
| Altın satır | Companion'ın kendi varlıklarından türetiliyor (kaç tane, hangi formatta, ücretsiz) — 29 elle yazılmış pazarlama üçlemesi değil |
| Metadata satırı | `meta` alanındaki gerçek değer ("PDF · US LETTER · 32 PAGES") |
| Sosyal kart | Kitabın kendi kapağı |
| Alt metin | Kitabı adıyla anıyor — "image" / "cover" / "hero image" yasak (§21) |

---

## 5. Rota tablosu — üretimde ölçüldü

| Companion | Kitap | Kendi kapağı | Kaynaklar | E-posta | Kitap CTA | SEO | H1 | Canlı |
|---|---|---|---|---|---|---|---|---|
| `/companion/hangul` | Korean Hangul Handwriting Workbook | ✓ | 3/3 | ✓ | ✓ | ✓ | ✓ | 200 |
| `/companion/world-games` | The Great Book of World Games | ✓ | 4/4 | ✓ | ✓ | ✓ | ✓ | 200 |
| `/companion/dudeney` | The Puzzles of Henry Dudeney | ✓ | 2/2 | ✓ | ✓ | ✓ | ✓ | 200 |
| `/companion/world-myths` | The Great Book of World Myths | ✓ | 4/4 | ✓ | ✓ | ✓ | ✓ | 200 |
| `/companion/codex-bestiarium` | Codex Bestiarium | ✓ | 4/4 | ✓ | ✓ | ✓ | ✓ | 200 |
| `/companion/codex-mythologica` | Codex Mythologica | ✓ | 2/2 | ✓ | ✓ | ✓ | ✓ | 200 |
| `/companion/myth-hunters-field-book` | The Myth Hunter's Field Book | ✓ | 3/3 | ✓ | ✓ | ✓ | ✓ | 200 |
| `/companion/epictetus` | Epictetus: The Discourses and Enchiridion | ✓ | 4/4 | ✓ | ✓ | ✓ | ✓ | 200 |
| `/companion/chess-and-playing-cards` | Chess and Playing Cards: The Chess, Divination and Card Collections | ✓ | 4/4 | ✓ | ✓ | ✓ | ✓ | 200 |
| `/companion/korean-games` | Korean Games: The Games of Chance and Divination | ✓ | 4/4 | ✓ | ✓ | ✓ | ✓ | 200 |
| `/companion/games-ancient-and-oriental` | Games Ancient and Oriental: The Egyptian Games | ✓ | 4/4 | ✓ | ✓ | ✓ | ✓ | 200 |
| `/companion/seneca` | Seneca: Selected Dialogues | ✓ | 4/4 | ✓ | ✓ | ✓ | ✓ | 200 |
| `/companion/greek` | The Greek Alphabet Handwriting Workbook | ✓ | 4/4 | ✓ | ✓ | ✓ | ✓ | 200 |
| `/companion/china-gods` | Myths and Legends of China: Volume One, The Gods | ✓ | 4/4 | ✓ | ✓ | ✓ | ✓ | 200 |
| `/companion/vedic-gods` | Indian Myth and Legend: Volume One, The Vedic Gods | ✓ | 4/4 | ✓ | ✓ | ✓ | ✓ | 200 |
| `/companion/the-dragon` | Mythical Monsters: Volume One, The Dragon | ✓ | 4/4 | ✓ | ✓ | ✓ | ✓ | 200 |
| `/companion/codex-puzzles` | Codex Mythologica: The Puzzle Book | ✓ | 3/3 | ✓ | ✓ | ✓ | ✓ | 200 |
| `/companion/mancala` | Mancala, the National Game of Africa | ✓ | 4/4 | ✓ | ✓ | ✓ | ✓ | 200 |
| `/companion/traditional-games` | The Singing Games of England, Scotland, and Ireland | ✓ | 4/4 | ✓ | ✓ | ✓ | ✓ | 200 |
| `/companion/kwaidan` | Kwaidan: Stories and Studies of Strange Things | ✓ | 5/5 | ✓ | ✓ | ✓ | ✓ | 200 |
| `/companion/sea-monsters-unmasked` | Sea Monsters Unmasked, and Sea Fables Explained | ✓ | 4/4 | ✓ | ✓ | ✓ | ✓ | 200 |
| `/companion/book-of-were-wolves` | The Book of Were-Wolves | ✓ | 4/4 | ✓ | ✓ | ✓ | ✓ | 200 |
| `/companion/british-goblins` | British Goblins | ✓ | 4/4 | ✓ | ✓ | ✓ | ✓ | 200 |
| `/companion/fairy-mythology-vol-1` | The Fairy Mythology, Volume I | ✓ | 5/5 | ✓ | ✓ | ✓ | ✓ | 200 |
| `/companion/fairy-mythology-vol-2` | The Fairy Mythology, Volume II | ✓ | 5/5 | ✓ | ✓ | ✓ | ✓ | 200 |
| `/companion/etymon` | Words from the Gods | — | 3/3 | ✓ | ✓ | ✓ | ✓ | 200 |
| `/companion/play-anywhere` | Pencil & Paper | ✓ | 4/4 | ✓ | ✓ | ✓ | ✓ | 200 |
| `/companion/under-every-sky` | How the World Began | ✓ | 5/5 | ✓ | ✓ | ✓ | ✓ | 200 |
| `/companion/tricksters-table` | The Trickster's Table | ✓ | 5/5 | ✓ | ✓ | ✓ | ✓ | 200 |

**DOĞRULANMIŞ** — `node scripts/companion/audit.mjs --base https://valicepress.com`:

```
routes: 29  ·  clean: 29  ·  with problems: 0
assets checked: 113                 (113/113 çözülüyor, hepsi doğru content-type)
duplicate <title> across pages: 0
duplicate descriptions across pages: 0
cross-book covers: 0
```

Denetim, karşılaştırmadan önce HTML varlıklarını çözüyor. İlk koşuda üç
**doğru** sayfa `&#x27;` yüzünden başarısız raporlanmıştı; yanlış bir
başarısızlık gerçek olanları gömer.

---

## 6. FİZİKSEL CİHAZ TESTİ

**Device:** Xiaomi Redmi Note 8 Pro (M1908C3JGG, `biloba_global`)
**OS:** Android 11
**Browser:** Chrome 152.0.7977.82 (ADB + Chrome DevTools Protocol üzerinden)
**Date:** 13 Eylül 2026
**Base:** `https://valicepress.com` — canlı üretim, tarayıcı yeniden boyutlandırma değil

**Routes tested (9):** world-games · hangul · world-myths · codex-bestiarium ·
kwaidan · play-anywhere · dudeney · codex-puzzles · etymon

Bu dokuz, örnek olsun diye değil, şablonun hayatta kalması gereken **biçimleri**
kapsadığı için seçildi: iki, üç, dört ve beş kaynak (tek sayıda son kart tam
genişliğe geçer), `&` içeren bir başlık, kesme işareti içeren bir başlık,
ızgarayla e-posta kartı arasına giren etkileşimli cevap kontrolü, ve kitabının
hiç kapak varlığı olmayan tek companion.

**Passes:**

| Ölçüm | Sonuç |
|---|---|
| Rota render | **9/9** |
| Yatay taşma | **0** (kıyas: ana sayfa 516px) |
| WCAG dokunma hedefi hatası | **0** |
| Kontrast hatası | **0** |
| Belirsiz kontrast | **0** |
| 12px altı metin | **0** |

**Failures and fixes applied:**

1. **12px altı metin (7 düğüm/sayfa)** — kart metadata satırı 10.5px, hero
   etiketi ve altın satır 11px. Ev kuralına yükseltildi: **mobilde 12px,
   `lg:`'den itibaren 11px**. Telefonda bulundu, incelemede değil.
2. **Kapak yer tutucusunun künyesi 8px** — `<CoverArt>`'ın tipografik yer
   tutucusu "Valice Press"i sabit 8px yazıyordu. 20vw'lik kart yuvasında
   orantılı, 300px'lik bir hero'da saçma. `eyebrowClassName` prop'u eklendi
   (bileşenin zaten sahip olduğu `titleClassName` ile aynı desen).
3. **Altın satır segment ortasından kırılıyordu** — "NO SIGN-" bir satırda,
   "UP" tek başına diğerinde. Her segment artık `whitespace-nowrap`;
   ayraçlar dışarıda, yani satır yalnızca kasıtlı görünen yerde kırılıyor.

**Final result: PASS.**

### Fiziksel cihaz testinde öğrenilen — ve enstrümana yazılan

**ENGEL / GÖZLEM** — İlk üç cihaz koşusu **yanlış bir derlemeyi ölçtü** ve
bunu başarı gibi raporladı:

- `next start` yerelde Clerk anahtarı olmadan kök layout'ta patlıyor; telefon
  sayfa yerine *"SOMETHING WENT WRONG"* hata sınırını alıyordu.
- Harness yeni rotaya **yumuşak geçiş** yapıyor (bir bağlantıya tıklıyor), bu da
  telefonun elindeki app shell'i koruyor. Yeniden derlemeden sonra o shell bir
  önceki derlemenin hash'li CSS chunk'ını istiyor, sunucuda o dosya yok, sayfa
  **stilsiz** render oluyor.
- Sonuç: 88 dokunma hatası, 576 belirsiz kontrast, "render olmadı" diyen bir
  rota — **hiçbiri test edilen derleme için doğru değildi.**

Denenip **geri alınan** iki müdahale kayda değer: `Network.setCacheDisabled`
ve bağlantıda `about:blank`'e park etme. İkisi de her alt kaynağı her rotada
ADB tünelinden tekrar geçirdi, mevcut bekleme bütçesi yetmedi ve tünel sweep'in
ortasında düştü. Harness **sıcak** ölçmek için ayarlanmış; onu soğuğa zorlamak
çalışan bir enstrümanı güvenilmez yaptı. `scripts/mobile/device.mjs` olduğu
gibi bırakıldı.

**Doğru çözüm, kanıt üretimden alındı** — ortam da, varlık sunumu da doğru
olan tek yer orası.

**Kontrol ölçümü:** home, catalog, about, terms rotaları da 10–16 WCAG dokunma
hatası ve 40–47 adet 24px altı hedef gösteriyor. Companion sayfaları 0/21 ile
bunların **altında**; paylaşılan header ve footer'daki bu sayılar site geneli
ve bu çalışmadan önce de vardı.

---

## 7. AI asistan eşlemesi (§24)

**GÖZLEM** — 29 companion, 29 ayrı kitap, **çakışma yok, yinelenen slug yok.**
Eşleme bire bir: asistanın A kitabı için B kitabının companion'ını döndürmesi
mümkün değil. Kolay karışacak çiftler ayrı ayrı kontrol edildi:

```
the-great-book-of-world-games   → /companion/world-games
the-great-book-of-world-myths   → /companion/world-myths
codex-mythologica               → /companion/codex-mythologica
codex-mythologica-the-puzzle-book → /companion/codex-puzzles
```

---

## 8. Açık kalan tek madde

**ENGEL** — `/companion/etymon` tipografik yer tutucuyu render ediyor.
Kitabı *Words from the Gods* (ETY-01) **başka bir ajanın dalında**
(`feat/ety-01-words-from-the-gods`) ve `public/images/books/` altında kapak
varlığı yok.

Uydurulmadı: sayfa açılıyor, üç kaynağı da çalışıyor, ve kapak yerine kitabın
adını taşıyan tasarlanmış bir yer tutucu gösteriyor. O dal birleştiğinde kapak
dosyası eklenir ve hero kendiliğinden gerçek kapağa geçer — kod değişikliği
gerekmez.

---

## 9. Kapsam dışı bırakılan, kaydedilen

| Bulgu | Not |
|---|---|
| Ana sayfada **516px yatay taşma** | Cihazda ölçüldü. Gerçek ve bu çalışmadan önce de var; companion sayfaları 0 |
| Header/footer'da 24px altı dokunma hedefleri | Site geneli, paylaşılan bileşenler |
| `scripts/factory/companion-page.test.js` — 3 başarısız | Bu depoda olmayan kitap PDF'lerini okuyor; paylaşılan ağaçta başka bir ajan o iç sayfaları yeniden üretiyor. Diffim o dosyaların hiçbirine dokunmuyor |

---

## 10. Dağıtım

**Deployment hash:** `ea7c731`
**Live:** https://valicepress.com/companion/<slug> — 29 rotanın tamamı **200**

Doğrulama komutları:

```bash
node scripts/companion/audit.mjs --base https://valicepress.com
MOBILE_BASE_URL=https://valicepress.com npm run mobile:audit -- --routes companion,companion-kwaidan,companion-etymon
```

**Sonuç: READY FOR PRODUCTION.**
