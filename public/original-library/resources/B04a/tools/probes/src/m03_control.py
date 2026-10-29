for i in range(1, 6):          # 1..5
    if i % 2 == 0:
        print(i, "even")
    else:
        print(i, "odd")

total = 0
n = 10
while n > 0:
    total += n
    n -= 1
print("sum 1..10 =", total)

for x in range(1, 10):
    if x == 3:
        continue               # 跳过 3
    if x == 6:
        break                  # 到 6 停止
    print("x =", x)
