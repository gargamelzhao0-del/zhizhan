(() => {
  window.AndroidBridge?.themeChanged?.('ink');
  let books=[];try{books=JSON.parse(document.getElementById('shelfBooks').textContent);}catch{return;}
  let latest=null;
  for(const b of books){try{
    const p=JSON.parse(localStorage.getItem('mpos:'+b.id)||'null');
    if(p&&p.id&&(!latest||p.updated>latest.position.updated))latest={book:b,position:p};
    const done=JSON.parse(localStorage.getItem('mdone:'+b.id)||'{}');
    const count=Object.values(done).filter(Boolean).length;
    const card=document.querySelector('.card[data-id="'+b.id+'"] .card-meta');
    if(card&&count)card.textContent=b.modules+' 模块 · 已阅读 '+count+' 项';
  }catch{}}
  if(!latest)return;
  const box=document.getElementById('shelfContinue');box.hidden=false;
  const label=document.createElement('p');label.textContent='上次阅读：'+latest.book.name+' · '+latest.position.title;
  const link=document.createElement('a');link.href='books/'+latest.book.id+'.html?resume=1#'+encodeURIComponent(latest.position.id);link.textContent='继续阅读';
  box.append(label,link);
})();
