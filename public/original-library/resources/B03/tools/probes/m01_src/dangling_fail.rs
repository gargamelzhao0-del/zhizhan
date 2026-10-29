#![no_std]
// 反面：返回局部变量的引用 —— 编译器直接拒绝
pub fn bad() -> &'static u8 {
    let x = 5u8;
    &x          // 错误：`x` does not live long enough
}
