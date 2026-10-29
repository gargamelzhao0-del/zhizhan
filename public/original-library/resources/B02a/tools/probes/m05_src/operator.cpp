#include <iostream>

struct Vec2 {
    double x, y;
};
Vec2 operator+(const Vec2 &a, const Vec2 &b) {     /* 重载 + */
    return Vec2{a.x + b.x, a.y + b.y};
}
std::ostream &operator<<(std::ostream &os, const Vec2 &v) {   /* 让它能 cout */
    return os << "(" << v.x << ", " << v.y << ")";
}

int main()
{
    Vec2 a{1, 2}, b{3, 4};
    Vec2 c = a + b;                                 /* 用起来像内置类型 */
    std::cout << "a + b = " << c << "\n";
    return 0;
}
