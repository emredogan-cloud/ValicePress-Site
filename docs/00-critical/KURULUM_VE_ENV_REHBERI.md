# Dijital Kitabevi — Kurulum ve Ortam Değişkenleri Rehberi

> **Belge sahibi:** Platform Mühendisliği
> **Hedef kitle:** Bu projeyi yerel makinede ayağa kaldıracak, Vercel'de
> üretime dağıtacak veya CI/CD hattını yapılandıracak mühendisler.
> **Önkoşul:** `WEB_SITE_ROADMAP.md` ve `memory/PAST_DECISIONS.md`
> belgelerinin okunmuş olması.

Bu rehber; Neon, Clerk, Cloudflare R2, Paddle ve Inngest için **hesap
oluşturmadan üretim dağıtımına kadar** her adımı, kod tabanının fiilen
hangi ortam değişkenini hangi dosyada okuduğu bilgisiyle birlikte verir.
Belge, kaynak koddaki `process.env.*` referansları taranarak hazırlanmıştır;
yalnızca `.env.example` şablonuna güvenilerek yazılmamıştır.

---

## 0. Belge Kapsamı

| Bölüm | İçerik |
|---|---|
| 1 | Mimari özet ve değişken yaşam döngüsü |
| 2 | Ortam değişkenleri envanteri — tek bakışta tüm kayıtlar |
| 3 | Önkoşullar ve önerilen kurulum sırası |
| 4 | **Neon** — Postgres veritabanı |
| 5 | **Clerk** — Kimlik doğrulama |
| 6 | **Cloudflare R2** — Nesne depolama |
| 7 | **Paddle** — Merchant of Record |
| 8 | **Inngest** — Asenkron iş kuyruğu |
| 9 | Yardımcı değişkenler (`NEXT_PUBLIC_APP_URL`, `ADMIN_EMAILS`) |
| 10 | Yerel doğrulama prosedürü |
| 11 | GitHub Actions / CI sırları |
| 12 | Sorun giderme |
| 13 | Üretim çıkış kontrol listesi |
| 14 | **Upstash Redis** — Rate-limit + Data Cache arka ucu |
| 15 | **Resend** — Transactional email ("siparişiniz hazır" gibi) |
| 16 | **Vercel Analytics & Speed Insights** — Ürün analitiği + Core Web Vitals |
| 17 | **Sentry** — Hata izleme, performans ve source-map sembolizasyonu |
| 18 | **MailerLite & BookFunnel** — Bonus sahne lead magnet hunisi ve okuyucu kazanımı |

---

## 1. Mimari Üzerine Hızlı Bağlam

Dijital Kitabevi; **Next.js (App Router)** üzerinde çalışan modüler bir
monolittir. Yan hizmetler şu şekilde paylaşılmıştır:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Next.js (Vercel — Fluid Compute)                │
│  • SSG/ISR katalog + Server Actions + API rotaları                     │
└────────────┬──────────────┬────────────┬──────────────┬───────────────┘
             │              │            │              │
        ┌────▼────┐    ┌────▼────┐  ┌────▼────┐    ┌────▼────┐
        │  Neon   │    │  Clerk  │  │   R2    │    │ Paddle  │
        │Postgres │    │  Auth   │  │ Storage │    │  MoR    │
        └─────────┘    └─────────┘  └─────────┘    └─────────┘
                                                         │
                                                    ┌────▼────┐
                                                    │ Inngest │
                                                    │ Kuyruk  │
                                                    └─────────┘
```

Her bağlantı için **üç ayrı ortam** vardır:

1. **Yerel geliştirme** (`.env.local`)
2. **Vercel Preview / Staging** (Vercel projesi → Settings → Environment Variables)
3. **Vercel Production** (Vercel projesi → Settings → Environment Variables)

**Kural (PAST_DECISIONS · §12):** Üç ortam **birbirinden tamamen
yalıtılmış** kimlik bilgileri kullanır. Üretim Paddle anahtarını
Preview'a kopyalamak; Production Neon dalını staging'de kullanmak vb.
**yasaktır.** Her ortam için ayrı bir Neon dalı, ayrı R2 kova çifti ve
Paddle Sandbox/Production ayrımı zorunludur.

### 1.1. Bir Değişkenin Yaşam Döngüsü

```
┌──────────────────┐   1. Üçüncü taraf panosunda oluşturulur
│ Sağlayıcı panosu │      (Neon / Clerk / R2 / Paddle / Inngest)
└────────┬─────────┘
         │  2. Kopyalanır
         ▼
┌──────────────────┐   3. Yerelde .env.local'a yazılır (asla commit edilmez!)
│  Yerel .env.local│
└────────┬─────────┘
         │  4. `vercel env add NAME` veya Vercel panelinden eklenir
         ▼
┌──────────────────┐   5. Vercel build/runtime ortamına otomatik enjekte edilir
│  Vercel ortamı   │
└────────┬─────────┘
         │  6. Migration adımları için GitHub Actions secret olarak da eklenir
         ▼
