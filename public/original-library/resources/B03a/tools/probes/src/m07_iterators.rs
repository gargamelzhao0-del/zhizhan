fn longest<'a>(a: &'a str, b: &'a str) -> &'a str {   // 生命周期标注
    if a.len() >= b.len() { a } else { b }
}

fn main() {
    let nums = vec![1, 2, 3, 4, 5, 6];
    let evens_sq: Vec<i32> = nums.iter()
        .filter(|&&x| x % 2 == 0)      // 闭包捕获
        .map(|&x| x * x)
        .collect();
    println!("evens squared = {:?}", evens_sq);

    let add = |a, b| a + b;            // 闭包
    println!("add(2,3) = {}", add(2, 3));

    println!("longest = {}", longest("hello", "hi"));
}
