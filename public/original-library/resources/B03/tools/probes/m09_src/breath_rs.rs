#![no_std]
// 定时器 PWM 呼吸灯：同一功能，Rust 版
#[no_mangle]
pub extern "C" fn breath_rs(arr: *mut u32, period: u32) {
    let mut d: u32 = 0;
    while d < period {
        unsafe { core::ptr::write_volatile(arr, d); }
        let mut i: u32 = 0;
        while i < period { i += 1; }
        d += 1;
    }
}
