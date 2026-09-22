(() => {
  const logout=document.getElementById('logoutBtn');
  if (!logout || typeof sb==='undefined') return;
  const btn=document.createElement('button');
  btn.type='button';btn.className='icon-btn';btn.textContent='Новый код';
  btn.title='Создать новый код владельца на этом устройстве';
  btn.hidden=true;btn.style.width='auto';btn.style.padding='0 10px';
  logout.parentNode.insertBefore(btn,logout);
  async function visibility(){
    try {
      const {data,error}=await sb.auth.getUser();
      const u=data?.user;
      btn.hidden=!!error || !u || u.email!=='owner@content-center.local' || u.app_metadata?.role!=='content_center_owner';
    } catch {btn.hidden=true;}
  }
  function showCode(value){
    const overlay=document.createElement('div');
    overlay.style.cssText='position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.78);display:grid;place-items:center;padding:20px';
    const panel=document.createElement('div');
    panel.style.cssText='width:min(100%,460px);background:#151b23;color:white;border:1px solid #566271;border-radius:20px;padding:24px;display:grid;gap:16px';
    const title=document.createElement('h2');title.textContent='Ваш новый код владельца';
    const note=document.createElement('p');note.textContent='Код показан один раз. Скопируйте и сохраните его. Старые коды пока остаются действительными.';
    const field=document.createElement('input');field.type='text';field.value=value;field.readOnly=true;field.autocomplete='off';
    field.style.cssText='width:100%;box-sizing:border-box;padding:14px;border-radius:10px;border:1px solid #566271;background:#f5f7fb;color:#18202a;font-size:14px';
    const copy=document.createElement('button');copy.className='primary';copy.textContent='Скопировать код';
    copy.onclick=async()=>{field.focus();field.select();try{await navigator.clipboard.writeText(field.value);copy.textContent='Код скопирован';}catch{copy.textContent='Код выделен: нажмите «Копировать»';}};
    const close=document.createElement('button');close.className='icon-btn';close.textContent='Закрыть';
    close.onclick=()=>{field.value='';overlay.remove();};
    panel.append(title,note,field,copy,close);overlay.append(panel);document.body.append(overlay);
  }
  btn.addEventListener('click',async()=>{
    if(btn.disabled || !window.confirm('Создать новый код владельца? Существующие коды пока не отзываются.'))return;
    btn.disabled=true;
    try{
      const {data,error}=await sb.auth.getSession();
      if(error || !data?.session?.access_token)throw Error('Сессия истекла. Войдите снова.');
      const response=await fetch(SUPABASE_URL+'/functions/v1/rotate-owner-code',{
        method:'POST',headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY,'Authorization':'Bearer '+data.session.access_token},
        body:'{}',cache:'no-store'
      });
      const payload=await response.json();
      if(!response.ok || typeof payload.code!=='string')throw Error('Не удалось создать код: '+(payload.error||response.status));
      showCode(payload.code);
    }catch(error){toast(error.message||'Ошибка создания кода',true);}
    finally{btn.disabled=false;}
  });
  visibility();
  sb.auth.onAuthStateChange(()=>setTimeout(visibility,0));
})();
