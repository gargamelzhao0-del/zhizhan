import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  dest = path.join(root, "release/zhizhan-windows");
await fs.mkdir(path.join(dest, "scripts"), { recursive: true });
await fs.mkdir(path.join(dest, "runtime"), { recursive: true });
const metadata = JSON.parse(
  await fs.readFile(path.join(root, "package.json"), "utf8"),
);
await fs.writeFile(
  path.join(dest, "package.json"),
  JSON.stringify({
    name: metadata.name,
    version: metadata.version,
    type: "module",
  }),
);
// Remove only our generated dist inside the verified release directory, never user data.
const generatedDist = path.resolve(dest, "dist");
if (!generatedDist.startsWith(path.resolve(root, "release") + path.sep))
  throw new Error("Unexpected output path");
await fs.rm(generatedDist, { recursive: true, force: true });
await fs.cp(path.join(root, "dist"), path.join(dest, "dist"), {
  recursive: true,
});
await fs.copyFile(
  path.join(root, "scripts/serve.mjs"),
  path.join(dest, "scripts/serve.mjs"),
);
// Windows locks a running executable. Keep an identical bundled runtime in place.
const runtimePath = path.join(dest, "runtime/node.exe");
const fileHash = async (file) => createHash("sha256").update(await fs.readFile(file)).digest("hex");
let installedRuntime;
try { installedRuntime = await fileHash(runtimePath); }
catch (error) { if (error.code !== "ENOENT") throw error; }
if (installedRuntime !== await fileHash(process.execPath))
  await fs.copyFile(process.execPath, runtimePath);
await fs.copyFile(
  path.join(root, "docs/使用说明.md"),
  path.join(dest, "使用说明.md"),
);
await fs.copyFile(path.join(root, "docs/更新功能与发布指南.md"), path.join(dest, "更新功能与发布指南.md"));
await fs.copyFile(path.join(root, "docs/本机私人更新服务器.md"), path.join(dest, "本机私人更新服务器.md"));
await fs.copyFile(
  path.join(root, "docs/产品审查与学习内容质量报告.md"),
  path.join(dest, "产品审查与学习内容质量报告.md"),
);
await fs.copyFile(
  path.join(root, "THIRD_PARTY_NOTICES.md"),
  path.join(dest, "THIRD_PARTY_NOTICES.md"),
);
await fs.copyFile(
  path.join(root, "docs/NODE_LICENSE.txt"),
  path.join(dest, "NODE_LICENSE.txt"),
);
// Windows-only launcher. A hidden helper owns the loopback server; no remote listener.
await fs.writeFile(
  path.join(dest, "启动知栈.vbs"),
  'Set shell = CreateObject("WScript.Shell")\r\nSet fso = CreateObject("Scripting.FileSystemObject")\r\nroot = fso.GetParentFolderName(WScript.ScriptFullName)\r\nshell.Run Chr(34) & root & "\\runtime\\node.exe" & Chr(34) & " " & Chr(34) & root & "\\scripts\\serve.mjs" & Chr(34), 0, False\r\n',
);
await fs.writeFile(
  path.join(dest, "启动知栈.cmd"),
  '@echo off\r\ncd /d "%~dp0"\r\n"runtime\\node.exe" "scripts\\serve.mjs"\r\n',
);
console.log(dest);
