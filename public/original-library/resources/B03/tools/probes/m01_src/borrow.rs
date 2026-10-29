#![no_std]
pub fn sum(xs: &[u8]) -> u32 {
    let mut s = 0u32; let mut i = 0usize;
    while i < xs.len() { s = s.wrapping_add(xs[i] as u32); i += 1; }
    s
}
pub fn inc(xs: &mut [u8]) {
    let mut i = 0usize;
    while i < xs.len() { xs[i] = xs[i].wrapping_add(1); i += 1; }
}
pub fn demo() -> u32 {
    let mut a = [1u8, 2, 3];
    inc(&mut a);       // 独占借用
    sum(&a)            // 之后才共享借用
}
