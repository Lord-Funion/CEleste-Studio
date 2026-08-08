(()=>{
  'use strict';
  const EXPECTED='f0b2d6898215223a2108852a2f90913b6371af8e2ae89360ddb02f8fbf417af7';
  const SESSION_KEY='celeste-studio-private-unlocked-v1';

  async function sha256(text){
    const bytes=new TextEncoder().encode(String(text));
    const digest=await crypto.subtle.digest('SHA-256',bytes);
    return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
  }

  // Requested JavaScript password function. This is intentionally client-side;
  // it gates the UI but is not equivalent to server-side HTTP authentication.
  window.celestePrivatePassword=async password=>(await sha256(password))===EXPECTED;

  async function updateCartButton(){
    const btn=document.getElementById('privateCartButton');
    if(!btn)return;
    const {getPrivateCartInfo,pickAndStorePrivateCart}=await import('./lib/private-cart.mjs');
    const refresh=async()=>{
      const info=await getPrivateCartInfo();
      btn.textContent=info?`Original cart: ${info.name}`:'Set original Celeste .p8';
      btn.title=info?'Stored only in this browser. Click to replace it.':'Choose your own original Celeste Classic text .p8 cart for exact-cartridge preview physics.';
    };
    btn.onclick=async()=>{
      try{const saved=await pickAndStorePrivateCart();if(saved)await refresh();}
      catch(err){alert(err?.message||String(err));}
    };
    await refresh();
  }

  async function unlock(){
    document.documentElement.classList.remove('private-locked');
    document.getElementById('privateGate')?.remove();
    await import('./app.js?v=20260808-private-real-cart');
    await import('./interaction-fix.js?v=20260808-rotation-map2');
    await updateCartButton();
  }

  async function submit(){
    const input=document.getElementById('privatePassword');
    const error=document.getElementById('privateGateError');
    const button=document.getElementById('privateGateSubmit');
    button.disabled=true;error.textContent='';
    try{
      if(await window.celestePrivatePassword(input.value)){
        sessionStorage.setItem(SESSION_KEY,'1');
        await unlock();
      }else{
        error.textContent='Wrong password.';input.select();
      }
    }finally{button.disabled=false;}
  }

  window.addEventListener('DOMContentLoaded',()=>{
    if(sessionStorage.getItem(SESSION_KEY)==='1'){unlock();return;}
    const input=document.getElementById('privatePassword');
    document.getElementById('privateGateSubmit')?.addEventListener('click',submit);
    input?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();submit();}});
    input?.focus();
  });
})();
