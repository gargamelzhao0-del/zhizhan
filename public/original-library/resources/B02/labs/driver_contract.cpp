// Host adapter contract; this does not execute a peripheral or measure an MCU image.
#include <array>
#include <cassert>
#include <iostream>
enum class Error { ok, bus, empty };
struct Reading {Error error;int raw;};
struct MockBus {
    bool failed=false;
    Reading read(){return failed?Reading{Error::bus,0}:Reading{Error::ok,2048};}
};
template<class Bus> class Sampler {
    Bus &bus;
    std::array<int,4> samples{};
    unsigned count=0;
public:
    explicit Sampler(Bus &b):bus(b){}
    Error step(){auto r=bus.read();if(r.error!=Error::ok)return r.error;
        if(count==samples.size())return Error::empty;
        samples[count++]=r.raw;return Error::ok;}
    unsigned size()const{return count;}
};
int main(){MockBus bus;Sampler<MockBus> s(bus);
    assert(s.step()==Error::ok && s.size()==1);
    bus.failed=true;assert(s.step()==Error::bus && s.size()==1);
    bus.failed=false;for(int i=0;i<3;i++)assert(s.step()==Error::ok);
    assert(s.step()==Error::empty && s.size()==4);
    std::cout<<"adapter/failure/no-write-on-error/fixed-capacity: RESULT: PASS\n";
}
