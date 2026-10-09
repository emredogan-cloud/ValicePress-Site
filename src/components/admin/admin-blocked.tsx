import type { AdminBlocked as Blocked } from "@/lib/admin/context";

/** What a visitor sees when the admin area will not open for them: a title, a sentence, nothing more. */
export function AdminBlocked({ ctx }: { ctx: Blocked }) {
  return (
    <section aria-labelledby="admin-blocked-title" className="mx-auto max-w-xl py-16 text-center">
      <p className="text-[12px] font-semibold uppercase tracking-[0.3em] text-emerald-bright">Admin</p>
      <h1 id="admin-blocked-title" className="mt-4 font-serif text-[30px] font-medium text-fg-hi">
        {ctx.title}
      </h1>
      <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-fg-mid">{ctx.body}</p>
      {ctx.missing.length > 0 && (
        <ul className="mx-auto mt-6 max-w-md space-y-1 text-left font-mono text-[13px] text-fg-soft">
          {ctx.missing.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
