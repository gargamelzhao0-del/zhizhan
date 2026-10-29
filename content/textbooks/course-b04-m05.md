# 构建与 CI 脚本化

```zhizhan-anchor
m05
```



"编译→烧录→跑测试→出报告"如果每次靠手点，就不可能持续。这一节用 Python 的 ` subprocess ` 把工具链串成 **一条命令** ， 并接到 CI，让每次提交都自动跑一遍。

 

> ◷ 约 60 分钟 · ◈ subprocess · esptool · Actions · ⚑ 可复现

 

```zhizhan-anchor
m05-1
```



## 5.1 为什么上层用 Python 编排工具链

 

工具链本身是 C 程序（gcc/arm-none-eabi/esptool/openocd…）。用 Python 把它们 **串成流水线** 的理由很直接： 跨平台、易读、易加逻辑（解析输出、判成败、生成报告），且不必写一套 shell 兼容层。

 

| 工具 | 负责什么 | 本册用法 |
| --- | --- | --- |
| ` subprocess ` | 调用任意命令行程序并拿回退出码/输出 | 编排流水线（本节） |
| ` esptool ` | ESP32/8266 烧录、读芯片信息 | flash 步骤 |
| ` west ` | Zephyr 的 build/flash/debug 元工具 | Zephyr 工程 |
| ` platformio ` | 跨框架构建/烧录/测试 | Arduino/ESP-IDF 等 |

 

```zhizhan-anchor
m05-2
```



## 5.2 ` subprocess ` 的正确姿势

 

◆ 四条纪律

 

 
- **传列表、不要拼字符串** ：` run(["esptool","--port",p,"write_flash",...]) `；拼 shell 字符串会遇到空格/注入问题。
 
- **` check=True `** ：非零退出码直接抛异常，别让"编译失败还继续烧录"。
 
- **设 ` timeout `** ：外部工具可能卡住（尤其串口/网络）。
 
- **用 ` sys.executable `**  调 Python 脚本，保证和当前解释器一致。

 

```zhizhan-anchor
m05-3
```



## 5.3 一条命令的流水线

 

build\_all.py — 编译 → 烧录 → 测试 → 报告 Python

 

```text
# build_all.py —— 一条命令走完：编译 → 烧录 → 测试 → 报告
import subprocess, sys, argparse

def run(cmd, dry=False):
    print("$", " ".join(cmd))
    if dry:
        return 0
    return subprocess.run(cmd, check=True).returncode      # check=True：失败即抛异常

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--port", default="COM5")
    a = ap.parse_args()

    run([sys.executable, "-m", "py_compile", "protocol.py"], dry=a.dry_run)          # 1) 语法门禁
    run(["esptool", "--port", a.port, "write_flash", "0x1000", "firmware.bin"], dry=a.dry_run)  # 2) 烧录
    run([sys.executable, "test_protocol.py", "--port", a.port], dry=a.dry_run)        # 3) 自动化测试
    run([sys.executable, "make_report.py"], dry=a.dry_run)                            # 4) 出报告
    print("pipeline done.")

if __name__ == "__main__":
    main()
```

 

**bash**  — 复跑：` python tools/probes/m05_src/build_all.py --dry-run `（CPython 3.13）

 

```text
$ python build_all.py --dry-run
$ python -m py_compile protocol.py
$ esptool --port COM5 write_flash 0x1000 firmware.bin
$ python test_protocol.py --port COM5
$ python make_report.py
pipeline done.
# --dry-run 只回显命令、不真执行；去掉即可真跑（需装 esptool 且接上板子）。
```

 

```zhizhan-anchor
m05-4
```



## 5.4 接到 CI：每次提交自动跑

 

ci.yml — GitHub Actions：语法门禁 \+ 上位机脚本测试 YAML

 

```text
# .github/workflows/ci.yml —— 无硬件也能跑的部分
name: ci
on: [push, pull_request]
jobs:
  host-tools:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }
      - run: pip install -r requirements.txt
      - run: python -m py_compile tools/*.py           # 语法门禁
      - run: python -m pytest tests/ -q                # 上位机脚本单测
      - run: python tools/probes/m05_src/build_all.py --dry-run       # 流水线干跑（无需硬件）
```

 

⚠ CI 里的两条边界

 

①  **需要真实硬件的步骤（烧录/串口测试）不能放进无板 CI** ——用 ` --dry-run ` 干跑，或自建带板 runner； ② 交叉编译（arm-none-eabi/Zephyr/ESP-IDF）要装对应工具链，或用预构建镜像。 **能自动化的先自动化，硬件步骤单独分层。**

 

```zhizhan-anchor
m05-5
```



## 5.5 编排的纪律

 

**FIG 5.1**  一条命令的流水线：编译 → 烧录 → 测试 → 报告

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="Python 编排各工具，任一步失败即停并报告">
          <rect x="20" y="44" width="120" height="44" rx="6" class="sv-cyn-s"></rect>
          <text x="80" y="71" class="sv-lbl-hi" text-anchor="middle">编译</text>
          <path d="M140 66 L180 66" class="sv-arrow"></path>
          <rect x="182" y="44" width="120" height="44" rx="6" class="sv-amb-s"></rect>
          <text x="242" y="71" class="sv-lbl-hi" text-anchor="middle">烧录</text>
          <path d="M302 66 L342 66" class="sv-arrow"></path>
          <rect x="344" y="44" width="120" height="44" rx="6" class="sv-grn-s"></rect>
          <text x="404" y="71" class="sv-lbl-hi" text-anchor="middle">测试</text>
          <path d="M464 66 L504 66" class="sv-arrow"></path>
          <rect x="506" y="44" width="120" height="44" rx="6" class="sv-red-s"></rect>
          <text x="566" y="71" class="sv-lbl-hi" text-anchor="middle">报告</text>
        </svg>
