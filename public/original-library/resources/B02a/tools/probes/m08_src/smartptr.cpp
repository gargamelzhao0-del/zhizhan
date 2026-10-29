#include <iostream>
#include <memory>
#include <stdexcept>

class Res {
public:
    Res()  { std::cout << "获取资源\n"; }
    ~Res() { std::cout << "释放资源（RAII）\n"; }
};

int main()
{
    try {
        std::unique_ptr<Res> p = std::make_unique<Res>();   // 在 try 作用域内
        std::cout << "使用资源…\n";
        throw std::runtime_error("模拟错误");                 // 抛异常，p 仍会析构
    } catch (const std::exception &e) {
        std::cout << "捕获异常: " << e.what() << "\n";
    }
    return 0;
}
