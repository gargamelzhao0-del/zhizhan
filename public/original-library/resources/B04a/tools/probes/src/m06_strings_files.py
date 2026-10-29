s = "  Hello, Embedded World  "
print("strip:", repr(s.strip()))
print("upper:", s.strip().upper())
print("replace:", s.strip().replace("World", "Rust"))
print("split:", "a,b,c".split(","))
print("join:", "-".join(["a", "b", "c"]))
print(f"len('hello') = {len('hello')}, 'x'*3 = {'x' * 3}")

path = "sample.txt"
with open(path, "w", encoding="utf-8") as fh:   # with 自动关闭
    fh.write("line1\nline2\nline3\n")

with open(path, "r", encoding="utf-8") as fh:
    lines = [ln.strip() for ln in fh]           # 列表推导式读所有行
print("file lines:", lines)
