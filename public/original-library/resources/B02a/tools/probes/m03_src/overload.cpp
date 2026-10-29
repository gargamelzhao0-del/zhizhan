#include <iostream>
#include <string>

int area(int w, int h) { return w * h; }          /* 两个 int */
double area(double r) { return 3.14159 * r * r; }  /* 一个 double：重载 */

int greet(const std::string &name = "world") {     /* 默认参数 */
    std::cout << "hello, " << name << "\n";
    return 0;
}
int main()
{
    std::cout << "area(3,4)   = " << area(3, 4) << "\n";
    std::cout << "area(2.0)   = " << area(2.0) << "\n";
    greet();                                          /* 用默认参数 */
    greet("C++");
    return 0;
}
