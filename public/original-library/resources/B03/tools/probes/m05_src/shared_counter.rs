#![no_std]
use core::sync::atomic::{AtomicU32, Ordering};

static COUNT: AtomicU32 = AtomicU32::new(0);

// 中断里：一次原子加
#[no_mangle] pub extern "C" fn isr_tick() { COUNT.fetch_add(1, Ordering::Relaxed); }
// 主循环：读快照
#[no_mangle] pub extern "C" fn snapshot() -> u32 { COUNT.load(Ordering::Relaxed) }
