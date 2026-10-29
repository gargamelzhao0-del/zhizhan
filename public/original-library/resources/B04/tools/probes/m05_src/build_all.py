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
