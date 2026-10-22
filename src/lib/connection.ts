/**
 * True when fetching megabytes would be rude: the visitor asked to save data,
 * or the connection reports itself as 3G or slower. Deliberately conservative:
 * an unknown connection is treated as fine, because most are.
 *
 * Read by the ambient film (`media/ambient-video.tsx`), which then stays on its
 * poster, and by the spiral library on `/books`, which then shows its list
 * instead of downloading the 3D scene.
 */
export function connectionIsExpensive(): boolean {
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
