import { zipSync } from "fflate";
import { unzipBounded } from "./zipCodec";
import type { ZipJob } from "./zipJobs";
self.onmessage = ({ data }: MessageEvent<ZipJob>) => {
  try {
    const result =
      data.kind === "zip"
        ? zipSync(data.files, { level: 1 })
        : unzipBounded(data.bytes);
    const buffers =
      result instanceof Uint8Array
        ? [result.buffer]
        : Object.values(result).map((b) => b.buffer);
    self.postMessage(
      { result },
      { transfer: [...new Set(buffers)] as ArrayBuffer[] },
    );
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
