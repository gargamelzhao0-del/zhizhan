// C++20, complete host exercise: value semantics, invalidation and non-owning views.
#include <algorithm>
#include <cassert>
#include <concepts>
#include <iostream>
#include <memory>
#include <span>
#include <stdexcept>
#include <vector>
class Buffer {
    std::size_t n_;
    std::unique_ptr<double[]> p_;
public:
    explicit Buffer(std::size_t n): n_(n),p_(n?std::make_unique<double[]>(n):nullptr) {}
    Buffer(const Buffer &b):Buffer(b.n_){if(n_)std::copy_n(b.p_.get(),n_,p_.get());}
    Buffer(Buffer &&b) noexcept:n_(b.n_),p_(std::move(b.p_)){b.n_=0;}
    void swap(Buffer &b) noexcept {std::swap(n_,b.n_);p_.swap(b.p_);}
    Buffer &operator=(Buffer b) noexcept {swap(b);return *this;}
    std::span<double> view(){return {p_.get(),n_};}
};
template<std::floating_point T>
T mean(std::span<const T> values){
    if(values.empty())throw std::invalid_argument("empty samples");
    T sum=0; for(T v:values)sum+=v;
    return sum/static_cast<T>(values.size());
}
int main(){
    Buffer a(3); a.view()[0]=2; a.view()[1]=4; a.view()[2]=6;
    Buffer b=a; b.view()[0]=8; assert(a.view()[0]==2);
    a=a; assert(a.view()[0]==2);
    Buffer moved=std::move(b); assert(b.view().empty() && moved.view()[0]==8);
    assert(mean<double>(a.view())==4);
    try {mean<double>({});assert(false);}catch(const std::invalid_argument&){}
    std::vector<int> v={3,1,2};
    // Sort may change positions; reserve/push may invalidate addresses. Keep values/indices, not stale pointers.
    int saved=v[0];v.reserve(100);v.push_back(4);assert(saved==3);
    std::ranges::sort(v);assert(v.front()==1 && v.back()==4);
    std::cout<<"copy/move/self-assignment/view/empty-input/container: RESULT: PASS\n";
}
