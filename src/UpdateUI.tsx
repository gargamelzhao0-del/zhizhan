import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { App as NativeApp } from "@capacitor/app";
import { Download, RefreshCw, Settings2, X } from "lucide-react";
import { db } from "./db";
import { native } from "./platform";
import {
  automaticCheckDue,
  configuredService,
  httpsAddress,
  updateBackend,
} from "./updates";
import { UpdateController, type UpdateState } from "./updateController";
import { version } from "../package.json";

interface UpdateContextValue {
  controller: UpdateController;
  state: UpdateState;
  url: string;
  auto: boolean;
  check: (automatic?: boolean) => Promise<void>;
  configure: (url: string) => Promise<void>;
  setAuto: (enabled: boolean) => Promise<void>;
  ignore: () => Promise<void>;
  dismissed: boolean;
  dismiss: () => void;
  lastAttempt?: number;
  managed: boolean;
}
const UpdateContext = createContext<UpdateContextValue | null>(null);
function useUpdates() {
  const context = useContext(UpdateContext);
  if (!context) throw new Error("更新组件尚未初始化");
  return context;
}
export function UpdateProvider({ children }: { children: ReactNode }) {
  const controller = useMemo(() => new UpdateController(updateBackend()), []);
  const [service, setService] = useState<{
    url: string;
    managed: boolean;
  } | null>(null);
  useEffect(() => {
    let alive = true;
    void configuredService()
      .then((value) => {
        if (alive) setService(value);
      })
      .catch(() => {
        if (alive) setService({ url: "", managed: false });
      });
    return () => {
      alive = false;
    };
  }, []);
  const [state, setState] = useState(controller.state),
    [dismissed, setDismissed] = useState(false);
  const preferences = useLiveQuery(async () => {
    const settings = new Map(
      (await db.settings.toArray()).map((s) => [s.key, s.value]),
    );
    return {
      url:
        typeof settings.get("appUpdateUrl") === "string"
          ? String(settings.get("appUpdateUrl"))
          : "",
      auto: settings.get("appUpdateAuto") !== false,
      ignored: settings.get("appUpdateIgnored") as
        { url: string; code: number } | undefined,
      last: settings.get("appUpdateLastAttempt") as
        { url: string; time: number } | undefined,
    };
  }, []);
  const url = native ? service?.url || "" : preferences?.url || "",
    auto = preferences?.auto ?? true;
  useEffect(() => controller.subscribe(setState), [controller]);
  useEffect(
    () => () => {
      void controller.cancel();
    },
    [controller],
  );
  useEffect(() => {
    if (!controller.state.sourceUrl || controller.state.sourceUrl === url) {
      setDismissed(false);
      return;
    }
    let current = true;
    void controller.cancel().then(() => {
      if (current) controller.reset();
    });
    setDismissed(false);
    return () => {
      current = false;
    };
  }, [controller, url]);
  const check = useCallback(
    async (automatic = false) => {
      if (!url || controller.busy) return;
      try {
        const allowed = await db.transaction("rw", db.settings, async () => {
          if (!native && (await db.settings.get("appUpdateUrl"))?.value !== url)
            return false;
          const last = (await db.settings.get("appUpdateLastAttempt"))?.value;
          if (
            automatic &&
            ((await db.settings.get("appUpdateAuto"))?.value === false ||
              !automaticCheckDue(last, url))
          )
            return false;
          await db.settings.put({
            key: "appUpdateLastAttempt",
            value: { url, time: Date.now() },
          });
          return true;
        });
        if (!allowed) return;
        setDismissed(false);
        await controller.check(url);
        await db.settings.put({
          key: "appUpdateLastAttempt",
          value: {
            url,
            time: Date.now(),
            failed: !["current", "available", "incompatible"].includes(
              controller.state.phase,
            ),
          },
        });
        if (
          automatic &&
          controller.state.manifest &&
          preferences?.ignored?.url === url &&
          preferences.ignored.code === controller.state.manifest.versionCode
        )
          setDismissed(true);
      } catch {
        if (!automatic)
          controller.reportError(
            "无法保存更新检查状态，请重试；本地资料仍可使用",
          );
      }
    },
    [controller, url, preferences?.ignored?.url, preferences?.ignored?.code],
  );
  useEffect(() => {
    if (!preferences || !url || !auto) return;
    const maybeCheck = () => {
      if (document.visibilityState === "visible") void check(true);
    };
    const timer = setTimeout(maybeCheck, 3000);
    document.addEventListener("visibilitychange", maybeCheck);
    window.addEventListener("online", maybeCheck);
    const listener = native
      ? NativeApp.addListener("appStateChange", (e) => {
          if (e.isActive) maybeCheck();
        })
      : undefined;
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", maybeCheck);
      window.removeEventListener("online", maybeCheck);
      void listener?.then((l) => l.remove());
    };
  }, [!!preferences, url, auto, check]);
  const value: UpdateContextValue = {
    controller,
    state,
    url,
    auto,
    managed: !!service?.managed,
    dismissed,
    check,
    dismiss: () => setDismissed(true),
    lastAttempt:
      preferences?.last?.url === url ? preferences.last.time : undefined,
    configure: async (input) => {
      if (controller.busy) throw new Error("请先结束当前更新任务");
      const address = input.trim() ? httpsAddress(input) : "";
      await db.transaction("rw", db.settings, async () => {
        await db.settings.put({ key: "appUpdateUrl", value: address });
        await db.settings.delete("appUpdateLastAttempt");
        await db.settings.delete("appUpdateIgnored");
      });
      controller.reset();
      setDismissed(false);
    },
    setAuto: async (enabled) => {
      await db.settings.put({ key: "appUpdateAuto", value: enabled });
    },
    ignore: async () => {
      if (state.manifest)
        await db.settings.put({
          key: "appUpdateIgnored",
          value: { url, code: state.manifest.versionCode },
        });
      setDismissed(true);
    },
  };
  return (
    <UpdateContext.Provider value={value}>{children}</UpdateContext.Provider>
  );
}

