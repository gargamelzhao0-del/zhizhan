#![no_std]
// 用安全 API 包住一处必要的不安全：外部只需调用 read_sensor()
pub struct Mmio { addr: *const u32 }
impl Mmio {
    pub fn new(addr: u32) -> Self { Self { addr: addr as *const u32 } }
    // 安全契约：addr 必须是有效的只读寄存器地址
    pub fn read(&self) -> u32 { unsafe { core::ptr::read_volatile(self.addr) } }
}
pub fn read_sensor() -> u32 { Mmio::new(0x4001_2000).read() }
