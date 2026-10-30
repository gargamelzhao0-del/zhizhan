import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { initialize } from "./seed";
import { UpdateProvider } from "./UpdateUI";
import "./style.css";
import "./design.css";
import "./interactions.css";
import "./refinement.css";
import "./chrome.css";
import "./technical.css";
import "./textbooks.css";
import "./reader.css";
import "./precision.css";
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: string }
> {
  state = { error: "" };
  static getDerivedStateFromError(e: Error) {
    return { error: e.message };
  }
  render() {
    return this.state.error ? (
      <div className="startup">
        <h1>暂时无法打开知识库</h1>
        <p>{this.state.error}</p>
        <p>你的本地数据不会因此被清除。</p>
        <button onClick={() => location.reload()}>重新打开</button>
      </div>
    ) : (
      this.props.children
    );
  }
}
function Bootstrap() {
  const [ready, setReady] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    void initialize()
      .then(() => {
        setReady(true);
        if (navigator.storage?.persist)
          void navigator.storage.persist().catch(() => {});
      })
      .catch((e) => setError(e.message));
  }, []);
  return ready ? (
    <UpdateProvider>
      <App />
    </UpdateProvider>
  ) : (
    <div className="startup">
      <img src="/icon.svg" alt="知栈" />
      <h1>{error ? "知识库尚未准备好" : "正在打开你的知识空间"}</h1>
      <p>{error || "首次打开会将课程和项目资料保存到本机，请稍候。"}</p>
      {error ? (
        <button onClick={() => location.reload()}>重试</button>
      ) : (
        <span className="spinner" />
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <Bootstrap />
  </ErrorBoundary>,
);
