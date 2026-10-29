import { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, ArrowRight } from "lucide-react";
import { reducedMotion } from "./motion";

const demos = {
  archive: {
    title: "一个归档怎样安全离开 SD",
    labels: ["封存", "开始", "传片", "提交", "删除"],
    text: [
      "writer 封存为 ready。现在本地持有待补传副本，网络失败不应删除它。",
      "begin 协商能力并取得恢复偏移。请求 ID 用于匹配本次事务。",
      "发送归档片段并等待确认；ACK 丢失时按约定重试，不能重复追加已有数据。",
      "commit 请求交给对端做完整性确认。只有匹配本段和连接代次的成功 ACK 才构成提交证据。",
      "提交成功后还要满足本地清理条件。删除失败则保留文件，后续通过幂等流程重试，不冒充已清理。",
    ],
  },
  session: {
    title: "断网后，哪些身份变化",
    labels: ["在线会议", "断网", "恢复申请", "继续同场"],
    text: [
      "示意：逻辑会话 S，开启请求 R1，连接代次 E1。音频记录属于 S。",
      "原模式仍存续，设备保存离线音频。网络连接中断不等于用户结束这场会议。",
      "连接进入 E2，恢复使用新请求 R2，仍提交原 audio_session_id=S。旧 E1 的 ACK 不可完成 R2。",
      "归档和实时流以会话及采集边界关联。若此前已主动停止或八小时上限退出，则重新开启要按新会话处理。",
    ],
  },
  lease: {
    title: "缓冲何时可以再次使用",
    labels: ["空闲", "写入", "交付", "消费者使用", "归还"],
    text: [
      "缓冲槽空闲，生产者可以取得写入权。",
      "生产者写完整数据及必要元信息，此时消费者不能把半帧当作完整帧。",
      "通过队列或发布语义交付。转移的是使用责任，指针值相同不代表双方都能修改。",
      "消费者、DMA 或补传重试仍可能访问数据。生产者不得提前覆盖。具体归还条件由路径契约决定。",
      "确认消费完成或取消后真正退出，再归还槽位。超时本身不是消费者已停止的证明。",
    ],
  },
  ownership: {
    title: "看见所有权的转移",
    labels: ["创建", "借用", "移动", "释放"],
    text: [
      "A 创建并拥有资源。资源只能由一个 unique_ptr 拥有。",
      "view 借用同一资源，不负责释放，也不延长生命周期。",
      "所有权从 A 转移给 B；A 变空。资源本身没有移动，view 仍有效。",
      "B 离开作用域，资源被释放。view 已悬空，不能继续访问。",
    ],
  },
  tcp: {
    title: "一次接收，不等于一条消息",
    labels: ["等待", "收到 2 字节", "再收 5 字节", "再收 3 字节"],
    text: [
      "协议：4 字节大端长度 + UTF-8 正文。消息“你好”编码后是 6 字节。",
      "只收到了长度头的前 2 字节。还不能解释长度，更不能解析正文。",
      "头部完整：长度为 6。目前正文只有 3 字节，继续等待，不能提前交付。",
      "正文 6 字节已收齐，再严格解码，交付完整消息“你好”。",
    ],
  },
  boot: {
    title: "沿启动链寻找证据",
    labels: ["ROM", "引导程序", "内核", "根文件系统", "PID 1", "业务服务"],
    text: [
      "芯片启动代码按平台规则寻找下一阶段，先检查供电、启动介质和串口。",
      "加载内核与设备树，准备启动参数。看见引导输出不代表 Linux 已运行。",
      "初始化调度、内存与驱动。驱动内建或模块加载时机必须匹配启动依赖。",
      "挂载 rootfs；核对 root 参数、文件系统支持以及存储驱动。",
      "执行初始化程序，准备用户环境。动态解释器、权限与配置都可能阻止启动。",
      "服务启动后仍要验证功能、停止、重启和失败恢复，开机画面不等于交付验收。",
    ],
  },
  queue: {
    title: "有界队列如何保护数据",
    labels: ["空队列", "写入", "写满", "背压", "消费", "关闭排空"],
    text: [
      "队列最多容纳 4 条。内存边界在开始前就确定。",
      "生产者提交 2 条记录，成功提交后才转移处理责任。",
      "4 个槽位都已使用，下一次写入不能直接覆盖旧数据。",
      "本例选择阻塞等待：生产者暂停，等待空位或关闭通知，不把等待算成丢弃。",
      "消费者取走 1 条并通知可写。等待者重新检查条件，不能假定被唤醒就一定有空位。",
      "关闭后拒绝新记录，已有记录处理完再退出。join 完成之后才释放共享队列。",
    ],
  },
} as const;

