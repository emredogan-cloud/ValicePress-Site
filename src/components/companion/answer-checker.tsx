"use client";

/**
 * The answer checker for /companion/codex-puzzles.
 *
 * WHY IT IS DIGESTS AND NOT ANSWERS
 * Every answer in this book is printed in the book. So there is no secret to
 * keep and no reason for a server round-trip, a rate limiter or a peppered
 * hash — the Codex Enigmatica verifier needs all three because it withholds one
 * answer deliberately, and this page withholds nothing.
 *
 * What it does have to avoid is being a page that, opened by somebody halfway
 * through the book, shows them a hundred answers. So the manifest it fetches
 * carries a truncated SHA-256 of each normalised answer rather than the answer,
 * the reader's guess is hashed in their own browser, and the two are compared.
 * That is not security. It is tact, and it is the right amount of engineering
 * for the problem.
 *
 * NORMALISATION has to match `BUILD/build_companion.py` exactly, or a right
 * answer reads as wrong: lower-case, accents stripped, everything but a–z0–9
 * removed. The salt is the same string on both sides.
 */

import { useEffect, useMemo, useState } from "react";

type Entry = {
  title: string;
  family: string;
  tier: string;
  shape: string;
  digests: string[];
  checkable: boolean;
};

type Manifest = {
  salt: string;
  puzzles: Record<string, Entry>;
};

const MANIFEST_URL = "/companion/codex-puzzles/answers.json";

/** Must match `normalise()` in BUILD/build_companion.py. */
function normalise(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

async function digest(salt: string, text: string): Promise<string> {
  const bytes = new TextEncoder().encode(salt + normalise(text));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

type Verdict =
  | { kind: "idle" }
  | { kind: "unknown-number" }
  | { kind: "not-checkable"; entry: Entry }
  | { kind: "empty" }
  | { kind: "match"; entry: Entry }
  | { kind: "no-match"; entry: Entry };

export function AnswerChecker() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [failed, setFailed] = useState(false);
  const [number, setNumber] = useState("");
  const [guess, setGuess] = useState("");
  const [verdict, setVerdict] = useState<Verdict>({ kind: "idle" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    fetch(MANIFEST_URL)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("http"))))
      .then((m: Manifest) => live && setManifest(m))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  const entry = useMemo(
    () => (manifest ? manifest.puzzles[number.trim()] : undefined),
    [manifest, number],
  );

  async function check(e: React.FormEvent) {
    e.preventDefault();
    if (!manifest) return;
    const n = number.trim();
    const found = manifest.puzzles[n];
    if (!found) {
      setVerdict({ kind: "unknown-number" });
      return;
    }
    if (!found.checkable) {
      setVerdict({ kind: "not-checkable", entry: found });
      return;
    }
    if (!guess.trim()) {
      setVerdict({ kind: "empty" });
      return;
    }
    setBusy(true);
    try {
      const d = await digest(manifest.salt, guess);
      setVerdict(
        found.digests.includes(d)
          ? { kind: "match", entry: found }
          : { kind: "no-match", entry: found },
      );
    } finally {
      setBusy(false);
    }
  }

  if (failed) {
    return (
      <p className="text-sm text-fg-mid">
        The checker could not load its answer list. Every answer is printed at
        the back of the book, and the filled grids are in the download above.
      </p>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
      <form onSubmit={check} className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[12px] uppercase tracking-wider text-fg-low lg:text-[11px]">
            Puzzle
          </span>
          <input
            inputMode="numeric"
            value={number}
            onChange={(e) => {
              setNumber(e.target.value);
              setVerdict({ kind: "idle" });
            }}
            placeholder="47"
            className="w-24 rounded-lg border border-white/12 bg-black/20 px-3 py-2 text-fg-hi outline-none focus:border-emerald-bright"
          />
        </label>
        <label className="flex min-w-[16rem] flex-1 flex-col gap-1">
          <span className="font-mono text-[12px] uppercase tracking-wider text-fg-low lg:text-[11px]">
            Your answer
          </span>
          <input
            value={guess}
            onChange={(e) => {
              setGuess(e.target.value);
              setVerdict({ kind: "idle" });
            }}
            placeholder={entry?.shape ?? "type it however you like"}
            className="rounded-lg border border-white/12 bg-black/20 px-3 py-2 text-fg-hi outline-none focus:border-emerald-bright"
          />
        </label>
        <button
          type="submit"
          disabled={busy || !manifest}
          className="rounded-lg border border-emerald-bright/40 px-4 py-2 text-sm text-emerald-bright hover:bg-emerald-bright/10 disabled:opacity-50"
        >
          {busy ? "Checking…" : "Check"}
        </button>
      </form>

      {entry && verdict.kind === "idle" && (
        <p className="mt-3 text-sm text-fg-mid">
          <span className="text-fg-hi">{entry.title}</span> — tier {entry.tier}.
          It wants {entry.shape}. Spelling, capitals, spaces and punctuation are
          all ignored.
        </p>
      )}

      {verdict.kind === "unknown-number" && (
        <p className="mt-3 text-sm text-fg-mid">
          There is no puzzle with that number. The book has 1 to 100; this page
          adds 101 to 110.
        </p>
      )}
      {verdict.kind === "empty" && (
        <p className="mt-3 text-sm text-fg-mid">Type an answer to check.</p>
      )}
      {verdict.kind === "not-checkable" && (
        <p className="mt-3 text-sm text-fg-mid">
          {verdict.entry.title} is a grid, and a grid is not something to type.
          Compare it against <em>The filled grids</em> above.
        </p>
      )}
      {verdict.kind === "match" && (
        <p className="mt-3 text-sm text-emerald-bright">
          That is it. {verdict.entry.title} — solved.
        </p>
      )}
      {verdict.kind === "no-match" && (
        <p className="mt-3 text-sm text-fg-mid">
          Not that one. {verdict.entry.title} wants {verdict.entry.shape} — and
          if you are stuck, the hint cards above have three for every puzzle.
        </p>
      )}

      <p className="mt-4 text-xs leading-relaxed text-fg-low">
        Your answer is checked in your own browser and is not sent anywhere.
        This page holds a fingerprint of each answer rather than the answer, so
        that opening it does not spoil a hundred puzzles for you.
      </p>
    </div>
  );
}
