use std::collections::HashMap;

fn parse_int(s: &str) -> Result<i32, std::num::ParseIntError> {
    let n: i32 = s.trim().parse()?;              // ? 传播错误
    Ok(n)
}

fn main() {
    let mut v: Vec<i32> = Vec::new();
    for i in 1..=4 { v.push(i * i); }
    println!("vec = {:?}, sum = {}", v, v.iter().sum::<i32>());

    let s = String::from("hello");
    println!("len = {}, upper = {}", s.len(), s.to_uppercase());

    let mut counts: HashMap<&str, i32> = HashMap::new();
    for w in ["a", "b", "a", "a"] { *counts.entry(w).or_insert(0) += 1; }
    println!("a = {}, b = {}", counts["a"], counts["b"]);

    match parse_int("42") {
        Ok(n) => println!("parsed = {n}"),
        Err(e) => println!("error: {e}"),
    }
}
