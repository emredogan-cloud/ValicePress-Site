const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Is this a canonical UUID? Row ids arrive from the browser on every admin
 * action; one that is not a UUID never reaches SQL (where Postgres would reject
 * it with an error whose text names the column and the value).
 */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}
