import {environmentRefresh,refreshGuard} from './environment-refresh.mjs';
/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import {siteApi} from './site-api.mjs';
import {fullBackupApi} from './full-backup.mjs';
import {sourceSyncApi} from './source-sync.mjs';
import sourceSnapshot from 'virtual:onspa-source-snapshot';

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  FILES: import('@cloudflare/workers-types').R2Bucket;
  SETUP_ADMIN_AUTO_LOGIN?: string;
  SETUP_ADMIN_ACTIVATION_TOKEN?: string;
  SETUP_ADMIN_COOKIE_SECRET?: string;
  SETUP_ADMIN_EXPIRES_AT?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const refreshResponse=await environmentRefresh(request,env);if(refreshResponse)return refreshResponse;
    const refreshBusy=await refreshGuard(request,env);if(refreshBusy)return refreshBusy;
    const backupResponse=await fullBackupApi(request,env,sourceSnapshot);
    if(backupResponse)return backupResponse;
    const sourceResponse=await sourceSyncApi(request,env,sourceSnapshot);
    if(sourceResponse)return sourceResponse;
    const api = await siteApi(request, env);
    if(api)return api;

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
