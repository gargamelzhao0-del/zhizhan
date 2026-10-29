#include <iostream>
#include <vector>
#include <string>
#include <map>

template <class T>
T max_of(const T &a, const T &b) { return a > b ? a : b; }   /* 函数模板 */

int main()
{
    std::cout << "max_of(3,7) = " << max_of(3, 7) << "\n";
    std::cout << "max_of(2.5,1.5) = " << max_of(2.5, 1.5) << "\n";

    std::vector<int> v;
    for (int i = 1; i <= 5; i++) v.push_back(i * i);          /* 动态数组 */
    int sum = 0;
    for (int x : v) sum += x;                                 /* 范围 for */
    std::cout << "sum of squares 1..5 = " << sum << "\n";

    std::map<std::string, int> counts;                        /* 键值表 */
    counts["a"]++; counts["a"]++; counts["b"]++;
    std::cout << "a=" << counts["a"] << " b=" << counts["b"] << "\n";
    return 0;
}
