/**
 * Shared CDP driver for the Valice Press mobile QA harness.
 *
 * Talks to two kinds of target:
 *   - the physical Redmi Note 8 (2021) over `adb forward tcp:9222`
 *   - a local Chrome for Testing, spawned headless, for desktop regression
 *
 * Node 24 ships a global `WebSocket`, so this needs no dependency.
 *
 * Hard-won rules encoded here (see MOBILE_CURRENT_STATE_AUDIT.md §1):
 *   - The dev server MUST be asserted healthy before every route. It died
 *     twice mid-sweep during the original audit and silently produced eight
 *     invalid captures before anyone noticed.
 *   - `scrollHeight === innerHeight` with a thin DOM is a RENDER FAILURE,
 *     not a short page.
 *   - NEVER use `Page.captureScreenshot({captureBeyondViewport:true})`. It
 *     tiles the page and repaints sticky elements per tile, so the header
 *     and hero appear duplicated. Scroll and capture instead.
 */
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";

export const BASE_URL = process.env.MOBILE_BASE_URL ?? "http://localhost:3100";
export const DEVICE_CDP = process.env.MOBILE_CDP ?? "http://localhost:9222";
export const CHROME_BIN =
  process.env.MOBILE_CHROME ??
  "/home/emre/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome";

/* ────────────────────────────── failures ────────────────────────────── */

export class HarnessError extends Error {
  constructor(msg, detail) {
    super(msg);
    this.name = "HarnessError";
    this.detail = detail;
  }
}

/** Abort the run loudly. Never let a sweep continue past a broken target. */
export function fail(msg, detail) {
  const e = new HarnessError(msg, detail);
  console.error(`\n╳ HARNESS FAILURE: ${msg}`);
  if (detail) console.error(`  ${JSON.stringify(detail)}`);
  throw e;
}

/* ─────────────────────────── server health ──────────────────────────── */

/**
 * Assert the origin answers 200 before we ask a browser to render it.
 * Called before EVERY route, not once per run.
 */
export async function assertServerHealthy(baseUrl = BASE_URL, { path = "/", attempts = 2, timeoutMs = 60000 } = {}) {
  const url = new URL(path, baseUrl).href;
  let res, lastErr;
  /* Generous timeout with one retry: `next dev` compiles a route on first hit,
   * and a dynamic route on a cold server can take well over 15s. A tight
   * timeout here reports "server unreachable" for a server that is merely
   * busy, and aborts the whole sweep. */
  for (let i = 0; i < attempts; i++) {
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), redirect: "manual" });
      lastErr = null;
      break;
    } catch (err) {
      lastErr = err;
      await sleep(1500);
    }
  }
  if (lastErr) {
    fail(`dev server unreachable at ${url}`, { error: String(lastErr.message), attempts });
  }
  // 2xx and 3xx are both fine; a redirect still means the server is alive.
  if (res.status >= 400) {
    fail(`dev server returned HTTP ${res.status} for ${url}`, { status: res.status });
  }
  return res.status;
}

/* ──────────────────────────── CDP plumbing ──────────────────────────── */

export class CDP {
  constructor(ws, meta = {}) {
    this.ws = ws;
    this.meta = meta;
    this.id = 0;
    this.pending = new Map();
    this.events = [];
    this.consoleErrors = [];
    this.pageErrors = [];
  }

