name = "Python"          # 无需声明类型
count = 3
pi = 3.14
nothing = None           # 表示"没有值"
print("Hello,", name)
print("count =", count, "pi =", pi, "nothing =", nothing)
# 动态类型：同一个名字可以指向不同类型
count = "now a string"   # 合法，但类型变了（C 里不允许）
print(count)
