#!/usr/bin/env node
/**
 * Marks the phone's Chrome profile as INTERNAL traffic for one origin, so that running the suite against a LIVE
 * site leaves its analytics alone (the design is in src/lib/internal-traffic.ts):
 *
 *   - the `vp_internal=1` cookie — read in the page by the analytics gate and on the server by /api/events, which
 *     drops the funnel events of a marked visitor;
 *   - the `va-disable` localStorage key — what Vercel's documented opt-out reads, so Web Analytics and Speed
 *     Insights send nothing from this profile.
 *
 *   adb forward tcp:9222 localabstract:chrome_devtools_remote
 *   node scripts/mobile/mark-internal.mjs https://valicepress.com            # mark
 *   node scripts/mobile/mark-internal.mjs https://valicepress.com --remove   # unmark
 *
 * It touches only the origin it is given, once per profile; both markers last a year. A localhost origin is refused
 * because there is nothing to protect there.
 */
import { connectDevice, navigateAndSettle } from "./device.mjs";

const argv = process.argv.slice(2);
const origin = (argv.find((a) => /^https?:\/\//.test(a)) ?? "").replace(/\/$/, "");
const remove = argv.includes("--remove");
if (!origin) {
  console.error("usage: node scripts/mobile/mark-internal.mjs <https://origin> [--remove]");
  process.exit(2);
}
const url = new URL(origin);
if (["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
  console.error(`refusing ${url.hostname}: a local server has no analytics to protect`);
  process.exit(2);
}

const cdp = await connectDevice();
try {
  if (remove) {
    await cdp.send("Network.deleteCookies", { name: "vp_internal", domain: url.hostname, path: "/" });
  } else {
    await cdp.send("Network.setCookie", {
      name: "vp_internal",
      value: "1",
      domain: url.hostname,
      path: "/",
      secure: url.protocol === "https:",
      sameSite: "Lax",
      expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,
    });
  }
  // localStorage belongs to an origin, so be on a page of it: robots.txt is a plain text document that runs no scripts of ours.
  await navigateAndSettle(cdp, `${origin}/robots.txt`, { hard: true, settleMs: 300 });
  const state = await cdp.eval(`(() => {
    try { ${remove ? `localStorage.removeItem("va-disable");` : `localStorage.setItem("va-disable", "1");`} } catch (e) { return "localStorage: " + e; }
    return JSON.stringify({ origin: location.origin, vaDisable: localStorage.getItem("va-disable"), cookie: document.cookie.includes("vp_internal=1") });
  })()`);
  console.log(state);
  const parsed = JSON.parse(state);
  const ok = remove ? parsed.vaDisable === null : parsed.vaDisable === "1" && parsed.cookie === true;
  console.log(ok ? (remove ? "unmarked" : "marked as internal traffic") : "FAILED to apply the marker");
  process.exitCode = ok ? 0 : 1;
} finally {
  await cdp.close?.();
}