export function UpdateNotice() {
  const update = useUpdates();
  if (
    update.dismissed ||
    update.state.phase !== "available" ||
    !update.state.manifest ||
    update.state.sourceUrl !== update.url
  )
    return null;
  return (
    <div className="update-notice" role="status">
      <span>知栈 {update.state.manifest.version} 已发布</span>
      <a href="#settings">查看更新</a>
      <button
        className="icon-button"
        aria-label="稍后查看更新"
        onClick={update.dismiss}
      >
        <X size={16} />
      </button>
    </div>
  );
}

export function UpdateSettings() {
  const update = useUpdates(),
    { state, controller } = update;
  const [draft, setDraft] = useState(update.url),
    [feedback, setFeedback] = useState("");
  const [autoDraft, setAutoDraft] = useState(update.auto),
    [savingAuto, setSavingAuto] = useState(false);
  useEffect(() => {
    setAutoDraft(update.auto);
  }, [update.auto]);
  const saveAuto = async (enabled: boolean) => {
    setAutoDraft(enabled);
    setSavingAuto(true);
    try {
      await update.setAuto(enabled);
    } catch {
      setAutoDraft(update.auto);
      setFeedback("偏好保存失败，请重试");
    } finally {
      setSavingAuto(false);
    }
  };
  useEffect(() => {
    setDraft(update.url);
  }, [update.url]);
  const busy = ["checking", "downloading", "cancelling", "installing"].includes(
    state.phase,
  );
  const candidate =
    state.manifest && !["current", "incompatible"].includes(state.phase);
  const progress = state.manifest
    ? Math.floor((state.received / state.manifest.apk.bytes) * 100)
    : 0;
  return (
    <section
      id="software-update"
      className="settings-card update-settings"
      aria-label="软件更新"
    >
      <h2>
        <RefreshCw size={21} />
        软件更新
      </h2>
      <p>
        当前版本 {version}
        。检查和下载仅获取发布文件，你的文章、笔记和附件仍保存在本机。
      </p>
      <div className="setting-row">
        <div>
          <strong>自动检查新版本</strong>
          <small>打开或回到应用时检查；成功后每天一次，连接失败稍后重试</small>
        </div>
        <label className="update-toggle">
          <input
            className="update-checkbox"
            type="checkbox"
            aria-label="自动检查新版本"
            checked={autoDraft}
            disabled={savingAuto}
            onChange={(e) => void saveAuto(e.target.checked)}
          />
          <span className="toggle-track" aria-hidden="true" />
        </label>
      </div>
      {native ? (
        <p className="managed-service">
          {update.managed
            ? "更新服务已内置，无需配置。个人资料保存在本机。"
            : "此安装包尚未接入更新服务，请等待发布者提供已接入的版本。阅读与编辑可正常使用。"}
        </p>
      ) : (
        <details className="update-source" open={!update.url}>
          <summary>
            <Settings2 size={16} />
            更新发布地址
          </summary>
          <label htmlFor="update-url">版本清单 HTTPS 地址</label>
          <input
            id="update-url"
            type="url"
            inputMode="url"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={2048}
            placeholder="https://你的发布站点/latest.json"
            value={draft}
            disabled={busy}
            onChange={(e) => {
              setDraft(e.target.value);
              setFeedback("");
            }}
          />
          <p className="muted">
            由发布者提供，指向版本清单文件。尚未配置时不会访问任何更新服务器；清空并保存即可停用。
          </p>
          <button
            className="button"
            disabled={busy}
            onClick={() =>
              void update
                .configure(draft)
                .then(() =>
                  setFeedback(
                    draft.trim() ? "更新地址已保存" : "更新地址已清除",
                  ),
                )
                .catch((e) => setFeedback(e.message))
            }
          >
            保存更新地址
          </button>
          {feedback && <p role="status">{feedback}</p>}
        </details>
      )}
      {!update.url && !native ? (
        <p className="update-message" role="status">
          尚未配置更新地址。配置后可自动检测，也可点击检查更新。
        </p>
      ) : update.url ? (
        <>
          <div className="button-row">
            <button
              className="button"
              disabled={busy}
              onClick={() => void update.check()}
            >
              <RefreshCw size={16} />
              检查更新
            </button>
            {["checking", "downloading", "cancelling"].includes(
              state.phase,
            ) && (
              <button
                className="button"
                disabled={state.phase === "cancelling"}
                onClick={() => void controller.cancel()}
              >
                取消{state.phase === "checking" ? "检查" : "下载"}
              </button>
            )}
          </div>
          {update.lastAttempt && (
            <p className="muted">
              上次尝试检查：
              {new Date(update.lastAttempt).toLocaleString("zh-CN")}
            </p>
          )}
        </>
      ) : null}
      {state.message && (
        <p
          className={`update-message ${state.phase === "error" ? "update-error" : ""}`}
          role="status"
        >
          {state.message}
        </p>
      )}
      {state.manifest && !["checking", "current"].includes(state.phase) && (
        <div className="update-release">
          <strong>知栈 {state.manifest.version}</strong>
          <p className="muted">
            {new Date(state.manifest.publishedAt).toLocaleDateString("zh-CN")} ·{" "}
            {(state.manifest.apk.bytes / 1048576).toFixed(1)} MiB
          </p>
          <ul>
            {state.manifest.notes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
          {state.phase === "downloading" && (
            <div>
              <progress
                aria-label="安装包下载进度"
                max={100}
                value={progress}
              />
              <p>
                {progress}% · {(state.received / 1048576).toFixed(1)} MiB
                {progress === 100 ? " · 正在核对安装信息…" : ""}
              </p>
            </div>
          )}
          {candidate && !busy && controller.backend.canInstall && (
            <div className="button-row">
              {state.verified ? (
                <button
                  className="button primary"
                  onClick={() => void controller.install()}
                >
                  {state.phase === "permission" ? "继续安装" : "安装更新"}
                </button>
              ) : (
                <button
                  className="button primary"
                  onClick={() => void controller.download()}
                >
                  <Download size={16} />
                  下载更新
                </button>
              )}
              <button
                className="button"
                onClick={() =>
                  void update.ignore().catch(() => setFeedback("偏好保存失败"))
                }
              >
                忽略此版本提醒
              </button>
            </div>
          )}
          {candidate && !controller.backend.canInstall && (
            <p>
              这是 Android
              安装包，请在手机上的知栈中完成下载安装。电脑端可在此查看版本信息。
            </p>
          )}
          {candidate && (
            <p className="muted">
              覆盖安装保留本机资料。建议先导出重要资料备份；系统安装界面打开不代表安装已完成。
            </p>
          )}
        </div>
      )}
    </section>
  );
}
