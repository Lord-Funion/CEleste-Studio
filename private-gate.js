(()=>{
  'use strict';
  const EXPECTED_SHA256='d19377fe38bedeedf51da2e50e394c833fdad6bbecf1e2c2582d2dd1cd143b13';
  const SESSION_KEY='celeste-studio-private-unlocked-v1';
  let unlocking=false;

  async function sha256(text){
    if(!globalThis.crypto?.subtle)throw new Error('This private gate requires HTTPS or localhost so Web Crypto is available.');
    const bytes=new TextEncoder().encode(String(text));
    const digest=await crypto.subtle.digest('SHA-256',bytes);
    return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
  }

  // Requested JavaScript password function. This deliberately gates the UI in
  // the browser; it is not a substitute for server-side authentication.
  window.celestePrivatePassword=async password=>(await sha256(password))===EXPECTED_SHA256;
  window.celestePrivateLogout=()=>{sessionStorage.removeItem(SESSION_KEY);location.reload();};

  async function updateCartButton(){
    const btn=document.getElementById('privateCartButton');
    if(!btn)return;
    const {getPrivateCartInfo,pickAndStorePrivateCart}=await import('./lib/private-cart.mjs');
    const refresh=async()=>{
      const info=await getPrivateCartInfo();
      btn.textContent=info?`Original cart: ${info.name}`:'Set original Celeste .p8';
      btn.title=info?'Stored only in this browser. Click to replace it.':'Choose your own original Celeste Classic text .p8 cart. It never uploads to the server.';
    };
    btn.onclick=async()=>{
      try{const saved=await pickAndStorePrivateCart();if(saved)await refresh();}
      catch(err){alert(err?.message||String(err));}
    };
    window.addEventListener('celeste-private-cart-changed',refresh);
    await refresh();
  }

  async function unlock(){
    if(unlocking)return;unlocking=true;
    const error=document.getElementById('privateGateError');
    try{
      // Keep the editor hidden until every runtime module is ready. A failed
      // import therefore leaves the password/error screen visible, not a half-loaded app.
      await import('./app.js?v=20260808-private-original-cart-v2');
      await import('./interaction-fix.js?v=20260808-rotation-map2');
      await updateCartButton();
      document.documentElement.classList.remove('private-locked');
      document.getElementById('privateGate')?.remove();
    }catch(err){
      sessionStorage.removeItem(SESSION_KEY);
      if(error)error.textContent=`Studio failed to load: ${err?.message||err}`;
      console.error(err);
    }finally{unlocking=false;}
  }

  async function submit(){
    const input=document.getElementById('privatePassword');
    const error=document.getElementById('privateGateError');
    const button=document.getElementById('privateGateSubmit');
    if(!input||!button)return;
    button.disabled=true;if(error)error.textContent='';
    try{
      if(await window.celestePrivatePassword(input.value)){
        sessionStorage.setItem(SESSION_KEY,'1');
        await unlock();
      }else{
        if(error)error.textContent='Wrong password.';input.select();
      }
    }catch(err){if(error)error.textContent=err?.message||String(err);}
    finally{button.disabled=false;}
  }

  window.addEventListener('DOMContentLoaded',()=>{
    if(sessionStorage.getItem(SESSION_KEY)==='1'){unlock();return;}
    const input=document.getElementById('privatePassword');
    document.getElementById('privateGateSubmit')?.addEventListener('click',submit);
    input?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();submit();}});
    input?.focus();
  });
})();
