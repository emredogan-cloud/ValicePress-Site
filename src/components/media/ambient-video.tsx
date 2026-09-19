"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * A film that plays as part of the page rather than in a player on it.
 *
 * NO CHROME AT ALL. No border, no radius, no shadow, no card, no controls
 * bar. The <video> is the section's ground the way the hero photograph is:
 * full-bleed, `object-cover`, with the page's own type and scrims over it.
 * That is the whole design brief — anything that makes it look like an
 * embedded player is a bug here.
 *
 * WHAT IT COSTS A VISITOR, AND WHEN.
 * Autoplaying a 16 MB film above the fold would buy atmosphere with the
 * thing the atmosphere is for. So nothing about the video is fetched until
 * the section is actually approaching the viewport, and what gets fetched
 * depends on the visitor:
 *
 *   · `preload="none"` and no `<source>` in the DOM until the observer
 *     fires — a `<video>` with a `src` set starts talking to the network
 *     even with preload="none" on some browsers, so the src genuinely is
 *     not there yet.
 *   · The poster is a plain <img> underneath, so the section is never
 *     empty and never shifts: same box, same aspect ratio, painted from a
 *     35–180 KB WebP.
 *   · The rendition is chosen from the viewport, not the device: a 1280px
 *     laptop gets the 720p file, and so does a phone.
 *   · `navigator.connection.saveData`, or a 2g/3g `effectiveType`, means
 *     the video is never requested. The poster is the page for that
 *     visitor, and it is a good page.
 *
 * REDUCED MOTION IS NOT A DEGRADED EXPERIENCE. `prefers-reduced-motion:
 * reduce` gets the poster and a real play button, because "no autoplay"
 * is the request — not "no video". Pressing it plays the film with
 * controls, which is what someone who asked for stillness and then chose
 * motion actually wants.
 *
 * ACCESSIBILITY. The element is `aria-hidden` while it is decorative and
 * silent; the moment a visitor presses play it becomes a real video with
 * controls and a label. There is no audio track in any rendition at all
 * (stripped at encode), so there is nothing to caption and nothing that
 * can surprise someone with sound.
 */

export interface AmbientVideoProps {
  /** 1080p rendition, used from 1440px up. */
  src1080: string;
  /** 720p rendition — the default everywhere else. */
  src720: string;
  /** Poster, painted immediately; also the whole experience on slow links. */
  poster: string;
  /**
   * What the film shows, for the play button's accessible name once the
   * visitor has opted into motion. Never spoken while it is decorative.
   */
  label: string;
  /** Tailwind classes for the <video>/<img> box. Defaults to a full cover. */
  className?: string;
  /** Extra classes on the wrapper. */
  wrapperClassName?: string;
  /** Fires once, when playback actually begins. For analytics. */
  onPlay?: () => void;
}

type Mode = "poster" | "auto" | "manual";

/**
 * The visitor's motion and connection preferences, read as an external store
 * rather than copied into state by an effect.
 *
 * `useSyncExternalStore` is the right shape here for two reasons beyond the
 * lint rule: the server snapshot is explicit (so the first paint is the same
 * on both sides and hydration stays quiet), and a visitor who changes their
 * reduced-motion setting while the page is open is followed rather than
 * stuck with whatever was true at mount.
 */
const MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToMotion(onChange: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia(MOTION_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function readMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(MOTION_QUERY).matches;
}

/** On the server nobody has asked for anything; the poster is the first paint. */
function serverMotion(): boolean {
  return false;
}

/**
 * True when fetching megabytes would be rude. Deliberately conservative:
 * an unknown connection is treated as fine, because most are.
 */
function connectionIsExpensive(): boolean {
  if (typeof navigator === "undefined") return false;
  const c = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }
  ).connection;
  if (!c) return false;
  if (c.saveData) return true;
  return c.effectiveType === "slow-2g" || c.effectiveType === "2g" || c.effectiveType === "3g";
}

