import {
  parseUpdateManifest,
  httpsAddress,
  updateDecision,
  type AppInfo,
  type UpdateBackend,
  type UpdateManifest,
} from "./updates";
export type UpdatePhase =
  | "idle"
  | "checking"
  | "available"
  | "current"
  | "incompatible"
  | "downloading"
  | "cancelling"
  | "cancelled"
  | "ready"
  | "installing"
  | "permission"
  | "handed_off"
  | "error";
export interface UpdateState {
  phase: UpdatePhase;
  message: string;
  manifest?: UpdateManifest;
  received: number;
  verified: boolean;
  sourceUrl?: string;
}
interface Job {
  id: string;
  cancelled: boolean;
  done: Promise<void>;
  finish: () => void;
}
export class UpdateController {
  state: UpdateState = {
    phase: "idle",
    message: "",
    received: 0,
    verified: false,
  };
  private listeners = new Set<(state: UpdateState) => void>();
  private job?: Job;
  private info?: AppInfo;
  constructor(readonly backend: UpdateBackend) {}
  get busy() {
    return !!this.job;
  }
  subscribe(listener: (state: UpdateState) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private set(state: Partial<UpdateState>) {
    this.state = { ...this.state, ...state };
    this.listeners.forEach((l) => l(this.state));
  }
  private start(): Job | undefined {
    if (this.job) return;
    let finish!: () => void;
    const done = new Promise<void>((resolve) => {
      finish = resolve;
    });
    return (this.job = {
      id: crypto.randomUUID(),
      cancelled: false,
      done,
      finish,
    });
  }
  private end(job: Job) {
    if (this.job === job) this.job = undefined;
    job.finish();
  }
  private failed(error: unknown, job: Job) {
    this.set({
      phase: job.cancelled ? "cancelled" : "error",
      verified: false,
      message: job.cancelled
        ? "已取消，可稍后重试"
        : error instanceof Error
          ? error.message
          : String(
              (error as { message?: string })?.message ||
                "更新操作失败，请重试",
            ),
    });
  }
  async check(address: string) {
    if (this.busy) return;
    let url: string;
    try {
      url = httpsAddress(address);
    } catch (e) {
      this.set({
        phase: "error",
        message: (e as Error).message,
        manifest: undefined,
        verified: false,
      });
      return;
    }
    const job = this.start()!;
    this.set({
      phase: "checking",
      message: "正在检查新版本…",
      manifest: undefined,
      received: 0,
      verified: false,
      sourceUrl: url,
    });
    try {
      this.info = await this.backend.getInfo();
      if (job.cancelled) throw new Error();
      const result = await this.backend.check(url, job.id);
      if (job.cancelled) throw new Error();
      const manifest = parseUpdateManifest(result.text, result.url),
        phase = updateDecision(manifest, this.info);
      this.set({
        phase,
        manifest,
        message:
          phase === "current"
            ? "当前已是此发布地址提供的最新版本"
            : phase === "incompatible"
              ? `发现新版 ${manifest.version}，但需要更高版本的 Android（API ${manifest.minSdk}）`
              : `发现新版本 ${manifest.version}`,
      });
    } catch (e) {
      this.failed(e, job);
    } finally {
      this.end(job);
    }
  }
  async download() {
    const manifest = this.state.manifest;
    if (
      this.busy ||
      !manifest ||
      !this.info ||
      updateDecision(manifest, this.info) !== "available"
    )
      return;
    const job = this.start()!;
    this.set({
      phase: "downloading",
      message: "正在下载安装包…",
      received: 0,
      verified: false,
    });
    try {
      const result = await this.backend.download(
        manifest,
        job.id,
        (received) => {
          if (this.job === job && !job.cancelled && Number.isFinite(received))
            this.set({
              received: Math.max(
                this.state.received,
                Math.min(manifest.apk.bytes, received),
              ),
            });
        },
      );
      if (job.cancelled) throw new Error();
      if (!result.verified) throw new Error("安装包未通过验证");
      this.set({
        phase: "ready",
        verified: true,
        received: manifest.apk.bytes,
        message: "安装包已校验，点击安装后由 Android 系统确认",
      });
    } catch (e) {
      this.failed(e, job);
    } finally {
      this.end(job);
    }
  }
  async install() {
    if (this.busy || !this.state.verified || !this.backend.canInstall) return;
    const job = this.start()!;
    this.set({
      phase: "installing",
      message: "正在核对安装包并打开系统安装界面…",
    });
    try {
      const result = await this.backend.install(job.id);
      if (result.needsPermission)
        this.set({
          phase: "permission",
          message: "请在系统页面允许知栈安装应用，返回后点击“继续安装”",
        });
      else if (result.launched)
        this.set({
          phase: "handed_off",
          message:
            "已打开系统安装界面。完成安装后请重新打开知栈；若取消，可再次点击安装",
        });
      else throw new Error("系统安装界面未打开，请重试");
    } catch (e) {
      this.failed(e, job);
    } finally {
      this.end(job);
    }
  }
  async cancel() {
    const job = this.job;
    if (!job || this.state.phase === "installing") return;
    job.cancelled = true;
    this.set({ phase: "cancelling", message: "正在取消…" });
    try {
      await this.backend.cancel(job.id);
    } catch {
      /* The bounded operation still owns completion. */
    }
    await job.done;
  }
  reset() {
    if (this.busy) return;
    this.set({
      phase: "idle",
      message: "",
      manifest: undefined,
      received: 0,
      verified: false,
      sourceUrl: undefined,
    });
  }
  reportError(message: string) {
    if (!this.busy)
      this.set({
        phase: "error",
        message,
        manifest: undefined,
        verified: false,
      });
  }
}
