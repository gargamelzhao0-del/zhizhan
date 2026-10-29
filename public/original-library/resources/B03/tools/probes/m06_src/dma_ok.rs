#![no_std]
// DMA 发送：传输期间借用缓冲，借用检查器禁止你此时改动它
pub struct DmaTx<'a> { buf: &'a [u8], active: bool }
impl<'a> DmaTx<'a> {
    pub fn start(buf: &'a [u8]) -> Self { Self { buf, active: true } }
    pub fn busy(&self) -> bool { self.active }
    pub fn len(&self) -> usize { self.buf.len() }
}
pub fn demo(buf: &mut [u8]) {
    buf[0] = 1;
    let tx = DmaTx::start(buf);   // 共享借用 buf；此后不能再可变借用
    while tx.busy() { /* 等 DMA 完成 */ }
    let _ = tx.len();
}
