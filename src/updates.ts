import {
  Capacitor,
  registerPlugin,
  type PluginListenerHandle,
} from "@capacitor/core";
import { version, androidVersionCode } from "../package.json";
export const APP_ID = "app.zhizhan.local";
export const MAX_APK_BYTES = 128 * 1024 * 1024;
export const MAX_MANIFEST_BYTES = 64 * 1024;
export interface UpdateManifest {
  format: "zhizhan-update";
  schemaVersion: 1;
  appId: string;
  version: string;
  versionCode: number;
  minSdk: number;
  publishedAt: string;
  notes: string[];
  apk: { url: string; bytes: number; sha256: string };
}
export interface AppInfo {
  appId: string;
  version: string;
  versionCode: number;
  sdk: number | null;
}
export function httpsAddress(value: string, base?: string) {
  try {
    if (typeof value !== "string" || !value.trim() || value.length > 2048)
      throw new Error();
    const url = new URL(value.trim(), base);
    if (
      url.protocol !== "https:" ||
      !url.hostname ||
      url.username ||
      url.password ||
      url.hash ||
      url.port === "0"
    )
      throw new Error();
    return url.href;
  } catch {
    throw new Error("请输入有效的 HTTPS 地址，不支持 HTTP、账号密码或片段");
  }
}
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("版本清单格式无效");
  return value as Record<string, unknown>;
};
const integer = (value: unknown, min: number, max: number) => {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  )
    throw new Error("版本清单数值无效");
  return value;
};
export function parseUpdateManifest(
  text: string,
  source: string,
): UpdateManifest {
  if (new TextEncoder().encode(text).length > MAX_MANIFEST_BYTES)
    throw new Error("版本清单超过 64 KiB");
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("服务器没有返回有效的版本清单 JSON");
  }
  const data = object(json),
    apk = object(data.apk);
  if (data.format !== "zhizhan-update" || data.schemaVersion !== 1)
    throw new Error("不支持此版本清单格式");
  if (data.appId !== APP_ID) throw new Error("版本清单属于其他应用");
  if (
    typeof data.version !== "string" ||
    !/^[0-9A-Za-z][0-9A-Za-z.+_-]{0,39}$/.test(data.version)
  )
    throw new Error("版本名称无效");
  if (
    typeof data.publishedAt !== "string" ||
    data.publishedAt.length > 40 ||
    !Number.isFinite(Date.parse(data.publishedAt))
  )
    throw new Error("发布时间无效");
  if (
    !Array.isArray(data.notes) ||
    data.notes.length > 20 ||
    data.notes.some((n) => typeof n !== "string" || !n.trim() || n.length > 500)
  )
    throw new Error("更新说明无效或过长");
  if (typeof apk.sha256 !== "string" || !/^[a-fA-F0-9]{64}$/.test(apk.sha256))
    throw new Error("缺少有效的安装包 SHA-256");
  if (typeof apk.url !== "string") throw new Error("缺少安装包地址");
  return {
    format: "zhizhan-update",
    schemaVersion: 1,
    appId: APP_ID,
    version: data.version,
    versionCode: integer(data.versionCode, 1, 2147483647),
    minSdk: integer(data.minSdk, 26, 1000),
    publishedAt: data.publishedAt,
    notes: data.notes as string[],
    apk: {
      url: httpsAddress(apk.url, httpsAddress(source)),
      bytes: integer(apk.bytes, 1, MAX_APK_BYTES),
      sha256: apk.sha256.toLowerCase(),
    },
  };
}
export function updateDecision(manifest: UpdateManifest, info: AppInfo) {
  if (manifest.appId !== info.appId)
    throw new Error("版本清单与当前应用不匹配");
  if (manifest.versionCode <= info.versionCode) return "current" as const;
  if (info.sdk !== null && manifest.minSdk > info.sdk)
    return "incompatible" as const;
  return "available" as const;
}
export function automaticCheckDue(
  last: unknown,
  url: string,
  now = Date.now(),
) {
  if (!last || typeof last !== "object") return true;
  const previous = last as { url?: string; time?: number; failed?: boolean };
  return (
    previous.url !== url ||
    typeof previous.time !== "number" ||
    !Number.isFinite(previous.time) ||
    now < previous.time ||
    now - previous.time >= (previous.failed ? 300000 : 86400000)
  );
}

