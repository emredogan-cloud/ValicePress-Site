/**
 * Read the reader on the actual phone (Directive §38).
 *
 * The project's memory is blunt about why this exists: a hidden automation tab
 * is not a browser, and a device harness that sweeps localhost measures a stale
 * build. So this drives the physical Redmi's own Chrome against PRODUCTION and
 * reports what that screen actually does — layout, overflow, target sizes, and
 * whether the book is being streamed or downloaded.
 *
 * It reuses the tab that is already open rather than creating one, because the
 * session lives in that browser profile and a fresh tab would have to sign in.
 *
 *   export PATH=$PATH:/home/emre/Android/Sdk/platform-tools
 *   adb -s <serial> forward tcp:9222 localabstract:chrome_devtools_remote
 *   node scripts/reader/device-check.mjs <reader-url>
 */

const CDP = process.env.MOBILE_CDP ?? "http://localhost:9222";
const target = process.argv[2];
if (!target) {
  console.error("usage: node scripts/reader/device-check.mjs <url>");
  process.exit(1);
}

const pages = (await (await fetch(`${CDP}/json`)).json()).filter(
  (t) => t.type === "page" && t.webSocketDebuggerUrl,
);
// Which tab, and why it matters. The phone keeps a dozen tabs open and only
// the FOREGROUND one runs a rendering pipeline — attach to a backgrounded one
// and `Page.enable` simply never answers. `--tab <n>` names one explicitly
// (list them with `curl localhost:9222/json`); otherwise prefer a tab already
// on the production origin, because that is the one carrying a session.
const tabFlag = process.argv.indexOf("--tab");
const page =
  tabFlag !== -1
    ? pages[Number(process.argv[tabFlag + 1])]
    : pages.find((t) => (t.url || "").startsWith("https://valicepress.com")) ??
      pages[0];
if (!page) {
  console.error("no debuggable page on the device");
  process.exit(1);
}

const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  const p = pending.get(msg.id);
  if (p) {
    pending.delete(msg.id);
    if (msg.error) p.reject(new Error(msg.error.message));
    else p.resolve(msg.result);
  }
});
await new Promise((r) => ws.addEventListener("open", r, { once: true }));

const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const n = ++id;
    pending.set(n, { resolve, reject });
    ws.send(JSON.stringify({ id: n, method, params }));
    setTimeout(() => {
      if (pending.has(n)) {
        pending.delete(n);
        reject(new Error(`CDP timeout: ${method}`));
      }
    }, 90_000);
  });

const evaluate = async (expression) => {
  const { result, exceptionDetails } = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (exceptionDetails) throw new Error(exceptionDetails.text);
  return result.value;
};

await send("Page.enable");
await send("Runtime.enable");
console.log(`device tab : ${page.title?.slice(0, 50)}`);
console.log(`navigating : ${target}\n`);

await send("Page.navigate", { url: target });
await new Promise((r) => setTimeout(r, 6000));

// Open the volume, wait for the first page, then measure.
const report = await evaluate(`(async () => {
  const reader = document.querySelector('.vp-reader');
  if (!reader) return { error: 'no reader on the page', url: location.href,
                        title: document.title };
  document.querySelector('.vp-vol')?.click();
  const t0 = Date.now();
  while (document.querySelector('.vp-veil') && Date.now() - t0 < 45000) {
    await new Promise(r => setTimeout(r, 300));
  }
  await new Promise(r => setTimeout(r, 2500));

  const de = document.documentElement;
  const reqs = performance.getEntriesByType('resource')
    .filter(e => e.name.includes('/api/read/'));
  const small = [...document.querySelectorAll('.vp-btn, .vp-edge')]
    .map(el => { const r = el.getBoundingClientRect();
                 return { label: el.getAttribute('aria-label') || el.title || '?',
                          w: Math.round(r.width), h: Math.round(r.height) }; })
    .filter(b => b.w > 0 && (b.w < 40 || b.h < 40));

  return {
    url: location.href,
    viewport: { w: innerWidth, h: innerHeight, dpr: devicePixelRatio },
    layout: document.querySelector('.vp-book')?.dataset.layout,
    perf: reader.dataset.perf,
    msToFirstPage: t0 ? Date.now() - t0 : null,
    folio: document.querySelector('.vp-folio')?.textContent.trim(),
    horizontalOverflow: de.scrollWidth - de.clientWidth,
    bookFitsViewport: (() => {
      const b = document.querySelector('.vp-book')?.getBoundingClientRect();
      return b ? (b.width <= innerWidth + 1 && b.height <= innerHeight + 1) : null;
    })(),
    transferredMB: +(reqs.reduce((a,e)=>a+(e.transferSize||0),0)/1048576).toFixed(2),
    requests: reqs.length,
    tapTargetsUnder40px: small,
    leafPainted: (() => {
      const c = document.querySelector('.vp-leaf--right .vp-leaf__canvas');
      return c ? { w: c.width, h: c.height } : null;
    })(),
  };
})()`);

console.log(JSON.stringify(report, null, 2));
ws.close();