```

 

每一步检查返回码；失败即停，避免"烧了个错的固件还继续测"。

 

**FIG 5.2**  subprocess 的正确姿势

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="用列表传参、check=True 抛异常、捕获输出，避免 shell 注入与静默失败">
          <rect x="30" y="40" width="240" height="56" rx="6" class="sv-red-s"></rect>
          <text x="150" y="63" class="sv-lbl-hi" text-anchor="middle">os.system("tool " + arg)</text>
          <text x="150" y="83" class="sv-lbl-dim" text-anchor="middle">注入风险·无法捕获</text>
          <rect x="330" y="40" width="280" height="56" rx="6" class="sv-grn-s"></rect>
          <text x="470" y="63" class="sv-lbl-hi" text-anchor="middle">subprocess.run([...], check=True)</text>
          <text x="470" y="83" class="sv-lbl-dim" text-anchor="middle">列表传参·失败抛异常</text>
        </svg>
```

 

列表传参避免 shell 解析；` check=True ` 让失败立刻暴露。

 

run\_step.py — 统一的外部命令执行 Python

 

```text
import subprocess

def run(cmd, cwd=None):
    r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"{cmd} failed: {r.stderr.strip()}")
    return r.stdout

print(run(["python", "-c", "print(42)"]).strip())
```

 

**bash**  — 复跑：` python tools/probes/m05_src/build_all.py --dry-run `（本机真实运行）

 

| 做法 | 安全性 | 可捕获输出 |
| --- | --- | --- |
| ` os.system ` | 差（shell 解析） | 否 |
| ` subprocess.run(字符串) ` | 较差 | 可 |
| ` subprocess.run(列表) ` | 好 | 可 |
| ` check=True ` | — | 失败抛异常 |

 

◆ 迁移练习

 

把你"手动依次敲几条命令"的流程写成一个 Python 脚本，任一步失败即停并打印原因；在 CI 里调用它。

 

| 流水线返回码 | 含义 | 动作 |
| --- | --- | --- |
| 0 | 成功 | 继续下一步 |
| 非 0 | 该步失败 | 停止并报告 |
| 超时 | 工具挂起 | 杀掉并报错 |
| 部分成功 | 有的目标失败 | 据清单决定 |

 

| CI 门禁项 | 检查 |
| --- | --- |
| 语法 | ` py_compile ` / lint |
| 单测 | pytest |
| 上位机脚本 | 实跑 m03–m07 |
| 构建 | 编译固件（可选） |

 

◆ 本章要点

 

 
- 工具链是命令行程；Python 用 ` subprocess ` 把它们串成一条命令。
 
- 四条纪律：传列表、` check=True `、设 ` timeout `、用 ` sys.executable `。
 
- 流水线 = 编译 → 烧录 → 测试 → 报告；` --dry-run ` 让它无硬件也能干跑。
 
- CI（GitHub Actions 等）在每次提交跑"语法门禁 \+ 上位机单测 \+ 干跑"；硬件步骤单独分层。
 
- esptool / west / platformio 各管一段，Python 是它们之上的"胶水与编排"。

 

◆ 自测 · Module 05（先答再看）

 

 
1. 判断：` subprocess.run("esptool --port COM5 write_flash ...", shell=True) ` 是可取的写法。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不推荐。应传列表 ` [\"esptool\",\"--port\",\"COM5\",\"write_flash\",...] ` 并让 ` shell=False `（默认）；拼字符串/开 shell 会遇到空格与注入问题。"}
   ```
 
2. 简答：为什么流水线脚本要支持 ` --dry-run `？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"让\"无硬件环境\"（CI、他人机器）也能验证流程与命令正确性，不因缺板子中断；也避免误烧录。"}
   ```
 
3. 诊断：流水线"编译失败却仍去烧录了"，最可能是漏了什么参数？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"漏了 ` check=True `。没有它时非零退出码不会抛异常，脚本会继续往下走。"}
   ```
 
4. 动手：给 ` build_all.py ` 的 ` run ` 加 ` timeout=30 ` 与失败日志，再跑一次 ` --dry-run `。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"加深后命令行为不变（dry-run 不回显 timeout），但真跑时外部工具卡住会在 30s 抛 ` TimeoutExpired `——这是脚本健壮性的关键。"}
   ```
 
5. 判断：把"烧录到真板"也放进无板 CI 是标准做法。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不是。无板 CI 只能做语法/单测/干跑；需要硬件的步骤要放到自建带板 runner 或单独的人工/自动发布流程。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 05 完成？**  给你自己的工程写一个 ` build_all.py `：编译→烧录→测试→报告，并加 ` --dry-run `。

 

```zhizhan-assessment
{"id":"course-b04-m05","criterion":"子命令失败能传播退出码，依赖和构建路径可重现。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[Python 3.13 标准库](https://docs.python.org/3.13/library/)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b04-guide)