  static async attach(wsUrl, meta) {
    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => {
      ws.onopen = res;
      ws.onerror = () => rej(new Error(`cannot open CDP socket ${wsUrl}`));
      setTimeout(() => rej(new Error(`CDP socket timeout ${wsUrl}`)), 20000);
    });
    const c = new CDP(ws, meta);
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id && c.pending.has(msg.id)) {
        const { res, rej } = c.pending.get(msg.id);
        c.pending.delete(msg.id);
        if (msg.error) rej(new Error(JSON.stringify(msg.error)));
        else res(msg.result);
        return;
      }
      if (!msg.method) return;
      c.events.push(msg);
      if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") {
        const text = String(msg.params.entry.text);
        // Dev-server noise, not product errors: the Turbopack/webpack HMR
        // socket drops whenever a page enters the back-forward cache.
        if (!/_next\/webpack-hmr|__nextjs|react-devtools|Page entered Back-Forward Cache/i.test(text)) {
          c.consoleErrors.push(text.slice(0, 300));
        }
      }
      if (msg.method === "Runtime.exceptionThrown") {
        const d = msg.params.exceptionDetails;
        c.pageErrors.push(String(d?.exception?.description ?? d?.text ?? "").slice(0, 300));
      }
    };
    return c;
  }

  send(method, params = {}, timeoutMs = 60000) {
    const id = ++this.id;
    return new Promise((res, rej) => {
      this.pending.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          rej(new Error(`CDP timeout: ${method}`));
        }
      }, timeoutMs);
    });
  }

  /** Evaluate an expression in the page and return its value. */
  async eval(expression, { awaitPromise = false } = {}) {
    const r = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise,
    });
    if (r.exceptionDetails) {
      throw new Error(
        `page eval threw: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`,
      );
    }
    return r.result?.value;
  }

  async enableDomains() {
    await this.send("Page.enable");
    await this.send("Runtime.enable");
    await this.send("Log.enable");
    await this.send("DOM.enable");
    await this.send("CSS.enable");
    await this.send("Network.enable");
  }

  clearDiagnostics() {
    this.events.length = 0;
    this.consoleErrors.length = 0;
    this.pageErrors.length = 0;
  }

  close() {
    try { this.ws.close(); } catch { /* already gone */ }
  }
}

/* ───────────────────────── target: the Redmi ────────────────────────── */

/**
 * Wake the phone and keep it awake for the run.
 *
 * A sleeping Redmi drops the DevTools socket and the next CDP call dies with
 * "CDP timeout: CSS.enable" partway through a sweep. Cheap to prevent, very
 * confusing to diagnose. Best-effort: never fails the run.
 */
export function wakeDevice() {
  const adb = process.env.ADB_BIN ?? "/home/emre/Android/Sdk/platform-tools/adb";
  const run = (args) => {
    try { execFileSync(adb, args, { stdio: "ignore", timeout: 8000 }); return true; }
    catch { return false; }
  };
  const woke = run(["shell", "input", "keyevent", "KEYCODE_WAKEUP"]);
  run(["shell", "svc", "power", "stayon", "usb"]);
  run(["shell", "settings", "put", "system", "screen_off_timeout", "1800000"]);
  /* Chrome must be the FOREGROUND app, not merely running.
   *
   * Android suspends a backgrounded Chrome's renderers, and the DevTools
   * socket then accepts a connection but never answers — the sweep dies on
   * "CDP timeout: CSS.enable" partway through, which reads like a harness bug
   * and is not one. This bit us for real in Phase 9: launching the WebView
   * host (scripts/mobile/wvhost) pushed Chrome to the background and the very
   * next audit aborted on route 1 of 224. Cheap to prevent; costly to
   * diagnose. Best-effort, like the rest of this function. */
  run(["shell", "monkey", "-p", "com.android.chrome", "-c",
       "android.intent.category.LAUNCHER", "1"]);
  return woke;
}

export async function connectDevice({ cdpUrl = DEVICE_CDP } = {}) {
  wakeDevice();
  let version, list;
  try {
    version = await (await fetch(`${cdpUrl}/json/version`, { signal: AbortSignal.timeout(8000) })).json();
    list = await (await fetch(`${cdpUrl}/json/list`, { signal: AbortSignal.timeout(8000) })).json();
  } catch (err) {
    fail(
      `cannot reach device CDP at ${cdpUrl}. Is the phone plugged in and is ` +
      `'adb forward tcp:9222 localabstract:chrome_devtools_remote' set?`,
      { error: String(err.message) },
    );
  }
  const target = list.find((t) => t.type === "page");
  if (!target) fail("no page target on the device — open a tab in Chrome first");
  const cdp = await CDP.attach(target.webSocketDebuggerUrl, {
    kind: "device",
    browser: version.Browser,
    androidPackage: version["Android-Package"],
  });
  await cdp.enableDomains();

  /* Pin the browser to English.
   *
   * A phone set to Turkish had Chrome translate the page on arrival: every
   * visible string came back Turkish ("Sepete ekle" for "Add to cart"), and
   * every text-matching check in the suite reported the control missing. The
   * page was fine; the harness was reading a translation. Overriding the
   * accept-language and the locale stops Chrome offering it, and it also keeps
   * dates and number formats stable between phones. */
  try {
    await cdp.send("Emulation.setUserAgentOverride", {
      userAgent: version["User-Agent"], acceptLanguage: "en-US,en", platform: "Android",
    });
    await cdp.send("Emulation.setLocaleOverride", { locale: "en-US" });
  } catch { /* older builds: not fatal, the guard below still catches it */ }
  return cdp;
}

