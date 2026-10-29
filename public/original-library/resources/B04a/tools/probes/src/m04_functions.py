def add(a, b):
    return a + b

def greet(name, greeting="hello"):    # 默认参数
    return f"{greeting}, {name}!"

def stats(xs):
    return min(xs), max(xs), sum(xs)  # 返回多个值（元组）

print(add(3, 4))
print(greet("world"))
print(greet("C", greeting="hi"))       # 关键字参数
print(stats([3, 1, 9, 4]))

square = lambda x: x * x               # lambda：匿名函数
print("square(5) =", square(5))

def make_counter():
    c = 0
    def inc():
        nonlocal c                     # 修改外层变量
        c += 1
        return c
    return inc

cnt = make_counter()
print(cnt(), cnt(), cnt())
