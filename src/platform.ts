import { Capacitor, registerPlugin } from "@capacitor/core";
interface DocumentsPlugin {
  beginSave(options: { name: string; mime: string }): Promise<void>;
  appendSave(options: { data: string }): Promise<void>;
  finishSave(): Promise<{ cancelled?: boolean }>;
  cancelSave(): Promise<void>;
}
const Documents = registerPlugin<DocumentsPlugin>("Documents");
export const native = Capacitor.isNativePlatform();
export async function saveFile(
  name: string,
  data: Blob,
  mime = data.type || "application/octet-stream",
) {
  if (!native) {
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return;
  }
  await Documents.beginSave({ name, mime });
  try {
    for (let i = 0; i < data.size; i += 196608) {
      const bytes = new Uint8Array(
        await data.slice(i, i + 196608).arrayBuffer(),
      );
      let binary = "";
      for (const b of bytes) binary += String.fromCharCode(b);
      await Documents.appendSave({ data: btoa(binary) });
    }
    const result = await Documents.finishSave();
    if (result.cancelled) throw new Error("已取消保存");
  } catch (e) {
    await Documents.cancelSave().catch(() => {});
    throw e;
  }
}
export async function fileBytes(file: Blob) {
  return new Uint8Array(await file.arrayBuffer());
}
export function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