/* ──────────────────── target: desktop Chrome for Testing ─────────────── */

export async function launchDesktopChrome({ port = 9333, width = 1440, height = 900 } = {}) {
  const userDataDir = `/tmp/valice-mobile-desktop-${port}`;
  mkdirSync(userDataDir, { recursive: true });
  const proc = spawn(
    CHROME_BIN,
    [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      "--headless=new",
      "--hide-scrollbars",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--force-device-scale-factor=1",
      `--window-size=${width},${height}`,
      "about:blank",
    ],
    { stdio: "ignore", detached: true },
  );
  proc.unref();

  // Wait for the debugging endpoint.
  let version = null;
  for (let i = 0; i < 60; i++) {
    try {
      version = await (await fetch(`http://localhost:${port}/json/version`, {
        signal: AbortSignal.timeout(2000),
      })).json();
      break;
    } catch { await sleep(500); }
  }
  if (!version) fail(`desktop Chrome did not expose CDP on :${port}`, { bin: CHROME_BIN });

  const list = await (await fetch(`http://localhost:${port}/json/list`)).json();
  const target = list.find((t) => t.type === "page");
  const cdp = await CDP.attach(target.webSocketDebuggerUrl, {
    kind: "desktop",
    browser: version.Browser,
    pid: proc.pid,
  });
  await cdp.enableDomains();
  cdp.chromeProc = proc;
  return cdp;
}

export async function closeDesktopChrome(cdp) {
  cdp.close();
  try { process.kill(-cdp.chromeProc.pid, "SIGTERM"); }
  catch { try { cdp.chromeProc.kill("SIGTERM"); } catch { /* gone */ } }
}

/* ─────────────────── navigation, settling, render checks ─────────────── */

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Navigate and wait until the page is genuinely ready.
 *
 * Settling is adaptive rather than a fixed sleep: dev-mode first hits can
 * take seconds to compile, and a fixed wait is how the original audit ended
 * up capturing blank pages.
 */
