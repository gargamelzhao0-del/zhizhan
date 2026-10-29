n = 7
x = 3.5
s = "embedded"
b = True
print(type(n).__name__, type(x).__name__, type(s).__name__, type(b).__name__)
print("7 / 2  =", 7 / 2)        # 真除法：3.5
print("7 // 2 =", 7 // 2)       # 整除：3
print("7 % 2 =", 7 % 2)
print("7 ** 2 =", 7 ** 2)       # 幂
print(f"n={n}, x={x}, s={s}")   # f-string
print("int('42') + 1 =", int("42") + 1)
print("'value=' + str(n) =", "value=" + str(n))
