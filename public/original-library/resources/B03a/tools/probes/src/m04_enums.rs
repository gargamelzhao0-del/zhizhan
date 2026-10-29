#[derive(Debug)]
enum Shape { Circle(f64), Rect(f64, f64) }

impl Shape {
    fn area(&self) -> f64 {
        match self {                            // 模式匹配：穷尽所有变体
            Shape::Circle(r) => 3.14159 * r * r,
            Shape::Rect(w, h) => w * h,
        }
    }
}

fn find_first_even(xs: &[i32]) -> Option<i32> {   // Some / None
    for &x in xs { if x % 2 == 0 { return Some(x); } }
    None
}

fn main() {
    let shapes = [Shape::Circle(1.0), Shape::Rect(2.0, 3.0)];
    for s in &shapes { println!("area = {:.2}", s.area()); }

    match find_first_even(&[1, 3, 4, 7]) {
        Some(v) => println!("first even = {v}"),
        None => println!("no even"),
    }
    if let Some(v) = find_first_even(&[1, 3]) { println!("even {v}"); } else { println!("none"); }
}
