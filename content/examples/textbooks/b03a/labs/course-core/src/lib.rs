//! Minimal versioned crate: parsing, traits, borrowing and host concurrency.
#![cfg_attr(not(feature = "host"), no_std)]
#[derive(Debug, PartialEq)]
pub enum SampleError { Parse, NonFinite, End }
pub trait Source {
    type Error;
    fn next(&mut self) -> Result<f64, Self::Error>;
}
pub fn acquire<S:Source>(source:&mut S)->Result<f64,S::Error>{source.next()}
pub fn parse(text:&str)->Result<f64,SampleError>{
    let v=text.trim().parse::<f64>().map_err(|_|SampleError::Parse)?;
    if !v.is_finite(){return Err(SampleError::NonFinite)}
    Ok(v)
}
/// A live element reference prevents a vector mutation that may relocate storage.
/// ```compile_fail
/// let mut v = vec![1, 2];
/// let first = &v[0];
/// v.push(3);
/// println!("{}", first);
/// ```
pub fn borrow_rule(){}
/// Rc is not Send; choose message ownership or Arc with appropriate synchronization.
/// ```compile_fail
/// let p = std::rc::Rc::new(1);
/// std::thread::spawn(move || println!("{}", p));
/// ```
pub fn send_rule(){}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]fn input_contract(){assert_eq!(parse("2.5"),Ok(2.5));assert_eq!(parse("NaN"),Err(SampleError::NonFinite));assert_eq!(parse("bad"),Err(SampleError::Parse));}
    struct Once(bool);
    impl Source for Once{type Error=SampleError;fn next(&mut self)->Result<f64,SampleError>{if self.0{Err(SampleError::End)}else{self.0=true;Ok(3.0)}}}
    #[test]fn traits(){let mut source=Once(false);assert_eq!(acquire(&mut source),Ok(3.0));let dyn_source:&mut dyn Source<Error=SampleError>=&mut source;assert_eq!(dyn_source.next(),Err(SampleError::End));}
    #[cfg(feature="host")]
    #[test]fn bounded_messages(){
        let(tx,rx)=std::sync::mpsc::sync_channel(2);
        let task=std::thread::spawn(move||{for i in 1..=4{tx.send(i).unwrap();}});
        let sum:i32=rx.iter().sum();task.join().unwrap();assert_eq!(sum,10);
    }
    #[cfg(feature="host")]
    #[test]fn synchronized_state(){
        use std::sync::{Arc,Mutex};
        let n=Arc::new(Mutex::new(0));let mut tasks=std::vec::Vec::new();
        for _ in 0..4{let n=n.clone();tasks.push(std::thread::spawn(move||{for _ in 0..100{*n.lock().unwrap()+=1;}}));}
        for task in tasks{task.join().unwrap();}assert_eq!(*n.lock().unwrap(),400);
    }
}
