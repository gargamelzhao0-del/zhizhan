nums = [3, 1, 4, 1, 5]                 # list
nums.append(9)
print("list:", nums, "len:", len(nums))
print("slice[:2]:", nums[:2], "sorted:", sorted(nums))

point = (3, 4)                          # tuple（不可变）
print("tuple:", point, "point[0] =", point[0])

person = {"name": "Ann", "age": 30}     # dict
person["city"] = "Chengdu"
print("dict:", person, "get('age'):", person.get("age"))

unique = {1, 2, 2, 3, 3, 3}             # set（自动去重）
print("set:", unique)

squares = [x * x for x in range(1, 6)]  # 推导式
print("squares:", squares)
evens = [x for x in range(10) if x % 2 == 0]
print("evens:", evens)
