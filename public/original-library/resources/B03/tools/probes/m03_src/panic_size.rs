#![no_std]
use core::panic::PanicInfo;
#[panic_handler]
fn ph(_: &PanicInfo) -> ! { loop {} }

#[no_mangle]
pub extern "C" fn plain(x: u32) -> u32 {
    if x == 0 { panic!() }            // 无格式化
    x
}
#[no_mangle]
pub extern "C" fn formatted(x: u32) -> u32 {
    if x == 0 { panic!("bad {}", x) } // 带格式化
    x
}
