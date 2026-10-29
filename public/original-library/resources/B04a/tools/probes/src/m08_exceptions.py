def parse(s):
    try:
        return int(s)
    except ValueError:
        return None                          # 转换失败返回 None

print(parse("42"), parse("abc"))

def countdown(n):                            # 生成器：惰性产出
    while n > 0:
        yield n
        n -= 1

print("countdown:", list(countdown(4)))

# 一个极简"测试"（真实项目用 pytest）
def test_add():
    assert 1 + 1 == 2
test_add()
print("test_add OK")
