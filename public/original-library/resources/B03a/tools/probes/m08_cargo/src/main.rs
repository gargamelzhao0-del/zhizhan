fn add(a: i32, b: i32) -> i32 { a + b }
fn is_even(n: i32) -> bool { n % 2 == 0 }

fn main() {
    println!("add(2,3) = {}", add(2, 3));
    println!("is_even(4) = {}", is_even(4));
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn test_add() { assert_eq!(add(2, 3), 5); }
    #[test]
    fn test_is_even() { assert!(is_even(4)); assert!(!is_even(5)); }
}
