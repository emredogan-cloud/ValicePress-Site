# UES-01 hardcover cover builder — pass 2: the head is an edge too

**File:** `MY-DİGİTAL-BOOK/BOOK-SERIES/AJAN-A-BOOK/PHASE-1-SERIES/UES-01/04_BUILD/covers_founder.py`
**Date:** 2026-09-20 (second patch of the day)
**Backup beside it:** `covers_founder.py.bak-20260920b`

That file lives under a tree its own repository gitignores wholesale
(`MY-DİGİTAL-BOOK/.gitignore:20 — BOOK-SERIES/*`), so the change is **on disk
and unversioned there**. This is the versioned record of exactly what changed
and why, the same as
[`UES-01-hardcover-cover-keepout-2026-09-20.patch.md`](UES-01-hardcover-cover-keepout-2026-09-20.patch.md),
which it corrects.

---

## What the first patch got wrong

The first patch lifted **both** panels by one constant, 0.117 in, derived from
one measurement of the **front** panel's foot (0.624 in against KDP's 0.716 in).
Measured afterwards, on the file that had already been uploaded:

```
                        before the lift   after the lift   KDP requires
front panel, foot          0.620 in          0.740 in        0.716 in   ✓ fixed
back panel, head           0.720 in          0.605 in        0.716 in   ✗ BROKEN
```

The back panel's headline — *"Thirty answers to the only question everyone has
asked."* — had four thousandths of an inch of slack at the head, and the lift
spent it. One edge was repaired by breaking another. The back panel never
needed moving at all: its own foot was 2.7 in clear.

It was found by measuring the built sheet against every edge instead of the one
that had been complained about, and confirmed by eye on a 150 dpi crop.

## What this patch does

The lift is no longer a constant. Each panel is **measured as it is composed**
and rises by the smaller of *what its foot is short* and *what its head can
spare*. A panel whose foot already clears does not move. And what no lift can
fix — a type block taller than the safe band, which needs a scale, not a
translation — an assertion at the end of `compose_wrap` refuses to write.

Measured on the rebuilt wrap, by the builder itself and again by
`COMMON-AREA/qa/panels.py`:

```
hardcover back  : type measured 0.720 in at the head and 2.083 in at the foot — not moved
hardcover front : foot was 0.120 in short, head could spare 2.707 in — lifted 0.120 in
VERIFIED back   : 0.7200 head / 2.0833 foot   against 0.716 required
VERIFIED front  : 3.3267 head / 0.7400 foot   against 0.716 required
```

The paperback was rebuilt from the patched source and compared with the
previous build at 100 dpi: **max absolute pixel difference 0**. The live
paperback edition is untouched by both patches.

Uploaded to KDP as `UES-01-hardcover-cover-v3.pdf` and approved in the Print
Previewer on 2026-09-20. KDP's own hidden fields for the uploaded file:
`coverWidthValue 14.286242860 · coverHeightValue 10.4173220 · spineWidthValue
0.711440460`, and `liveGraphicsHeight 8.986220`, which puts KDP's own keep-out
at `(10.41732 − 8.98622) / 2 = 0.71555 in` — the rule, arrived at independently.

---

## The diff

