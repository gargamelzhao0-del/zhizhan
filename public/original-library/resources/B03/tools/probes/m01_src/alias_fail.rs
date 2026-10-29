#![no_std]
// 反面：同一时刻两个可变借用
pub fn bad() {
    let mut a = [0u8; 4];
    let r1 = &mut a;
    let r2 = &mut a;   // 错误：cannot borrow `a` as mutable more than once
    r1[0] = 1;
    r2[0] = 2;
}