┌──────────────────┐
│  CI Secrets      │
└──────────────────┘
```

`NEXT_PUBLIC_*` ile başlayan değişkenler **build zamanında** istemci paketine
gömülür; gizli olmamalıdır. Diğer tüm değişkenler yalnızca sunucu tarafında
çalışan kodda görünür kalır.

---

## 2. Ortam Değişkenleri Envanteri (Tek Bakışta Tüm Kayıtlar)

Aşağıdaki tablo, her değişkenin **kod tabanında hangi dosyada** okunduğunu
gösterir. "Zorunlu mu?" sütunundaki **kırmızı** kayıtlar, üretim dağıtımı
öncesinde mutlaka set edilmelidir; aksi hâlde ilgili özellik **runtime
hatası** üretir.

| Değişken | Bağlam | Zorunlu mu? | Tüketim Noktası |
|---|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Uygulama | **Öneri** | `src/app/layout.tsx` (metadataBase), `src/lib/seo.ts` (getBaseUrl) |
| `DATABASE_URL` | Neon | **EVET** | `src/lib/db/index.ts` (Pool), `drizzle.config.ts` (drizzle-kit) |
| `DIRECT_URL` | Neon | Öneri | (drizzle-kit migration’ları için Neon tavsiyesi; gelecekte zorunlu olabilir) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk | **EVET** | `src/proxy.ts`, `src/app/layout.tsx`, `src/components/review-form.tsx`, `src/app/admin/page.tsx`, `src/lib/account.ts` |
| `CLERK_SECRET_KEY` | Clerk | **EVET** | `src/proxy.ts`, `src/app/admin/page.tsx`, `src/lib/account.ts` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Clerk | Öneri | Clerk SDK (kendi okur) |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Clerk | Öneri | Clerk SDK (kendi okur) |
| `CLERK_WEBHOOK_SECRET` | Clerk | Sonra | Şu an placeholder (`syncClerkUserToDatabase`); ileride Clerk → Postgres senkronu için |
| `ADMIN_EMAILS` | Uygulama | **EVET** (admin erişimi için) | `src/lib/auth.ts` (`getAdminEmailAllowlist`, `requireAdmin`) |
| `R2_ACCOUNT_ID` | R2 | Bilgi | (S3 SDK doğrudan kullanmaz; endpoint URL’sinde gömülüdür) |
| `R2_ACCESS_KEY_ID` | R2 | **EVET** | `src/lib/storage/index.ts` (S3Client credentials) |
| `R2_SECRET_ACCESS_KEY` | R2 | **EVET** | `src/lib/storage/index.ts` (S3Client credentials) |
| `R2_ENDPOINT` | R2 | **EVET** | `src/lib/storage/index.ts` (S3Client endpoint) |
| `R2_BUCKET_MASTERS` | R2 | **EVET** | `src/lib/storage/index.ts` (resolveBucketName) |
| `R2_BUCKET_ARTIFACTS` | R2 | **EVET** | `src/lib/storage/index.ts` (resolveBucketName) |
| `R2_PUBLIC_BASE_URL` | R2 | Öneri | `next.config.ts` (images.remotePatterns), `src/lib/seo.ts` (getCoverImageUrl) |
| `PADDLE_API_KEY` | Paddle | **EVET** | `src/lib/paddle.ts` (`getPaddleClient`) |
| `PADDLE_WEBHOOK_SECRET` | Paddle | **EVET** | `src/app/api/webhooks/paddle/route.ts` (imza doğrulama) |
| `PADDLE_ENVIRONMENT` | Paddle | Öneri | `src/lib/paddle.ts` (sandbox/production seçimi); varsayılan `sandbox` |
| `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` | Paddle | **EVET (checkout için)** | İstemci tarafı Paddle.js token’ı |
| `INNGEST_EVENT_KEY` | Inngest | **EVET (üretim)** | Inngest SDK (`inngest.send`) |
| `INNGEST_SIGNING_KEY` | Inngest | **EVET (üretim)** | Inngest SDK (`serve` handler imza doğrulaması) |
| `UPSTASH_REDIS_REST_URL` | Upstash | Öneri | `src/lib/rate-limit.ts` (rate limiter Redis istemcisi) |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash | Öneri | `src/lib/rate-limit.ts` (rate limiter Redis istemcisi) |
| `RESEND_API_KEY` | Resend | **EVET (üretim)** | `src/lib/email.ts` (`getResendClient`) |
| `EMAIL_FROM` | Resend | Öneri | `src/lib/email.ts` (gönderen adresi; varsayılan `onboarding@resend.dev` — test) |
| `SENTRY_DSN` | Sentry | Öneri | `sentry.server.config.ts`, `sentry.edge.config.ts`, `src/lib/logger.ts` |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry | Öneri | `sentry.client.config.ts` (browser-side init) |
| `SENTRY_AUTH_TOKEN` | Sentry | Öneri (build) | `next.config.ts` (`withSentryConfig` — source-map upload) |
| `SENTRY_ORG` | Sentry | Öneri (build) | `next.config.ts` (source-map upload) |
| `SENTRY_PROJECT` | Sentry | Öneri (build) | `next.config.ts` (source-map upload) |

> **Önemli:** `NEXT_PUBLIC_*` öneki olan tüm değişkenler **istemci paketine
> dahil edilir**. Bu nedenle bunlar **gizli olmamalıdır.** Sızması zararlı
> olabilecek anahtarları (örn. `CLERK_SECRET_KEY`, `PADDLE_API_KEY`,
> `R2_SECRET_ACCESS_KEY`, `INNGEST_SIGNING_KEY`) **asla** `NEXT_PUBLIC_`
> önekiyle yeniden adlandırmayın.

---

## 3. Önkoşullar ve Önerilen Kurulum Sırası

### 3.1. Yerel Önkoşullar

| Araç | Sürüm | Kontrol |
|---|---|---|
| Node.js | ≥ 22 LTS (önerilen 24 LTS) | `node --version` |
| npm | ≥ 10 | `npm --version` |
| git | ≥ 2.40 | `git --version` |
| Vercel CLI | son | `npm i -g vercel@latest` |
| Inngest CLI | son | `npm i -g inngest-cli@latest` |

### 3.2. Önerilen Kurulum Sırası

Sağlayıcıları aşağıdaki sırayla provizyonlayın. Sıra **rastgele değildir**:
sonraki adımlar öncekinin çıktısına bağlıdır.

```
1. GitHub deposunu klonla            (zaten yapıldı)
2. Vercel projesini oluştur          (depoyu Vercel'e bağla — link/connect)
3. Neon projesi + dalları           → DATABASE_URL, DIRECT_URL
4. Clerk uygulaması                 → NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY
5. Cloudflare R2 kovaları + token   → R2_*
6. Paddle Sandbox + Production      → PADDLE_*, NEXT_PUBLIC_PADDLE_CLIENT_TOKEN
7. Inngest Cloud uygulaması         → INNGEST_*
8. ADMIN_EMAILS, NEXT_PUBLIC_APP_URL → uygulama yardımcı değişkenleri
9. `npm run db:migrate` ile şemayı uygula
10. Yerel doğrulama prosedürü       → §10
11. Vercel'e dağıt                  → vercel deploy --prod
```

---

## 4. Neon — Postgres Veritabanı

### 4.1. Amaç

Neon; sipariş, kullanıcı, kitap, yetki belgesi (entitlement), inceleme,
filigran işleri gibi tüm ilişkisel veriyi tutar. Kullandığımız sürücü
**WebSocket-tabanlı `@neondatabase/serverless`** (SUB-PR 0.3); bu, Drizzle
ile gerçek `BEGIN…COMMIT` işlemleri (fulfillment hattının atomikliği için
zorunlu) yapabilmek için seçilmiştir.

### 4.2. Hesap ve Proje Oluşturma

1. **Hesap aç:** `https://console.neon.tech/sign_up` → e-posta veya GitHub
   ile kayıt ol.
2. **Yeni proje oluştur:** Üst menüde **Projects** → sağ üstte
   **`+ New Project`** düğmesi.
3. Açılan formda:
   - **Project name:** `digital-bookstore-prod` (üretim için)
   - **Postgres version:** 17 (varsayılan kabul)
   - **Region:** Ana hedef pazara en yakın bölge (AB için
     `aws-eu-west-2 (London)`; ABD için `aws-us-east-1 (N. Virginia)`).
     Vercel projenizin bölgesiyle aynı/yakın olmalı.
   - **Database name:** `bookstore` (varsayılan `neondb` yerine açıklayıcı bir ad)
   - **Role:** `bookstore_owner`
4. **`Create project`** düğmesine basın.

### 4.3. Geliştirme / Staging Dalları (Branches)

Neon'un öne çıkan özelliği "veritabanı dalı" oluşturmaktır — her dal,
bağımsız bir Postgres örneğidir.

1. Sol kenar menüden **`Branches`** sekmesine girin.
2. **`Create branch`** düğmesine basın.
3. Form:
   - **Parent branch:** `main` (default)
   - **Branch name:** `preview` (Vercel Preview ortamı için)
4. Oluştur.
5. Aynı adımı **`staging`** adıyla bir kez daha tekrarlayın.

Sonunda üç dalınız olmalı: `main` (production), `preview`, `staging`.
Her dalın **kendi `DATABASE_URL` ve `DIRECT_URL`** değerleri vardır.

### 4.4. Bağlantı Dizelerini Kopyalama

Her dal için ayrı ayrı yapılır:

1. **Branches** sekmesi → ilgili dalın üzerine tıklayın.
2. Açılan sayfanın sağ üstünde **`Connect`** düğmesi → tıklayın.
3. Modal'da:
   - **Database:** `bookstore`
   - **Role:** `bookstore_owner`
   - **Connection type:** **`Connection string`** seçili olsun.
4. İki bağlantı dizesi görünür:
   - **Pooled connection** (üst kutu, içinde `-pooler` geçer)
     → **`DATABASE_URL`** olarak kullanılır. Uygulama runtime'ı bunu okur.
   - **Direct connection** (alt kutu, `-pooler` **yoktur**)
     → **`DIRECT_URL`** olarak kullanılır. drizzle-kit migration'ları
     için tavsiye edilir.
5. Kopyalama: Her iki dizeyi de **`Copy`** simgesiyle kopyalayıp aşağıdaki
   şablona yapıştırın.

```bash
# Pooled (uygulama)
DATABASE_URL=postgresql://bookstore_owner:NEON_PWD@ep-xxxx-pooler.eu-west-2.aws.neon.tech/bookstore?sslmode=require

# Direct (migration)
DIRECT_URL=postgresql://bookstore_owner:NEON_PWD@ep-xxxx.eu-west-2.aws.neon.tech/bookstore?sslmode=require
```

### 4.5. Değerleri Üç Ortama Yerleştirme

#### 4.5.1. Yerel Geliştirme

Proje kök dizininde `.env.local` dosyası oluşturun (zaten yoksa):

```bash
touch .env.local
echo "DATABASE_URL=…"  >> .env.local   # preview dalının pooled dizesi
echo "DIRECT_URL=…"    >> .env.local   # preview dalının direct dizesi
```

> Yerel geliştirme için **preview** dalını kullanmak gerçek üretim verisini
> korur. Üretim dalını yerelde kullanmayın.

#### 4.5.2. Vercel — Preview ve Production

```bash
# Preview ortamı (preview dalının dizeleri)
vercel env add DATABASE_URL preview
vercel env add DIRECT_URL   preview

# Production ortamı (main dalının dizeleri)
vercel env add DATABASE_URL production
vercel env add DIRECT_URL   production
```

Komut çalıştırdığınızda Vercel CLI değeri sorar; ilgili dalın bağlantı
dizesini yapıştırın. Alternatif olarak Vercel panelinde:
**Projeniz → Settings → Environment Variables → `Add New`** yolunu izleyin.

#### 4.5.3. GitHub Actions (Migration İçin)

CI üzerinden `npm run db:migrate` çalıştırılacaksa, GitHub deposunda:

1. **Settings → Secrets and variables → Actions** sayfasına girin.
2. **`New repository secret`** düğmesine basın.
3. İki secret ekleyin:
   - **Name:** `DATABASE_URL_MIGRATIONS`
     **Secret:** Production `main` dalının **direct** dizesi
   - **Name:** `DATABASE_URL_PREVIEW`
     **Secret:** Preview dalının **direct** dizesi

(İsim olarak `DATABASE_URL` yerine ayrı isim kullanmak; üretim
migration'ının yanlışlıkla başka iş akışında kullanılmasını engeller.)

### 4.6. İlk Şema Uygulaması

Yerel olarak:

```bash
npm install
npm run db:migrate    # drizzle/0000_*.sql ve sonrasını uygular
```

Doğrulama:

```bash
npm run db:studio     # tarayıcıda Drizzle Studio açılır
```

### 4.7. Yaygın Sorunlar — Neon

| Belirti | Olası Sebep | Çözüm |
|---|---|---|
| `connection refused` | Yanlış endpoint (pooler vs direct karışmış) | Migration için direct, runtime için pooler kullanın |
| `password authentication failed` | Role parolası değişti | Neon → Roles → şifre sıfırla → bağlantı dizesini yeniden kopyala |
| `relation "books" does not exist` | Migration uygulanmamış | `npm run db:migrate` çalıştırın |

---

## 5. Clerk — Kimlik Doğrulama

### 5.1. Amaç

Clerk; oturum açma, e-posta doğrulama, magic-link, sosyal kimlikler ve
oturum çerezleri için tek noktadan yönetilen kimlik sağlayıcıdır
(`PAST_DECISIONS.md` · ADR-8). Postgres `users` tablosu **ticari ilişkiyi**
(sipariş, yetki, inceleme) tutar; Clerk **kimliği** tutar — iki depo
`upsertLocalUser` ile JIT senkronize edilir.

### 5.2. Uygulama Oluşturma

1. **Kayıt:** `https://dashboard.clerk.com/sign-up` → GitHub ile veya
   e-posta ile.
2. **Yeni uygulama:** Sol üst Workspace seçici altında
   **`+ Create application`** düğmesi.
3. Form:
   - **Application name:** `digital-bookstore` (üretim)
   - **Sign-in options** seçicilerinden açılması istenenleri işaretleyin:
     - ✅ **Email** (zorunlu, magic-link bunun üstünden gelir)
     - ✅ **Google** (sosyal kimlik tercihiniz varsa)
     - ✅ **GitHub** (geliştirici hedef kitle için ek bir seçenek)
4. **`Create application`** düğmesi.

### 5.3. E-posta ve Magic-Link Açılması

1. Sol menü: **User & authentication → Email, Phone, Username**.
2. **Email address** kartında:
   - **Required** anahtarını **açın**.
   - **Verify at sign-up** anahtarını **açın**.
   - **Email verification code** yerine **`Email verification link`**
     (magic-link) seçeneğini etkinleştirin.
3. Aşağıda **Sign-in factors** bölümünde:
   - **Email verification link** seçeneğini etkinleştirin (ana giriş yöntemi).
4. **Save** düğmesi.

### 5.4. Sosyal Bağlantılar

1. Sol menü: **User & authentication → Social Connections**.
2. Açmak istediğiniz her sağlayıcı için (örn. **Google**):
   - **Configure** düğmesi → karşınıza Google Cloud Console’dan alacağınız
     `Client ID` ve `Client Secret` istenir. (Clerk varsayılan paylaşılan
     anahtar sunmaz; production için kendi OAuth uygulamanızı kurmanız
     gerekir.)
   - Gerekli yönlendirme URI’sini Clerk size verir; bunu Google Cloud
     Console’a kopyalayın.
3. Tamamlanınca **Enable** anahtarını açın.

### 5.5. API Anahtarlarının Çıkarılması

1. Sol menü: **Configure → API Keys** (URL: `…clerk.com/apps/…/api-keys`).
2. Sayfada iki bölüm vardır:
   - **Publishable key** — `pk_test_…` veya `pk_live_…` ile başlar.
     Bu **istemciye yayılır**, gizli değildir.
   - **Secret keys → Show secret** ile gösterilir; `sk_test_…` /
     `sk_live_…` ile başlar. Bu **sunucu tarafıdır**, **kesinlikle**
     istemciye sızdırılmaz.
3. Her ikisini de kopyalayın:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxx
CLERK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 5.6. Üç Ortama Yerleştirme

#### 5.6.1. Yerel

```bash
# .env.local
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
```

#### 5.6.2. Vercel

```bash
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY preview
vercel env add CLERK_SECRET_KEY                  preview
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production
vercel env add CLERK_SECRET_KEY                  production
```

> **Production için ayrı bir Clerk uygulaması açın.** Üretimde `pk_live_*`
> ve `sk_live_*` anahtarları kullanılır. Aynı uygulamayı staging ve
> production için karıştırmak; staging’deki test kullanıcılarının
> production veritabanına sızması demektir.

### 5.7. Kod Tabanı ile Bağlantı

`src/app/layout.tsx` (SUB-PR 2.3 düzeltmesi) içinde **koşullu
`ClerkProvider`** kullanılır:

```tsx
const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
// publishableKey set değilse <ClerkProvider> mount edilmez.
```

Bu yüzden:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` yoksa: **Tüm sayfa Clerk olmadan
  çalışır.** Korunaklı `/admin`, `/account`, `/order`, `/read` rotaları
  yine de proxy katmanında "Clerk yok → korumayı atla" stratejisi
  kullanır (`src/proxy.ts:isClerkConfigured`).
- `CLERK_SECRET_KEY` yoksa: Clerk Server SDK çağrıları (örn. `currentUser`)
  hata fırlatır; ilgili sayfanın `loadXxxContext` yapıları bu durumu
  "Configuration required" notu olarak gösterir.

### 5.8. (İsteğe Bağlı, Sonra) Clerk Webhook

`CLERK_WEBHOOK_SECRET` şu an placeholder’dır (`src/lib/auth.ts:syncClerkUserToDatabase`).
İleride bir SUB-PR Clerk → Postgres senkron webhook’unu eklediğinde:

1. **Configure → Webhooks → `+ Add Endpoint`**
2. **Endpoint URL:** `https://your-domain.com/api/webhooks/clerk`
3. Subscribe to events: `user.created`, `user.updated`, `user.deleted`.
4. **Signing Secret** alanını kopyalayın → `CLERK_WEBHOOK_SECRET` olarak
   üç ortama da yerleştirin.

---

## 6. Cloudflare R2 — Nesne Depolama

### 6.1. Amaç

R2; **özel** kitap masterları (PDF kaynaklar) ve **özel** filigranlı
artefaktları (alıcıya özel PDF kopyaları) barındırır. Kapak görselleri
(`books.cover_key`) tek istisnadır — okuma trafiği yüksek olduğu için
ayrı bir **public** kova üzerinden sunulur. Egress sıfır maliyettir
(ADR-6); bu, indirme ağırlıklı iş modelimiz için belirleyicidir.

Sistemimizde **iki özel kova çifti** (per environment) ve **bir public
kova** vardır:

| Kova | Görev | Erişim |
|---|---|---|
| `R2_BUCKET_MASTERS` | Yükleme yapılan PDF kaynaklar | Özel — yalnızca imzalı URL |
| `R2_BUCKET_ARTIFACTS` | Sipariş başına filigranlı kopyalar | Özel — yalnızca imzalı URL |
| (public) | Kapaklar, statik varlıklar | Public domain (`R2_PUBLIC_BASE_URL`) |

### 6.2. R2'yi Aktifleştirme

1. Cloudflare hesabınızla giriş: `https://dash.cloudflare.com`.
2. Sol kenar menü: **R2 Object Storage** (öğe yoksa hesap üst seviyesinden
   **R2** sekmesine geçin).
3. İlk defa açıyorsanız: **`Subscribe`** veya **`Enable R2`** ile fatura
   planını onaylayın. R2 ücretsiz katman (10 GB depolama + 1M Class A
   istek/ay) ile çalışır; aşımdan sonra fiyatlandırma çok düşüktür.

### 6.3. Kovaların Oluşturulması

> **2026-09-02 — GERÇEK DURUM.** Aşağıdaki `-prod` kova adları bu kılavuzun
> önerdiği şemadır; **hiçbir zaman oluşturulmadılar.** Üretim bugün
> `bookstore-masters-dev` ve `bookstore-artifacts-dev` kovalarını kullanıyor.
> Bu tahmin değil, ölçüm: `GET /api/admin/storage-check` çalışan üretim
> fonksiyonuna kendi `R2_BUCKET_MASTERS` değerini sordu, beş master'ın
> tamamını okudu ve artifacts kovasına yaz-oku-sil turu yaptı (hepsi başarılı).
> `R2_BUCKET_MASTERS` Vercel'de *sensitive* olduğu için değeri dışarıdan
> okunamıyordu; iki faz boyunca açık kalan soru bu şekilde kapandı.
>
> Kovaları yeniden adlandırmayın. Ad kozmetik; veri taşımak gerçek bir risk.
> Ayrı bir üretim kovası gerçekten istenirse, sıra şudur: kovayı oluştur →
> altı master'ı kopyala → `/api/admin/storage-check` ile doğrula → ancak o
> zaman `R2_BUCKET_MASTERS`'ı değiştir.

Production için tipik şema (öneri — kullanılmadı):

```
bookstore-masters-prod
bookstore-artifacts-prod
bookstore-public-prod      (kapaklar)
```

Preview/staging için ayrı kovalar:

```
bookstore-masters-preview
bookstore-artifacts-preview
bookstore-public-preview
```

Her kovayı tek tek oluşturun:

1. **R2 → Buckets sekmesi → `Create bucket`** düğmesi.
2. Form:
   - **Bucket name:** `bookstore-masters-prod`
   - **Location:** **`Automatic`** (R2 trafiğinize göre seçer)
   - **Default storage class:** **`Standard`**
3. **`Create`** düğmesi.
4. Aynı adımları diğer iki ad için tekrarlayın.

### 6.4. Public Kova için Custom Domain (`R2_PUBLIC_BASE_URL`)

Kapak görselleri Next/Image üzerinden servis edilir
(`src/components/cover-image.tsx`). İki seçenek vardır:

**Seçenek A — r2.dev geliştirme URL’si (yalnızca staging/preview)**

1. `bookstore-public-prod` kovasının üstüne tıklayın.
2. Üst sekmeler: **Settings** → **Public access** kartı.
3. **`Allow Access`** düğmesine basın (uyarı diyaloğunu onaylayın).
4. **Public R2.dev URL** alanından `https://pub-<hash>.r2.dev` adresini
   kopyalayın.
5. `R2_PUBLIC_BASE_URL=https://pub-<hash>.r2.dev` olarak yerleştirin.

> **Uyarı:** Cloudflare, `r2.dev` URL'lerinde rate limit uygular ve bunu
> üretim trafiği için **önermez**. Production'da Seçenek B kullanın.

**Seçenek B — Custom domain (üretim önerisi)**

1. Aynı **Settings → Public access** kartında **`Connect Domain`**
   düğmesine basın.
2. Bağlamak istediğiniz subdomain’i girin: `files.kitabevi.com.tr`.
3. Cloudflare otomatik olarak DNS kaydını (`CNAME`) ekler — domain
   Cloudflare üzerinde değilse manuel kayıt eklemeniz istenir.
4. Sertifika provizyonu birkaç dakika alır.
5. `R2_PUBLIC_BASE_URL=https://files.kitabevi.com.tr` olarak yerleştirin.

`next.config.ts` zaten bu URL'yi parse edip `images.remotePatterns`'a
otomatik ekler (SUB-PR 3.1):

```ts
function buildCustomR2RemotePattern() {
  const url = process.env.R2_PUBLIC_BASE_URL;
  if (!url) return [];
  return [{ protocol: "https", hostname: new URL(url).hostname }];
}
```

### 6.5. S3 Uyumlu API Token Oluşturma

Uygulamamız S3 SDK kullanır; bu yüzden bize **Access Key + Secret** çifti
lazımdır (Cloudflare API token değil!).

1. Sol kenar menü: **R2 → Manage R2 API Tokens** (URL:
   `dash.cloudflare.com/.../r2/api-tokens`).
2. **`Create API Token`** düğmesine basın.
3. Form:
   - **Token name:** `bookstore-prod-s3-rw` (anlamlı isim)
   - **Permissions:** **`Object Read & Write`**
   - **Specify bucket(s):** **`Apply to specific buckets only`** seçin →
     üç production kovasını tek tek ekleyin:
     - `bookstore-masters-prod`
     - `bookstore-artifacts-prod`
     - `bookstore-public-prod`
   - **TTL:** (zorunlu değil; süresiz token üretimi için boş bırakın)
4. **`Create API Token`** düğmesi.
5. Açılan sayfada **bir kereye mahsus** şu üç değer gösterilir:
   - **Access Key ID** → `R2_ACCESS_KEY_ID`
   - **Secret Access Key** → `R2_SECRET_ACCESS_KEY`
   - **Endpoint for S3 clients** → `R2_ENDPOINT`
     (`https://<account-id>.r2.cloudflarestorage.com`)
6. **Bu sayfayı kapatmadan** üçünü de güvenli bir yere kopyalayın
   (Vercel, parola yöneticisi). Cloudflare bu sırrı bir daha göstermez.

> `R2_ACCOUNT_ID` envanterde **Bilgi** olarak işaretlidir — kod doğrudan
> kullanmaz çünkü endpoint URL'sinde gömülüdür. Yine de yedek için yerel
> notlarda tutmak mantıklıdır.

### 6.6. Üç Ortama Yerleştirme

#### Yerel
```bash
# .env.local
R2_ENDPOINT=https://abc123.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=xxxxxxxxxxxxxxxxxxxx
R2_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
R2_BUCKET_MASTERS=bookstore-masters-preview
R2_BUCKET_ARTIFACTS=bookstore-artifacts-preview
R2_PUBLIC_BASE_URL=https://pub-xxxx.r2.dev
```

#### Vercel
```bash
vercel env add R2_ENDPOINT                preview
vercel env add R2_ACCESS_KEY_ID           preview
vercel env add R2_SECRET_ACCESS_KEY       preview
vercel env add R2_BUCKET_MASTERS          preview
vercel env add R2_BUCKET_ARTIFACTS        preview
vercel env add R2_PUBLIC_BASE_URL         preview
# … production için aynı setin -prod versiyonunu ekleyin
```

### 6.7. Kod Tabanı ile Bağlantı

`src/lib/storage/index.ts` S3 istemcisini **tembel** (lazy) oluşturur:
ilk gerçek çağrıya kadar credential aramaz. Bu sayede:
- `next build` aşaması, R2 anahtarları olmadan da geçer.
- İlk gerçek çağrıda (örn. admin yükleme akışı, watermark üretimi) eksik
  env varsa **net ve yönlendirici** bir hata fırlatır:
  `R2 storage is not configured. Set R2_ENDPOINT, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY.`

İmzalı URL TTL'leri kod içinde **sabit** olarak güvenlik tavanına bağlıdır
(`MAX_DOWNLOAD_TTL_SECONDS = 900`); env üzerinden değiştirilemez. Bu,
Roadmap §11 sözleşmesinin sızdırılmaz tarafıdır.

### 6.8. Yaygın Sorunlar — R2

| Belirti | Olası Sebep | Çözüm |
|---|---|---|
| `SignatureDoesNotMatch` | Endpoint URL bir başka hesabınkine ait | Doğru hesabın R2 panosundan endpoint'i yeniden kopyala |
| `NoSuchBucket` | Kova adı yanlış yazılmış | `R2_BUCKET_MASTERS` / `R2_BUCKET_ARTIFACTS` değerlerini ortam başına kontrol et |
| Kapak görseli `<Image>` 400 | `R2_PUBLIC_BASE_URL` set değil → `getCoverImageUrl` `null` döner | URL'yi set et ve yeniden dağıt |
| Next.js `Invalid src prop` | Domain `images.remotePatterns`'da yok | `R2_PUBLIC_BASE_URL` set edilmiş ve **rebuild** yapılmış olmalı (build zamanında parse edilir) |

---

## 7. Paddle — Merchant of Record (Ödeme + Vergi)

### 7.1. Amaç

Paddle; küresel KDV/satış vergisi, PCI kapsamı, kart kayıtları, geri
ödemeler ve dolandırıcılık riskini bizden devralan Merchant of Record’tur
(ADR-2). Doğrudan Stripe değil, doğrudan Paddle çünkü vergi sorumluluğu
**Paddle’dadır**.

İki ayrı ortam kullanılır:

| Pano | URL | Anahtar öneki |
|---|---|---|
| Sandbox | `https://sandbox-vendors.paddle.com` | `pdl_sdbx_…` / `pri_01_…` |
| Production | `https://vendors.paddle.com` | `pdl_live_…` / `pri_01_…` |

### 7.2. Sandbox Hesabı Açma

1. `https://sandbox-vendors.paddle.com/signup` → kayıt.
2. Onay e-postasını tıklayın → giriş.
3. Karşılama akışını tamamlayın (şirket adı, ülke, vergi numarası boş
   geçilebilir — sandbox’tır).

### 7.3. Ürün ve Fiyat Tanımlama

Her kitap için Paddle’da bir **Product** + en az bir **Price** oluşturmak
gerekir. `books.paddle_price_id` kolonu bu price’ı işaret eder.

1. Sol menü: **Catalog → Products**.
2. **`+ New product`** düğmesi.
3. Form:
   - **Name:** Kitabın başlığı (örn. `Learning Rust`)
   - **Description:** Kısa tanım
   - **Tax category:** **`Standard digital goods`** (PDF kitap için)
4. **`Create product`** düğmesi.
5. Açılan ürün detay sayfasında **Prices** bölümüne inin.
6. **`+ Add price`** düğmesi.
7. Form:
   - **Type:** `One-time` (abonelik değil)
   - **Amount:** `15.00`
   - **Currency:** `USD` (Paddle çoklu para birimi destekler; ana fiyat
     bu)
   - **Description:** `Standard one-time license`
8. **`Create price`** düğmesi.
9. Oluşan kayıtta `pri_01h…` ile başlayan **Price ID**’yi kopyalayın.
10. Bu ID'yi `books.paddle_price_id` kolonuna kaydedin — admin panelindeki
    "Add a book" formunda **Merchant of Record (Paddle)** fieldset'ine
    yapıştırın (SUB-PR 4.1’de eklendi).

### 7.4. API Anahtarı

1. Sol menü: **Developer Tools → Authentication → API Keys**.
2. **`+ New API key`** düğmesi.
3. Form:
   - **Name:** `digital-bookstore-server`
   - **Permissions:** Tam erişim (sandbox için bu pratiktir; production’da
     gereksiz yetkileri kaldırmayı düşünün).
4. **`Save`** → görünen `pdl_sdbx_apikey_…` (veya production'da
   `pdl_live_apikey_…`) **bir kerelik** gösterilir.
5. Kopyalayın → `PADDLE_API_KEY` olarak yerleştirin.

### 7.5. Webhook Endpoint

1. Sol menü: **Developer Tools → Notifications**.
2. **`+ New destination`** düğmesi.
3. Form:
   - **Destination type:** `Webhook`
   - **Description:** `bookstore fulfillment webhook`
   - **URL:** `https://your-domain.com/api/webhooks/paddle`
     (Yerelde test için `ngrok` veya Paddle’ın local proxy aracı
     kullanılabilir.)
   - **Events:** **`transaction.completed`** kutusunu işaretleyin (şu an
     fulfillment yalnızca bunu dinler — `src/app/api/webhooks/paddle/route.ts`).
4. **`Save destination`** → açılan kart üzerinde **Secret key** alanı
   `pdl_ntfset_…` ile başlayan değer içerir.
5. Kopyalayın → `PADDLE_WEBHOOK_SECRET` olarak yerleştirin.

> **Önemli — imza doğrulama:** Webhook handler’ımız (`route.ts`) gelen her
> isteği `getPaddleClient().webhooks.unmarshal(...)` ile imza doğrular.
> Bu yüzden secret yanlış set edilirse Paddle'dan gelen tüm istekler 401
> dönecektir; loglarda `signature verification failed` görürsünüz.

### 7.6. İstemci Token (Client-Side Checkout)

Paddle.js (istemci tarafı checkout SDK'sı) bir **client token** gerektirir.

1. Sol menü: **Developer Tools → Authentication → Client Tokens**.
2. **`+ New client token`** düğmesi.
3. Form:
   - **Name:** `digital-bookstore-web`
   - **Allowed domains:** `your-domain.com`, `*.vercel.app` (preview için)
4. **Save** → token `pdl_ctkn_…` ile başlar.
5. Kopyalayın → `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`.

### 7.7. Üç Ortama Yerleştirme

#### Yerel (Sandbox)
```bash
# .env.local
PADDLE_API_KEY=pdl_sdbx_apikey_...
PADDLE_WEBHOOK_SECRET=pdl_ntfset_...
PADDLE_ENVIRONMENT=sandbox
NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=pdl_ctkn_...
```

#### Vercel Preview (Sandbox)
```bash
vercel env add PADDLE_API_KEY                    preview
vercel env add PADDLE_WEBHOOK_SECRET             preview
vercel env add PADDLE_ENVIRONMENT                preview    # değer: "sandbox"
vercel env add NEXT_PUBLIC_PADDLE_CLIENT_TOKEN   preview
```

#### Vercel Production (Production Paddle)
> **Production için ayrı bir Paddle hesabı kullanılır.** Sandbox’ı
> production’da kullanmak gerçek müşterilerden ödeme almaz; sahte para
> tahsil eder. Tersi de geçerli — production anahtarını sandbox’ta
> kullanmak gerçek kart yükler.

```bash
vercel env add PADDLE_API_KEY                    production
vercel env add PADDLE_WEBHOOK_SECRET             production
vercel env add PADDLE_ENVIRONMENT                production # değer: "production"
vercel env add NEXT_PUBLIC_PADDLE_CLIENT_TOKEN   production
```

### 7.8. Yaygın Sorunlar — Paddle

| Belirti | Olası Sebep | Çözüm |
|---|---|---|
| Checkout açılmıyor | `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` eksik | Token’ı ekle, **rebuild** et |
| Webhook 401 | `PADDLE_WEBHOOK_SECRET` yanlış | Notifications kartında Secret’ı yeniden kopyala |
| Webhook 503 | `PADDLE_WEBHOOK_SECRET` set değil | Üretime de eklemeyi unutmayın |
| Vergiler sıfır | Sandbox’ta gerçek vergi hesaplanmaz | Beklenen davranıştır; production’da düzelir |
| `Customer not found` | `tx.customerId` null geldi | Webhook handler bu durumu zaten tolere eder; yine de Paddle ürünlerini doğru tax category ile oluşturduğunuzu kontrol edin |

---

## 8. Inngest — Asenkron İş Kuyruğu

### 8.1. Amaç

Paddle webhook’u geldiğinde fulfillment işi (filigran üretimi,
entitlement yazma, R2’ye yükleme) **senkron** çalıştırılırsa Paddle’a 200
dönüş süresi belirsizleşir ve webhook retry'a girer. Bu yüzden iş kuyruğa
atılır: Paddle webhook → `inngest.send(...)` → Inngest Cloud → bizim
`/api/inngest` endpoint’imiz → `processFulfillment` adım adım çalışır
(ADR-3 — async social DRM).

### 8.2. Yerel Geliştirme (CLI)

Inngest, yerel geliştirme için **proxy bir devlopment server** sunar.
Cloud’a hiçbir şey gitmez; tüm olaylar yerelde yakalanır ve fonksiyonlar
yerelde çalışır.

1. Bir terminal sekmesinde Next.js dev server’ı başlatın:
   ```bash
   npm run dev
   ```
2. **İkinci** bir terminal sekmesinde Inngest dev server’ı başlatın:
   ```bash
   npx inngest-cli@latest dev
   ```
3. Inngest CLI varsayılan olarak `http://localhost:3000/api/inngest`
   adresini keşfeder ve oradaki fonksiyonları yükler.
4. `http://localhost:8288` adresini tarayıcıda açarak Inngest dev
   panosunu görürsünüz: gelen olaylar, çalışan adımlar, hatalar.

> Yerel geliştirme için `INNGEST_EVENT_KEY` ve `INNGEST_SIGNING_KEY` set
> edilmesine **gerek yoktur** — Inngest CLI bağımsız çalışır.

### 8.3. Cloud Hesabı (Production)

1. **Kayıt:** `https://app.inngest.com/sign-up` → GitHub ile.
2. **Yeni app:** Onboarding adımları sizden bir uygulama oluşturmanızı
   ister: **`+ New app`** → adı **`digital-bookstore`** (kod tarafında
   `src/lib/inngest/client.ts` içinde `id: "digital-bookstore"` ile aynı
   olmak zorundadır; değişirse historical run state sıfırlanır).
3. **Vercel Integration:** Inngest panosu sizi **`Vercel`** entegrasyon
   ekranına yönlendirir:
   - **`Install Inngest on Vercel`** düğmesine basın.
   - Vercel’de hangi projeye bağlayacağınızı sorar; `digital-bookstore`
     projesini seçin.
   - Inngest otomatik olarak **iki gizli değişkeni** Vercel’in production
     ortamına yazar:
     - `INNGEST_EVENT_KEY`
     - `INNGEST_SIGNING_KEY`
   - Vercel projeyi yeniden dağıttıktan sonra Inngest, `/api/inngest`
     endpoint'inden fonksiyonları keşfeder.

### 8.4. Anahtarların Manuel Çıkarılması (Vercel entegrasyonunu kullanmıyorsanız)

1. Inngest Cloud → **Settings → Event Keys**.
2. **`+ Create Event Key`** → ad ver, **Save**.
3. Oluşturulan anahtar `prod_…` ile başlar. Kopyalayın → `INNGEST_EVENT_KEY`.
4. Inngest Cloud → **Settings → Signing Key**.
5. **Reveal** ile gösterilir; kopyalayın → `INNGEST_SIGNING_KEY`.

### 8.5. Üç Ortama Yerleştirme

#### Yerel (CLI kullanılırsa env zorunlu değil)
```bash
# .env.local — opsiyonel; CLI bunları görmez
# Sadece "production benzeri" yerel test için Cloud'a bağlanılacaksa eklenir.
```

#### Vercel Preview / Production
Vercel entegrasyonu kullanılıyorsa otomatiktir. Aksi hâlde:
```bash
vercel env add INNGEST_EVENT_KEY     preview
vercel env add INNGEST_SIGNING_KEY   preview
vercel env add INNGEST_EVENT_KEY     production
vercel env add INNGEST_SIGNING_KEY   production
```

### 8.6. Kod Tabanı ile Bağlantı

| Konum | Açıklama |
|---|---|
| `src/lib/inngest/client.ts` | `new Inngest({ id: "digital-bookstore" })` — istemci |
| `src/inngest/functions/watermark.ts` | `processFulfillment` fonksiyonu (3 katmanlı idempotency) |
| `src/app/api/inngest/route.ts` | `serve({ client, functions })` — Inngest Cloud’un keşfedeceği endpoint |

`inngest.send(...)` çağrısı `INNGEST_EVENT_KEY` ister; `serve` handler
`INNGEST_SIGNING_KEY` ile imza doğrular. İki anahtar da set edilmediğinde
**yerel** çalışma kırılmaz (CLI bağımsız), **üretim** çalışma kırılır
(401 imza hatası).

### 8.7. Yaygın Sorunlar — Inngest

| Belirti | Olası Sebep | Çözüm |
|---|---|---|
| Yerelde fonksiyon görünmüyor | Inngest CLI Next.js'i bulamadı | Next.js'in `localhost:3000`'de çalıştığını ve `/api/inngest` GET'inin 200 döndüğünü doğrulayın |
| Production'da 401 | `INNGEST_SIGNING_KEY` yanlış / eksik | Vercel ortamlarına yeniden ekleyip **redeploy** edin |
| Fonksiyon birden fazla çalışıyor | İdempotency için step.run kullanılmamış | `watermark.ts` zaten doğru kalıbı uygular; özel iş eklerken adımları `step.run("name", async …)` ile sarın |

---

## 9. Yardımcı Değişkenler

### 9.1. `NEXT_PUBLIC_APP_URL`

Sitenin **kanonik** kök URL'si. SEO için kritik:

- `src/app/layout.tsx` → `metadataBase: new URL(NEXT_PUBLIC_APP_URL)` — tüm
  metadata canonical / OG / Twitter URL'leri buna göre **mutlaklaştırılır**.
- `src/lib/seo.ts` → `getBaseUrl()` — JSON-LD ve sitemap entry'leri buna
  göre üretilir.

| Ortam | Önerilen değer |
|---|---|
| Yerel | `http://localhost:3000` |
| Preview | `https://digital-bookstore-git-<branch>.vercel.app` (Vercel otomatik) |
| Production | `https://kitabevi.com.tr` (kendi alan adınız) |

```bash
# Yerel
echo "NEXT_PUBLIC_APP_URL=http://localhost:3000" >> .env.local

# Vercel
vercel env add NEXT_PUBLIC_APP_URL preview
vercel env add NEXT_PUBLIC_APP_URL production
```

Set edilmezse SEO modülü `http://localhost:3000`'e geri döner — üretimde
metadata yanlış canonical yayar; **mutlaka set edin**.

### 9.2. `ADMIN_EMAILS`

`/admin` rotasında **strict gate**. SUB-PR 4.1'de eklenen
`requireAdmin()` helper'ı bunu okur (`src/lib/auth.ts`).

Format: **virgülle ayrılmış**, **büyük/küçük harf duyarsız**, e-posta
listesi.

```bash
ADMIN_EMAILS=emre30283@gmail.com,operator@kitabevi.com.tr
```

- **Boş / set edilmemiş = kimse admin değil** (güvenli varsayılan).
- Promosyon/iptal = redeploy. Üretim için ayrı bir admin-yönetim UI
  henüz yok (gelecek SUB-PR adayı, ses kayıtlı denetim ile birlikte).

#### Yerel
```bash
echo "ADMIN_EMAILS=emre30283@gmail.com" >> .env.local
```

#### Vercel
```bash
vercel env add ADMIN_EMAILS preview        # değer: kendi e-postanız
vercel env add ADMIN_EMAILS production     # değer: operatör + sizin e-postanız
```

---

## 10. Yerel Doğrulama Prosedürü

Tüm anahtarlar yerine konduktan sonra çalıştırın:

```bash
# 1) Bağımlılıklar
npm install

# 2) DB şeması (Neon preview dalına)
npm run db:migrate

# 3) Lint + tip kontrolü + üretim derleme
npm run lint
npx tsc --noEmit
npm run build

# 4) Dev sunucu
npm run dev
```

Tarayıcıda hızlı duman testleri:

| URL | Beklenti |
|---|---|
| `http://localhost:3000` | Ana sayfa serif başlık + "Browse the catalog" CTA |
| `http://localhost:3000/books` | Boş katalog veya seed verisi listesi |
| `http://localhost:3000/blog` | İki blog yazısı görünmeli (SUB-PR 3.2 markdown’ları) |
| `http://localhost:3000/sitemap.xml` | Geçerli XML çıktı |
| `http://localhost:3000/admin` | `ADMIN_EMAILS`’de olmayan bir e-postayla → "Not authorized" notu; olan e-postayla → dashboard |
| `http://localhost:3000/sign-in` | Clerk magic-link akışı |
| Paddle sandbox checkout (test) | `4242 4242 4242 4242` test kartı çalışmalı; webhook yerelde test için `ngrok http 3000` |

İkinci terminal:
```bash
npx inngest-cli@latest dev
# http://localhost:8288 → Inngest dev paneli
```

---

## 11. GitHub Actions / CI Sırları

Önerilen CI hattı, push'ta lint + tsc + build çalıştırır; main'e merge'te
migration uygular. İhtiyaç duyduğu sırlar:

| Secret Adı | Kullanım | Değer |
|---|---|---|
| `DATABASE_URL_MIGRATIONS` | `npm run db:migrate` (production) | Production `main` dalının **direct** dizesi |
| `DATABASE_URL_PREVIEW` | (opsiyonel) Preview migration | Preview dalının direct dizesi |
| `VERCEL_TOKEN` | (opsiyonel) `vercel deploy --token` | `vercel.com/account/tokens` → New Token |
| `VERCEL_ORG_ID` | (opsiyonel) Deploy hedeflemesi | `.vercel/project.json` |
| `VERCEL_PROJECT_ID` | (opsiyonel) Deploy hedeflemesi | `.vercel/project.json` |

Eklemek için: **GitHub → repo → Settings → Secrets and variables →
Actions → `New repository secret`**.

> **Not:** CI'da test çalıştırmak için Clerk/Paddle/R2 anahtarları gerekmez
> — `npm run lint`, `npx tsc --noEmit`, `npm run build` adımları
> credential-free çalışır (kod tabanı boyunca **lazy init** + **safeQuery**
> sayesinde). Yalnızca migration adımı `DATABASE_URL` ister.

---

## 12. Sorun Giderme

### 12.1. Build Anında Hata

| Hata | Sebep | Çözüm |
|---|---|---|
| `R2 storage is not configured` | Build sırasında R2'ye giden bir yol var (olmamalı) | Hatalı kod yolu; storage modülü lazy olmalı (`src/lib/storage/index.ts`) |
| `Paddle is not configured` | Build sırasında Paddle çağrısı | Aynı; `getPaddleClient` lazy'dir |
| `Failed query: …` warning | Build sırasında DB query çalıştı, DB yok | Beklenen; `safeQuery` fallback'i yakalar |
| `Module not found: '@clerk/nextjs/server'` | `npm install` çalıştırılmadı | `npm install` |

### 12.2. Runtime Hatası

| Hata | Sebep | Çözüm |
|---|---|---|
| `/admin` → "Configuration required" | Clerk veya DB env eksik | `.env.local` ve Vercel ortamına ekle |
| `/admin` → "Admin allowlist is empty" | `ADMIN_EMAILS` set değil | Ekle, redeploy |
| `/admin` → "Not authorized" | E-postanız `ADMIN_EMAILS`'de yok | Ekle (virgülle), redeploy |
| Paddle webhook 401 | Secret yanlış | `PADDLE_WEBHOOK_SECRET`'i Notifications kartından yeniden kopyala |
| Inngest fonksiyonu çalışmıyor | `INNGEST_SIGNING_KEY` eksik üretim | Vercel entegrasyonu üzerinden yeniden bağlan |
| Kapaklar gözükmüyor | `R2_PUBLIC_BASE_URL` eksik | Set et + rebuild |
| Magic-link e-posta gelmiyor | Clerk'te Email production seçeneği kapalı | Clerk Configure → Email, Phone, Username → Email address → Required + Verify |

### 12.3. Klavyeyle Hızlı Bakış (Gizli Anahtar Sızıntısı Riski)

- `git status` öncesinde **mutlaka** `.env.local` dosyasının `.gitignore`'da
  olduğunu doğrulayın (zaten öyle; ama yeni geliştiriciler için kritik).
- `NEXT_PUBLIC_*` öneki olan anahtarları sızdırılmaz olarak değerlendirmeyin
  — istemci paketinde görünürler.

---

## 13. Üretim Çıkış Kontrol Listesi (Production Go-Live)

Üretime geçmeden önce işaretlenecek:

- [ ] **Neon production projesi** ve `main` dalı oluşturulmuş.
- [ ] **`DATABASE_URL`** (pooled, production) — Vercel production ortamında.
- [ ] **`DIRECT_URL`** (direct, production) — Vercel production ortamında.
- [ ] Şema migration’ı production dalına uygulanmış (`db:migrate`).
- [ ] **Clerk production uygulaması** açılmış (sandbox değil).
- [ ] **`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`** (pk_live_*) Vercel production.
- [ ] **`CLERK_SECRET_KEY`** (sk_live_*) Vercel production.
- [ ] Sosyal kimlik OAuth uygulamaları üretim için kurulu.
- [ ] **`ADMIN_EMAILS`** üretimde set — operatör e-postaları dahil.
- [ ] **R2 üretim kovaları** (`bookstore-masters-prod`, `bookstore-artifacts-prod`,
      `bookstore-public-prod`) oluşturulmuş ve doğru token'a izinli.
- [ ] **`R2_ENDPOINT`**, **`R2_ACCESS_KEY_ID`**, **`R2_SECRET_ACCESS_KEY`**,
      **`R2_BUCKET_MASTERS`**, **`R2_BUCKET_ARTIFACTS`** üretimde.
- [ ] **`R2_PUBLIC_BASE_URL`** — custom domain ile, r2.dev DEĞİL.
- [ ] **Paddle production hesabı** etkin (vendors.paddle.com).
- [ ] Kataloğun tüm yayınlanmış kitapları için `paddle_price_id` doldurulmuş.
- [ ] **`PADDLE_API_KEY`** (production) Vercel.
- [ ] **`PADDLE_WEBHOOK_SECRET`** (production) Vercel; webhook endpoint
      `https://kitabevi.com.tr/api/webhooks/paddle` Paddle'da kayıtlı.
- [ ] **`PADDLE_ENVIRONMENT=production`** Vercel.
- [ ] **`NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`** üretim domain'e bağlı.
- [ ] **Inngest Cloud app** Vercel entegrasyonu üzerinden bağlı veya
      `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY` manuel set.
- [ ] **`NEXT_PUBLIC_APP_URL=https://kitabevi.com.tr`** Vercel production.
- [ ] DNS: ana alan adınız Vercel’e CNAME/A kaydıyla bağlı; HTTPS aktif.
- [ ] İlk gerçek satın alma testi: `transaction.completed` webhook’u →
      Inngest job çalışıyor → entitlement `'ready'` durumunda → kullanıcı
      `/account/library` üzerinden indiriyor.
- [ ] Bir test incelemesi gönderilebiliyor (verified-purchaser akışı —
      SUB-PR 3.3).
- [ ] **Upstash Redis veritabanı** üretim ortamı için oluşturulmuş
      (`bookstore-rl-prod` gibi anlamlı bir ad).
- [ ] **`UPSTASH_REDIS_REST_URL`** ve **`UPSTASH_REDIS_REST_TOKEN`**
      Vercel production ortamına eklenmiş; production deploy sonrası
      sunucu loglarında **`[rate-limit] … is not set`** uyarısı
      görünmemeli — görünüyorsa env yanlış yüklenmiş demektir.
- [ ] **Resend hesabı** + **gönderim domain'i** (örn. `mail.kitabevi.com.tr`)
      eklenmiş, SPF/DKIM/DMARC kayıtları **Verified** durumunda.
- [ ] **`RESEND_API_KEY`** üretim ortamında set; **`EMAIL_FROM`** verified
      domain'inizi kullanıyor (`onboarding@resend.dev` test sender DEĞİL).
- [ ] **Vercel Analytics** ve **Speed Insights** Vercel panelinden
      etkinleştirilmiş (Project → Analytics → Enable).
- [ ] **Sentry projesi** oluşturulmuş (Next.js platformu), production
      ortamı için ayrı bir proje veya en azından `environment: production`
      filtresiyle ayrılabilir bir surface.
- [ ] **`SENTRY_DSN`** ve **`NEXT_PUBLIC_SENTRY_DSN`** Vercel production
      ortamına eklenmiş; deploy sonrası ilk hata Sentry → Issues sekmesinde
      30 sn içinde görünür olmalı.
- [ ] **`SENTRY_AUTH_TOKEN`** + **`SENTRY_ORG`** + **`SENTRY_PROJECT`**
      eklenmiş; build loglarında "Successfully uploaded source maps"
      satırı görünüyor (yoksa hatalar minified halde gelir).
- [ ] İlk gerçek satın alma testi sonrasında **müşterinin gerçekten
      "Your digital book is ready" e-postasını aldığı** doğrulanmış
      (Resend → Logs sekmesinde send id görünmeli).

---

## 14. Upstash Redis — Rate Limit ve Data Cache Arka Ucu

### 14.1. Amaç

Upstash Redis, projede **iki ayrı yetenek** için kullanılır (SUB-PR 4.2):

1. **Global rate-limit** (`src/lib/rate-limit.ts` + `src/proxy.ts`) —
   IP başına 10 saniyede 100 istek (sliding window). Suistimalden,
   bot taramasından ve istemsiz "thundering herd" davranışından
   uygulamayı korur. Roadmap §11 perimeter savunma sözleşmesinin somut
   karşılığıdır.
2. **(Gelecek) Edge-dostu Data Cache arka ucu** — Şu an Next.js'in
   yerleşik (in-memory) Data Cache'ini kullanıyoruz. Birden çok bölgeye
   dağıttığımızda Upstash Redis aynı zamanda cache backend olarak
   konfigüre edilebilir (Vercel Data Cache adapter yapılandırması).

Yalnızca **REST** uç noktası kullanılır — `@upstash/redis` paketi HTTPS
üzerinden çalışır; Edge runtime, Fluid Compute ve Node.js çalışma
zamanlarının üçünde de tek bir kalıpla çalışır.

### 14.2. Hesap ve Veritabanı Oluşturma

1. **Kayıt:** `https://console.upstash.com/login` → GitHub veya Google ile.
2. Üst menü: **Redis** sekmesi → sağ üstte **`+ Create Database`** düğmesi.
3. Form:
   - **Name:** `bookstore-rl-prod` (üretim için). Preview için
     `bookstore-rl-preview` adıyla **ayrı bir veritabanı** açın —
     environment yalıtımı (PAST_DECISIONS §12) burada da geçerlidir.
   - **Type:**
     - **Regional** — tek bölge, daha ucuz. Vercel projenizin **ana
       bölgesine en yakın** Upstash bölgesini seçin (örn. Vercel
       `iad1` → Upstash `us-east-1`).
     - **Global** — çoklu bölge replikasyonu. Trafik gerçekten
       coğrafi olarak dağılmadıkça gereksiz maliyettir.
   - **Eviction:** **`noeviction`**
     (rate-limit verisi çok küçüktür; istemeden silinmesini istemeyiz).
   - **TLS:** **Enable** (varsayılan; bırakın).
4. **`Create`** düğmesi.

### 14.3. REST Bilgilerini Kopyalama

1. Yeni oluşturulan veritabanına tıklayın.
2. Üst sekmelerde **`REST API`** seçeneğine geçin (Native Redis sekmesi
   değil — bizim istemcimiz REST kullanır).
3. İki değer görünür:
   - **UPSTASH_REDIS_REST_URL** → `https://<region>-<id>.upstash.io`
   - **UPSTASH_REDIS_REST_TOKEN** → uzun, opak bir token.
4. Sağdaki **`Copy`** düğmeleriyle her ikisini alın.

```bash
UPSTASH_REDIS_REST_URL=https://eu1-fast-mongrel-12345.upstash.io
UPSTASH_REDIS_REST_TOKEN=AY6mASQg... (uzun)
```

> Token sunucu tarafıdır — **asla** `NEXT_PUBLIC_` önekiyle yeniden
> adlandırmayın; istemci paketine sızdırılırsa rate-limit veritabanınız
> herhangi bir tarayıcıdan yazılabilir hâle gelir.

### 14.4. Üç Ortama Yerleştirme

#### Yerel
```bash
# .env.local — opsiyonel.
# Set edilmezse rate limit DEVRE DIŞI kalır; site yine çalışır
# (graceful degradation). Yerel geliştirmede genelde gerekmez.
UPSTASH_REDIS_REST_URL=https://eu1-...-preview.upstash.io
UPSTASH_REDIS_REST_TOKEN=AY...
```

#### Vercel Preview
```bash
vercel env add UPSTASH_REDIS_REST_URL    preview
vercel env add UPSTASH_REDIS_REST_TOKEN  preview
```

#### Vercel Production
```bash
vercel env add UPSTASH_REDIS_REST_URL    production
vercel env add UPSTASH_REDIS_REST_TOKEN  production
```

### 14.5. Kod Tabanı ile Bağlantı

| Konum | Açıklama |
|---|---|
| `src/lib/rate-limit.ts` | `getRatelimit()` — memoize edilmiş Ratelimit; eksik env'de `null` döner + bir kerelik `console.warn` |
| `src/lib/rate-limit.ts` | `checkRateLimit(req)` — middleware'in çağırdığı; 429 Response veya `null` |
| `src/proxy.ts` | Pipeline'da **1. adım**: rate limit; **2. adım**: Clerk auth |
| `src/lib/db/queries/catalog.ts` | `unstable_cache` kullanan iki query (`getFeaturedBooks`, `getBookSitemapEntries`); `CATALOG_TAG` ve `BOOKS_TAG` tag'leriyle invalidate edilebilir |
| `src/app/admin/actions.ts:createBook` | Başarılı insert sonrası `revalidateTag(CATALOG_TAG)` ile cache busts |

### 14.6. Doğrulama

#### Yerel doğrulama (Upstash set edildiğinde)

```bash
# 1) Dev sunucuyu başlat
npm run dev

# 2) Aynı IP'den 100+ istek at — 101. istek 429 dönmeli
for i in $(seq 1 110); do
  curl -s -o /dev/null -w "%{http_code} " http://localhost:3000/books
done
# Beklenti: ilk 100 istek 200; sonraki istekler 429
```

#### Vercel'de doğrulama

1. Production deploy sonrası bir sayfayı yenileyin → response başlıklarını
   inceleyin (DevTools → Network):
   ```
   X-RateLimit-Limit: 100
   X-RateLimit-Remaining: 99
   X-RateLimit-Reset: 1717000000
   ```
   Bu başlıklar görünüyorsa rate limiter aktiftir.
2. Upstash console → **Data Browser** sekmesinde `bookstore-rl:*` anahtarlarını
   göreceksiniz — her IP için bir sayaç.

### 14.7. Yaygın Sorunlar — Upstash

| Belirti | Olası Sebep | Çözüm |
|---|---|---|
| Sunucu loglarında `[rate-limit] … is not set` | Env yüklenmemiş | Vercel ortamına ekle + **redeploy** |
| Her istek 429 | Rate limit yanlış yapılandırılmış (örn. tüm IP'ler aynı bucket'a düşüyor) | `getClientIp` mantığını gözden geçir; load balancer x-forwarded-for'u set ediyor mu? |
| `Failed to fetch` Upstash hatası | Yanlış URL veya token | REST API sekmesinden değerleri **yeniden** kopyala; trailing slash / boşluk kontrol et |
| Sandbox / preview'da gerçek IP yerine `127.0.0.1` | Vercel preview proxy IP'leri | Beklenen; rate-limit yine çalışır, sadece üretimdeki gibi keskin değildir |
| Cache busts çalışmıyor (yeni kitap görünmüyor) | `revalidateTag` çağrısı yapılmadı | `src/app/admin/actions.ts:createBook` action'ında `revalidateTag(CATALOG_TAG)` çağrısının varlığını doğrula |

### 14.8. Maliyet

Upstash Redis, **ücretsiz katman**da: 10.000 komut/gün + 256 MB depolama.
100 req/10s rate limit ortalama trafikte bunun çok altında kalır
(her istek 1-2 komut tüketir). Üretim trafiği ücretsiz katmanı aştığında
"Pay-as-you-go" planı tek tıkla etkinleştirilir — fatura yöntemi öncesinde
veritabanı kullanılamaz olmaz, sadece komutlar throttle edilir.

---

## 15. Resend — Transactional Email

### 15.1. Amaç

Resend; sipariş tamamlandıktan sonra müşteriye **"Dijital kitabınız hazır"**
e-postasını gönderen transactional servis (SUB-PR 4.3). Tek bir e-posta
şablonu var bugün; sonraki SUB-PR'larda iade onayı, kullanıcı silme
onayı vb. eklenebilir.

Akış:

```
Paddle webhook → Inngest (watermark step) → Inngest (email step) →
   src/lib/email.ts → Resend API → Müşterinin gelen kutusu
```

`src/lib/email.ts` yine **lazy init + graceful degradation** kalıbını
kullanır: `RESEND_API_KEY` set değilse `sendOrderReadyEmail` çağrısı
`{ ok: false, error }` döner; fulfillment kırılmaz (yetki belgesi zaten
`ready` durumundadır).

### 15.2. Hesap Açma

1. **Kayıt:** `https://resend.com/signup` → GitHub veya e-posta ile.
2. Doğrulama e-postasını onaylayın.

### 15.3. Gönderim Domain'ini Doğrulama

Resend; **doğrulanmış bir domain üzerinden** üretim e-postası göndermenizi
zorunlu kılar. Doğrulanmamış domain'lerde yalnızca `onboarding@resend.dev`
test gönderen adresi çalışır (günlük 100 e-posta limiti).

1. Sol menü: **Domains** → sağ üstte **`+ Add Domain`** düğmesi.
2. Form:
   - **Domain:** `mail.kitabevi.com.tr` (kök domain'i değil, mail için
     bir subdomain önerilir — kök domain'in reputation'u ile karışmaz).
   - **Region:** Trafik ana bölgenizle örtüşen Resend bölgesini seçin
     (Avrupa için `eu-west-1` gibi).
3. **`Add`** düğmesi.
4. Resend size **3 DNS kaydı** verir:
   - **MX** kaydı (gönderim onayları için)
   - **TXT** (SPF politikası — `v=spf1 include:amazonses.com ~all`)
   - **TXT** (DKIM imzası — `resend._domainkey…`)
   - **TXT** (DMARC — opsiyonel ama önerilir: `v=DMARC1; p=quarantine; …`)
5. Bu kayıtları DNS sağlayıcınızda (Cloudflare, Route53, vb.) ekleyin.
6. Resend panelinde **`Verify DNS Records`** düğmesine basın → her satır
   **`Verified`** olmalı (DNS yayılması 1-30 dk).

### 15.4. API Anahtarı

1. Sol menü: **API Keys** → **`+ Create API Key`** düğmesi.
2. Form:
   - **Name:** `digital-bookstore-server-prod`
   - **Permission:** **`Full access`** (üretim için);
     **`Sending access`** dilerseniz daha kısıtlayıcı bir alternatif.
   - **Domain:** Az önce eklediğiniz domain'i seçin (anahtar sadece o
     domain üzerinden gönderim yapabilir).
3. **`Add`** düğmesi → açılan modal `re_…` ile başlayan anahtarı
   **bir kez** gösterir. Kopyalayın → `RESEND_API_KEY` olarak yerleştirin.

### 15.5. Üç Ortama Yerleştirme

#### Yerel (test sender ile)
```bash
# .env.local — domain doğrulama yoksa test sender ile sınırlı (100/gün)
RESEND_API_KEY=re_test_...
EMAIL_FROM="Digital Bookstore <onboarding@resend.dev>"
```

#### Vercel Preview / Production
```bash
vercel env add RESEND_API_KEY  preview
vercel env add EMAIL_FROM      preview
vercel env add RESEND_API_KEY  production
vercel env add EMAIL_FROM      production    # "Digital Bookstore <noreply@mail.kitabevi.com.tr>"
```

> **Üretimde test sender'ı asla kullanmayın.** `onboarding@resend.dev`'in
> günlük limiti 100'dür; ayrıca alıcı tarafında Resend-marked sender
> görünür — kurumsal görünmez. Production'a geçmeden domain doğrulamasını
> tamamlayın.

### 15.6. Kod Tabanı ile Bağlantı

| Konum | Açıklama |
|---|---|
| `src/lib/email.ts` | `sendOrderReadyEmail({ to, buyerName, bookTitle, orderId, bookId })` — Resend istemcisini lazy init eder, `idempotencyKey` ile gönderir |
| `src/emails/order-ready.tsx` | React Email şablonu (`@react-email/components`) — calm-literary tasarım, evergreen CTA |
| `src/inngest/functions/watermark.ts` | Watermark adımından sonra ayrı `step.run("email-order-ready-${bookId}", ...)` — Inngest step-level + Resend idempotency-key çift katmanlı koruma |

### 15.7. Doğrulama

1. Yerel test (DB + Paddle sandbox bağlı, Inngest CLI çalışıyor):
   - Paddle sandbox'tan bir test satın alma yapın.
   - Inngest dev panelinde (`http://localhost:8288`) iş akışında
     `email-order-ready-…` adımının `succeeded` olduğunu görün.
   - Resend panelinde **Emails → Logs** → en üstte gönderilmiş e-postayı
     ve `delivered` durumunu görün.

2. Üretim doğrulaması: ilk gerçek satın alma sonrasında müşteri e-postası
   geldikten sonra Resend → **Logs** üzerinden `MessageId`'yi destek
   notlarınıza ekleyin.

### 15.8. Yaygın Sorunlar — Resend

| Belirti | Olası Sebep | Çözüm |
|---|---|---|
| `403 Validation failed: Invalid 'from' field` | `EMAIL_FROM`'daki domain doğrulanmamış | Domains sekmesinde domain'i Verified'a getirin VEYA test sender'a düşün |
| E-postalar SPAM klasörüne düşüyor | SPF/DKIM/DMARC eksik | Üç DNS kaydını da eklediğinizden ve **Verified** olduğundan emin olun |
| `429 Rate limited` | Free planın saatlik limiti aşıldı | Pro plana geçin VEYA üretim trafiği için Pay-as-you-go aktive edin |
| Müşteri e-posta almıyor ama Resend "delivered" diyor | Müşterinin spam filtresi | DMARC `quarantine → reject` geçişi + müşteri destek notu |
| Duplicate e-posta | İdempotency anahtarı yanlış | `src/lib/email.ts`'te `idempotencyKey: "order-ready:${orderId}:${bookId}"` formatı bozulmamış olmalı |

---

## 16. Vercel Analytics & Speed Insights

### 16.1. Amaç

Sıfır-yapılandırmalı, Vercel'in kendi sunduğu iki gözlemleme ürünü:

- **Analytics** — sayfa görüntüleme + benzersiz ziyaretçi + olay sayma
  (privacy-first; cookie kullanmaz).
- **Speed Insights** — Core Web Vitals (LCP, INP, CLS) gerçek kullanıcı
  ölçümlerini (RUM) toplar.

Her ikisi de:
- **Hiç env değişkeni gerektirmez** — Vercel deploy'da otomatik enjekte
  edilir.
- Vercel **dışında** (yerel dev, self-host) **sessizce devre dışı** kalır
  — script yüklenmez, beacon atılmaz, console gürültüsü yoktur.
- Aynı script host'u kullanır: `va.vercel-scripts.com`. Bu host bizim
  CSP `script-src` allowlist'imize ekli (SUB-PR 4.3 — `next.config.ts`).

### 16.2. Vercel Panelinden Etkinleştirme

1. Vercel projesi → **Analytics** sekmesi → **`Enable`**.
2. Aynı sekmenin altında **Speed Insights** kartı → **`Enable`**.
3. (İsteğe bağlı) **Settings → Privacy** üzerinden veri saklama süresini
   ayarlayın.

Tek başına etkinleştirme yeterli değildir — uygulama tarafında ise zaten
`src/app/layout.tsx`'te `<Analytics />` + `<SpeedInsights />` bileşenleri
mount edilmiştir (SUB-PR 4.3). Sıradaki deploy'la birlikte veri akmaya
başlar.

### 16.3. Kod Tabanı ile Bağlantı

| Konum | Açıklama |
|---|---|
| `src/app/layout.tsx` | `<Analytics />` ve `<SpeedInsights />` `<body>` içinde, `{children}`'dan sonra render edilir — ClerkProvider'ın koşullu mount durumundan bağımsız |
| `next.config.ts` (CSP) | `script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com` — script host'u explicit allowlist'te |

### 16.4. Doğrulama

1. Vercel deploy sonrası bir sayfayı açın → DevTools → Network → filtre
   `vercel-scripts.com` → `script.js` ve `speed-insights/script.js`
   yüklenmiş olmalı.
2. Network → filtre `vitals.vercel-insights.com` → beacon POST'larını
   görün.
3. Vercel pano → **Analytics** sekmesi → 30 sn içinde ilk pageview
   görünür.

### 16.5. Maliyet

Vercel Free planında her iki ürün de **ücretsiz katman** ile
gelir (aylık 2.5k pageview Analytics + 10k data points Speed Insights).
Aşılırsa Pro plan'a otomatik geçer; ek ücret deployment sayfasında görünür.

---

## 17. Sentry — Hata İzleme ve Performans

### 17.1. Amaç

Sentry; üretimde fırlatılan tüm yakalanmamış istisnaları, manuel olarak
`logger.error(...)` ile raporlanan kayıtları ve isteğe bağlı performans
spanlarını merkezi bir dashboard'a iletir (SUB-PR 4.5). Vercel'in standart
loglarının üstünde:
- Hatalar **stack-trace'leri sembolize** edilmiş hâlde gelir (source-map
  yükleme yapıldıysa).
- Aynı hata **dedup edilir** — `Issues` görünümünde "ilk görüldüğünden
  beri X kez" olarak takip edilir.
- **PII otomatik olarak filtrelenmez** — bizim varsayılan init
  (`sendDefaultPii: false`) bu güvenliği uygular (Roadmap §11).

Üç farklı runtime için ayrı init dosyaları:

| Dosya | Runtime | DSN değişkeni |
|---|---|---|
| `sentry.client.config.ts` | Tarayıcı | `NEXT_PUBLIC_SENTRY_DSN` |
| `sentry.server.config.ts` | Node (`/api/*`, Server Actions, RSC) | `SENTRY_DSN` |
| `sentry.edge.config.ts` | Edge (middleware) | `SENTRY_DSN` |

`instrumentation.ts` Next.js'in `NEXT_RUNTIME` env değerine göre doğru
config dosyasını yükler.

### 17.2. Hesap ve Proje Oluşturma

1. **Kayıt:** `https://sentry.io/signup/` → GitHub veya e-posta ile.
2. **Yeni proje:** Sol kenar menü → **Projects** → sağ üstte
   **`+ Create Project`** düğmesi.
3. Form:
   - **Platform:** **`Next.js`** (önemli — Sentry buna göre kurulum
     wizard'ı önerir; biz manuel kurduğumuz için wizard'ı atlayabiliriz).
   - **Project name:** `digital-bookstore-prod`
   - **Team:** mevcut takımınız (yoksa yeni bir tane oluşturun).
4. **`Create Project`** düğmesi.

### 17.3. DSN'lerin Kopyalanması

1. Yeni proje sayfasında **Settings → Client Keys (DSN)** menüsüne
   girin (URL: `…sentry.io/settings/<org>/projects/<project>/keys/`).
2. **Default key** kartında üç değer vardır:
   - **DSN** — `https://<hash>@o<orgid>.ingest.sentry.io/<projectid>`
   - **Public Key** ve **Secret Key** — bunlar DSN içinde gömülüdür;
     çoğu zaman ayrıca kullanılmaz.
3. **DSN değerini kopyalayın** → hem `SENTRY_DSN` (sunucu) hem
   `NEXT_PUBLIC_SENTRY_DSN` (istemci) için aynı değeri kullanın.
   - Public ve server için **AYNI DSN** kullanmak güvenlidir; DSN
     zaten "yalnızca yazma" yetkisine sahiptir (sızsa bile saldırgan
     yalnızca sahte hatalar gönderebilir, mevcut hataları okuyamaz).

```bash
SENTRY_DSN=https://xxxx@o1234.ingest.sentry.io/5678
NEXT_PUBLIC_SENTRY_DSN=https://xxxx@o1234.ingest.sentry.io/5678
```

> İstemci ve sunucu için **ayrı projeler** kullanmak isterseniz iki
> ayrı Sentry projesi oluşturun ve DSN'leri ayrı tutun. Çoğu kullanım
> için tek proje yeterlidir.

### 17.4. Source-Map Upload — Sembolize Stack Trace İçin

Production bundle'lar minified'tır. Source map yüklemezseniz Sentry'deki
hata satırı `t.x:1:42198` gibi görünür. Yüklerseniz `src/app/admin/actions.ts:172`
olarak okunur.

1. **Sentry Auth Token oluşturma:**
   - Sol kenar menü: **Settings → Account → API → Auth Tokens** (URL:
     `sentry.io/settings/account/api/auth-tokens/`).
   - **`+ Create New Token`** düğmesi.
   - Form:
     - **Name:** `digital-bookstore-ci-source-maps`
     - **Scopes:** `project:releases` ve `org:read` (minimum gerekli).
   - **`Create Token`** → görünen `sntrys_…` ile başlayan değeri
     **bir kez** gösterir. Kopyalayın → `SENTRY_AUTH_TOKEN`.
2. **Organization slug:**
   - URL'nizden okuyun: `sentry.io/organizations/<ORG_SLUG>/projects/`
   - `<ORG_SLUG>` → `SENTRY_ORG` olarak yerleştirin.
3. **Project slug:**
   - Proje sayfasının URL'sinden: `sentry.io/organizations/<org>/projects/<PROJECT_SLUG>/`
   - `<PROJECT_SLUG>` → `SENTRY_PROJECT` olarak yerleştirin (örn.
     `digital-bookstore-prod`).

### 17.5. Üç Ortama Yerleştirme

#### Yerel (genelde gerekmez — yerel hatalar Sentry'ye gitmesin)
```bash
# .env.local — boş bırakmak, init'in atlamasına yol açar; tavsiye edilir.
# Yerel'de Sentry test etmek istiyorsanız:
#   SENTRY_DSN=https://...
#   NEXT_PUBLIC_SENTRY_DSN=https://...
# Source-map upload yerelde KESİNLİKLE devre dışı bırakılmalı
# (auth token boş bırakıldığında zaten otomatik atlar).
```

#### Vercel Preview
```bash
vercel env add SENTRY_DSN              preview
vercel env add NEXT_PUBLIC_SENTRY_DSN  preview
# Source-map upload preview'da opsiyonel — tipik akış sadece production:
# vercel env add SENTRY_AUTH_TOKEN     preview
# vercel env add SENTRY_ORG            preview
# vercel env add SENTRY_PROJECT        preview
```

#### Vercel Production
```bash
vercel env add SENTRY_DSN              production
vercel env add NEXT_PUBLIC_SENTRY_DSN  production
vercel env add SENTRY_AUTH_TOKEN       production
vercel env add SENTRY_ORG              production
vercel env add SENTRY_PROJECT          production
```

### 17.6. Kod Tabanı ile Bağlantı

| Konum | Açıklama |
|---|---|
| `sentry.client.config.ts` | İstemci init; `NEXT_PUBLIC_SENTRY_DSN` yoksa atlanır |
| `sentry.server.config.ts` | Sunucu init; `SENTRY_DSN` yoksa atlanır |
| `sentry.edge.config.ts` | Edge runtime init |
| `instrumentation.ts` | Next.js `register()` hook'u; runtime'a göre doğru config'i yükler. `onRequestError` → `Sentry.captureRequestError` (Next.js 15+ hatası yakalama) |
| `next.config.ts` | `withSentryConfig(nextConfig, …)` — build-time source-map upload + plugin entegrasyonu |
| `src/lib/logger.ts` | `logger.info / warn / error()` — `error` çağrıları DSN setliyse Sentry'ye iletilir |

### 17.7. Graceful Degradation Sözleşmesi

Sentry **hiçbir env yokken** uygulama tamamen çalışır:

1. `Sentry.init()` çağrıları DSN olmadığında atlanır (config dosyalarının
   içindeki `if (dsn)` gate'i).
2. `Sentry.captureException()` / `Sentry.captureMessage()` çağrıları
   init yapılmamışken **sessizce no-op** olur — istek atılmaz, hata
   fırlatılmaz.
3. `withSentryConfig` `SENTRY_AUTH_TOKEN` yoksa source-map upload'u
   atlar (`sourcemaps.disable: true`), build başarılı olur.
4. `logger.error()` her zaman `console.error`'a yazar — Vercel logları
   gözlemleme zemini olarak kalır.

### 17.8. Doğrulama

1. Bir test hatası fırlatın:
   ```bash
   # Yerel dev sunucu açıkken bir test endpoint açın
   curl -X POST http://localhost:3000/api/admin/actions \
     -H "Content-Type: application/json" \
     -d '{"badRequest":true}'
   ```
2. Sentry → **Issues** sekmesi → 30 sn içinde yeni bir issue görünmeli.
3. Issue'yu açın → stack trace satır numaraları **kaynak dosya yolları**
   olmalı (sembolize edilmiş). Eğer `app-<hash>.js:1:NNNN` görünüyorsa
   source-map upload başarısız demektir — build loglarına bakın.

### 17.9. Yaygın Sorunlar — Sentry

| Belirti | Olası Sebep | Çözüm |
|---|---|---|
| Hatalar Sentry'ye düşmüyor | DSN env değişkeni yanlış set | Vercel ortamına ekleyip **redeploy** edin |
| Stack trace minified (`t.x:1:42198`) | Source-map upload başarısız | `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT` üçünü de set ettiğinizden emin olun |
| Build çıktısında `Skipping sentry-cli` | Auth token eksik (graceful skip — sorun değil ama upload da yok) | Token ekleyip yeniden deploy |
| Test/preview hataları production'a karışıyor | Tek proje + `environment` filtresi yok | İki ayrı proje kullanın VEYA Issues sayfasında `environment` filtresini sabitleyin |
| Sentry'de PII (e-posta vb.) görünüyor | `sendDefaultPii: true` set edilmiş | Config dosyalarında `sendDefaultPii: false` olduğundan emin olun (Roadmap §11) |

### 17.10. Maliyet

Sentry Developer Plan ücretsiz: aylık 5.000 hata + 10.000 performans
event'i + 50 replay. Düşük trafikli ürünler için fazlasıyla yeterli.
Aşıldığında Team plan ($26/ay) veya event quota artırımı satın
alınabilir.

---

## 18. MailerLite & BookFunnel — Bonus Sahne / Lead Magnet Hunisi

Kurgu kitap serileri için fiziksel veya dijital kitap içi QR kodları üzerinden okuyucu toplayan ve teslimat yapan altyapıdır. Ayrıntılı mimari rehber için bkz: [`docs/60-architecture/BONUS_SCENE_LEAD_MAGNET_ARCHITECTURE_TR.md`](file:///home/emre/Downloads/Valice-Press-Site/docs/60-architecture/BONUS_SCENE_LEAD_MAGNET_ARCHITECTURE_TR.md).

### 18.1. Değişkenler Tablosu

| Değişken Adı | Kapsam | Ortam | Açıklama |
|---|---|---|---|
| `MAILERLITE_API_TOKEN` | Sunucu | Production, Preview | MailerLite REST API yetkilendirme belirteci (`Bearer`). Asla tarayıcıya açılmaz. |
| `MAILERLITE_GROUP_ID` | Sunucu | Production, Preview | Varsayılan veya 1. Kitap (`/bonus`) MailerLite grup ID'si. |
| `MAILERLITE_GROUP_ID_<SLUG>` | Sunucu | Production, Preview | İlgili kitap funnel'ına özel MailerLite grup ID'si (Örn: `MAILERLITE_GROUP_ID_LONG_WAY_BACK`). |
| `NEXT_PUBLIC_BOOKFUNNEL_URL` | İstemci/Build | Production, Preview | 1. Kitap bonus sahnesi için BookFunnel indirme URL'si (Derleme anında inlined). |
| `NEXT_PUBLIC_BOOKFUNNEL_URL_<SLUG>` | İstemci/Build | Production, Preview | İlgili kitap bonus sahnesi için BookFunnel indirme URL'si (Örn: `NEXT_PUBLIC_BOOKFUNNEL_URL_LONG_WAY_BACK`). |

### 18.2. Önemli Sözleşmeler ve Güvenlik
1. **İki Ayrı Cevap (`ok` vs `deliver`):** MailerLite geçici servis hatası verse bile okuyucuya dosya teslim edilir (`deliver: true`).
2. **Form Gizleme (Safe State):** `NEXT_PUBLIC_BOOKFUNNEL_URL_*` henüz build ortamına girilmemişse, teslim edilemeyecek bir söz için e-posta toplanmaz; form gizlenir ve "The download opens soon" mesajı verilir.
3. **Build-Time Inlining:** `NEXT_PUBLIC_*` değişkenleri statik sayfa derlemesi (SSG) anında HTML içine yazılır; Vercel'e eklendikten sonra mutlaka **yeniden deploy (Redeploy)** tetiklenmelidir.

---

## Ek A: Hızlı Komut Referansı

```bash
# Yerel ortam dosyasını Vercel'den çek
vercel env pull .env.local

# Tek bir ortam değişkenini ekle (etkileşimli)
vercel env add VARIABLE_NAME preview

# Tek bir değişkeni kaldır
vercel env rm VARIABLE_NAME preview

# Üretime gerçek deploy
vercel deploy --prod

# Drizzle migration
npm run db:migrate
npm run db:studio        # tarayıcıda DB browser
npm run db:generate      # schema.ts'den yeni migration üret

# Inngest yerel dev
npx inngest-cli@latest dev

# Lint + tip + build
npm run lint
npx tsc --noEmit
npm run build
```

---

## Ek B: Belge Versiyonu

| Tarih | Versiyon | Değişiklik |
|---|---|---|
| 2026-05-29 | 1.0 | İlk yayın — SUB-PR 4.1 sonrası tam envanter |

> Bu belge, kaynak kod boyunca `process.env.*` referansları taranarak
> hazırlanmıştır. Yeni bir ortam değişkeni eklendiğinde **mutlaka**:
> 1. `.env.example`'a şablonu ve açıklamayı ekleyin,
> 2. Bu belgenin ilgili bölümünü ve **§2 Envanter Tablosu**'nu güncelleyin,
> 3. Üç ortamın hepsine değeri yerleştirmeyi unutmayın.
