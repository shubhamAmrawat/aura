/**
 * Tells scripts which database a connection string points at, so nothing writes to
 * production by accident. The production Supabase project ref appears in the user name
 * (pooler: postgres.<ref>) or the host (direct: db.<ref>.supabase.co).
 */
export const PROD_PROJECT_REF = "yeywyjczcifrajhwnphp";

export function isProduction(url: string): boolean {
  return url.includes(PROD_PROJECT_REF);
}

/** "production (yeywy…)" / "dev (abcd…)" plus the host — never the password. */
export function describe(url: string): string {
  const at = url.lastIndexOf("@");
  const host = url.slice(at + 1).split("/")[0];
  const user = url.slice(url.indexOf("//") + 2).split(":")[0];
  const ref = user.split(".")[1] ?? host.split(".")[1] ?? "?";
  return `${isProduction(url) ? "PRODUCTION" : "dev"} database (${ref}) at ${host}`;
}