```diff
@@ -134,13 +134,64 @@
 #
 # Hardcover only. The paperback wrap has a different scale and a different
 # allowance, it is LIVE on Amazon, and it was not the subject of the rejection.
+#
+# ⭑ AND THE HEAD IS AN EDGE TOO — SAME DAY, SECOND PASS ⭑
+# The first version of this correction lifted BOTH panels by one constant,
+# 0.117 in, derived from one measurement of the FRONT panel's foot. Measured
+# again afterwards, the BACK panel's headline — "Thirty answers to the only
+# question everyone has asked." — had been carried from 0.720 in clear of the
+# head, four thousandths inside the rule, out to 0.605 in. One edge was repaired
+# by breaking another, and the back panel never needed moving: its own foot was
+# 2.7 in clear.
+#
+# So the lift is no longer a constant. Each panel is MEASURED as it is composed
+# and rises by the smaller of what its foot is short and what its head can
+# spare. A panel whose foot already clears does not move. And what no lift can
+# fix, the assertion at the end of compose_wrap refuses to write.
 PANEL_FOOT_SAFE_IN = 0.716      # what KDP asked for, verbatim
-PANEL_FOOT_MEASURED_IN = 0.624  # what the built wrap gave, measured
 PANEL_LIFT_BUFFER_IN = 0.024    # so a rounding does not put it back on the line
 
+# The house row finder. It lives in COMMON-AREA because every book's cover has
+# to answer the same question, and a copy per book is how two of them came to
+# answer it differently.
+QA_DIR = "/home/emre/Downloads/MY-DİGİTAL-BOOK/COMMON-AREA/qa"
+
 NOTES = []
 
 
+def _type_rows(img):
+    """Text rows on a composed panel, searched in BOTH polarities.
+
+    `hcsafe.text_lines` takes one polarity per call. This wrap sets light type on
+    a dark ground, so one call happens to be enough for it — but a gate that
+    silently sees half a sheet is worse than no gate, and the cost of the second
+    pass is one render that is already in memory.
+    """
+    if QA_DIR not in sys.path:
+        sys.path.insert(0, QA_DIR)
+    import numpy as np
+    from hcsafe import text_lines
+    a = np.asarray(img.convert("L"), dtype=np.uint8)
+    rows = []
+    for dark in (True, False):
+        rows += text_lines(a, DPI, dark)
+    return rows
+
+
+def _type_bounds(img):
+    """(head, foot) clearance of the outermost type row, in inches.
+
+    None when the panel carries no type the row finder can see. Nothing is moved
+    in that case: acting on a measurement you did not make is exactly how the
+    head came to be broken while the foot was being fixed.
+    """
+    rows = _type_rows(img)
+    if not rows:
+        return None
+    h = img.size[1]
+    return min(r[1] for r in rows) / DPI, (h - max(r[3] for r in rows)) / DPI
+
+
 # ---------------------------------------------------------------------------------
 # resampling
 # ---------------------------------------------------------------------------------
@@ -317,14 +368,12 @@
     panel_w = (W - spine_w) // 2
     bleed_px = int(round(outer_in * DPI))
 
-    # How far the panels must rise so the comp's burned-in foot type clears the
-    # edge KDP names. Zero for the paperback, which was not rejected and whose
-    # wrap is a different size.
-    lift_px = 0
-    if kind == "hardcover":
-        deficit_in = (PANEL_FOOT_SAFE_IN - PANEL_FOOT_MEASURED_IN
-                      + PANEL_LIFT_BUFFER_IN)
-        lift_px = max(0, int(round(deficit_in * DPI)))
+    # How far a panel must rise so the comp's burned-in foot type clears the edge
+    # KDP names. Decided per panel, below, from that panel's own measurement.
+    # Hardcover only: the paperback wrap has a different scale and a different
+    # allowance, it is LIVE on Amazon, and it was not the subject of a rejection.
+    need_in = PANEL_FOOT_SAFE_IN + PANEL_LIFT_BUFFER_IN
+    measured = {}
 
     src = load_wrap()
     sh = src.size[1]
@@ -344,22 +393,39 @@
         inner = excess - outer
         left = outer if name == "back" else inner
         scaled = scaled.crop((left, 0, left + panel_w, H))
-        if kind == "hardcover" and lift_px:
-            # Lift the panel, then extend its own bottom row down into the wrap.
-            # After the lift, row (H-1-lift_px) of the result IS the panel's
-            # original bottom row, so the fill continues the artwork rather than
-            # inventing an edge.
-            lifted = Image.new("RGB", (panel_w, H), (10, 14, 28))
-            lifted.paste(scaled, (0, -lift_px))
-            foot = scaled.crop((0, H - 1, panel_w, H)).resize(
-                (panel_w, lift_px), Image.NEAREST)
-            lifted.paste(foot, (0, H - lift_px))
-            scaled = lifted
-            NOTES.append(
-                f"{kind} {name}: lifted {lift_px}px ({lift_px / DPI:.3f} in) so the "
-                f"burned-in type clears {PANEL_FOOT_SAFE_IN:.3f} in at the foot; the "
-                f"vacated strip repeats the panel's bottom row and sits inside the "
-                f"{outer_in:.3f} in wrap")
+        if kind == "hardcover":
+            bounds = _type_bounds(scaled)
+            if bounds is None:
+                NOTES.append(f"{kind} {name}: no type row found; panel not moved")
+            else:
+                head_in, foot_in = bounds
+                short = max(0.0, need_in - foot_in)        # what the foot lacks
+                spare = max(0.0, head_in - need_in)        # what the head can give
+                lift_px = int(round(min(short, spare) * DPI))
+                if lift_px:
+                    # Lift the panel, then extend its own bottom row down into the
+                    # wrap. After the lift, row (H-1-lift_px) of the result IS the
+                    # panel's original bottom row, so the fill continues the
+                    # artwork rather than inventing an edge.
+                    lifted = Image.new("RGB", (panel_w, H), (10, 14, 28))
+                    lifted.paste(scaled, (0, -lift_px))
+                    foot = scaled.crop((0, H - 1, panel_w, H)).resize(
+                        (panel_w, lift_px), Image.NEAREST)
+                    lifted.paste(foot, (0, H - lift_px))
+                    scaled = lifted
+                    NOTES.append(
+                        f"{kind} {name}: type measured {head_in:.3f} in at the head and "
+                        f"{foot_in:.3f} in at the foot; lifted {lift_px}px "
+                        f"({lift_px / DPI:.3f} in) — the foot was {short:.3f} in short and "
+                        f"the head could spare {spare:.3f} in. The vacated strip repeats "
+                        f"the panel's bottom row and sits inside the {outer_in:.3f} in wrap")
+                else:
+                    NOTES.append(
+                        f"{kind} {name}: type measured {head_in:.3f} in at the head and "
+                        f"{foot_in:.3f} in at the foot against {PANEL_FOOT_SAFE_IN:.3f} in — "
+                        f"not moved" + ("" if short == 0 else
+                        f"; the foot is {short:.3f} in short and the head has nothing to spare"))
+                measured[name] = (head_in, foot_in)
         sheet.paste(scaled, (dest_x, 0))
         NOTES.append(f"{kind} {name}: cropped {excess}px ({excess/DPI:.3f} in) - "
                      f"{outer}px from the outer edge (allowance {outer_in:.3f} in = "
@@ -376,6 +442,29 @@
     NOTES.append(f"{kind} spine: uniform scale x{k:.3f} (the panels take x{vscale:.3f}), "
                  f"{nblocks} text blocks respaced to fill {spine_w}px")
 
+    # ⭑ THE BUILDER IS ITS OWN GATE ⭑
+    # Two KDP rejections in a row were for a margin that a separate gate, run
+    # afterwards, was supposed to catch and did not: once because no gate asked
+    # about the panels at all, once because the fix for the foot was not
+    # re-measured at the head. A wrap that breaks the rule is not written.
+    if kind == "hardcover":
+        for name, dest_x, width in (("back", 0, panel_w),
+                                    ("front", panel_w + spine_w, W - panel_w - spine_w)):
+            b = _type_bounds(sheet.crop((dest_x, 0, dest_x + width, H)))
+            if b is None:
+                continue
+            head_in, foot_in = b
+            if min(head_in, foot_in) < PANEL_FOOT_SAFE_IN - 1.5 / DPI:
+                sys.exit(
+                    f"REFUSING TO WRITE {out_pdf}: the {name} panel's type sits "
+                    f"{head_in:.4f} in from the head and {foot_in:.4f} in from the foot; "
+                    f"KDP requires {PANEL_FOOT_SAFE_IN:.3f} in from every outside edge "
+                    f"(notice of 2026-09-16, ISBN 9798174550629). A lift cannot fix a "
+                    f"type block taller than the safe band — the panel has to be scaled.")
+            NOTES.append(f"{kind} {name}: VERIFIED on the composed sheet — type "
+                         f"{head_in:.4f} in from the head, {foot_in:.4f} in from the foot, "
+                         f"against {PANEL_FOOT_SAFE_IN:.3f} in required")
+
     os.makedirs(os.path.dirname(out_pdf), exist_ok=True)
     jpg = f"{ROOT}/03_COVER/_founder-{kind}.jpg"
     # No `dpi=` tag. The sheet really is DPI dots per inch because it really has
```
