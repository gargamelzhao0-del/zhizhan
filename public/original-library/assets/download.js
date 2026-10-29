(() => {
  try { const theme=localStorage.getItem('mtheme');if(theme==='paper')document.documentElement.dataset.theme='paper'; } catch {}
  if(window.AndroidBridge)document.documentElement.classList.add('native-insets');
  document.addEventListener('click',event=>{
    const a=event.target.closest('a[download]');
    if(!a||!window.AndroidBridge?.exportAsset)return;
    const url=new URL(a.href);
    if(url.protocol!=='file:'||!url.pathname.startsWith('/android_asset/www/'))return;
    event.preventDefault();
    const ok=window.AndroidBridge.exportAsset(decodeURIComponent(url.pathname.slice('/android_asset/www/'.length)));
    if(!ok)window.MobileReader?.toast('无法打开保存位置，请稍后重试');
  });
  if(document.body.classList.contains('m-project-page')){
    for(const [key,property,defaultValue,min,max] of [['mfs','--m-fs',18,16,24],['mcodefs','--m-code-fs',14,12,20],['mlh','--m-lh',1.8,1.5,2.2]]){
      let value=defaultValue;try{const stored=localStorage.getItem(key);if(stored!==null&&Number.isFinite(+stored))value=Math.max(min,Math.min(max,+stored));}catch{}
      document.documentElement.style.setProperty(property,value+(property==='--m-lh'?'':'px'));
    }
    window.AndroidBridge?.themeChanged?.(document.documentElement.dataset.theme==='paper'?'paper':'ink');
    document.querySelectorAll('figure img').forEach(img=>{
      const link=document.createElement('a');link.href=img.src;link.setAttribute('aria-label','查看原图：'+(img.alt||'工程结果图'));img.replaceWith(link);link.append(img);
      const hint=document.createElement('a');hint.className='m-image-original';hint.href=img.src;hint.textContent='查看原图';img.closest('figure').append(hint);
    });

    document.addEventListener('click',async event=>{
      const button=event.target.closest('.copy-btn');if(!button)return;
      const pre=button.closest('.codeblk').querySelector('pre');
      try{
        if(window.AndroidBridge){if(!window.AndroidBridge.copy(pre.innerText))throw new Error('copy');}
        else if(navigator.clipboard)await navigator.clipboard.writeText(pre.innerText);
        else { const box=document.createElement('textarea');box.value=pre.innerText;document.body.append(box);box.select();const ok=document.execCommand('copy');box.remove();if(!ok)throw new Error('copy'); }
        button.textContent='已复制';
      }catch{button.textContent='请长按选择';}
      setTimeout(()=>button.textContent='复制',1800);
    });
  }
})();
