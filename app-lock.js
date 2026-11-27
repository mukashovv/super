const appLock = (() => {
 const F=Finance;
 const hasBook=()=>typeof book!=='undefined' && book;
 const panel=document.createElement('dialog');
 panel.className='pin-panel';
 panel.setAttribute('aria-labelledby','pin-title');
 document.body.append(panel);
 let startupId=null;
 const key=()=> 'st.lock.'+(startupId||F.userId);
 const read=()=>JSON.parse(localStorage.getItem(key())||'null');
 const save=settings=>localStorage.setItem(key(),JSON.stringify(settings));
 const bytes=n=>crypto.getRandomValues(new Uint8Array(n));
 const encode=value=>btoa(String.fromCharCode(...new Uint8Array(value)));
 const decode=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
 let locked=false, lastActive=Date.now(), resume, menu;
 function screen(title,content){
   panel.classList.remove('pin-phone');
   panel.innerHTML='<h2 id="pin-title"></h2>'+content+'<p aria-live="polite" class="error"></p>';
   panel.querySelector('#pin-title').textContent=title;
   if(!panel.open)panel.showModal();
   panel.querySelector('input,button')?.focus();
 }
 panel.addEventListener('cancel',event=>{if(locked)event.preventDefault();});
 function close(){
   if(resume)document.documentElement.classList.add('pin-wait');
   startupId=null;
   locked=false;document.documentElement.classList.remove('pin-locked');
   panel.close();lastActive=Date.now();resume?.(true);resume=null;
 }
 async function digest(pin,salt){
   const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(pin),'PBKDF2',false,['deriveBits']);
   return encode(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',iterations:600000,salt:decode(salt)},material,256));
 }
 function action(label,callback){
   const button=document.createElement('button');button.type='button';button.textContent=label;
   panel.querySelector('.pin-actions').append(button);
   button.onclick=async()=>{button.disabled=true;try{await callback();}catch{panel.querySelector('.error').textContent='Не удалось выполнить действие. Попробуйте снова.';}finally{button.disabled=false;}};
 }
 const actions='<div class="pin-actions"></div>';
 const pinInput='<input required type="password" inputmode="numeric" pattern="[0-9]{4}|[0-9]{6}" maxlength="6" autocomplete="off">';
 function form(title,fields,label,submit){
   screen(title,'<form>'+fields+'<button class="primary">'+label+'</button></form>'+actions);
   panel.querySelector('form').onsubmit=async event=>{
     event.preventDefault();const f=event.currentTarget,b=f.querySelector('button');if(b.disabled)return;b.disabled=true;
     try{await submit([...f.querySelectorAll('input')].map(input=>input.value));}
     catch(error){panel.querySelector('.error').textContent=error.message;f.querySelector('input')?.select();}
     finally{b.disabled=false;}
   };
 }
 function setup(){
   form('Новый PIN','<label>PIN из 4 или 6 цифр'+pinInput+'</label><label>Повторите PIN'+pinInput+'</label>','Сохранить',async([pin,repeat])=>{
     if(pin!==repeat)throw Error('PIN-коды не совпадают.');
     const salt=encode(bytes(16));save({salt,hash:await digest(pin,salt),length:pin.length,minutes:read()?.minutes??5});close();
   });
 }
 function challenge(success,unlocking=false){
   async function verify([pin]){
     const s=read();if(s.until>Date.now())throw Error('Слишком много попыток. Подождите минуту.');
     if(await digest(pin,s.salt)!==s.hash){s.errors=(s.errors||0)+1;if(s.errors%5===0)s.until=Date.now()+60000;save(s);throw Error('Неверный PIN.');}
     s.errors=0;s.until=0;s.length=pin.length;save(s);success();
   }
   if(unlocking&&matchMedia('(max-width:640px), (pointer:coarse) and (max-height:600px)').matches)phonePad(verify);
   else form(unlocking?'Супер Таблица заблокирована':'Подтвердите PIN','<label>Введите PIN-код'+pinInput+'</label>','Подтвердить',verify);
   if(unlocking&&read()?.device)action('Разблокировать с помощью устройства',async()=>{await device(false);close();});
   action('Забыли PIN-код?',()=>{
     form('Восстановление PIN','<label>Пароль аккаунта<input required type="password" autocomplete="current-password"></label>','Продолжить',async([password])=>{
       const owner=F.userId;if(!await F.authenticate('login',F.email,password)||F.userId!==owner)throw Error('Не удалось подтвердить аккаунт.');
       setup();
     });
     action('Назад',()=>challenge(success,unlocking));
   });
   if(!unlocking)action('Отмена',close);
 }
 // The authenticator releases the same PRF output only for this credential and input.
 function phonePad(verify){
   const length=read().length;
   let value='',pending=false;
   screen(document.querySelector('meta[name="apple-mobile-web-app-title"]').content,'<p>Введите PIN-код</p><div class="pin-dots" role="status"></div><div class="pin-pad"></div>'+actions);
   panel.classList.add('pin-phone');
   const pad=panel.querySelector('.pin-pad'),dots=panel.querySelector('.pin-dots');
   function paint(){
     dots.textContent='●'.repeat(value.length)+'○'.repeat((length||6)-value.length);
     dots.setAttribute('aria-label','Введено цифр: '+value.length);
   }
   async function press(key){
     if(pending)return;
     if(key==='⌫')value=value.slice(0,-1);
     else if(key!=='✓'&&value.length<(length||6))value+=key;
     paint();
     if(key==='⌫'||!(value.length===(length||6)||(!length&&value.length===4&&key==='✓')))return;
     pending=true;
     try{await verify([value]);}
     catch(error){panel.querySelector('.error').textContent=error.message;}
     finally{pending=false;value='';paint();}
   }
   for(const key of ['1','2','3','4','5','6','7','8','9','✓','0','⌫']){
     const b=document.createElement('button');b.type='button';b.textContent=key;
     if(key==='✓'){b.style.visibility=length?'hidden':'visible';b.setAttribute('aria-label','Подтвердить PIN');}
     if(key==='⌫')b.setAttribute('aria-label','Удалить цифру');
     b.onclick=()=>press(key);pad.append(b);
   }
   paint();
   const title=panel.querySelector('#pin-title');
   title.tabIndex=-1;
   title.focus({preventScroll:true});
 }
 async function device(enroll){
   const s=read(),salt=enroll?bytes(32):decode(s.device.salt);
   let id=enroll?null:decode(s.device.id);
   if(enroll){
     const credential=await navigator.credentials.create({publicKey:{challenge:bytes(32),rp:{name:'Супер Таблица'},user:{id:bytes(32),name:F.email,displayName:F.email},pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],authenticatorSelection:{authenticatorAttachment:'platform',userVerification:'required'},extensions:{prf:{}}}});
     id=credential.rawId;
   }
   const assertion=await navigator.credentials.get({publicKey:{challenge:bytes(32),allowCredentials:[{type:'public-key',id}],userVerification:'required',extensions:{prf:{eval:{first:salt}}}}});
   const output=assertion.getClientExtensionResults().prf?.results?.first;
   if(!output)throw Error('Unsupported');
   const hash=encode(await crypto.subtle.digest('SHA-256',output));
   if(enroll){s.device={id:encode(id),salt:encode(salt),hash};save(s);settings();}
   else if(hash!==s.device.hash)throw Error('Invalid');
 }
 const lockChannel=typeof BroadcastChannel==='function'?new BroadcastChannel('supertable.app-lock'):null;
 if(lockChannel)lockChannel.onmessage=event=>{
   if(hasBook()&&event.data===F.userId)lock(false);
 };
 function lock(broadcast=true){
   if(locked||!(startupId||F.userId)||F.local||!read())return;
   locked=true;document.documentElement.classList.add('pin-locked');
   if(broadcast)lockChannel?.postMessage(startupId||F.userId);
   panel.close();challenge(close,true);
 }
 function settings(){
   screen('Настройки · Безопасность',actions);
   const s=read();
   if(!s)action('Включить блокировку по PIN',setup);
   else{
     action('Заблокировать сейчас',lock);
     action('Изменить PIN',()=>challenge(setup));
     if(window.PublicKeyCredential&&!s.device)action('Подключить разблокировку устройством',()=>challenge(()=>{
       screen('Разблокировка устройством',actions);
       action('Подключить',()=>device(true));
       action('Назад',settings);
     }));
     const label=document.createElement('label');label.textContent='Блокировать при бездействии';
     const select=document.createElement('select');
     for(const n of [1,5,15,30])select.add(new Option(n+' мин',n,false,n===s.minutes));
     select.onchange=()=>save({...read(),minutes:Number(select.value)});label.append(select);panel.querySelector('.pin-actions').append(label);
     action('Отключить блокировку',()=>challenge(()=>{localStorage.removeItem(key());close();}));
   }
   action('Закрыть',close);
 }
 function attachMenu(label){
   const wrap=document.createElement('span');wrap.className='email-menu';label.replaceWith(wrap);wrap.append(label);
   label.tabIndex=0;label.setAttribute('role','button');label.setAttribute('aria-expanded','false');
   const item=document.createElement('button');item.textContent='Настройки';item.hidden=true;wrap.append(item);
   function toggle(open){menu?.();item.hidden=!open;label.setAttribute('aria-expanded',String(open));menu=open?()=>{item.hidden=true;label.setAttribute('aria-expanded','false');menu=null;}:null;}
   wrap.onmouseenter=()=>{if(matchMedia('(hover:hover)').matches)toggle(true);};
   wrap.onmouseleave=()=>{if(matchMedia('(hover:hover)').matches)toggle(false);};
   label.onclick=()=>toggle(item.hidden||matchMedia('(hover:hover)').matches);
   label.onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();toggle(item.hidden);}};
   item.onclick=()=>{toggle(false);settings();};
 }
 document.addEventListener('pointerdown',e=>{if(!e.target.closest('.email-menu'))menu?.();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&hasBook())lock();});
 window.addEventListener('pagehide',()=>{if(hasBook())lock();});
 window.addEventListener('storage',e=>{if(hasBook()&&e.key===key()&&e.newValue)lock();});
 function activity(){if(!locked)lastActive=Date.now();}
 for(const type of ['keydown','pointerdown','scroll'])document.addEventListener(type,activity,{capture:true,passive:true});
 setInterval(()=>{if(hasBook()&&!F.local&&!locked&&Date.now()-lastActive>=(read()?.minutes??Infinity)*60000)lock();},1000);
 return {attachMenu,cancelStartup(){if(startupId)close();document.documentElement.classList.remove('pin-wait');},
   beforeOpen(id=null){startupId=id;if(!read()){startupId=null;return;}return new Promise(resolve=>{resume=resolve;lock();});}};
})();
const startupFragment=new URLSearchParams(location.hash.slice(1));
let startupUnlock=Finance.configured && window.pinStartupAccount && siteLocale===pageLanguage &&
 !startupFragment.has('error') && startupFragment.get('type')!=='recovery' &&
 !new URLSearchParams(location.search).has('error') ? appLock.beforeOpen(window.pinStartupAccount) : null;
