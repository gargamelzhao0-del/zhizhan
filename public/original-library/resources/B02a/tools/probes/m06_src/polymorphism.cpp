#include <iostream>
#include <vector>
#include <memory>

class Shape {
public:
    virtual double area() const = 0;          /* 纯虚：抽象类 */
    virtual ~Shape() = default;
};
class Circle : public Shape {
    double r_;
public:
    explicit Circle(double r) : r_(r) {}
    double area() const override { return 3.14159 * r_ * r_; }
};
class Rect : public Shape {
    double w_, h_;
public:
    Rect(double w, double h) : w_(w), h_(h) {}
    double area() const override { return w_ * h_; }
};

int main()
{
    std::vector<std::unique_ptr<Shape>> shapes;
    shapes.push_back(std::make_unique<Circle>(2.0));
    shapes.push_back(std::make_unique<Rect>(3.0, 4.0));
    for (const auto &s : shapes)               /* 通过基类指针多态调用 */
        std::cout << "area = " << s->area() << "\n";
    return 0;
}
