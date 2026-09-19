# DaVinci Resolve disk audit — 2026-09-19

**Status: AUDITED AND VERIFIED. Two deletions are staged and blocked pending
Founder approval** — the agent's permission layer refuses `rm` outside the
project directory, which is the correct default for a destructive filesystem
action. Every target below was verified byte-identical to a copy that is being
kept, so the commands are safe to run as written.

---

## The brief's premise was wrong, and this is the important part

The roadmap said:

> Preserve the DaVinci Resolve 21.1 installer/archive used for the completed
> brand film… Remove only genuinely obsolete installations and duplicates,
> especially… obsolete 20.3.3 installation if unused.

The disk says the opposite way round. **The installed Resolve is 20.3.3, and
21.1 is not installed at all.**

```
$ head -1 /opt/resolve/docs/*.txt
You are about to install DaVinci Resolve 20.3.3.
```

So "delete the obsolete 20.3.3 installation" would have deleted **the only
DaVinci Resolve on this machine** — the one the brand film was cut in. It is
kept, and nothing in this audit touches `/opt/resolve`.

---

## What is on disk

| Path | Size | What it is | Verdict |
|---|---:|---|---|
| `/opt/resolve` | 6.5 G | **The installed application, 20.3.3.** The only one. | **KEEP** |
| `~/Downloads/DaVinci_Resolve_20.3.3_Linux.zip` | 3.4 G | The installer for the installed version | **KEEP** — needed to repair or reinstall |
| `~/Downloads/_resolve_install/` | 3.4 G | The same installer, unzipped | **DELETE** — verified identical (below) |
| `…/VALICE_VIDEO/DaVinci_Resolve_21.1_Linux.zip` | 4.1 G | The 21.1 upgrade the roadmap names | **KEEP** — explicitly preserved |
| `…/VALICE_VIDEO/DaVinci_Resolve_21.1_Linux (1).zip` | 4.1 G | A second copy of the same download | **DELETE** — verified identical (below) |
| `~/.local/share/DaVinciResolve/` | 42 M | Settings, Fusion templates, the project database | **KEEP** |
| `~/Documents/BlackmagicDesign/` | 20 K | Application support | **KEEP** |
| `…/VALICE_VIDEO/` (21 numbered stage folders) | — | The active edit: 15_RESOLVE, 17_DELIVER and the rest | **KEEP — never touched** |

---

## The verification, because a size match is not an identity match

**`_resolve_install/DaVinci_Resolve_20.3.3_Linux.run` vs. the copy inside the
retained zip** — the zip's own recorded CRC-32 against a CRC-32 computed over
the extracted file:

```
zip entry CRC-32     : bde28c84    (unzip -v DaVinci_Resolve_20.3.3_Linux.zip)
extracted .run CRC-32: bde28c84    (zlib.crc32 over the whole file)
both lengths         : 3,645,322,464 bytes
```

Identical. The extracted copy can be regenerated at any time with
`unzip DaVinci_Resolve_20.3.3_Linux.zip`.

**The two 21.1 archives** — same length, so compared by content:

```
4997846ff80d9ea57e855970c3ade2c9  DaVinci_Resolve_21.1_Linux.zip
4997846ff80d9ea57e855970c3ade2c9  DaVinci_Resolve_21.1_Linux (1).zip
both lengths: 4,092,807,815 bytes
```

Identical. `(1)` is a browser's second download of the same file.

---

## Disk before

```
/dev/nvme0n1p2  915G  413G used  457G avail  48%
```

## The two commands

```bash
# 1. The unzipped 20.3.3 installer — CRC-identical to the retained zip
rm -rf /home/emre/Downloads/_resolve_install

# 2. The duplicate 21.1 download — MD5-identical to the retained zip
rm -f "/home/emre/Downloads/MY-DİGİTAL-BOOK/VALICE_VIDEO/DaVinci_Resolve_21.1_Linux (1).zip"
```

**Expected reclaim: ≈ 7.5 GB** (3.4 G + 4.1 G), taking the volume from 48 %
to roughly 47 %.

## Disk after

To be filled in by whoever runs the two commands:

```bash
df -h /
```

---

## What was deliberately NOT done

- **`/opt/resolve` was not touched.** See the top of this file. It is 20.3.3,
  it is the only installation, and the brand film was cut in it.
- **No project file, render, cache or preview was touched.** The brand film
  (`17_DELIVER/VALICE_BRAND_FILM_1080p_master.mov`, 1.80 GB) and the World
  Games short are both intact; the site's own web renditions were encoded
  from them earlier in this session and live in `public/video/`.
- **No Resolve database, Fusion template or setting was touched.**
- **Nothing was deleted on a size match alone.** Two files can share a byte
  count and differ; both targets were compared by content.