export async function navigateAndSettle(cdp, url, { timeoutMs = 45000, settleMs = 1200, hard = false } = {}) {
  /* Pacing for a LIVE site. The proxy rate-limits per IP (100 requests / 10 s) and one page load that is scrolled
   * through spends that many on Next's link prefetches alone, so a script that walks page after page at full speed
   * is answered "Too many requests" and reports the limiter, not the page. MOBILE_PACE_MS=8000 waits before every
   * navigation; unset (the default, and right for the local server) waits for nothing. */
  const pace = Number(process.env.MOBILE_PACE_MS ?? 0);
  if (pace > 0) await sleep(pace);
  cdp.clearDiagnostics();

  /* Prefer a CLIENT-SIDE navigation.
   *
   * Why: in `next dev`, a hard load of a route whose tree contains a
   * postponed Suspense boundary (React marker `<!--$~-->`, e.g. /books, whose
   * CatalogShell reads useSearchParams) can leave the streamed content parked
   * in a hidden `<div id="S:0">` that never gets swapped in. The page then
   * renders its hero and footer with the entire catalog invisible. Production
   * does not do this — valicepress.com/books ships the cards inline with no
   * S:0 — so it is a dev-server artifact, not a product defect. Measuring it
   * would silently baseline a blank catalog.
   *
   * A soft navigation (injecting an <a> and clicking it, which Next's router
   * intercepts) resolves the boundary exactly as a real in-session visit does.
   * Hard navigation stays available via `hard: true`, and CWV measurement
   * always uses it because a soft nav has no fresh paint timeline.
   */
  const target = new URL(url);
  if (!hard) {
    const here = await cdp.eval(`location.origin + "|" + location.pathname`).catch(() => null);
    const sameOrigin = typeof here === "string" && here.split("|")[0] === target.origin;
    if (!sameOrigin) {
      await cdp.send("Page.navigate", { url: target.origin + "/" });
      await waitReady(cdp, timeoutMs);
      await sleep(400);
    }
    /* Click an EXISTING Next <Link> anchor. A freshly injected <a> is not
     * intercepted — Next's router hangs a React onClick on the anchors it
     * renders, it does not delegate from the document. Hidden anchors work
     * fine: .click() dispatches regardless of display, which matters here
     * because the primary nav is `hidden md:flex` at phone widths. */
    const want = target.pathname + target.search;
    const soft = await cdp.eval(`(() => {
      const match = Array.from(document.querySelectorAll("a[href]")).find((a) => {
        try { const u = new URL(a.href, location.href);
              return u.origin === location.origin && (u.pathname + u.search) === ${JSON.stringify(want)}; }
        catch (e) { return false; }
      });
      if (!match) return false;
      match.click();
      return true;
    })()`).catch(() => false);

    let softOk = soft;
    if (!softOk) {
      // No anchor here — the homepage footer links most routes. Hop and retry.
      await cdp.send("Page.navigate", { url: target.origin + "/" });
      await waitReady(cdp, timeoutMs);
      await sleep(500);
      softOk = await cdp.eval(`(() => {
        const match = Array.from(document.querySelectorAll("a[href]")).find((a) => {
          try { const u = new URL(a.href, location.href);
                return u.origin === location.origin && (u.pathname + u.search) === ${JSON.stringify(want)}; }
          catch (e) { return false; }
        });
        if (!match) return false;
        match.click();
        return true;
      })()`).catch(() => false);
    }

    if (softOk) {
      const deadline = Date.now() + timeoutMs;
      let ok = false;
      while (Date.now() < deadline) {
        await sleep(400);
        const st = await cdp.eval(
          `({ p: location.pathname + location.search, rs: document.readyState,
              stuck: !!document.getElementById("S:0"),
              nodes: document.querySelectorAll('*').length })`,
        ).catch(() => null);
        if (st && st.p === target.pathname + target.search && st.rs === "complete" && !st.stuck) {
          ok = true;
          break;
        }
      }
      if (ok) {
        /* A soft transition swaps the tree in progressively and readyState
         * never leaves "complete", so "the URL changed" is not "the page is
         * there". Wait until the node count stops growing. */
        await settleUntilStable(cdp);
        await sleep(settleMs);
        try { await cdp.eval(`document.fonts ? document.fonts.ready.then(()=>0) : 0`, { awaitPromise: true }); } catch {}
        return cdp.eval(
          `({ rs: document.readyState, nodes: document.querySelectorAll('*').length,
              h: document.documentElement.scrollHeight, vh: innerHeight,
              href: location.href, title: document.title, nav: "soft" })`,
        );
      }
    }
    // Soft navigation failed — fall through to a hard load.
  }

  await cdp.send("Page.navigate", { url });

  const state = await waitReady(cdp, timeoutMs);
  // Fonts, lazy images, hydration.
  await sleep(settleMs);
  try {
    await cdp.eval(`document.fonts ? document.fonts.ready.then(()=>0) : 0`, { awaitPromise: true });
  } catch { /* fonts API unavailable — not fatal */ }
  return state;
}

/** Poll until the DOM stops growing — the tell that a soft transition landed. */
async function settleUntilStable(cdp, { maxMs = 12000, quietChecks = 2 } = {}) {
  const deadline = Date.now() + maxMs;
  let last = -1, stable = 0;
  while (Date.now() < deadline) {
    await sleep(400);
    const n = await cdp.eval(`document.querySelectorAll('*').length`).catch(() => -1);
    if (n === last && n > 0) { if (++stable >= quietChecks) return n; }
    else { stable = 0; last = n; }
  }
  return last;
}

/** Poll until the document is complete and has a non-trivial DOM. */
async function waitReady(cdp, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let state = null;
  while (Date.now() < deadline) {
    await sleep(400);
    try {
      state = await cdp.eval(
        `({ rs: document.readyState, nodes: document.querySelectorAll('*').length,
            h: document.documentElement.scrollHeight, vh: innerHeight,
            href: location.href, title: document.title, nav: "hard" })`,
      );
    } catch { continue; }          // navigation in flight; retry
    if (state?.rs === "complete" && state.nodes > 60) break;
  }
  return state;
}

/**
 * Render-failure detection.
 *
 * A route that answered 200 can still paint nothing (dev compile error,
 * dead server, error boundary). Catch it here rather than writing a blank
 * screenshot into the baseline.
 */
