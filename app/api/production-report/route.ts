import { env } from "cloudflare:workers";
import { siteApi } from "../../../worker/site-api.mjs";

export async function POST(request: Request) {
  return siteApi(request, env);
}
