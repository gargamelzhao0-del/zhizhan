import { zipSync } from "fflate";
import { unzipBounded } from "./zipCodec";
type Files = Record<string, Uint8Array>;
export type ZipJob =
  { kind: "zip"; files: Files } | { kind: "unzip"; bytes: Uint8Array };

function execute<T>(job: ZipJob, transfer: Transferable[]): Promise<T> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./zip.worker.ts", import.meta.url), {
      type: "module",
    });
    const finish = () => {
      clearTimeout(timeout);
      worker.terminate();
    };
    const timeout = setTimeout(() => {
      finish();
      reject(new Error("资料包处理超时，原有资料未被更改"));
    }, 180000);
    worker.onmessage = ({ data }) => {
      finish();
      if (data.error) reject(new Error(data.error));
      else resolve(data.result);
    };
    worker.onerror = () => {
      finish();
      reject(new Error("后台资料包处理失败，请重新打开应用后重试"));
    };
    worker.onmessageerror = () => {
      finish();
      reject(new Error("无法读取后台处理结果"));
    };
    try {
      worker.postMessage(job, transfer);
    } catch (e) {
      finish();
      reject(e);
    }
  });
}
export async function zipInBackground(files: Files): Promise<Uint8Array> {
  // Node-based storage tests have no browser Worker. Browser and Android use the worker.
  if (typeof Worker === "undefined") return zipSync(files, { level: 1 });
  return execute<Uint8Array>({ kind: "zip", files }, [
    ...new Set(Object.values(files).map((b) => b.buffer as ArrayBuffer)),
  ]);
}
export async function unzipInBackground(bytes: Uint8Array): Promise<Files> {
  if (typeof Worker === "undefined") return unzipBounded(bytes);
  return execute<Files>({ kind: "unzip", bytes }, [
    bytes.buffer as ArrayBuffer,
  ]);
}
