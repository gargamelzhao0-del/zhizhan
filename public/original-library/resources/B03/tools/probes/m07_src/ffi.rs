#![no_std]
// 与 C 互调：声明外部 C 符号，并在安全函数里封装
extern "C" {
    fn c_checksum(data: *const u8, len: usize) -> u32;
}
pub fn checksum(data: &[u8]) -> u32 {
    unsafe { c_checksum(data.as_ptr(), data.len()) }   // 唯一的不安全点
}
// Rust 导出给 C 用
#[no_mangle]
pub extern "C" fn rs_add(a: u32, b: u32) -> u32 { a.wrapping_add(b) }