export function LearningDemo({ kind }: { kind: string }) {
  const demo = Object.prototype.hasOwnProperty.call(demos, kind)
    ? demos[kind as keyof typeof demos]
    : undefined;
  const [step, setStep] = useState(0),
    [playing, setPlaying] = useState(false);
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    setStep(0);
    setPlaying(false);
  }, [kind]);
  useEffect(() => {
    const stop = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener("visibilitychange", stop);
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const stopForPreference = () => {
      if (preference.matches) setPlaying(false);
    };
    preference.addEventListener("change", stopForPreference);
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting) setPlaying(false);
    });
    if (root.current) observer.observe(root.current);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", stop);
      preference.removeEventListener("change", stopForPreference);
    };
  }, []);
  useEffect(() => {
    if (!playing || !demo) return;
    if (step >= demo.text.length - 1) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => setStep((value) => value + 1), 1800);
    return () => clearTimeout(timer);
  }, [playing, step, demo]);
  if (!demo) return <p>此原理演示暂不支持，请阅读下方文字说明。</p>;
  const next = () => {
    setPlaying(false);
    setStep(Math.min(step + 1, demo.text.length - 1));
  };
  return (
    <figure className="learning-demo" ref={root} aria-label={demo.title}>
      <figcaption>
        <span className="eyebrow">动手理解 · 示意模型</span>
        <strong>{demo.title}</strong>
      </figcaption>
      <ol className="demo-steps">
        {demo.labels.map((label, index) => (
          <li key={label} data-active={index === step} data-done={index < step}>
            <span>{index + 1}</span>
            {label}
          </li>
        ))}
      </ol>
      <div className="demo-scene" aria-hidden="true">
        {kind === "ownership" ? (
          <>
            <div className={`demo-node ${step < 2 ? "on" : ""}`}>
              owner A<br />
              <small>{step < 2 ? "拥有资源" : "空"}</small>
            </div>
            <ArrowRight />
            <div className={`demo-resource ${step < 3 ? "on" : ""}`}>
              {step < 3 ? "资源 42" : "已释放"}
              <small>
                {step === 1 || step === 2
                  ? "view 借用"
                  : step === 3
                    ? "view 失效"
                    : ""}
              </small>
            </div>
            <ArrowRight />
            <div className={`demo-node ${step === 2 ? "on" : ""}`}>
              owner B<br />
              <small>{step === 2 ? "拥有资源" : "空"}</small>
            </div>
          </>
        ) : kind === "tcp" ? (
          <div className="byte-stream">
            {["00", "00", "00", "06", "E4", "BD", "A0", "E5", "A5", "BD"].map(
              (byte, i) => (
                <span
                  key={i}
                  data-filled={i < [0, 2, 7, 10][step]}
                  data-header={i < 4}
                >
                  {byte}
                </span>
              ),
            )}
          </div>
        ) : kind === "queue" ? (
          <div className="queue-slots">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} data-filled={i < [0, 2, 4, 4, 3, 0][step]}>
                {i + 1}
              </span>
            ))}
          </div>
        ) : (
          <div className="boot-stage">
            <span>{String(step + 1).padStart(2, "0")}</span>
            <strong>{demo.labels[step]}</strong>
            <small>
              {kind === "boot"
                ? "只证明当前阶段，继续检查下一层"
                : "教学示意 · 点击下一步追踪边界"}
            </small>
          </div>
        )}
      </div>
      <p className="demo-explanation" aria-live="polite" aria-atomic="true">
        {demo.text[step]}
      </p>
      <div className="demo-controls">
        <button
          className="button"
          onClick={next}
          disabled={step === demo.text.length - 1}
        >
          下一步
          <ArrowRight size={16} />
        </button>
        <button
          className="button quiet"
          aria-label={playing ? "暂停演示" : "播放演示"}
          aria-pressed={playing}
          onClick={() => {
            if (reducedMotion()) {
              setPlaying(false);
              setStep((value) =>
                value === demo.text.length - 1 ? 0 : value + 1,
              );
            } else {
              if (step === demo.text.length - 1) setStep(0);
              setPlaying(!playing);
            }
          }}
        >
          {playing ? <Pause size={16} /> : <Play size={16} />}
          <span>{playing ? "暂停" : "播放"}</span>
        </button>
        <button
          className="icon-button"
          aria-label="重新开始演示"
          onClick={() => {
            setPlaying(false);
            setStep(0);
          }}
        >
          <RotateCcw size={16} />
        </button>
      </div>
    </figure>
  );
}
