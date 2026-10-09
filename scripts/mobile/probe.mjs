/**
 * In-page measurement probe. Serialised into the target page by audit.mjs.
 *
 * Everything here runs inside the Redmi's Chrome, so it must be ES5-safe
 * enough to be obvious and must never throw — a probe exception aborts the
 * whole sweep. Each section is individually try/caught.
 */
/*
 * GUARD: this file must contain exactly two backticks — the String.raw
 * delimiters below. A backtick anywhere in the probe body or its comments ends
 * the template early and the rest of the file is parsed as JavaScript, which
 * fails with a confusing "X is not defined" at import time. This has bitten
 * three times; write comments with plain quotes.
 */
export const PROBE_SOURCE = String.raw`(() => {
  const W = innerWidth, H = innerHeight, de = document.documentElement;
  const out = { vw: W, vh: H, dpr: devicePixelRatio };

  /* An element is "visible" only if it actually generates boxes. Checking the
     element's own computed style is not enough: a hidden wrapper's descendants
     still report display:block for themselves (the root layout once mounted a
     SiteHeader that a CSS rule hid this way). getClientRects() is empty when
     the element OR any ancestor is display:none, which is what we need. */
  const visible = (el) => {
    if (el.getClientRects().length === 0) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden") return false;
    if (parseFloat(cs.opacity) === 0) return false;
    return true;
  };
  const sel = (el) => {
    if (!el || el === document.body) return "body";
    let s = el.tagName.toLowerCase();
    if (el.id) return s + "#" + el.id;
    const cls = (el.getAttribute("class") || "").trim().split(/\s+/).filter(Boolean).slice(0, 4).join(".");
    if (cls) s += "." + cls;
    const p = el.parentElement;
    return (p && p !== document.body ? p.tagName.toLowerCase() + " > " : "") + s;
  };

  const all = Array.prototype.slice.call(document.querySelectorAll("*"));
  out.domNodes = all.length;
  out.title = document.title;
  out.href = location.href;

  /* ── horizontal overflow ─────────────────────────────────────────── */
  try {
    const docScrollW = Math.max(de.scrollWidth, document.body.scrollWidth);
    out.docScrollW = docScrollW;
    out.docScrollH = Math.max(de.scrollHeight, document.body.scrollHeight);
    out.hOverflowPx = Math.max(0, docScrollW - de.clientWidth);
    const offenders = [];
    for (const el of all) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.right <= W + 1.5 && r.left >= -1.5) continue;
      let clipped = false, p = el.parentElement;
      while (p && p !== de) {
        const pcs = getComputedStyle(p);
        if (pcs.overflow !== "visible" || pcs.overflowX !== "visible") { clipped = true; break; }
        p = p.parentElement;
      }
      if (!clipped) {
        offenders.push({ sel: sel(el), left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width) });
      }
    }
    out.overflowers = offenders.sort((a, b) => b.right - a.right).slice(0, 8);
    out.overflowCount = offenders.length;
  } catch (e) { out.overflowError = String(e).slice(0, 120); }

  /* ── tap targets ─────────────────────────────────────────────────── */
  try {
    const Q = "a[href],button,input:not([type=hidden]),select,textarea,[role=button],[role=link],[role=tab],[role=switch],[tabindex]:not([tabindex='-1'])";
    const targets = [];
    for (const el of document.querySelectorAll(Q)) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      targets.push({ el, r, min: Math.min(r.width, r.height) });
    }
    const describe = (t) => ({
      sel: sel(t.el), w: Math.round(t.r.width), h: Math.round(t.r.height),
      txt: (t.el.textContent || t.el.getAttribute("aria-label") || "").trim().slice(0, 30),
    });
    const under24 = targets.filter((t) => t.min < 24);
    const under44 = targets.filter((t) => t.min >= 24 && t.min < 44);

    /* WCAG 2.2 SC 2.5.8 spacing exception: a 24px-diameter circle centred on
       an undersized target must not intersect another target's circle or box.
       Undersized targets that pass this are conformant; we report them apart
       from genuine failures so the numbers are not inflated. */
    /* SC 2.5.8's INLINE exception: "the target is in a sentence or its size is
       otherwise constrained by the line-height of non-target text." A text link
       sitting in a metadata line or a paragraph is exempt no matter how the
       spacing arithmetic lands. Without this the checker reported a conformance
       failure for a tag link sitting next to a date — which the criterion
       explicitly excludes. Implemented, not waived: the element must actually
       be line-height-constrained AND sit among other text. */
    const isInline = (t) => {
      const cs = getComputedStyle(t.el);
      const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
      if (t.r.height > lh + 2) return false;            // taller than its line box
      const parent = t.el.parentElement;
      if (!parent) return false;
      let otherText = "";
      for (const node of parent.childNodes) {
        if (node === t.el) continue;
        otherText += (node.textContent || "");
      }
      return otherText.trim().length > 0;
    };

    /* SC 2.5.8's EQUIVALENT exception: "another control on the same page
       performs the same function and meets the requirement." A cart line links
       the book from both its 96x64 cover and its 179x20 title; the title is
       carried by the cover. Matched on href, which is the function here. */
    const bigHrefs = new Set(
      targets.filter((t) => t.min >= 24 && t.el.getAttribute("href"))
             .map((t) => t.el.getAttribute("href")));
    const hasEquivalent = (t) => {
      const href = t.el.getAttribute("href");
      return !!href && bigHrefs.has(href);
    };

    const failsSpacing = [];
    for (const a of under24) {
      if (isInline(a) || hasEquivalent(a)) continue;
      const ac = { x: a.r.left + a.r.width / 2, y: a.r.top + a.r.height / 2 };
      let intersects = false;
      for (const b of targets) {
        if (b === a) continue;
        const bc = { x: b.r.left + b.r.width / 2, y: b.r.top + b.r.height / 2 };
        const dist = Math.hypot(ac.x - bc.x, ac.y - bc.y);
        if (b.min < 24) { if (dist < 24) { intersects = true; break; } }
        else {
          // circle (r=12) vs the other target's box
          const cx = Math.max(b.r.left, Math.min(ac.x, b.r.right));
          const cy = Math.max(b.r.top, Math.min(ac.y, b.r.bottom));
          if (Math.hypot(ac.x - cx, ac.y - cy) < 12) { intersects = true; break; }
        }
      }
      if (intersects) failsSpacing.push(a);
    }
    out.tapTotal = targets.length;
    out.tapUnder24 = under24.length;
    out.tapUnder24List = under24.slice(0, 10).map(describe);
    out.tapUnder44 = under44.length;
    out.tapUnder44List = under44.slice(0, 10).map(describe);
    out.tapFailsWcag = failsSpacing.length;
    out.tapFailsWcagList = failsSpacing.slice(0, 10).map(describe);

    /* Drag targets are called out separately. SC 2.5.8's spacing exception can
       make an isolated 4px-tall range input "conformant" while still being
       close to undraggable with a finger, so conformance and usability are
       reported as different numbers. */
    out.dragTargets = Array.prototype.slice.call(document.querySelectorAll("input[type=range]"))
      .filter(visible).map((el) => {
        const r = el.getBoundingClientRect();
        /* elementFromPoint is viewport-relative and returns null for anything
           off-screen, so an element below the fold would report a hit height of
           0 and look catastrophic when it is merely scrolled away. Only sample
           when the centre line is actually on screen; otherwise say so. */
        const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2);
        const onScreen = cy >= 30 && cy <= innerHeight - 30 && cx >= 0 && cx <= innerWidth;
        let hit = null;
        if (onScreen) {
          hit = 0;
          for (let dy = -30; dy <= 30; dy++) {
            if (document.elementFromPoint(cx, cy + dy) === el) hit++;
          }
        }
        return { sel: sel(el), w: Math.round(r.width), h: Math.round(r.height),
                 hitHeightPx: hit, measured: onScreen };
      });
  } catch (e) { out.tapError = String(e).slice(0, 120); }

  /* ── small text ──────────────────────────────────────────────────── */
  try {
    const buckets = {};
    for (const el of all) {
      if (!el.firstChild || el.firstChild.nodeType !== 3) continue;
      const txt = (el.firstChild.nodeValue || "").trim();
      if (txt.length < 3) continue;
      if (!visible(el)) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (!fs || fs >= 12.5) continue;
      const k = fs.toFixed(1);
      buckets[k] = buckets[k] || { size: fs, count: 0, sample: [] };
      buckets[k].count++;
      if (buckets[k].sample.length < 3) buckets[k].sample.push(sel(el) + " :: " + txt.slice(0, 30));
    }
    out.tinyText = Object.keys(buckets).map((k) => buckets[k]).sort((a, b) => a.size - b.size);
    out.tinyTextTotal = out.tinyText.reduce((s, t) => s + t.count, 0);
    /* The acceptance number. tinyTextTotal counts everything under 12.5px,
       which includes 12px text-xs — a legitimate size. What matters is text
       BELOW the 12px floor. */
    out.textBelow12 = out.tinyText.filter((t) => t.size < 12).reduce((s, t) => s + t.count, 0);
  } catch (e) { out.textError = String(e).slice(0, 120); }

  /* ── body type scale (editorial legibility) ──────────────────────── */
  try {
    /* Measure the READING body, not whatever <p> happens to come first.
       Taking document.querySelectorAll("p")[0] picked up the hero standfirst on
       article pages and reported its ratio as the article's — the roadmap's
       P2-4 ("blog line-height 1.35") was that mistake. The real reading column
       is the .cinematic-prose column, which measures 18px/1.75. */
    const proseRoot = document.querySelector(".cinematic-prose");
    const scope = proseRoot || document;
    let ps = Array.prototype.slice.call(scope.querySelectorAll("p"))
      .filter(visible).filter((e) => (e.textContent || "").trim().length > 60);
    if (ps.length === 0) {
      ps = Array.prototype.slice.call(document.querySelectorAll("p"))
        .filter(visible).filter((e) => (e.textContent || "").trim().length > 60);
    }
    if (ps.length) {
      const cs = getComputedStyle(ps[0]);
      const fs = parseFloat(cs.fontSize), lh = parseFloat(cs.lineHeight);
      const c = document.createElement("canvas").getContext("2d");
      c.font = cs.fontWeight + " " + cs.fontSize + " " + cs.fontFamily;
      const chw = c.measureText("abcdefghijklmnopqrstuvwxyz").width / 26;
      out.bodyType = {
        fontPx: fs, lineHeightPx: lh, ratio: +(lh / fs).toFixed(2),
        charsPerLine: Math.round(ps[0].getBoundingClientRect().width / chw),
        paragraphs: ps.length,
        source: proseRoot ? ".cinematic-prose" : "document",
      };
    }
    const h1 = document.querySelector("h1");
    if (h1) out.h1Px = parseFloat(getComputedStyle(h1).fontSize);
  } catch (e) { out.typeError = String(e).slice(0, 120); }

  /* ── colour contrast (WCAG 2.2 SC 1.4.3) ─────────────────────────── */
  try {
    const parseRGB = (str) => {
      const m = /rgba?\(([^)]+)\)/.exec(str);
      if (!m) return null;
      const p = m[1].split(",").map((x) => parseFloat(x));
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    };
    const lum = (c) => {
      const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    };
    const ratio = (a, b) => {
      const l1 = lum(a), l2 = lum(b);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    };
    const blend = (fg, bg) => ({
      r: fg.r * fg.a + bg.r * (1 - fg.a),
      g: fg.g * fg.a + bg.g * (1 - fg.a),
      b: fg.b * fg.a + bg.b * (1 - fg.a),
      a: 1,
    });
    /* Walk up for the first opaque background. Anything sitting on an image or
       a gradient is reported as INDETERMINATE rather than guessed at — a
       contrast number invented over a photograph is worse than none. */
    const gradientAverage = (bi) => {
      if (!bi || bi === "none" || !/gradient/i.test(bi)) return null;
      const stops = bi.match(/rgba?\([^)]+\)/g);
      if (!stops || !stops.length) return null;
      const cols = stops.map(parseRGB).filter((c) => c && c.a > 0.5);
      if (!cols.length) return null;
      return {
        r: cols.reduce((t, c) => t + c.r, 0) / cols.length,
        g: cols.reduce((t, c) => t + c.g, 0) / cols.length,
        b: cols.reduce((t, c) => t + c.b, 0) / cols.length,
        a: 1,
      };
    };

    const backdrop = (el) => {
      let n = el, acc = null, approx = false;
      while (n && n !== document.documentElement) {
        const cs = getComputedStyle(n);
        /* A "background-clip: text" element paints its background onto the
           GLYPHS, not behind them — it is the foreground. Skip it as a backdrop
           and keep walking. Without this the emerald gradient headlines were
           compared against themselves and reported 1.42:1 when the real ratio
           is about 12.5:1. */
        const clip = cs.webkitBackgroundClip || cs.backgroundClip;
        if (clip === "text") { n = n.parentElement; continue; }
        const bg = parseRGB(cs.backgroundColor);
        if (bg && bg.a > 0) {
          acc = acc ? blend(acc, bg) : bg;
          if (acc.a >= 0.999 && !approx) return { color: acc, approximate: false };
        }
        /* A gradient backdrop: average its colour stops rather than ignoring
           it. Without this the emerald CTA buttons — dark text on a bright
           gradient — were measured against the dark page behind them and
           reported a 1.11 ratio, which is the opposite of the truth. A
           background IMAGE (a photo) still cannot be resolved this way, so it
           only marks the result approximate. */
        const bi = cs.backgroundImage;
        if (bi && bi !== "none") {
          const avg = gradientAverage(bi);
          if (avg) {
            acc = acc ? blend(acc, avg) : avg;
            return { color: acc, approximate: true };
          }
          approx = true;
        }
        n = n.parentElement;
      }
      const root = parseRGB(getComputedStyle(document.documentElement).backgroundColor);
      if (root && root.a > 0) {
        return { color: acc ? blend(acc, root) : root, approximate: approx };
      }
      return { indeterminate: true };
    };

    const results = [];
    let indeterminate = 0, approximate = 0;
    for (const el of all) {
      if (!el.firstChild || el.firstChild.nodeType !== 3) continue;
      const txt = (el.firstChild.nodeValue || "").trim();
      if (txt.length < 3) continue;
      if (!visible(el)) continue;
      const cs = getComputedStyle(el);
      const clip = cs.webkitBackgroundClip || cs.backgroundClip;
      // Gradient-filled text: the gradient is the ink, "color" never paints.
      const inkGradient = clip === "text" ? gradientAverage(cs.backgroundImage) : null;
      const fg = inkGradient || parseRGB(cs.color);
      if (!fg || fg.a === 0) continue;
      const bd = backdrop(el);
      if (bd.indeterminate) { indeterminate++; continue; }
      if (bd.approximate) approximate++;
      const fgOn = fg.a < 1 ? blend(fg, bd.color) : fg;
      const cr = ratio(fgOn, bd.color);
      const size = parseFloat(cs.fontSize);
      const weight = parseInt(cs.fontWeight, 10) || 400;
      /* SC 1.4.3: large text is >=24px, or >=18.66px when bold. */
      const large = size >= 24 || (size >= 18.66 && weight >= 700);
      const required = large ? 3 : 4.5;
      if (cr + 0.05 < required) {
        results.push({ sel: sel(el), text: txt.slice(0, 34), ratio: +cr.toFixed(2),
                       required, size, weight, fg: cs.color,
                       approximate: !!bd.approximate });
      }
    }
    out.contrast = {
      failures: results.length,
      failuresOnSolidBackground: results.filter((r) => !r.approximate).length,
      measured: results.length + approximate,
      approximateBackdrops: approximate,
      indeterminate,
      worst: results.sort((a, b) => a.ratio - b.ratio).slice(0, 8),
    };
  } catch (e) { out.contrastError = String(e).slice(0, 140); }


  /* ── images ──────────────────────────────────────────────────────── */
  try {
    const imgs = Array.prototype.slice.call(document.images).filter(visible);
    const oversized = [];
    for (const im of imgs) {
      const r = im.getBoundingClientRect();
      if (!im.naturalWidth || r.width === 0) continue;
      const ratio = im.naturalWidth / (r.width * devicePixelRatio);
      if (ratio > 1.6) {
        oversized.push({ src: (im.currentSrc || im.src).slice(-70), natural: im.naturalWidth,
                         cssW: Math.round(r.width), ratio: +ratio.toFixed(2) });
      }
    }
    out.imgCount = imgs.length;
    out.imgOversized = oversized.slice(0, 6);
    out.imgNoAlt = Array.prototype.slice.call(document.images).filter((x) => !x.hasAttribute("alt")).length;
    out.imgLazy = imgs.filter((i) => i.loading === "lazy").length;
  } catch (e) { out.imgError = String(e).slice(0, 120); }

  /* ── safe areas + theme integration ──────────────────────────────── */
  try {
    const probe = document.createElement("div");
    probe.style.cssText =
      "position:fixed;top:0;left:0;visibility:hidden;padding-top:env(safe-area-inset-top);" +
      "padding-bottom:env(safe-area-inset-bottom);padding-left:env(safe-area-inset-left);" +
      "padding-right:env(safe-area-inset-right)";
    document.body.appendChild(probe);
    const pcs = getComputedStyle(probe);
    out.safeArea = { top: pcs.paddingTop, bottom: pcs.paddingBottom, left: pcs.paddingLeft, right: pcs.paddingRight };
    probe.remove();
    const hcs = getComputedStyle(de), bcs = getComputedStyle(document.body);
    out.theme = {
      htmlBg: hcs.backgroundColor, bodyBg: bcs.backgroundColor,
      colorScheme: hcs.colorScheme,
      themeColorMeta: (document.querySelector('meta[name="theme-color"]') || {}).content || null,
      viewportMeta: (document.querySelector('meta[name="viewport"]') || {}).content || null,
    };
  } catch (e) { out.themeError = String(e).slice(0, 120); }

  /* ── navigation reachability (the P0) ────────────────────────────── */
  try {
    /* Take the first header that actually renders. (The root layout used to mount a
       second, hidden SiteHeader ahead of the real one; it was deleted in Phase 12 of the
       site update, and the visibility filter stays as the cheap defence against its return.) */
    const header = Array.prototype.slice.call(document.querySelectorAll("header")).filter(visible)[0] || null;
    const navLinks = header
      ? Array.prototype.slice.call(header.querySelectorAll("a[href]")).filter(visible)
          .map((a) => a.getAttribute("href"))
      : [];
    const menuBtn = Array.prototype.slice.call(document.querySelectorAll("button,[role=button]"))
      .filter(visible).filter((e) => {
        const s = ((e.getAttribute("aria-label") || "") + " " + (e.className || "") + " " +
                   (e.id || "") + " " + (e.textContent || "")).toLowerCase();
        return /menu|hamburger|navigation|burger|nav-toggle/.test(s);
      })[0];
    const mr = menuBtn ? menuBtn.getBoundingClientRect() : null;
    out.nav = {
      headerFound: !!header,
      headerLinks: navLinks,
      headerLinkCount: navLinks.length,
      /* The P0 metric: how many DISTINCT browse destinations a phone user can
         reach from the header. Utility controls (logo/search/cart/account) are
         not browse destinations. */
      browseDestinations: navLinks.filter((h) =>
        !/^\/$|^\/search|^\/cart|^\/account\/?$/.test(h)).length,
      hasMenuButton: !!menuBtn,
      menuButtonSize: mr ? Math.round(mr.width) + "x" + Math.round(mr.height) : null,
      menuButtonExpanded: menuBtn ? menuBtn.getAttribute("aria-expanded") : null,
    };
  } catch (e) { out.navError = String(e).slice(0, 120); }

  /* ── accessibility spot checks ───────────────────────────────────── */
  try {
    const first = document.querySelector("body a[href], body button");
    out.a11y = {
      h1Count: document.querySelectorAll("h1").length,
      landmarks: document.querySelectorAll("main,[role=main],nav,[role=navigation],footer,[role=contentinfo]").length,
      skipLink: !!(first && /skip/i.test(first.textContent || "")),
      inputsWithoutLabel: Array.prototype.slice.call(
        document.querySelectorAll("input:not([type=hidden]),select,textarea"))
        .filter(visible)
        .filter((i) => !i.getAttribute("aria-label") && !i.getAttribute("aria-labelledby") &&
                       !(i.id && document.querySelector('label[for="' + i.id + '"]')) &&
                       !i.closest("label")).length,
      reducedMotionHonoured: matchMedia("(prefers-reduced-motion: reduce)").matches,
    };
  } catch (e) { out.a11yError = String(e).slice(0, 120); }

  return out;
})()`;
