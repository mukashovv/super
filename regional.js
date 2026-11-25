// Regional UI uses authenticated RPCs; no code validation or access grants in the browser.
const RP = (() => {
 const t=key=>tr(key), h=value=>esc(value??'');
 const labels={monthly:'Ежемесячная подписка',year1:'1 год',year2:'2 года',year3:'3 года',pending:'Ожидает проверки',active:'Активен',expired:'Истёк',revoked:'Отозван',rejected:'Отклонён',free:'Бесплатный'};
 const label=id=>t(labels[id]||id);
 const wa='https://wa.me/996709139603?text='+encodeURIComponent('Здравствуйте! Хочу приобрести полный доступ к SuperTable. Подскажите, пожалуйста, условия оплаты');
 let catalog=[],rows=[],offset=0,search='',filter='all',selected=null;
 const call=async(name,args={})=>{const result=await F.regional(name,args);if(result?.error)throw Error(result.error);return result;};
 const btn=(action,text,extra='')=>button('regional-'+action,t(text),'secondary',extra);
 const input=(name,value='',type='text',extra='')=>'<input name="'+name+'" type="'+type+'" value="'+h(value)+'" '+extra+'>';
 const select=(name,values,current)=>'<select name="'+name+'">'+values.map(([id,text])=>'<option value="'+h(id)+'" '+(id===current?'selected':'')+'>'+h(text)+'</option>').join('')+'</select>';
 const date=value=>value?new Date(value).toLocaleString(siteLocale):'—';
 const isoDay=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bishkek',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
 async function offers(){
  catalog=await call('catalog');
  const requests=F.local?[]:await call('my_requests');
  const cards=catalog.map(p=>'<details class="regional-plan" name="boosty-plan"><summary><span>'+h(label(p.id))+'</span><b>'+new Intl.NumberFormat(siteLocale,{style:'currency',currency:'RUB',maximumFractionDigits:0}).format(p.price)+'</b><i aria-hidden="true"></i></summary><div class="regional-plan-body">'+(p.id==='monthly'?'<p>'+t('Поддержка + Ежемесячная подписка 🖤')+'</p>':'')+'<p class="muted">'+h(t(p.id==='monthly'?'В месяц · продление в Boosty':'Разовая покупка · без автопродления'))+'</p><a class="primary" target="_blank" rel="noopener noreferrer" href="'+h(p.url)+'">'+t('Купить в Boosty')+'</a></div></details>').join('');
  const status=F.fullAccess(book)?(book.paid_until?t('Доступ до')+': '+h(date(book.paid_until)):t('Бессрочный доступ')):t('Бесплатный месяц');
  modal(t('Полный доступ'),'<div class="regional-payments"><section class="subscription-card"><div class="sub-laptop" aria-hidden="true"><div><img src="'+h(brandImage)+'" alt=""></div></div><h3>'+t('Супер Таблица')+'</h3><p>'+status+'</p></section><div class="regional-options"><details class="regional-offers"><summary>'+t('Выберите удобный способ оплаты')+'<i aria-hidden="true"></i></summary><div class="regional-plans">'+cards+'</div><a class="secondary regional-whatsapp" href="'+h(wa)+'" target="_blank" rel="noopener noreferrer">'+t('Оплатить через WhatsApp')+'</a><p class="regional-note">'+t('Условия и реквизиты сообщим лично')+'</p></details><details class="regional-activation"'+(requests.some(r=>r.status==='pending')?' open':'')+'><summary>'+t('Уже оплатили?')+'<i aria-hidden="true"></i></summary><div class="regional-activation-body">'+(F.local?'<p class="muted">'+t('Для активации войдите в облачный аккаунт')+'</p>':btn('activate','Активировать доступ')+' '+btn('offers','Обновить статус'))+requests.map(r=>'<p class="regional-status"><b>'+h(label(r.plan))+'</b> · '+h(label(r.status))+'<br><span>'+t('Доступ до')+': '+h(date(r.expires_at))+'</span></p>').join('')+'</div></details></div>'+legalLinks()+'</div>');
 }
 function activation(){
  if(F.local)return;
  modal(t('Активировать доступ'),formWrap('regional-activate',
   '<p>'+h(F.email)+'</p>'+field(t('Тип покупки'),select('kind',[['monthly',t('Ежемесячная подписка')],['long',t('Долгосрочный доступ')]],'monthly'))+
   field(t('Email аккаунта Boosty'),input('email','','email','required maxlength="254" autocomplete="email"'))+
   '<p class="muted">'+t('Укажите именно ту электронную почту, которую вы использовали для входа в Boosty и совершения покупки')+'</p>'+
   '<div id="regional-code" hidden>'+field(t('Код активации'),input('code','','password','maxlength="100" autocomplete="off"'))+'</div><p class="muted">'+t('Доступ выдаётся временно до проверки покупки. Повторная заявка не продлевает временный доступ.')+'</p>',t('Отправить заявку')));
 }
 async function admin(){
  if(F.local||!book.manager)return;
  catalog=await call('catalog'); const summary=await call('summary');
  rows=await call('admin_list',{p_search:search,p_filter:filter,p_offset:offset});
  modal(t('Платежи и подписки'),'<div class="regional-admin"><p role="status">'+t('Ожидает проверки')+': <b>'+summary.pending+'</b> · '+t('Скоро истекает')+': <b>'+summary.due+'</b></p>'+formWrap('regional-search',field(t('Поиск'),input('search',search,'search','maxlength="254"'))+field(t('Статус'),select('filter',[['all',t('Все')],['pending',label('pending')],['active',label('active')],['expired',label('expired')],['revoked',label('revoked')],['rejected',label('rejected')],['review',t('Проверить ежемесячную оплату')],['due',t('Скоро истекает')]],filter)),t('Найти'))+'<div class="form-actions">'+btn('settings','Настройки оплаты')+'</div>'+rows.slice(0,50).map(r=>'<article class="regional-record"><strong>'+h(r.account_email)+'</strong><p>'+h(r.boosty_email||'—')+' · '+h(r.method)+'<br>'+h(label(r.plan))+' · '+h(label(r.effective_status))+'<br>'+t('Доступ до')+': '+h(date(r.expires_at))+'</p>'+btn('edit','Управление','data-key="'+r.id+'"')+'</article>').join('')+(rows.length?'':'<p>'+t('Нет заявок')+'</p>')+'<div class="form-actions">'+btn('prev','Назад',offset?'':'disabled')+btn('next','Далее',rows.length>50?'':'disabled')+'</div></div>');
 }
 async function editor(id){
  selected=rows.find(r=>r.id===id); if(!selected)return;
  const r=selected,history=await call('history',{p_id:id});
  const actions=r.status==='pending'?[['confirm',t('Подтвердить покупку')],['reject',t('Отклонить заявку')]]:r.status==='active'?[['extend',t('Продлить подписку')],['set_expiry',t('Изменить срок доступа')],['revoke',t('Отозвать доступ')]]:[['revoke',t('Отозвать доступ')]];
  modal(t('Управление оплатой'),'<p><b>'+h(r.account_email)+'</b><br>'+h(r.boosty_email||'—')+' · '+h(label(r.plan))+' · '+h(r.method)+'</p><p>'+t('Дата заявки')+': '+h(date(r.created_at))+'<br>'+t('Дата подтверждения')+': '+h(date(r.confirmed_at))+'<br>'+t('Последняя оплата')+': '+h(date(r.last_payment_at))+'</p>'+changeForm(actions,r)+ '<details><summary>'+t('История изменений')+'</summary>'+history.map(a=>'<p>'+h(date(a.at))+' · '+h(t(actionLabels[a.action]||a.action))+'<br>'+h(a.details?.after?.comment||'')+'</p>').join('')+'</details>');
 }
 const actionLabels={submitted:'Заявка отправлена',confirm:'Подтвердить покупку',reject:'Отклонить заявку',revoke:'Отозвать доступ',extend:'Продлить подписку',set_expiry:'Изменить срок доступа',manual:'Предоставить доступ вручную'};
 function changeForm(actions,r){
  const end=new Date(Math.max(Date.now(),r.status==='active'?(Date.parse(r.expires_at)||0):0));end.setUTCMonth(end.getUTCMonth()+(catalog.find(p=>p.id===r.plan)?.months||1));
  return formWrap('regional-change',
   field(t('Действие'),select('action',actions,actions[0][0]))+field(t('Дата окончания доступа'),input('expires_at',isoDay(end),'date','required'))+field(t('Дата оплаты'),input('paid_at',isoDay(Date.now()),'date'))+
   field(t('Комментарий администратора'),'<textarea name="comment" maxlength="2000">'+h(r.comment||'')+'</textarea>'),t('Сохранить'));
 }
 async function settings(){
  const s=await call('admin_settings');catalog=s.plans;
  modal(t('Настройки оплаты'),formWrap('regional-hours',field(t('Временный доступ, часов'),input('hours',s.hours,'number','min="1" max="168" required')),t('Сохранить'))+catalog.map(p=>'<details><summary>'+h(label(p.id))+'</summary>'+formWrap('regional-plan',input('id',p.id,'hidden')+field(t('Цена, RUB'),input('price',p.price,'number','min="1" required'))+field(t('Ссылка покупки'),input('url',p.url,'url','required'))+(p.id==='monthly'?'':field(t('Новый код активации'),input('code','','password','minlength="8" maxlength="100" autocomplete="new-password"'))),t('Сохранить'))+'</details>').join(''));
 }
 async function action(el){
  const a=el.dataset.action.slice(9);
  if(a==='offers')return offers();if(a==='activate')return activation();if(a==='admin')return admin();
  if(a==='edit')return editor(el.dataset.key);
  if(a==='settings')return settings();
  if(a==='prev'){offset=Math.max(0,offset-50);return admin();}if(a==='next'){offset+=50;return admin();}
 }
 async function submit(form){
  const f=Object.fromEntries(new FormData(form)),kind=form.dataset.form;
  if(kind==='regional-activate'){
   const result=await call('activate',{p_kind:f.kind,p_email:f.email,p_code:f.code||''});form.reset();book=await F.load();render();await offers();notice(t(result.status==='expired'?'Заявка принята. Ожидайте проверки покупки.':'Заявка принята. Временный доступ включён.'));return;
  }
  if(kind==='regional-search'){search=f.search;filter=f.filter;offset=0;return admin();}
  if(kind==='regional-change'){
   const p={...f,id:selected?.id,revision:selected?.revision,expires_at:f.expires_at?f.expires_at+'T23:59:59+06:00':null,paid_at:f.paid_at?f.paid_at+'T00:00:00+06:00':null};
   await call('admin_change',{p});book=await F.load();render();return admin();
  }
  if(kind==='regional-hours'){await call('configure',{p:{hours:Number(f.hours)}});notice(t('Сохранено'));return settings();}
  if(kind==='regional-plan'){await call('configure',{p:{...f,price:Number(f.price)}});form.reset();notice(t('Сохранено'));return settings();}
 }
 function error(message){
  const errors={BOOSTY_EMAIL_USED:'Эта почта Boosty уже привязана к другому аккаунту.',RATE_LIMIT:'Слишком много попыток. Повторите через час.',EMAIL_REQUIRED:'Укажите email аккаунта Boosty',ALREADY_PENDING:'У вас уже есть заявка. Ожидайте проверки.',INVALID_CODE:'Неверный код активации',REGIONAL_NOT_READY:'Активация ещё настраивается. Напишите в WhatsApp.',VERIFICATION_REQUIRED:'Укажите дату оплаты, срок, идентификатор покупки и подтверждение проверки.',PURCHASE_USED:'Эта покупка уже использована.',BAD_STATE:'Статус заявки изменился. Обновите список.',BAD_INPUT:'Проверьте заполненные поля.',AUTH_REQUIRED:'Для активации войдите в облачный аккаунт'};
  return Object.entries(errors).find(([key])=>message.includes(key))?.[1];
 }
 document.addEventListener('change',e=>{if(e.target.name==='kind'&&e.target.closest('[data-form="regional-activate"]')){const b=document.getElementById('regional-code');b.hidden=e.target.value!=='long';b.querySelector('input').required=!b.hidden;}});
 return {offers,action,submit,error};
})();
