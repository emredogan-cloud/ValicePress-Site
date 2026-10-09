import type { ReactNode } from "react";

import type { Stat } from "@/lib/admin/stat";

/**
 * One dashboard figure, in whichever of three states it is really in.
 *
 *   ok           the number, big;
 *   unavailable  no source (or no table yet) — says so, in the reason's words;
 *   error        there is a source and it could not be read — says THAT.
 *
 * The three look different on purpose, and each carries `data-state`, because
 * the failure this exists to prevent is a dashboard in which "could not read
 * it" and "nothing happened" are the same grey zero.
 */
export function StatCard<T>({
  label,
  stat,
  value,
  sub,
  accent = false,
  hint,
}: {
  label: string;
  stat: Stat<T>;
  /** How to print the figure when it was read. */
  value: (v: T) => ReactNode;
  /** A line under it, when it was read. */
  sub?: (v: T) => ReactNode;
  accent?: boolean;
  /** Always shown: what this figure does and does not count. */
  hint?: ReactNode;
}) {
  return (
    <div
      data-stat={label}
      data-state={stat.state}
      className={`rounded-2xl border p-5 ${
        stat.state === "error"
          ? "border-[#ff7a7a]/30 bg-[#ff7a7a]/[0.05]"
          : accent && stat.state === "ok"
            ? "border-emerald-bright/30 bg-emerald-bright/[0.06]"
            : "border-white/[0.06] bg-white/[0.02]"
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-soft">{label}</p>
      {stat.state === "ok" ? (
        <>
          <p className={`mt-2 font-serif text-[30px] leading-tight tabular-nums ${accent ? "text-emerald-bright" : "text-fg-hi"}`}>{value(stat.value)}</p>
          {sub && <p className="mt-1 text-[12px] text-fg-mid">{sub(stat.value)}</p>}
        </>
      ) : stat.state === "unavailable" ? (
        <>
          <p className="mt-2 font-serif text-[22px] leading-tight text-fg-soft">Unavailable</p>
          <p className="mt-1 text-[12px] leading-snug text-fg-soft">{stat.reason}</p>
        </>
      ) : (
        <>
          <p role="alert" className="mt-2 font-serif text-[22px] leading-tight text-[#ff9b9b]">
            Couldn’t load
          </p>
          <p className="mt-1 text-[12px] leading-snug text-[#ff9b9b]/80">{stat.message}</p>
        </>
      )}
      {hint && <p className="mt-3 text-[11.5px] leading-snug text-fg-fade">{hint}</p>}
    </div>
  );
}

/** A section heading with the same rhythm everywhere in the admin area. */
export function AdminSection({ id, title, note, children }: { id: string; title: string; note?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-12 first:mt-0">
      <h2 id={id} className="font-serif text-[24px] font-medium text-fg-hi">
        {title}
      </h2>
      {note && <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-fg-soft">{note}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

/** The page's own title block. */
export function AdminPageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header>
      <h1 className="font-serif text-[34px] font-medium tracking-[-0.02em] text-fg-hi">{title}</h1>
      {children && <div className="mt-3 max-w-3xl text-[14px] leading-relaxed text-fg-mid">{children}</div>}
    </header>
  );
}
