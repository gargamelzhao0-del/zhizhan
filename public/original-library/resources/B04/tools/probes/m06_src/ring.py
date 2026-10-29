class Ring:
    def __init__(self, n):
        self.n = n
        self.buf = []
    def push(self, x):
        self.buf.append(x)
        if len(self.buf) > self.n:
            self.buf.pop(0)

r = Ring(3)
for x in range(5):
    r.push(x)
print(r.buf)
