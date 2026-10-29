#[derive(Clone)]
struct Buf { data: [u8; 4] }

fn consume(b: Buf) {                 // 取得所有权
    println!("consume 拿到 Buf, data[0] = {}", b.data[0]);
}

fn main() {
    let a = Buf { data: [1, 2, 3, 4] };
    consume(a);                      // a 被移动进 consume
    // println!("{}", a.data[0]);    // 取消注释会编译错误：a 已被移动

    let x = 5;                       // i32 是 Copy：赋值/传参是复制
    let y = x;
    println!("x = {}, y = {} (Copy: x 仍可用)", x, y);

    let s = String::from("hi");
    let t = s.clone();               // 需要复制堆数据时显式 clone
    println!("s = {}, t = {}", s, t);
}
