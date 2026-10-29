#include <iostream>

namespace gpio {
    int pin = 13;
    void high() { std::cout << "pin " << pin << " -> HIGH\n"; }
}
namespace uart {
    int pin = 17;
}

int main()
{
    gpio::high();
    std::cout << "uart pin = " << uart::pin << "\n";
    return 0;
}
