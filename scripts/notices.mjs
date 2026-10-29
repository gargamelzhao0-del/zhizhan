import fs from "node:fs/promises";
import path from "node:path";
const lock = JSON.parse(await fs.readFile("package-lock.json", "utf8"));
let text =
  "# 知栈第三方组件说明\n\n本应用使用下列开源组件。许可证及版权声明按安装版本保留。用户项目手册和所附源码来自原工程，其原始文件头继续保留。\n\n";
const licenses = [];
for (const [location, pkg] of Object.entries(lock.packages)) {
  if (!location || pkg.dev) continue;
  const dir = path.resolve(location),
    name = pkg.name || location.split("node_modules/").pop();
  let names;
  try {
    names = await fs.readdir(dir);
  } catch {
    continue;
  }
  const licenseFiles = names.filter((n) =>
    /^(licen[sc]e|copying|notice)(\.|$)/i.test(n),
  );
  licenses.push({
    name,
    version: pkg.version,
    license: pkg.license || "See included notice",
  });
  text += `## ${name} ${pkg.version}\n\nLicense: ${pkg.license || "See package license"}\n\n`;
  for (const name of licenseFiles) {
    const file = path.join(dir, name);
    if (!(await fs.stat(file)).isFile()) continue;
    text += `\n### ${name}\n\n` + (await fs.readFile(file, "utf8")) + "\n";
  }
}
text +=
  "\n## Android 平台组件\n\nAndroidX 与 Android Gradle Plugin 使用 Apache License 2.0。Capacitor 使用 MIT；其许可证见上方组件内容。参考 https://source.android.com/docs/setup/about/licenses 与 https://www.apache.org/licenses/LICENSE-2.0 。\n";
text +=
  "\n## Node.js Windows 运行时\n\n电脑免安装包包含当前 Node.js 可执行文件，其完整许可证同时保存为 NODE_LICENSE.txt。\n";
await fs.writeFile("THIRD_PARTY_NOTICES.md", text);
await fs.writeFile("public/NOTICE.txt", text);
await fs.writeFile(
  "docs/dependency-licenses.json",
  JSON.stringify(licenses, null, 2),
);
try {
  await fs.copyFile(
    path.join(path.dirname(process.execPath), "LICENSE"),
    "docs/NODE_LICENSE.txt",
  );
} catch {
  if (!(await fs.stat("docs/NODE_LICENSE.txt").catch(() => null))?.isFile()) {
    const response = await fetch(
      "https://raw.githubusercontent.com/nodejs/node/v24.15.0/LICENSE",
    );
    if (!response.ok) throw new Error("Node license download failed");
    await fs.writeFile("docs/NODE_LICENSE.txt", await response.text());
  }
}
console.log(`Notices for ${licenses.length} production packages`);