export async function assertRendered(cdp, route, url) {
  const s = await cdp.eval(`(() => {
    const de = document.documentElement;
    const main = document.querySelector('main, [role=main], .cinematic-root');
    return {
      rs: document.readyState,
      nodes: document.querySelectorAll('*').length,
      scrollH: de.scrollHeight, innerH: innerHeight,
      title: document.title,
      hasMain: !!main,
      textLen: (main ? main.innerText : document.body.innerText || '').trim().length,
      href: location.href,
      // React parked streamed content in a hidden buffer and never swapped it in.
      stuckBoundary: !!document.getElementById("S:0"),
    };
  })()`);

  const minNodes = route?.minNodes ?? 100;
  const problems = [];
  if (s.rs !== "complete") problems.push(`readyState=${s.rs}`);
  if (s.nodes < minNodes) problems.push(`nodes=${s.nodes} < floor ${minNodes}`);
  if (!s.hasMain) problems.push("no <main>/.cinematic-root");
  if (s.textLen < 120) problems.push(`visible text ${s.textLen} chars`);
  if (/404|could not be found|Application error|Internal Server Error/i.test(s.title)) {
    problems.push(`error title "${s.title}"`);
  }
  if (s.stuckBoundary) {
    problems.push("streamed content parked in a hidden #S:0 boundary (never swapped in)");
  }
  // The tell from the original audit: viewport-height document + thin DOM.
  if (s.scrollH <= s.innerH && s.nodes < 200) {
    problems.push(`scrollHeight(${s.scrollH}) <= innerHeight(${s.innerH}) with a thin DOM`);
  }

  if (problems.length) {
    fail(`route did not render: ${url}`, { route: route?.name, problems, observed: s });
  }
  return s;
}

/**
 * Put the cart in a known-empty state before a baseline capture.
 *
 * The cart is an httpOnly cookie, so clearing it is a browser-level operation,
 * not an app-level one. Two things made this worth automating:
 *
 *   - Running the purchase journey leaves an item in the cart. The next
 *     fingerprint then compares a full cart against an empty-cart baseline and
 *     reports ~226 elements "changed" on /cart with no code difference at all.
 *   - `next dev` caches the rendered /cart. After the cookie is gone the dev
 *     server can still serve the populated render — which is also why clicking
 *     "Clear cart" appears to do nothing in dev. It is a dev render cache, not
 *     a product bug and not session leakage: an anonymous request after a dev
 *     restart correctly returns the empty state, and the route is
 *     `export const dynamic = "force-dynamic"`.
 *
 * So: clear the cookies, then VERIFY against an anonymous fetch. If the server
 * is still serving a cached cart, say so loudly rather than baselining it.
 */
export async function resetCart(cdp) {
  try {
    await cdp.send("Network.clearBrowserCookies");
  } catch { /* not fatal */ }
  try {
    const html = await (await fetch(new URL("/cart", BASE_URL).href, {
      signal: AbortSignal.timeout(20000),
    })).text();
    const stale = /Order summary/i.test(html);
    if (stale) {
      console.warn(
        "  ⚠ /cart still renders items for an anonymous request — `next dev` is\n" +
        "    serving a cached render. Restart the dev server before trusting a\n" +
        "    /cart baseline.",
      );
      return "stale-dev-cache";
    }
    return "empty";
  } catch {
    return "unverified";
  }
}

/** Set an emulated viewport. Used for the width matrix and desktop capture. */
export async function setViewport(cdp, { width, height, dpr = 1, mobile = false }) {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width, height, deviceScaleFactor: dpr, mobile,
  });
}

export async function clearViewport(cdp) {
  await cdp.send("Emulation.clearDeviceMetricsOverride");
}

/** Throttle to the roadmap's reference mobile connection: 1.6 Mbps / 70 ms. */
export async function throttle(cdp, { latency = 70, downKbps = 1600, upKbps = 750 } = {}) {
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency,
    downloadThroughput: (downKbps * 1024) / 8,
    uploadThroughput: (upKbps * 1024) / 8,
  });
}

export async function unthrottle(cdp) {
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1,
  });
}

export async function setCacheDisabled(cdp, disabled) {
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: disabled });
  if (disabled) { try { await cdp.send("Network.clearBrowserCache"); } catch { /* ok */ } }
}
