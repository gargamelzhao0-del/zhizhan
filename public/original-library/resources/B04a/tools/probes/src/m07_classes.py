import math                                  # 导入模块

class Circle:
    def __init__(self, r):                   # 构造方法
        self.r = r                           # 实例属性
    def area(self):                          # 方法（第一个参数是 self）
        return math.pi * self.r ** 2
    def __str__(self):                       # 打印时的表示
        return f"Circle(r={self.r})"

c = Circle(2.0)
print(c)
print(f"area = {c.area():.2f}")
print("math.sqrt(16) =", math.sqrt(16))
