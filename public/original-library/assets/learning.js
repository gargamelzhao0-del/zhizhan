(function(){'use strict';
  var base=new URL('.',document.currentScript.src),relative=new URL(location.href).pathname.replace(base.pathname,'');
  var key='ec_mobile_mastery_v1:'+(document.documentElement.dataset.vol||relative),state={};
  try{state=JSON.parse(localStorage.getItem(key)||'{}');if(!state||typeof state!=='object')state={};}catch(e){}
  document.querySelectorAll('[data-assess]').forEach(function(panel){
    var id=panel.dataset.assess,items=Array.from(panel.querySelectorAll('[data-criterion]'));
    items.forEach(function(item){item.checked=!!(state[id]&&state[id][item.dataset.criterion]);item.addEventListener('change',function(){state[id]={};items.forEach(function(box){state[id][box.dataset.criterion]=box.checked;});try{localStorage.setItem(key,JSON.stringify(state));}catch(e){}update();});});
    function update(){var count=items.filter(function(item){return item.checked;}).length;panel.dataset.complete=String(count===3);panel.querySelector('.mastery-status').textContent=count===3?'已完成自评':(count?count+'/3 项':'未记录');}
    update();
  });
  function revealHash(){
    var id;try{id=decodeURIComponent(location.hash.slice(1));}catch(e){return;}
    var target=document.getElementById(id);if(!target)return;
    for(var node=target.parentElement;node;node=node.parentElement){if(node.tagName==='DETAILS')node.open=true;}
  }
  document.addEventListener('click',function(event){var a=event.target.closest('a[href^="#"]');if(a)setTimeout(revealHash,0);});
  window.addEventListener('hashchange',revealHash);revealHash();
})();
