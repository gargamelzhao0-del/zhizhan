//! no_std ownership model. Only a synchronous mock abort is implemented.
//! A real DMA adapter must prove the peripheral has stopped before returning the buffer.
#![no_std]
pub struct Channel {busy:bool}
pub struct Transfer<'a>{channel:&'a mut Channel,buffer:&'a mut [u8]}
impl Default for Channel{fn default()->Self{Self{busy:false}}}
impl Channel{
    pub fn start<'a>(&'a mut self,buffer:&'a mut [u8])->Transfer<'a>{assert!(!self.busy);self.busy=true;Transfer{channel:self,buffer}}
    pub fn busy(&self)->bool{self.busy}
}
impl Transfer<'_>{pub fn mock_progress(&mut self){if let Some(x)=self.buffer.first_mut(){*x=7;}}}
impl Drop for Transfer<'_>{fn drop(&mut self){self.channel.busy=false; /* synchronous mock stop; not real DMA shutdown */}}
#[cfg(test)]mod tests{use super::*;
    #[test]fn cancel_and_reuse(){let mut c=Channel::default();let mut b=[0;4];
        {let mut t=c.start(&mut b);t.mock_progress();}
        assert!(!c.busy());assert_eq!(b[0],7);
        {let _t=c.start(&mut b);}assert!(!c.busy());
    }
}
