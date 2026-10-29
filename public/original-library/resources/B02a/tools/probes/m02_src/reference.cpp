#include <iostream>
#include <string>

void add_one(int &x) { x += 1; }          /* 引用参数：直接改实参 */
void print(const std::string &s) {        /* const 引用：不改，也不拷贝 */
    std::cout << "print: " << s << "\n";
}
int main()
{
    int n = 5;
    add_one(n);                            /* 传引用，行为像传变量本身 */
    std::cout << "n = " << n << "\n";

    int &r = n;                            /* r 是 n 的别名 */
    r = 42;
    std::cout << "n via ref = " << n << "\n";

    std::string msg = "hello reference";
    print(msg);
    return 0;
}
