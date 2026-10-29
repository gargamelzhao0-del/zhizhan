fn len(xs: &[i32]) -> usize { xs.len() }      // 共享借用（只读）

fn double_all(xs: &mut [i32]) {               // 可变借用（可写）
    for v in xs.iter_mut() { *v *= 2; }
}

fn main() {
    let mut data = vec![1, 2, 3];
    double_all(&mut data);                     // 独占可变借用
    println!("doubled = {:?}, len = {}", data, len(&data));  // 之后才共享借用
}
