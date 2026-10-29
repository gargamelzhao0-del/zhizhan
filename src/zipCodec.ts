import { Unzip, UnzipInflate, strFromU8 } from "fflate";
export const MAX_TOTAL = 128 * 1024 * 1024,
  MAX_FILE = 24 * 1024 * 1024;
const crcTable = Uint32Array.from({ length: 256 }, (_, i) => {
  let c = i;
  for (let n = 0; n < 8; n++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const b of bytes) crc = crcTable[(crc ^ b) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
export function unzipBounded(bytes: Uint8Array) {
  if (
    bytes.length > MAX_TOTAL ||
    bytes.length < 22 ||
    bytes[0] !== 80 ||
    bytes[1] !== 75
  )
    throw new Error("资料包无效或超过 128 MiB");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let p = bytes.length - 22; p >= Math.max(0, bytes.length - 65557); p--)
    if (
      view.getUint32(p, true) === 0x06054b50 &&
      p + 22 + view.getUint16(p + 20, true) === bytes.length
    ) {
      end = p;
      break;
    }
  if (end < 0) throw new Error("资料包末尾缺失，文件可能不完整");
  const entries = view.getUint16(end + 10, true),
    centralSize = view.getUint32(end + 12, true),
    centralStart = view.getUint32(end + 16, true);
  if (
    view.getUint16(end + 4, true) !== 0 ||
    view.getUint16(end + 6, true) !== 0 ||
    entries !== view.getUint16(end + 8, true) ||
    entries > 25000 ||
    centralStart + centralSize !== end
  )
    throw new Error("不支持的 ZIP 分卷或目录格式");
  const directory = new Map<string, { size: number; crc: number }>();
  let pos = centralStart,
    expectedBytes = 0;
  for (let i = 0; i < entries; i++) {
    if (pos + 46 > end || view.getUint32(pos, true) !== 0x02014b50)
      throw new Error("ZIP 目录损坏");
    const flags = view.getUint16(pos + 8, true),
      method = view.getUint16(pos + 10, true),
      len = view.getUint16(pos + 28, true),
      extra = view.getUint16(pos + 30, true),
      comment = view.getUint16(pos + 32, true),
      size = view.getUint32(pos + 24, true);
    if (
      pos + 46 + len + extra + comment > end ||
      flags & 1 ||
      ![0, 8].includes(method)
    )
      throw new Error("不支持加密或此压缩格式");
    const name = strFromU8(bytes.subarray(pos + 46, pos + 46 + len));
    expectedBytes += size;
    if (size > MAX_FILE || expectedBytes > MAX_TOTAL)
      throw new Error("资料包解压后超过容量限制");
    if (directory.has(name)) throw new Error("ZIP 路径重复");
    directory.set(name, { size, crc: view.getUint32(pos + 16, true) });
    pos += 46 + len + extra + comment;
  }
  if (pos !== end) throw new Error("ZIP 目录长度不符");
  const output: Record<string, Uint8Array> = Object.create(null);
  let total = 0,
    count = 0,
    pending = 0;
  const names = new Set<string>();
  const unzip = new Unzip((file) => {
    if (
      ++count > 25000 ||
      names.has(file.name) ||
      file.name.startsWith("/") ||
      file.name.includes("\\") ||
      file.name.split("/").some((s) => s === "..") ||
      file.name.includes(":")
    )
      throw new Error("资料包包含重复或不安全路径");
    names.add(file.name);
    pending++;
    const chunks: Uint8Array[] = [];
    let size = 0;
    file.ondata = (err, chunk, final) => {
      if (err) throw err;
      size += chunk.length;
      total += chunk.length;
      if (size > MAX_FILE || total > MAX_TOTAL) {
        file.terminate();
        throw new Error("资料包解压后超过容量限制");
      }
      chunks.push(chunk);
      if (final) {
        const bytes = new Uint8Array(size);
        let p = 0;
        for (const c of chunks) {
          bytes.set(c, p);
          p += c.length;
        }
        output[file.name] = bytes;
        pending--;
      }
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  for (let offset = 0; offset < bytes.length; offset += 4096)
    unzip.push(
      bytes.subarray(offset, offset + 4096),
      offset + 4096 >= bytes.length,
    );
  if (pending) throw new Error("资料包内容不完整");
  if (Object.keys(output).length !== directory.size)
    throw new Error("ZIP 文件数量不符");
  for (const [name, meta] of directory) {
    const data = output[name];
    if (!data || data.length !== meta.size || crc32(data) !== meta.crc)
      throw new Error("ZIP 内容损坏或校验不符");
  }
  return output;
}
