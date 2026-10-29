#![no_std]
// move：把所有权交出去后，原绑定不可再用
pub struct Buf { data: [u8; 8] }

pub fn consume(b: Buf) -> u8 { b.data[0] }

pub fn demo() -> u8 {
    let b = Buf { data: [0; 8] };
    let s = consume(b);      // 所有权移入 consume
    // let t = b.data[0];    // 编译错误：use of moved value: `b`
    s
}
