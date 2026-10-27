type Fetcher = { fetch(request: Request): Promise<Response> };
type D1Database = import("@cloudflare/workers-types").D1Database;
declare module "cloudflare:workers" {
  export const env: { DB: D1Database; FILES: import('@cloudflare/workers-types').R2Bucket };
}