interface UpdatesPlugin {
  getService(): Promise<{ url: string; managed: boolean }>;
  getInfo(): Promise<AppInfo>;
  check(options: {
    url: string;
    operationId: string;
  }): Promise<{ text: string; url: string }>;
  download(options: {
    manifest: UpdateManifest;
    operationId: string;
  }): Promise<{ verified: boolean }>;
  install(options: {
    operationId: string;
  }): Promise<{ needsPermission?: boolean; launched?: boolean }>;
  cancel(options: { operationId: string }): Promise<void>;
  addListener(
    event: "updateProgress",
    callback: (event: {
      operationId: string;
      received: number;
      total: number;
    }) => void,
  ): Promise<PluginListenerHandle>;
}
const NativeUpdates = registerPlugin<UpdatesPlugin>("Updates");
export async function configuredService() {
  if (Capacitor.getPlatform() === "android") {
    const service = await NativeUpdates.getService();
    return {
      url: service.url ? httpsAddress(service.url) : "",
      managed: service.managed,
    };
  }
  return { url: "", managed: false };
}
export interface UpdateBackend {
  canInstall: boolean;
  getInfo(): Promise<AppInfo>;
  check(url: string, id: string): Promise<{ text: string; url: string }>;
  download(
    manifest: UpdateManifest,
    id: string,
    progress: (received: number) => void,
  ): Promise<{ verified: boolean }>;
  install(
    id: string,
  ): Promise<{ needsPermission?: boolean; launched?: boolean }>;
  cancel(id: string): Promise<void>;
}
export function updateBackend(): UpdateBackend {
  const pendingDownloads = new Map<string, { cancelled: boolean }>();
  if (Capacitor.getPlatform() === "android")
    return {
      canInstall: true,
      getInfo: () => NativeUpdates.getInfo(),
      check: (url, operationId) => NativeUpdates.check({ url, operationId }),
      async download(manifest, operationId, progress) {
        const pending = { cancelled: false };
        pendingDownloads.set(operationId, pending);
        let listener: PluginListenerHandle | undefined;
        try {
          listener = await NativeUpdates.addListener("updateProgress", (e) => {
            if (e.operationId === operationId) progress(e.received);
          });
          if (pending.cancelled) throw new Error("更新已取消");
          return await NativeUpdates.download({ manifest, operationId });
        } finally {
          pendingDownloads.delete(operationId);
          await listener?.remove();
        }
      },
      install: (operationId) => NativeUpdates.install({ operationId }),
      cancel: async (operationId) => {
        const pending = pendingDownloads.get(operationId);
        if (pending) pending.cancelled = true;
        await NativeUpdates.cancel({ operationId });
      },
    };
  const requests = new Map<string, AbortController>();
  return {
    canInstall: false,
    getInfo: async () => ({
      appId: APP_ID,
      version,
      versionCode: androidVersionCode,
      sdk: null,
    }),
    async check(url, id) {
      const controller = new AbortController();
      requests.set(id, controller);
      const timeout = setTimeout(() => controller.abort(), 45000);
      try {
        const response = await fetch(httpsAddress(url), {
          signal: controller.signal,
          cache: "no-store",
          credentials: "omit",
          referrerPolicy: "no-referrer",
        });
        if (!response.ok)
          throw new Error(`更新服务器返回 HTTP ${response.status}`);
        const finalUrl = httpsAddress(response.url || url);
        if (Number(response.headers.get("content-length")) > MAX_MANIFEST_BYTES)
          throw new Error("版本清单超过 64 KiB");
        if (!response.body) throw new Error("版本清单为空");
        const reader = response.body.getReader(),
          chunks: Uint8Array[] = [];
        let size = 0;
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.length;
            if (size > MAX_MANIFEST_BYTES)
              throw new Error("版本清单超过 64 KiB");
            chunks.push(value);
          }
        } finally {
          await reader.cancel().catch(() => {});
          reader.releaseLock();
        }
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.length;
        }
        return {
          text: new TextDecoder("utf-8", { fatal: true }).decode(bytes),
          url: finalUrl,
        };
      } catch (e) {
        if (e instanceof TypeError)
          throw new Error(
            "无法连接更新地址。请检查网络；电脑浏览器还需要服务器允许跨域访问",
          );
        if (controller.signal.aborted)
          throw new Error("检查已取消或超时，请重试");
        throw e;
      } finally {
        clearTimeout(timeout);
        requests.delete(id);
      }
    },
    download: async () => {
      throw new Error("请在 Android 版知栈中下载安装更新");
    },
    install: async () => {
      throw new Error("请在 Android 版知栈中安装更新");
    },
    cancel: async (id) => {
      requests.get(id)?.abort();
    },
  };
}
