#![no_std]
// 反面：不带原子/临界保护地共享 static mut —— 数据竞争
static mut COUNT: u32 = 0;
pub fn isr_tick() { unsafe { COUNT = COUNT.wrapping_add(1); } }   // 读-改-写，非原子
pub fn snapshot() -> u32 { unsafe { COUNT } }
