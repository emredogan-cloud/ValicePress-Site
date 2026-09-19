#!/usr/bin/env bash
# Re-encode a delivered film for the web, from the DELIVER master.
#
# The masters live outside this repo (VALICE_VIDEO/…/DELIVER) and stay there:
# the brand film's ProRes master is 1.8 GB and the web MP4 it ships beside is
# 75 MB at 7 Mbps, which is a fine deliverable and a terrible autoplay loop.
# What the site serves is produced here and nowhere else.
#
# Two renditions, no audio at all. The films play muted and looping, so the
# audio track is 100% waste — stripping it also removes any chance of a
# browser surprising somebody with sound.
#
#   1080p  crf 32, capped at 1.5 Mbps — served from a 1440px viewport up
#    720p  crf 31, capped at 1.1 Mbps — the default everywhere else
#
# Usage: scripts/commerce/encode-video.sh <source.mp4> <out-basename>
set -euo pipefail
SRC="${1:?source file}"
OUT="${2:?output basename, e.g. public/video/valice-brand-film}"

ffmpeg -y -v error -i "$SRC" -an -c:v libx264 -preset veryslow -crf 32 \
  -maxrate 1500k -bufsize 3000k -pix_fmt yuv420p -movflags +faststart \
  -vf "scale=1920:1080" "${OUT}-1080.mp4"

ffmpeg -y -v error -i "$SRC" -an -c:v libx264 -preset slow -crf 31 \
  -maxrate 1100k -bufsize 2200k -pix_fmt yuv420p -movflags +faststart \
  -vf "scale=1280:720" "${OUT}-720.mp4"

ls -la "${OUT}-1080.mp4" "${OUT}-720.mp4"
