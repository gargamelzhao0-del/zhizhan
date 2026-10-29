trait Area { fn area(&self) -> f64; }           // 定义接口

#[derive(Debug)]
struct Rect { w: f64, h: f64 }
impl Area for Rect {                             // 实现 trait
    fn area(&self) -> f64 { self.w * self.h }
}
impl Rect {                                      // 普通方法
    fn new(w: f64, h: f64) -> Self { Rect { w, h } }
}

fn print_area<T: Area>(x: &T) { println!("area = {:.2}", x.area()); }   // 泛型 + trait 约束

fn main() {
    let r = Rect::new(3.0, 4.0);
    println!("{:?}", r);                         // #[derive(Debug)] 支持 {:?}
    print_area(&r);
}
