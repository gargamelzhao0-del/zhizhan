fn main() {
    let name = "Rust";          // 不可变绑定
    let mut n = 0;              // 可变绑定
    n += 1;
    let pi = 3.14;              // 类型由字面量推断为 f64
    println!("Hello, {}!", name);
    println!("n = {}, pi = {}", n, pi);
    let sum: i32 = (1..=5).sum();   // 1+2+3+4+5
    println!("sum 1..=5 = {}", sum);
}
