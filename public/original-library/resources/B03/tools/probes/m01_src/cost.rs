#![no_std]
// 借用/所有权在运行期不留痕迹：下面函数编译成纯循环
#[no_mangle]
pub extern "C" fn sum(xs: *const u8, n: usize) -> u32 {
    let mut s = 0u32; let mut i = 0usize;
    while i < n { s = s.wrapping_add(unsafe { *xs.add(i) } as u32); i += 1; }
    s
}
#[no_mangle]
pub extern "C" fn add(a: u32, b: u32) -> u32 { a.wrapping_add(b) }
