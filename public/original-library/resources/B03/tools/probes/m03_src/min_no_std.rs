#![no_std]
#![no_main]
use core::panic::PanicInfo;

#[panic_handler]
fn panic(_: &PanicInfo) -> ! { loop {} }

static mut COUNTER: u32 = 0;

#[no_mangle]
pub extern "C" fn reset_handler() -> ! {
    unsafe { COUNTER = 0; }
    loop { unsafe { COUNTER = COUNTER.wrapping_add(1); } }
}
