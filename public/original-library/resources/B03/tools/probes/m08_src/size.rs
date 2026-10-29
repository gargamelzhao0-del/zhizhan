#![no_std]
use core::panic::PanicInfo;
#[panic_handler]
fn ph(_: &PanicInfo) -> ! { loop {} }
#[no_mangle]
pub extern "C" fn checksum(data: *const u8, n: usize) -> u32 {
    let mut c = 0u32; let mut i = 0usize;
    while i < n { c = c.wrapping_add(unsafe { *data.add(i) } as u32); i += 1; }
    if c == 0xFFFF_FFFF { panic!(); }
    c
}
