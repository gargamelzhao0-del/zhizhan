#include <iostream>
#include <cstdint>

class Counter {
public:
    Counter(int start) : value_(start) { std::cout << "构造: " << value_ << "\n"; }
    ~Counter() { std::cout << "析构: " << value_ << "\n"; }

    void inc() { ++value_; }                 // 成员函数可改私有成员
    int value() const { return value_; }     // const 成员函数：不修改对象

private:
    int value_;                              // 私有：外部不能直接改
};

int main()
{
    Counter c(10);
    c.inc();
    c.inc();
    std::cout << "value = " << c.value() << "\n";
    // c.value_ = 99;                        // 错误：value_ 是 private
    return 0;                                // main 结束时自动调用析构
}
