#![no_std]
#![no_main]
// 有 panic 路径（索引越界会 panic），但没有 #[panic_handler]
#[no_mangle]
pub extern "C" fn first(x: &[u8]) -> u8 { x[0] }
