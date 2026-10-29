#![no_std]
pub struct DmaTx<'a> { buf: &'a [u8] }
impl<'a> DmaTx<'a> { pub fn start(buf: &'a [u8]) -> Self { Self { buf } } }
pub fn bad(buf: &mut [u8]) {
    let tx = DmaTx::start(buf);   // 共享借用
    buf[0] = 2;                   // 错误：已有共享借用时不能再可变借用
    let _ = tx.buf.len();
}
