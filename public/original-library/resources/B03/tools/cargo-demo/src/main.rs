// int_exception.rs —— 用 cortex-m-rt 注册 SysTick 异常处理器
#![no_std]
#![no_main]
use panic_halt as _;
use core::sync::atomic::{AtomicU32, Ordering};
use cortex_m::interrupt;
use cortex_m_rt::{entry, exception};

static COUNT: AtomicU32 = AtomicU32::new(0);

#[exception]
fn SysTick() {
    // 中断上下文：一次原子加（M3）。M0 上应改为临界区（见 §5.2）
    COUNT.fetch_add(1, Ordering::Relaxed);
}

#[entry]
fn main() -> ! {
    loop {
        let _snapshot = interrupt::free(|_cs| COUNT.load(Ordering::Relaxed));
        core::hint::spin_loop();
    }
}