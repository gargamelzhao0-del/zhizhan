import type { CapacitorConfig } from "@capacitor/cli";
const config: CapacitorConfig = {
  appId: "app.zhizhan.local",
  appName: "知栈",
  webDir: "dist",
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
    minWebViewVersion: 109,
  },
  server: { androidScheme: "https" },
};
export default config;
