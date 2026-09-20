# UES-01 hardcover cover fix — 2026-09-20

The file this patches lives under `MY-DİGİTAL-BOOK/BOOK-SERIES/`, which that
repository gitignores wholesale (`.gitignore:20: BOOK-SERIES/*`). The change is
therefore ON DISK AND UNVERSIONED there, with `covers_founder.py.bak-20260920`
beside it. This copy is the versioned record of exactly what changed and why.

Applies to: `BOOK-SERIES/AJAN-A-BOOK/PHASE-1-SERIES/UES-01/04_BUILD/covers_founder.py`

```diff
--- covers_founder.py (before)"	2026-09-20 14:26:02.450323427 +0300
+++ "/home/emre/Downloads/MY-D\304\260G\304\260TAL-BOOK/BOOK-SERIES/AJAN-A-BOOK/PHASE-1-SERIES/UES-01/04_BUILD/covers_founder.py"	2026-09-20 14:28:11.127392399 +0300
@@ -102,6 +102,42 @@
 # column scale, and then it scales UNIFORMLY so the letterforms keep their
 # shape.
 SPINE_END_SAFE_IN = 0.375
+
+# ⭑ PANEL TYPE KEEPS ITS DISTANCE FROM THE FOOT TOO ⭑
+# ⚠ THIS IS A SECOND KDP REJECTION, and it is the same mistake one level out.
+# KDP, 2026-09-16, ISBN 9798174550629 (this book's HARDCOVER):
+#
+#     "The front cover contains text/graphics that extend beyond the trim line
+#      and may be cut off during production. Please make sure that all elements
+#      intended to be viewable appear at least 0.716in (18.175mm) away from the
+#      outside edges."
+#
+# `build_spine` was taught to keep the SPINE type clear of both ends after the
+# first rejection. The PANELS never were. They are scaled to exactly the sheet
+# height, so the comp's own foot margin — which is almost nothing — is carried
+# through unchanged, and the "Vâliçe Press" imprint burned into the front panel
+# lands too close to the fold.
+#
+# Measured on the built hardcover wrap, 2026-09-20, rendered at 150 dpi:
+#
+#     lowest front-panel type    y = 9.793 in of 10.417  ->  0.624 in clear
+#     KDP requires                                           0.716 in clear
+#     deficit                                                0.092 in
+#
+# The correction is a straight upward LIFT of the panel. The strip it vacates at
+# the foot is filled by repeating the panel's own bottom row, and that strip
+# lies inside the 0.591 in WRAP — the margin this file already describes as one
+# that "folds around the board and is never seen". So nothing visible is
+# invented, the type keeps its size and its position relative to the artwork,
+# and only its distance from the fold changes. The head loses the same amount
+# into the opposite wrap, where the comp carries sky and no lettering.
+#
+# Hardcover only. The paperback wrap has a different scale and a different
+# allowance, it is LIVE on Amazon, and it was not the subject of the rejection.
+PANEL_FOOT_SAFE_IN = 0.716      # what KDP asked for, verbatim
+PANEL_FOOT_MEASURED_IN = 0.624  # what the built wrap gave, measured
+PANEL_LIFT_BUFFER_IN = 0.024    # so a rounding does not put it back on the line
+
 NOTES = []
 
 
@@ -281,6 +317,15 @@
     panel_w = (W - spine_w) // 2
     bleed_px = int(round(outer_in * DPI))
 
+    # How far the panels must rise so the comp's burned-in foot type clears the
+    # edge KDP names. Zero for the paperback, which was not rejected and whose
+    # wrap is a different size.
+    lift_px = 0
+    if kind == "hardcover":
+        deficit_in = (PANEL_FOOT_SAFE_IN - PANEL_FOOT_MEASURED_IN
+                      + PANEL_LIFT_BUFFER_IN)
+        lift_px = max(0, int(round(deficit_in * DPI)))
+
     src = load_wrap()
     sh = src.size[1]
     vscale = H / float(sh)
@@ -299,6 +344,22 @@
         inner = excess - outer
         left = outer if name == "back" else inner
         scaled = scaled.crop((left, 0, left + panel_w, H))
+        if kind == "hardcover" and lift_px:
+            # Lift the panel, then extend its own bottom row down into the wrap.
+            # After the lift, row (H-1-lift_px) of the result IS the panel's
+            # original bottom row, so the fill continues the artwork rather than
+            # inventing an edge.
+            lifted = Image.new("RGB", (panel_w, H), (10, 14, 28))
+            lifted.paste(scaled, (0, -lift_px))
+            foot = scaled.crop((0, H - 1, panel_w, H)).resize(
+                (panel_w, lift_px), Image.NEAREST)
+            lifted.paste(foot, (0, H - lift_px))
+            scaled = lifted
+            NOTES.append(
+                f"{kind} {name}: lifted {lift_px}px ({lift_px / DPI:.3f} in) so the "
+                f"burned-in type clears {PANEL_FOOT_SAFE_IN:.3f} in at the foot; the "
+                f"vacated strip repeats the panel's bottom row and sits inside the "
+                f"{outer_in:.3f} in wrap")
         sheet.paste(scaled, (dest_x, 0))
         NOTES.append(f"{kind} {name}: cropped {excess}px ({excess/DPI:.3f} in) - "
                      f"{outer}px from the outer edge (allowance {outer_in:.3f} in = "
```