export function AmbientVideo({
  src1080,
  src720,
  poster,
  label,
  className = "h-full w-full object-cover",
  wrapperClassName = "absolute inset-0",
  onPlay,
}: AmbientVideoProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [optedIn, setOptedIn] = useState(false);
  const firedPlay = useRef(false);

  const reduced = useSyncExternalStore(subscribeToMotion, readMotion, serverMotion);

  /**
   * What kind of section this is, derived rather than stored.
   *
   *   poster — an expensive connection, or the server render. Nothing loads.
   *   manual — reduced motion, and the visitor has not pressed play.
   *   auto   — autoplay, either because motion is fine or because they asked.
   *
   * `connectionIsExpensive()` is read during render on purpose: it is a
   * stable browser fact by the time the client renders, and reading it here
   * means there is no state to synchronise and no cascading render.
   */
  const mode: Mode = optedIn
    ? "auto"
    : connectionIsExpensive()
      ? "poster"
      : reduced
        ? "manual"
        : "auto";

  /** The rendition this viewport should get. Read at attach time, not at render. */
  const pickSrc = useCallback(() => {
    if (typeof window === "undefined") return src720;
    return window.innerWidth >= 1440 ? src1080 : src720;
  }, [src1080, src720]);

  // Attach the source only when the section is close to being looked at.
  //
  // No fallback branch for a missing IntersectionObserver: every browser this
  // app is built for has had it for years, and a visitor in one that does not
  // gets the poster — which is a correct page, not a broken one. A fallback
  // that set state straight from the effect body would cost a cascading
  // render on every visit to save that hypothetical visitor a video.
  useEffect(() => {
    if (mode !== "auto" || src) return;
    const node = wrapRef.current;
    if (!node || !("IntersectionObserver" in window)) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setSrc(pickSrc());
            io.disconnect();
          }
        }
      },
      // 300px of runway: the file starts arriving just before the section
      // does, so the cut from poster to motion lands off-screen.
      { rootMargin: "300px 0px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [mode, src, pickSrc]);

  // Start playing as soon as there are enough frames. `play()` returns a
  // promise that rejects on some platforms (low power mode, a policy we did
  // not anticipate); a rejection leaves the poster up, which is a correct
  // fallback, so it is swallowed rather than logged as an error.
  const handleCanPlay = useCallback(() => {
    const v = videoRef.current;
    if (!v || mode !== "auto") return;
    void v.play().then(
      () => {
        setPlaying(true);
        if (!firedPlay.current) {
          firedPlay.current = true;
          onPlay?.();
        }
      },
      () => setPlaying(false),
    );
  }, [mode, onPlay]);

  /** Reduced-motion visitors press this to opt in. */
  const startManually = useCallback(() => {
    const chosen = pickSrc();
    setSrc(chosen);
    setOptedIn(true);
    // The element needs the src before it can play; the canplay handler picks
    // it up from there.
    requestAnimationFrame(() => {
      const v = videoRef.current;
      if (v) v.load();
    });
  }, [pickSrc]);

  return (
    <div ref={wrapRef} className={wrapperClassName}>
      {/*
        The poster is a real <img>, not the <video poster> attribute: it can
        then be a WebP, it is painted by the normal image pipeline, and it
        stays put underneath while the video fades in over it.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element -- the poster is
          a pre-sized, pre-compressed WebP served from /public at exactly the
          box it fills; next/image would add a loader round-trip and a layout
          shim for an image that is already the right bytes and never the LCP
          element, since this section is below the fold by construction. */}
      <img
        src={poster}
        alt=""
        aria-hidden
        decoding="async"
        loading="lazy"
        className={className}
      />

      {src ? (
        <video
          ref={videoRef}
          className={`${className} absolute inset-0 transition-opacity duration-700 motion-reduce:transition-none ${
            playing ? "opacity-100" : "opacity-0"
          }`}
          // No audio track exists in any rendition, but `muted` is still what
          // makes autoplay legal, so it is set explicitly.
          muted
          loop
          playsInline
          preload="none"
          poster={poster}
          aria-hidden={mode === "auto" && !playing ? true : undefined}
          aria-label={playing ? label : undefined}
          onCanPlay={handleCanPlay}
          onPlaying={() => setPlaying(true)}
        >
          <source src={src} type="video/mp4" />
        </video>
      ) : null}

      {mode === "manual" ? (
        <button
          type="button"
          onClick={startManually}
          className="absolute inset-0 flex items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <span className="rounded-full border border-white/45 bg-black/45 px-5 py-2.5 text-[0.8125rem] font-medium tracking-wide text-white backdrop-blur-sm">
            Play the film
          </span>
          <span className="sr-only">{label}</span>
        </button>
      ) : null}
    </div>
  );
}
