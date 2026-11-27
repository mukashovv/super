"use strict";
const F=Finance, config=window.SUPER_TABLE_CONFIG;
const $=selector=>document.querySelector(selector);
const main=$("#main"), accountBox=$("#account"), dialog=$("#editor"), body=$("#dialog-body");
const welcome=main.innerHTML;
const monthNames=siteLocale==="kk"
 ? ["Қаңтар","Ақпан","Наурыз","Сәуір","Мамыр","Маусым","Шілде","Тамыз","Қыркүйек","Қазан","Қараша","Желтоқсан"]
 : Array.from({length:12},(_,i)=>new Intl.DateTimeFormat(siteLocale,{month:"long"}).format(new Date(2024,i,1)));
const currency=new Intl.NumberFormat(siteLocale,{maximumFractionDigits:2});
const money=cents=>currencyCode === "KGS" ? currency.format(cents/100)+" "+currencyUnit : moneyFormat.format(cents/100);
const numberInput=cents=>cents ? String(cents/100) : "";
const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const monthName=(key,year=true)=>monthNames[Number(key.slice(5))-1]+(year?" "+key.slice(0,4):"");
const len=key=>new Date(F.dateOf(key).getFullYear(),F.dateOf(key).getMonth()+1,0).getDate();
const firstDay=key=>key===F.monthKey()?new Date().getDate():1;
const id=()=>crypto.randomUUID();
let book,month,view="month",year,compare,gate="start",busy=false,workspaceOpening=null,lastDate=F.dateKey();
let editKey,editItem,editRev,flashTimer;
const icons={
 trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7m4-7v7"/>',
 members:'<circle cx="9" cy="8" r="3"/><path d="M2 20v-2a7 7 0 0 1 14 0v2m0-15a3 3 0 0 1 0 6m3 3a6 6 0 0 1 3 6"/>',
 month:'<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M7 2v4m10-4v4M3 10h18m-13 5h3"/>',
 debts:'<path d="M4 6h14a2 2 0 0 1 2 2v12H5a2 2 0 0 1-2-2V7a3 3 0 0 1 3-3l11-2v4"/><path d="M15 11h6v5h-6a2.5 2.5 0 0 1 0-5Z"/>',
 year:'<path d="M4 3v17h17M8 16v-4m5 4V7m5 9v-7"/>',
 plus:'<path d="M12 5v14M5 12h14"/>', settings:'<path d="M4 7h5m5 0h6M4 17h9m5 0h2"/><circle cx="11.5" cy="7" r="2.5"/><circle cx="15.5" cy="17" r="2.5"/>',
 logout:'<path d="M10 4H4v16h6m4-13 5 5-5 5m-5-5h10"/>',
 check:'<path d="m5 12 5 5L20 7"/>'
};
function icon(key){return '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">'+icons[key]+'</svg>';}
function button(action,label,klass="",attrs=""){return '<button type="button" class="'+klass+'" data-action="'+action+'" '+attrs+'>'+label+'</button>';}
function field(label,input){return '<label class="field"><span>'+label+'</span>'+input+'</label>';}
function monthField(label,name,value,min,max="9999-12"){
 if(siteLocale!=="kk")return field(label,'<input required type="month" name="'+name+'" min="'+esc(min)+'" max="'+max+'" value="'+esc(value)+'">');
 const [yy,mm]=value.split("-");
 const options=monthNames.map((label,i)=>{
   const code=String(i+1).padStart(2,"0");
   return '<option value="'+code+'" '+(mm===code?"selected":"")+'>'+label+'</option>';
 }).join("");
 return '<fieldset class="kk-month"><legend>'+label+'</legend><div class="pair">'+
   field(tr("Месяц"),'<select required data-month-part><option value="">—</option>'+options+'</select>')+
   field(tr("Год"),'<input required type="number" data-month-part min="'+Number(min.slice(0,4))+'" max="9999" value="'+esc(yy)+'">')+
   '<input type="hidden" name="'+name+'" data-min="'+esc(min)+'" value="'+esc(value)+'"></div></fieldset>';
}
function syncMonthField(control){
 const group=control.closest(".kk-month");
 const month=group.querySelector("select"), year=group.querySelector('[type="number"]'), result=group.querySelector('[type="hidden"]');
 const key=year.value+"-"+month.value;
 const tooEarly=year.validity.valid && month.value && key<result.dataset.min;
 month.setCustomValidity(tooEarly ? "Көрсетілген ай алғашқы төлем айынан ерте." : "");
 result.value=month.validity.valid && year.validity.valid ? key : "";
 if(result.name==="period" && result.value && !editItem){
   const item=F.installments(book.debts[editKey].data,result.value,result.value)[0];
   control.form.elements.amount.value=numberInput(item?.amount);
 }
}
document.addEventListener("input",event=>{
 if(event.target.hasAttribute("data-month-part"))syncMonthField(event.target);
});
function cashField(name,label,value=0,required=false){return field(label,'<input type="number" inputmode="decimal" step="0.01" min="'+(required?'0.01':'0')+'" max="99999999999" name="'+name+'" value="'+numberInput(value)+'" '+(required?"required":"")+' placeholder="0">');}
function textField(name,label,value="",required=false){return field(label,'<input name="'+name+'" maxlength="180" value="'+esc(value)+'" '+(required?"required":"")+'>');}
function amount(form,name){return Math.round(Number(form.get(name)||0)*100);}
function notice(message){const node=$("#notice");node.textContent=message;node.classList.add("show");clearTimeout(flashTimer);flashTimer=setTimeout(()=>node.classList.remove("show"),4500);}
function hint(message){const node=dialog.open?body.querySelector(".error"):main.querySelector(".error");if(node)node.textContent=message;else notice(message);}
function modal(title,html){dialog.classList.toggle("access-dialog",title===tr("Полный доступ"));$("#dialog-title").textContent=title;body.innerHTML=html;if(!dialog.open)dialog.showModal();}
function formWrap(name,content,label=tr("Сохранить"),extra=""){return '<form data-form="'+name+'">'+content+'<p class="error" role="alert"></p><div class="form-actions">'+extra+'<button class="primary" type="submit">'+label+'</button></div></form>';}
function renderGate(step){
 gate=step;const box=$("#gate");
 main.querySelector(".welcome").classList.toggle("auth-open",step!=="start");
 if(step==="start"){box.innerHTML=button("start",tr("Попробовать бесплатно"),"primary launch");return;}
 const preview=F.configured?"":button("local",tr("Открыть локальную таблицу"),"text-btn");
 if(step==="choice"){
   box.innerHTML='<div class="fade gate-actions">'+button("login",tr("Вход"),"primary")+button("register",tr("Регистрация"),"secondary")+'</div>'+preview;
 }else if(step==="reset" || step==="new-password"){
   const resetting=step==="reset";
   const input=resetting?field(tr("Электронная почта"),'<input type="email" name="email" autocomplete="email" required>'):
     field(tr("Новый пароль"),'<input type="password" name="password" autocomplete="new-password" minlength="8" required>')+
     field(tr("Повторите пароль"),'<input type="password" name="confirm" autocomplete="new-password" minlength="8" required>');
   box.innerHTML='<div class="auth-panel"><h1>'+tr("Восстановление пароля")+'</h1>'+formWrap(step,input,
     tr(resetting?"Отправить ссылку":"Сохранить пароль"),resetting?button("login",tr("Назад"),"text-btn"):"")+'</div>';
 }else if(step==="reset-sent"){
   box.innerHTML='<div class="auth-panel"><p role="status">'+tr("Если аккаунт с такой почтой существует, на неё придёт ссылка для смены пароля.")+'</p>'+button("login",tr("Войти"),"secondary")+'</div>';
 }else{
   const login=step==="login";
   box.innerHTML='<div class="auth-panel fade"><h1>'+(login?tr("Вход"):tr("Регистрация"))+'</h1>'+formWrap("auth",
      field(tr("Электронная почта"),'<input name="email" type="email" required autocomplete="email" maxlength="254">')+
      field(tr("Пароль"),'<input name="password" type="password" required '+(login?"":'minlength="8"')+' autocomplete="'+(login?"current-password":"new-password")+'">')+
      (login?"":registrationNotice())+
      (!F.configured?("<p class=\"muted\">"+tr("Облачные аккаунты появятся после подключения")+" Supabase. "+tr("Сейчас таблицу можно попробовать в этом браузере")+".</p>"):""),
      login?tr("Войти"):tr("Зарегистрироваться"),button("start",tr("Назад"),"text-btn"))+(login && F.configured?button("reset",tr("Забыли пароль?"),"text-btn"):"")+preview+"</div>";
 }
 box.querySelector("input,button")?.focus({preventScroll:true});
}
function home(){document.body.classList.remove("month-open","workbook-open");memberPage=[];memberOffset=0;book=null;view="month";main.innerHTML=welcome;accountBox.innerHTML="";gate="start";if(dialog.open)dialog.close();}
async function workspace(local=false,earlyUnlock=null){
 if(workspaceOpening)return workspaceOpening;
 workspaceOpening=(async()=>{
   const unlocked=!local && F.userId && await (earlyUnlock || appLock.beforeOpen());
   if(unlocked)document.documentElement.classList.add('pin-wait');
   try{
   book=local?F.startLocal():await F.load();
   month=book.paid?F.monthKey():book.trial;
   if(!book.access_locked&&!book.months[month])await createMonth(month);
   view="month";year=month.slice(0,4);compare=month;render();if(book.access_locked)await upgrade();else if(!unlocked)showAccessWelcome();
   }finally{document.documentElement.classList.remove('pin-wait');}
 })();
 try{await workspaceOpening;}finally{workspaceOpening=null;}
}
async function createMonth(key){
 const existing=Object.keys(book.months).sort().reverse();
 const prior=existing.find(m=>m<key)||existing[0];
 const data=F.emptyMonth(prior?structuredClone(book.months[prior].data.goals):undefined);
 try {book.months[key]=await F.save("months",key,0,data);}
 catch(error){if(!String(error.message).includes("STALE_VERSION"))throw error;book=await F.load();if(!book.months[key])throw error;}
}
function heading(title,actions=""){return '<div class="section-top"><h1>'+esc(title)+'</h1><div class="actions">'+actions+'</div></div>';}
function stats(items){return '<div class="stats">'+items.map(([name,value])=>'<div><span>'+esc(name)+'</span><strong>'+esc(value)+'</strong></div>').join("")+'</div>';}
function render(){
 document.body.classList.toggle("month-open",view==="month");
 document.body.classList.add("workbook-open");
 accountBox.innerHTML='<span class="account-label">'+(F.local?tr("На этом устройстве"):esc(F.email))+'</span>'+button("leave",icon("logout"),"icon-btn",("aria-label=\""+tr("Выйти")+"\" title=\""+tr("Выйти")+"\""));
 if(!F.local)appLock.attachMenu(accountBox.firstElementChild);
 const tabs=[["month",tr("Месяц")],["debts",tr("Долги")],["year",tr("Годы")]];
 if(book.manager)tabs.push(["members",tr("Участники")]);
 const nav=tabs.map(([key,name])=>button("view",icon(key)+name,"nav-item "+(view===key?"active":""),'data-key="'+key+'" '+(view===key?'aria-current="page"':""))).join("");
 const plan=button("subscription",tr(book.trial_active?"3 дня бесплатно":book.paid?"Полный доступ":"Выбрать тариф"),"plan-label");
 const section={month:monthView,debts:debtView,year:yearView,members:membersView}[view];
 main.innerHTML=("<div class=\"desk\"><nav class=\"tabs\" aria-label=\""+tr("Разделы таблицы")+"\">")+nav+plan+'</nav><section class="content">'+(book.access_locked&&view!=='members'?'<section class="panel content"><h2>'+tr('Доступ закончился')+'</h2><p>'+tr('Для продолжения выберите подписку. Ваши данные сохранены.')+'</p>'+button('upgrade',tr('Выбрать тариф'),'primary')+'</section>':section())+'</section></div>';
}
const weekdays=Array.from({length:7},(_,i)=>new Intl.DateTimeFormat(siteLocale,{weekday:"short"}).format(new Date(2024,0,1+i)));
const shortSum = new Intl.NumberFormat(siteLocale, {notation:"compact", maximumFractionDigits:1});

function monthReminders(){
 const days = new Map();
 if(!F.fullAccess(book))return days;
 for(const [key,{data}] of Object.entries(book.debts)){
   for(const item of F.calendarPayments(data,month)){
     const day=Number(item.reminder.slice(-2));
     if(!days.has(day)) days.set(day,[]);
     days.get(day).push({...item,key,name:data.name});
   }
 }
 return days;
}
const displayDate = date => new Date(date+"T12:00:00").toLocaleDateString(siteLocale,{day:"2-digit",month:"2-digit",year:"numeric"});
function sheetDay(day, entries, weekday, today, reminders) {
 const {income, expense, net} = F.totals({entries});
 const completed = entries.filter(entry => entry.done).length;
 const first = entries[0];
 const count = entries.length;
 const names = reminders.map(item=>item.name+(item.done?(" "+tr("· внесено")):"")).join(", ");
 const badges = reminders.map(r=>'<span class="payment-badge'+(r.done?' paid':'')+'">'+esc(r.name)+'</span>').join(" ");
 const label = [day, monthName(month), weekdays[weekday], today ? tr("Сегодня") : "", names && (tr("Платежи:")+" ")+names,
   count ? (tr("Записей:")+" ")+count+(tr(". Итог:")+" ")+money(net) : tr("Добавить запись")].filter(Boolean).join(" · ");
 const value = cents => cents ? currency.format(cents / 100) : "";
 const status = count ? completed+" / "+count : "";
 const description = [first?.source, first?.purpose].filter(Boolean).join(" · ");
 const mobileNote = [description, count>1 ? "+"+(count-1) : ""].filter(Boolean).join(" · ");
 const summary = count ? (Math.abs(net)<100000 ? currency.format(net/100) : shortSum.format(net/100)) : "";
 const classes = ["sheet-day",today && "is-today",count && completed===count && "finished"].filter(Boolean).join(" ");
 return button("day",'<span class="sheet-date"><b>'+day+'</b><small>'+weekdays[weekday]+'</small></span>'+
   '<span class="sheet-text">'+esc(first?.source || "")+(count>1?' <em>+'+(count-1)+'</em>':"")+'</span>'+
   '<span class="sheet-text">'+esc(first?.purpose || "")+'</span><span class="sheet-number">'+value(income)+'</span>'+
   '<span class="sheet-number">'+value(expense)+'</span><span class="sheet-number">'+(count?currency.format(net/100):"")+'</span>'+
   '<span class="sheet-status">'+status+'</span><span class="sheet-reminder" title="'+esc(names)+'">'+badges+'</span>'+
   '<span class="mobile-day-info"><span class="mobile-day-note">'+esc(mobileNote)+'</span><span class="mobile-day-payment">'+badges+'</span></span>'+
   '<span class="mobile-day-net">'+summary+'</span>',
   classes,'data-day="'+day+'" aria-label="'+esc(label)+'"'+(today?' aria-current="date"':""));
}

function monthView(){
 const data=book.months[month].data, sums=F.totals(data), days=len(month);
 const start=(F.dateOf(month).getDay()+6)%7;
 const grouped=Array.from({length:days+1},()=>[]);
 for(const entry of data.entries)grouped[entry.day].push(entry);
 const reminders=monthReminders();
 const cells=grouped.slice(1).map((entries,i)=>sheetDay(i+1,entries,(start+i)%7,month===F.monthKey() && i+1===firstDay(month),reminders.get(i+1)||[])).join("");
 const options=Object.keys(book.months).sort().reverse().map(k=>'<option '+(k===month?"selected":"")+' value="'+k+'">'+monthName(k)+'</option>').join("");
 const amounts=[[tr("Доходы"),sums.income],[tr("Расходы"),sums.expense],[tr("Итог месяца"),sums.net]].map(([label,n])=>
   '<div><dt>'+label+'</dt><dd>'+money(n)+'</dd></div>').join("");
 return ("<div class=\"sheet-tools\"><select id=\"months\" aria-label=\""+tr("Месячная вкладка")+"\">")+options+'</select>'+
   button("new-month",icon("plus")+("<span>"+tr("Вкладка")+"</span>"),"sheet-tool",("aria-label=\""+tr("Новая месячная вкладка")+"\" title=\""+tr("Новая месячная вкладка")+"\""))+
   button("goals",icon("settings")+("<span>"+tr("Распределение")+"</span>"),"sheet-tool",("aria-label=\""+tr("Распределение дохода")+"\" title=\""+tr("Распределение дохода")+"\""))+
   button("entry",icon("plus")+tr("Запись"),"sheet-add")+'</div><dl class="sheet-totals">'+amounts+'</dl>'+
   '<section class="month-sheet'+(reminders.size?" has-reminders":"")+'" aria-label="'+monthName(month)+'" style="--days:'+days+'">'+
   '<div class="sheet-labels">'+[tr("День"),tr("Откуда"),tr("На что"),tr("Доход"),tr("Расход"),tr("Итог дня"),tr("Готово"),...(reminders.size?[tr("Платежи")]:[])].map(s=>'<span>'+s+'</span>').join("")+'</div>'+
   ("<div class=\"mobile-sheet-labels\"><span>"+tr("День")+"</span><span>"+tr("Записи и платежи")+"</span><span>"+tr("Итог, сом")+"</span></div><div class=\"sheet-body\">")+cells+'</div></section>';
}

function dayDetail(day){
 const entries=book.months[month].data.entries.filter(entry=>entry.day===day);
 const reminders=monthReminders().get(day)||[];
 if(!entries.length && !reminders.length){entryEditor(day);return;}
 const date=F.dateOf(month);date.setDate(day);
 const rows=entries.map(entry=>{
   const key='data-id="'+esc(entry.id)+'"';
   return '<li class="'+(entry.done?'finished':'')+'">'+button("toggle-entry",entry.done?icon("check"):"","check",key+(" aria-label=\""+tr("Выполнено")+"\" aria-pressed=\"")+Boolean(entry.done)+'"')+
     button("entry",'<strong>'+esc(entry.source || entry.purpose || tr("Запись"))+'</strong>'+
      (entry.source && entry.purpose?'<span>'+esc(entry.purpose)+'</span>':"")+
      (entry.project?("<small>"+tr("Проект")+" · ")+esc(entry.project)+'</small>':"")+
      ("<small>"+tr("Доход")+" ")+money(entry.income)+(" "+tr("· Расход")+" ")+money(entry.expense)+'</small>',"day-entry",key)+'</li>';
 }).join("");
 modal(siteLocale==="kk" ? date.getFullYear()+" жылғы "+day+" "+monthNames[date.getMonth()].toLowerCase() : date.toLocaleDateString(siteLocale,{day:"numeric",month:"long",year:"numeric"}),
   (reminders.length?("<h3>"+tr("Долги и платежи")+"</h3><ul class=\"day-payments\">")+reminders.map(r=>{
     const token=r.period||r.payments[0].id;
     const unpaidAmount=r.amount || (!r.done?r.payments.reduce((sum,p)=>sum+(p.done?0:p.amount),0):0);
     const caption=[r.dueDate?(tr("К")+" ")+displayDate(r.dueDate):"",r.paid?(tr("Внесено")+" ")+money(r.paid):"",
       unpaidAmount?(tr("К оплате")+" ")+money(unpaidAmount):""].filter(Boolean).join(" · ");
     const attrs='data-key="'+esc(r.key)+'" data-day="'+day+'" data-token="'+esc(token)+'" aria-pressed="'+r.done+
       '" title="'+(r.done?tr("Снять отметку об оплате"):tr("Отметить оплату"))+'"';
     return '<li>'+button("check-installment",'<span class="check" aria-hidden="true">'+(r.done?icon("check"):"")+'</span>'+
       '<span><strong>'+esc(r.name)+'</strong><small>'+esc(caption)+'</small></span>',
       "day-payment-row",attrs)+'</li>';
   }).join("")+'</ul>':"")+
   '<ul class="day-entries">'+rows+'</ul><div class="form-actions">'+button("entry",icon("plus")+tr("Добавить запись"),"primary",'data-day="'+day+'"')+'</div>');
}
async function checkInstallment(key,day,token){
 const row=(monthReminders().get(day)||[]).find(r=>r.key===key && (r.period||r.payments[0]?.id)===token);
 if(!row)return;
 const rec=book.debts[key],d=structuredClone(rec.data);
 const ids=new Set(row.payments.map(p=>p.id));
 const payments=d.payments.filter(p=>ids.has(p.id));
 if(row.done){
   const applied=payments.filter(p=>p.done);
   const latest=applied.reduce((last,p)=>(p.markedAt||p.date)>=(last.markedAt||last.date)?p:last);
   latest.done=false;
   if(d.closed)d.closed=false;
 }else{
   const planned=payments.filter(p=>!p.done);
   const payment=planned.find(p=>p.amount===row.amount) || (!row.amount?planned[0]:null);
   if(payment){
     payment.done=true;
     payment.markedAt=new Date().toISOString();
   }else if(row.period && row.amount>0){
     d.payments.push({id:id(),period:row.period,date:F.dateKey(),dueDate:row.dueDate,
       periodAmount:row.paid+row.amount,amount:row.amount,done:true,note:"",markedAt:new Date().toISOString()});
   }else return;
 }
 await persist("debts",key,rec.rev,d,()=>dayDetail(day));
}
function cleanProject(name){return (name||"").normalize("NFC").trim().replace(/\s+/g," ");}
function projectCatalog(){
 const names=new Map();
 for(const {data} of Object.values(book.months)){
   for(const name of data.projectNames||[]){
     const key=name.toLowerCase();
     if(!names.has(key))names.set(key,name);
   }
 }
 return names;
}
function sourceField(entry){
 const current=entry.project;
 const names=[...projectCatalog().values()];
 if(current && !names.some(name=>name.toLowerCase()===current.toLowerCase()))names.push(current);
 const options=names.sort((a,b)=>a.localeCompare(b,siteLocale)).map(name=>'<option value="p:'+esc(name)+'" '+
   (name.toLowerCase()===current?.toLowerCase()?"selected":"")+'>'+esc(name)+'</option>');
 return ("<div class=\"field entry-source\"><label for=\"entry-source-name\">"+tr("Откуда поступили деньги")+"</label>")+
   '<div class="source-control"><input id="entry-source-name" name="source" maxlength="180" value="'+esc(entry.source)+'">'+
   ("<div class=\"source-project\"><select name=\"projectChoice\" aria-label=\""+tr("Проект")+"\"><option value=\"\">"+tr("проект")+"</option>")+
   options.join("")+("<option value=\"+\">＋ "+tr("Новый проект")+"…</option></select>")+
   ("<input name=\"project\" aria-label=\""+tr("Название нового проекта")+"\" maxlength=\"180\" placeholder=\""+tr("Название")+"\" hidden disabled>")+
   '</div></div></div>';
}
function entryEditor(day,entryId){
 const rec=book.months[month];const entry=rec.data.entries.find(e=>e.id===entryId)||{day:day||firstDay(month)};
 editKey=month;editRev=rec.rev;editItem=entry.id;
 const date=editKey+"-"+String(entry.day).padStart(2,"0");
 const allocation = rec.data.goals.length ? '<div class="daily-goals" aria-live="polite"></div>' : "";
 modal(entry.id?tr("Изменить запись"):tr("Новая запись"),formWrap("entry",
   field(tr("Дата"),'<input name="date" type="date" required min="'+month+'-01" max="'+month+'-'+len(month)+'" value="'+date+'">')+
   '<div class="pair">'+cashField("income",tr("Доход, сом"),entry.income)+cashField("expense",tr("Расход, сом"),entry.expense)+'</div>'+
   sourceField(entry)+
   textField("purpose",tr("На что запланирован расход"),entry.purpose)+allocation+
   '<label class="tick"><input type="checkbox" name="done" '+(entry.done?"checked":"")+("> "+tr("Выполнено")+"</label>")+
   ("<p class=\"muted\">"+tr("Итог дня равен доходу за вычетом расхода. Отметка «Выполнено» выделяет запись зелёным")+".</p>"),
   tr("Сохранить"),entry.id?button("remove-entry",tr("Удалить"),"text-btn danger"):""));
 dailyGoals();
}
function dailyGoals(){
 const output=body.querySelector(".daily-goals");if(!output)return;
 const form=new FormData(output.closest("form"));
 const date=form.get("date");if(!date)return;
 const day=Number(date.slice(-2));
 const other=book.months[editKey].data.entries.filter(e=>e.day===day && e.id!==editItem);
 const net=F.totals({entries:other}).net+amount(form,"income")-amount(form,"expense");
 output.textContent=(tr("За день ·")+" ")+book.months[editKey].data.goals.map(g=>g.name+" "+money(F.allocated(net,g.rate))).join(" · ");
}
document.addEventListener("input",e=>{if(e.target.closest('[data-form="entry"]'))dailyGoals();});
function goalRow(g={name:"",rate:""}){return '<div class="goal-row">'+textField("goalName",tr("Цель"),g.name,true)+field(tr("Доля, %"),'<input type="number" name="rate" min="0" max="100" step="0.01" required value="'+esc(g.rate)+'">')+button("drop-goal","×","icon-btn",("aria-label=\""+tr("Убрать цель")+"\""))+'</div>';}
function goalsEditor(){const data=book.months[month].data,net=F.totals(data).net;
 const allocations=data.goals.map(g=>esc(g.name)+" · "+money(F.allocated(net,g.rate))).join("<br>");
 editKey=month;editRev=book.months[month].rev;modal(tr("Распределение дохода"),formWrap("goals",("<p class=\"muted\">"+tr("Доли считаются от итога месяца и сохраняются для этой вкладки")+".</p><p class=\"allocation-preview\">")+allocations+'</p><div id="goal-rows">'+book.months[month].data.goals.map(goalRow).join("")+'</div>'+button("add-goal",tr("＋ Ещё цель"),"text-btn")));}
function projectChart(months,total){
 const heading=("<section class=\"panel\"><div class=\"panel-head\"><h2>"+tr("Доходы по проектам")+"</h2></div>");
 if(!total)return heading+("<p class=\"project-empty muted\">"+tr("За этот год пока нет доходов")+".</p></section>");
 const groups=new Map();
 for(const key of months){
   for(const entry of book.months[key].data.entries){
     if(!entry.income)continue;
     const name=cleanProject(entry.project),id=name.toLowerCase();
     if(!groups.has(id))groups.set(id,{name,amount:0});
     groups.get(id).amount+=entry.income;
   }
 }
 const palette=["#396750","#c18346","#55759c","#92719b","#8b924d","#ad655e"];
 const stops=[],rows=[];
 let cumulative=0,assigned=0;
 for(const {name,amount} of [...groups.values()].sort((a,b)=>b.amount-a.amount || a.name.localeCompare(b.name,siteLocale))){
   let color="#a5aba6";
   if(name){
     color=palette[assigned] || 'hsl('+Math.round(assigned*137.508%360)+' 43% 43%)';
     assigned++;
   }
   const start=100*cumulative/total;
   cumulative+=amount;
   stops.push(color+' '+start+'% '+100*cumulative/total+'%');
   const pct=100*amount/total;
   const share=pct<0.1?'&lt;0,1':currency.format(Math.round(pct*10)/10);
   rows.push('<li><i aria-hidden="true" style="background:'+color+'"></i><span>'+esc(name||tr("Без проекта"))+
     '</span><b>'+money(amount)+'</b><small>'+share+'%</small></li>');
 }
 const fill=stops.length===1?(assigned?palette[0]:"#a5aba6"):'conic-gradient('+stops.join(",")+')';
 return heading+'<div class="project-breakdown"><div class="project-pie" aria-hidden="true" style="background:'+
   fill+'"></div><ul>'+rows.join("")+'</ul></div></section>';
}
function yearView(){
 const keys=Object.keys(book.months).sort(), years=[...new Set(keys.map(k=>k.slice(0,4)))].reverse();
 const inYear=keys.filter(k=>k.startsWith(year+"-"));
 const sums=inYear.map(k=>F.totals(book.months[k].data));
 const annual=sums.reduce((a,b)=>({income:a.income+b.income,expense:a.expense+b.expense,net:a.net+b.net}),{income:0,expense:0,net:0});
 const select=("<select id=\"years\" aria-label=\""+tr("Год")+"\">")+years.map(y=>'<option '+(y===year?"selected":"")+'>'+y+'</option>').join("")+'</select>';
 const monthly=Array.from({length:12},(_,i)=>year+"-"+String(i+1).padStart(2,"0"));
 if(!inYear.includes(compare)) compare=inYear.at(-1);
 const before=F.nextMonth(compare,-1),prev=book.months[before],curr=F.totals(book.months[compare].data);
 const max=Math.max(1,...sums.map(s=>Math.abs(s.net)));
 return heading(tr("Сводка по годам"),select)+stats([[tr("Доходы за год"),money(annual.income)],[tr("Расходы за год"),money(annual.expense)],[tr("Итог за год"),money(annual.net)]])+
 projectChart(inYear,annual.income)+
 ("<div class=\"panel\"><div class=\"panel-head\"><h2>"+tr("Итоги по месяцам")+"</h2></div><div class=\"table-wrap\"><table><thead><tr><th>"+tr("Месяц")+"</th><th>"+tr("Доход")+"</th><th>"+tr("Расход")+"</th><th>"+tr("Прибыль")+"</th></tr></thead><tbody>")+monthly.map(k=>{
  const d=book.months[k],s=d?F.totals(d.data):null;
  return '<tr><th scope="row">'+(d?button("jump-month",monthName(k,false),"entry-link",'data-key="'+k+'"'):monthName(k,false))+'</th><td>'+(s?money(s.income):"—")+'</td><td>'+(s?money(s.expense):"—")+'</td><td>'+(s?'<div class="net-figure">'+money(s.net)+'<i style="width:'+Math.abs(s.net)/max*100+'%"></i></div>':"—")+'</td></tr>';}).join("")+
 ("</tbody></table></div></div><div class=\"panel\"><div class=\"panel-head\"><h2>"+tr("Сравнение месяцев")+"</h2><select id=\"comparison\" aria-label=\""+tr("Месяц для сравнения")+"\">")+inYear.map(k=>'<option value="'+k+'" '+(k===compare?'selected':'')+'>'+monthName(k)+'</option>').join("")+'</select></div>'+
 stats([[monthName(before),prev?money(F.totals(prev.data).net):tr("Нет данных")],[monthName(compare),money(curr.net)],[tr("Изменение прибыли"),prev?money(curr.net-F.totals(prev.data).net):"—"]])+'</div>';
}
function debtView(){
 if(!F.fullAccess(book))return heading(tr("Долги и платежи"))+
   ("<section class=\"panel\"><div class=\"panel-head\"><p>"+tr("Учёт долгов, регулярные платежи и напоминания доступны по подписке")+".</p>")+
   button("upgrade",tr("Получить полный доступ"),"primary")+'</div></section>';
 const all=Object.entries(book.debts);
 const records=all.filter(([,r])=>r.data.type!=="recurring"),active=records.filter(([,r])=>!r.data.closed);
 const regular=all.filter(([,r])=>r.data.type==="recurring");
 const remaining=active.reduce((sum,[,r])=>sum+F.balance(r.data),0);
 function lane(closed){
   const cards=records.filter(([,r])=>Boolean(r.data.closed)===closed);
   return '<section class="lane" data-lane="'+(closed?"closed":"active")+'"><h2>'+ (closed?tr("Выполнено"):tr("Активные долги"))+' <small>'+cards.length+'</small></h2>'+cards.map(([key,rec])=>{
     const d=rec.data,b=F.balance(d),total=d.principal+d.interest;
     const attrs='data-key="'+esc(key)+'"';
     const next=F.installments(d)[0];
     return '<article class="debt-card '+(closed?"done-card":"")+'" draggable="true" data-debt="'+esc(key)+'" data-open-debt="'+esc(key)+'" tabindex="0">'+deleteCorner(key,d.name)+'<h3>'+button("debt-detail",esc(d.name),"entry-link",attrs)+("</h3><span class=\"muted\">"+tr("Осталось")+"</span><strong>")+money(b)+'</strong><div class="meter"><i style="width:'+Math.min(100,(1-b/total)*100)+("%\"></i></div><div class=\"card-foot\"><span>"+tr("Внесено")+" ")+money(total-b)+(" "+tr("из")+" ")+money(total)+'</span>'+button("move-debt",closed?tr("Вернуть"):tr("Завершить"),"text-btn",attrs)+'</div>'+
       (next?("<p class=\"debt-next\">"+tr("Платить до")+" ")+displayDate(next.dueDate)+' · '+money(next.amount)+'</p>':"")+
       '</article>';
   }).join("")+(cards.length?"":'<div class="lane-empty">'+(closed?tr("Сюда можно перенести погашенный долг."):tr("Добавьте долг, чтобы вести график платежей."))+'</div>')+'</section>';
 }
 const recurringCards=regular.map(([key,{data}])=>{
   const attrs='data-key="'+esc(key)+'"';
   const next=F.installments(data)[0];
   return '<article class="debt-card recurring-card" data-open-debt="'+esc(key)+'" tabindex="0">'+deleteCorner(key,data.name)+'<h3>'+button("debt-detail",esc(data.name),"entry-link",attrs)+'</h3>'+
     '<strong>'+money(data.schedule.amount)+("</strong><span class=\"muted\">"+tr("в месяц")+"</span>")+
     (next?("<p class=\"debt-next\">"+tr("Платить до")+" ")+displayDate(next.dueDate)+' · '+money(next.amount)+'</p>':"")+
      '</article>';
 }).join("");
 return heading(tr("Долги и платежи"),button("new-debt",icon("plus")+tr("Добавить долг"),"primary")+button("new-recurring",tr("Регулярный платёж"),"secondary")+button("payment-history",tr("История платежей"),"text-btn"))+
 stats([[tr("Сумма активных долгов"),money(active.reduce((s,[,r])=>s+r.data.principal+(r.data.interest||0),0))],[tr("Осталось погасить"),money(remaining)]])+
 (regular.length?("<section class=\"lane recurring-lane\"><h2>"+tr("Регулярные платежи")+" <small>")+regular.length+'</small></h2><div class="recurring-grid">'+recurringCards+'</div></section>':"")+
 '<div class="board">'+lane(false)+lane(true)+'</div>';
}
function deleteCorner(key,name){
 const label=esc(tr("Удалить «")+name+"»");
 return button("delete-debt",icon("trash"),"delete-corner",'data-key="'+esc(key)+'" title="'+label+'" aria-label="'+label+'"');
}
function reminderOption(d){
 return '<label class="tick"><input type="checkbox" name="remindOnDueDate" '+(d?.remindOnDueDate?'checked':'')+'> '+tr('Я хочу напоминания день в день')+'</label>';
}
function recurringEditor(key){
 const rec=book.debts[key], d=rec?.data;
 editKey=key||id();editRev=rec?.rev||0;
 modal(rec?tr("Изменить регулярный платёж"):tr("Новый регулярный платёж"),formWrap("recurring",
   textField("name",tr("Название платежа"),d?.name,true)+cashField("monthly",tr("Сумма в месяц, сом"),d?.schedule.amount,true)+
   field(tr("Дата первого платежа"),'<input type="date" required name="firstDate" min="1000-01-01" max="9999-12-31" value="'+esc(d?.schedule.firstDate||F.dateKey())+'">')+
   reminderOption(d)+("<p class=\"muted\">"+tr("Без отметки напоминание появится за 4 дня до оплаты")+".</p>")));
}
function debtEditor(key){
 const rec=book.debts[key],d=rec?.data||{};
 editKey=key||id();editRev=rec?.rev||0;
 modal(rec?tr("Изменить долг"):tr("Новый долг"),formWrap("debt",textField("name",tr("Название или кредитор"),d.name,true)+
 cashField("principal",tr("Сумма долга, сом"),rec?d.principal+(d.interest||0):undefined,true)+
 (!rec?cashField("already",tr("Уже погашено, сом")):"")+
 ("<fieldset class=\"debt-schedule\"><legend>"+tr("Ежемесячный платёж")+"</legend><p class=\"muted\">"+tr("Для напоминаний укажите первый платёж по графику и количество платежей начиная с этой даты")+".</p>")+
 field(tr("Дата первого платежа"),'<input type="date" name="firstDate" min="1000-01-01" max="9999-12-31" value="'+esc(d.schedule?.firstDate)+'">')+
 '<div class="pair">'+cashField("monthly",tr("Платёж в месяц, сом"),d.schedule?.amount)+field(tr("Срок, мес."),'<input type="number" name="term" min="1" max="1200" step="1" value="'+esc(d.schedule?.months)+'">')+'</div>'+reminderOption(d)+'<p class="muted">'+tr('Без отметки напоминание появится за 4 дня до оплаты')+'.</p></fieldset>'));
}
function paymentCheck(payment,attrs){
 const label=payment.done?tr("Снять отметку «Внесено»"):tr("Отметить как внесённый");
 return button("toggle-payment",payment.done?icon("check"):"","check",attrs+' data-id="'+esc(payment.id)+
   '" aria-label="'+label+' · '+displayDate(payment.date)+' · '+money(payment.amount)+'" title="'+label+
   '" aria-pressed="'+Boolean(payment.done)+'"');
}
function paymentHistory(){
 const rows=[];
 for(const [key,{data}] of Object.entries(book.debts)){
   for(const p of data.payments)if(p.done)rows.push({key,name:data.name,p});
 }
 rows.sort((a,b)=>b.p.date.localeCompare(a.p.date));
 modal(tr("История платежей"),rows.length?'<ul class="payments">'+rows.map(({key,name,p})=>
   '<li class="paid">'+paymentCheck(p,'data-key="'+esc(key)+'" data-history="1"')+
   '<span>'+esc(name)+'<small>'+displayDate(p.date)+(p.period?(" "+tr("· за")+" ")+esc(monthName(p.period)):'')+
   '</small></span><b>'+money(p.amount)+'</b></li>').join("")+'</ul>':("<p class=\"muted\">"+tr("Пока нет внесённых платежей")+".</p>"));
}
function nextDebtPayment(d){
 if(d.closed)return null;
 const pending=d.payments.filter(p=>!p.done).sort((a,b)=>a.date.localeCompare(b.date))[0];
 const scheduled=F.installments(d)[0];
 if(pending&&(!scheduled||pending.period===scheduled.period||pending.date<=scheduled.dueDate))return pending;
 return scheduled;
}
function detail(key){
 const rec=book.debts[key],d=rec.data; editKey=key;editRev=rec.rev;
 const regular=d.type==="recurring";
 const previous=[...d.payments].reverse().filter(p=>p.done).sort((a,b)=>b.date.localeCompare(a.date))[0];
 const next=nextDebtPayment(d);
 modal(d.name,(regular?("<p class=\"muted\">"+tr("Ежемесячный платёж")+"</p><p class=\"big-money\">")+money(d.schedule.amount)+'</p>':
 ("<p class=\"muted\">"+tr("Остаток долга")+"</p><p class=\"big-money\">")+money(F.balance(d))+("</p><p class=\"muted\">"+tr("Сумма долга")+" ")+money(d.principal+(d.interest||0))+'</p>')+
 ("<div class=\"panel-head\"><h3>"+tr("История платежей")+"</h3>")+(!d.closed?button("payment",tr("＋ Внести платеж"),"secondary small"):"")+'</div>'+
 '<ul class="payments">'+(previous?'<li class="paid"><span class="payment-done-mark" aria-hidden="true">'+icon('check')+'</span><span>'+tr('Предыдущий платёж')+'<small>'+esc(displayDate(previous.date))+'</small></span><b>'+money(previous.amount)+'</b>'+button('payment',tr('Изменить'),'text-btn','data-id="'+esc(previous.id)+'"')+'</li>':'')+(next?'<li>'+button('complete-next','','check','data-key="'+esc(key)+'" aria-label="'+tr('Отметить как внесённый')+'" aria-pressed="false"')+'<span>'+tr('Запланирован')+'<small>'+esc(displayDate(next.date||next.dueDate))+'</small></span><b>'+money(next.amount)+'</b></li>':'')+'</ul>'+(!previous&&!next?'<p class="muted">'+tr('Пока нет платежей')+'</p>':'')+
 '<p class="error" role="alert"></p><div class="form-actions">'+button("edit-debt",regular?tr("Изменить регулярный платёж"):tr("Изменить долг"),"text-btn")+(regular?"":button("move-debt",d.closed?tr("Вернуть в активные"):tr("Перенести в выполнено"),"secondary",'data-key="'+key+'"'))+'</div>');
}
function paymentEditor(paymentId,period,day){
 const debt=book.debts[editKey].data, payment=debt.payments.find(p=>p.id===paymentId);
 const regular=debt.type==="recurring";
 const items=regular && period?F.installments(debt,period,period):F.installments(debt);
 const selected=payment?(payment.period||""):(period||items[0]?.period||"");
 const options=new Map(items.map(item=>[item.period,item.amount]));
 if(selected && !options.has(selected))options.set(selected,0);
 const periods=regular?monthField(tr("За какой месяц"),"period",selected,payment?.period && payment.period<debt.schedule.firstDate.slice(0,7)?payment.period:debt.schedule.firstDate.slice(0,7)):options.size?field(tr("За какой платёж"),("<select name=\"period\"><option value=\"\">"+tr("Вне графика")+"</option>")+
   [...options].map(([key,amount])=>'<option value="'+esc(key)+'" data-amount="'+amount+'" '+(key===selected?"selected":"")+'>'+esc(monthName(key))+'</option>').join("")+'</select>'):"";
 editItem=payment?.id;editRev=book.debts[editKey].rev;
 modal(payment?tr("Изменить платёж"):tr("Новый платёж"),formWrap("payment",field(tr("Дата платежа"),'<input required type="date" name="date" value="'+esc(payment?.date||F.dateKey())+'">')+
 (day?'<input type="hidden" name="returnDay" value="'+Number(day)+'">':"")+periods+cashField("amount",tr("Сумма, сом"),payment?.amount??options.get(selected),true)+textField("note",tr("Примечание"),payment?.note)+
 '<label class="tick"><input name="done" type="checkbox" '+(!payment||payment.done?"checked":"")+("> "+tr("Платёж внесён")+"</label>"),
 tr("Сохранить"),payment?button("remove-payment",tr("Удалить"),"text-btn danger"):""));
}
async function persist(kind,key,rev,data,after){
 if(kind==="debts" && data.type!=="recurring" && F.balance(data)<0){hint(tr("Внесённые платежи превышают сумму долга с переплатой."));return false;}
 book[kind][key]=await F.save(kind,key,rev,data);
 render();
 if(after)after();else if(dialog.open)dialog.close();
 return true;
}
async function showAccessWelcome(){
 const current=book;
 if(F.local || current.trial_active || !F.fullAccess(current))return;
 try{
   if(await F.claimAccessNotice() && book===current){
     const box=$("#access-welcome");
     box.textContent=tr("Поздравляем! Теперь вам открыт полный доступ.");
     box.classList.add("visible");
     setTimeout(()=>box.classList.remove("visible"),4500);
   }
 }catch(error){console.warn(tr("Не удалось проверить уведомление о подписке"),error);}
}
function subscription(){return RP.offers();}
function upgrade(){return RP.offers().catch(()=>hint(tr("Действие не завершено. Проверьте подключение и настройки доступа, затем повторите попытку.")));}
async function moveDebt(key,closing){
 const rec=book.debts[key],d=structuredClone(rec.data);
 if(Boolean(d.closed)===closing)return;
 editKey=key;editRev=rec.rev;
 if(closing && F.balance(d)>0){
  modal(tr("Завершить долг"),formWrap("settle",("<p class=\"intro\">"+tr("Записать последний платёж на")+" <b>")+money(F.balance(d))+("</b> "+tr("и перенести")+" «")+esc(d.name)+("» "+tr("в выполнено")+"?</p><p class=\"muted\">"+tr("Будущие платежи останутся в истории как запланированные")+".</p>"),tr("Погасить и завершить"),button("close",tr("Отмена"),"text-btn")));return;
 }
 d.closed=closing;await persist("debts",key,rec.rev,d);
}
const memberPageSize=25;
let memberPage=[],memberOffset=0;

function accessDate(value){
 return new Date(value).toLocaleDateString(siteLocale,{day:"2-digit",month:"2-digit",year:"numeric",timeZone:"Asia/Bishkek"});
}
function memberStatus(member){
 if(member.active)return member.paid_until?(tr("До")+" ")+accessDate(member.paid_until):tr("Бессрочный");
 return member.paid_until?(tr("Истёк")+" ")+accessDate(member.paid_until):tr("Бесплатный");
}
async function loadMembers(offset){
 const ownerBook=book;
 if(!ownerBook?.manager || F.local)return;
 const page=await F.members(offset);
 if(book!==ownerBook)return;
 memberOffset=offset;memberPage=page;view="members";render();
}
function membersView(){
 const rows=memberPage.slice(0,memberPageSize).map(m=>{
   const grant=m.self || (m.active && !m.paid_until) ? "—" :
     button("grant-dialog",tr("Выдать доступ"),"secondary small",'data-key="'+esc(m.id)+'"');
   return '<tr><th scope="row">'+esc(m.email)+'</th><td>'+accessDate(m.joined)+'</td><td>'+esc(memberStatus(m))+'</td><td>'+grant+'</td></tr>';
 }).join("");
 const prev=button("members-prev",tr("Назад"),"secondary small",memberOffset?"":"disabled");
 const next=button("members-next",tr("Далее"),"secondary small",memberPage.length>memberPageSize?"":"disabled");
 return heading(tr("Участники"))+button("regional-admin",tr("Платежи и подписки"),"secondary")+ ("<div class=\"panel member-panel\"><div class=\"table-wrap\"><table><thead><tr><th>"+tr("Почта")+"</th><th>"+tr("Регистрация")+"</th><th>"+tr("Полный доступ")+"</th><th>"+tr("Действие")+"</th></tr></thead><tbody>")+rows+'</tbody></table></div>'+
   (memberPage.length?"":("<p class=\"muted\">"+tr("Нет зарегистрированных пользователей")+".</p>"))+
   (memberOffset || memberPage.length>memberPageSize?'<div class="member-pages">'+prev+("<span>"+tr("Страница")+" ")+(memberOffset/memberPageSize+1)+'</span>'+next+'</div>':"")+'</div>';
}
function grantDialog(member){
 editKey=member.id;
 modal(tr("Выдать полный доступ"),formWrap("grant-member",
   '<p class="intro"><b>'+esc(member.email)+("</b><br>"+tr("Сейчас")+": ")+esc(memberStatus(member))+'</p>'+
   field(tr("Срок доступа"),("<select name=\"years\"><option value=\"1\">1 "+tr("год")+"</option><option value=\"3\">3 "+tr("года")+"</option><option value=\"5\">5 "+tr("лет")+"</option></select>"))+
   ("<p class=\"muted\">"+tr("При действующей подписке срок добавится к дате её окончания")+".</p>"),tr("Выдать доступ"),button("close",tr("Отмена"),"text-btn")));
}

async function handleAction(el){
 const action=el.dataset.action,key=el.dataset.key,item=el.dataset.id;
 if(action.startsWith("regional-")){await RP.action(el);return;}
 if(action==="close"){dialog.close();return;}
 if(action==="start"){renderGate("choice");return;}
 if(action==="login"||action==="register"||action==="reset"){renderGate(action);return;}
 if(action==="local"){await workspace(true);sessionStorage.setItem("st-preview-open","1");return;}
 if(action==="leave"){modal(tr('Выйти из аккаунта?'),'<p>'+tr('Вы действительно хотите выйти?')+'</p><div class="form-actions">'+button('close',tr('Отмена'),'secondary')+button('leave-confirm',tr('Выйти'),'primary')+'</div>');return;}
 if(action==="leave-confirm"){await F.leave();sessionStorage.removeItem("st-preview-open");home();return;}
 if(action==="retry-cloud"){await init().finally(()=>document.documentElement.classList.remove('session-loading'));return;}
 if(action==="view" && key==="members"){await loadMembers(0);return;}
 if(action==="members-next"){await loadMembers(memberOffset+memberPageSize);return;}
 if(action==="members-prev"){await loadMembers(Math.max(0,memberOffset-memberPageSize));return;}
 if(action==="grant-dialog" && book.manager){const m=memberPage.find(member=>member.id===key);if(m)grantDialog(m);return;}
 if(action==="view"){view=key;if(view==="year"){year=month.slice(0,4);compare=month;}render();return;}
 if(action==="jump-month"){month=key;view="month";render();return;}
 if(action==="new-month"){
  if(!book.paid){upgrade();return;}
  let suggestedMonth = F.nextMonth(month, 1);
  while (book.months[suggestedMonth]) {
    suggestedMonth = F.nextMonth(suggestedMonth, 1);
  }
  modal(tr("Новая месячная вкладка"),formWrap("month",monthField(tr("Месяц"),"month",suggestedMonth,"1000-01"),tr("Создать вкладку")));return;
 }
 if(action==="subscription" || action==="renew"){await subscription(action==="renew");return;}
 if(action==="upgrade"){await upgrade();return;}
 if(action==="refresh-plan"){book=await F.load();render();if(book.paid){dialog.close();showAccessWelcome();}else hint(tr("Оплата пока ожидает подтверждения"));return;}
 if(action==="day"){dayDetail(Number(el.dataset.day));return;}
 if(action==="entry"){entryEditor(Number(el.dataset.day),item);return;}
 if(action==="toggle-entry"){
  const rec=book.months[month],data=structuredClone(rec.data),entry=data.entries.find(e=>e.id===item);
  entry.done=!entry.done;await persist("months",month,rec.rev,data,()=>dayDetail(entry.day));return;
 }
 if(action==="goals"){goalsEditor();return;}
 if(action==="add-goal"){$("#goal-rows").insertAdjacentHTML("beforeend",goalRow());return;}
 if(action==="drop-goal"){el.closest(".goal-row").remove();return;}
 if(action==="remove-entry"||action==="remove-payment"){
   const what=action==="remove-entry"?tr("запись"):tr("платёж");
   modal((tr("Удалить")+" ")+what+"?",formWrap(action,("<p>"+tr("Это действие удалит")+" ")+what+(" "+tr("и пересчитает итог")+".</p>"),tr("Удалить"),button("close",tr("Отмена"),"text-btn")));return;
 }
 if(action==="new-debt"){debtEditor();return;}
 if(action==="new-recurring"){recurringEditor();return;}
 if(action==="delete-debt"){
   const rec=book.debts[key];
   editKey=key;editRev=rec.rev;
   modal(rec.data.type==="recurring"?tr("Удалить регулярный платёж?"):tr("Удалить долг?"),formWrap("delete-debt",
     '<p>«'+esc(rec.data.name)+("», "+tr("история оплат и напоминания будут удалены")+".</p>"),tr("Удалить"),button("close",tr("Отмена"),"text-btn")));
   return;
 }
 if(action==="payment-history"){paymentHistory();return;}
 if(action==="debt-detail"){detail(key);return;}
 if(action==="edit-debt"){
   const target=key||editKey;
   if(book.debts[target].data.type==="recurring")recurringEditor(target);else debtEditor(target);
   return;
 }
 if(action==="check-installment"){await checkInstallment(key,Number(el.dataset.day),el.dataset.token);return;}
 if(action==="record-payment"){editKey=key;paymentEditor(undefined,el.dataset.period,el.dataset.day);return;}
 if(action==="payment"){paymentEditor(item);return;}
 if(action==="move-debt"){await moveDebt(key,!book.debts[key].data.closed);return;}
 if(action==="complete-next"){
  const rec=book.debts[key],d=structuredClone(rec.data),next=nextDebtPayment(d);
  if(!next)return;
  if(next.id){const p=d.payments.find(p=>p.id===next.id);p.done=true;p.date=F.dateKey();}
  else d.payments.push({id:id(),date:F.dateKey(),amount:next.amount,period:next.period,dueDate:next.dueDate,periodAmount:d.schedule.amount,note:'',done:true});
  await persist('debts',key,rec.rev,d,()=>detail(key));return;
 }
 if(action==="toggle-payment"){
  const target=key||editKey,rec=book.debts[target],d=structuredClone(rec.data);
  const p=d.payments.find(payment=>payment.id===item);
  p.done=!p.done;
  if(d.closed && !p.done)d.closed=false;
  await persist("debts",target,rec.rev,d,()=>{
    if(el.dataset.day)dayDetail(Number(el.dataset.day));
    else if(el.dataset.history)paymentHistory();
    else detail(target);
  });
 }
}
async function submit(form){
 const f=new FormData(form),type=form.dataset.form;
 if(type.startsWith("regional-")){await RP.submit(form);return;}
 if(type==="delete-debt"){
   await F.deleteDebt(editKey,editRev);
   delete book.debts[editKey];
   dialog.close();render();notice(tr("Запись удалена"));return;
 }
 if(type==="grant-member"){
   const ownerBook=book;
   if(!ownerBook?.manager)return;
   const member=memberPage.find(m=>m.id===editKey);
   if(!member)return;
   const expiry=await F.grantMember(member.id,Number(f.get("years")));
   if(book!==ownerBook)return;
   member.paid_until=expiry;member.active=true;dialog.close();render();
   notice((tr("Полный доступ до")+" ")+accessDate(expiry));return;
 }
 if(type==="reset"){
   await F.requestReset(f.get("email").trim());renderGate("reset-sent");return;
 }
 if(type==="new-password" && gate==="new-password"){
   if(f.get("password")!==f.get("confirm")){hint(tr("Пароли не совпадают."));return;}
   await F.updatePassword(f.get("password"));await workspace();notice(tr("Пароль изменён."));return;
 }
 if(type==="auth"){
  if(gate==="register" && !f.has("legalAccept")){form.reportValidity();return;}
  if(!F.configured){hint(tr("Пока доступен локальный режим. Кнопка находится под формой."));return;}
  const started=await F.authenticate(gate,f.get("email").trim(),f.get("password"));
  if(started){await workspace();}else{renderGate("login");hint(tr("Проверьте почту и подтвердите регистрацию по ссылке."));}return;
 }
 if(type==="month"){const key=f.get("month");if(!book.months[key])await createMonth(key);month=key;dialog.close();render();return;}
 if(["entry","goals","remove-entry"].includes(type)){
  const d=structuredClone(book.months[editKey].data);
  if(type==="goals"){
    const rates=f.getAll("rate");d.goals=f.getAll("goalName").map((name,i)=>({name:name.trim(),rate:Number(rates[i])}));
    if(d.goals.some(g=>!g.name) || d.goals.reduce((s,g)=>s+Math.round(g.rate*100),0)>10000){hint(tr("Введите названия целей. Сумма долей должна быть не больше 100%."));return;}
  }else if(type==="remove-entry"){d.entries=d.entries.filter(e=>e.id!==editItem);}
  else{
    const entry={id:editItem||id(),day:Number(f.get("date").slice(-2)),income:amount(f,"income"),expense:amount(f,"expense"),source:f.get("source").trim(),purpose:f.get("purpose").trim(),done:f.has("done")};
    if(!(entry.income||entry.expense||entry.source||entry.purpose)){hint(tr("Введите сумму или описание записи."));return;}
    const choice=f.get("projectChoice");
    const name=cleanProject(choice?.startsWith("p:")?choice.slice(2):f.get("project"));
    if(choice==="+" && !name){hint(tr("Введите название проекта."));return;}
    if(name){
      entry.project=projectCatalog().get(name.toLowerCase())||name;
      d.projectNames ||= [];
      if(!d.projectNames.some(saved=>saved.toLowerCase()===entry.project.toLowerCase()))d.projectNames.push(entry.project);
    }
    const index=d.entries.findIndex(e=>e.id===entry.id);if(index<0)d.entries.push(entry);else d.entries[index]=entry;
  }
  await persist("months",editKey,editRev,d);return;
 }
 const rec=book.debts[editKey],d=structuredClone(rec?.data||{closed:false,payments:[]});
 if(type==="debt" || type==="recurring"){
  d.remindOnDueDate=f.has("remindOnDueDate");
  for(const p of d.payments){
   if(p.period && !p.dueDate && d.schedule)p.dueDate=F.dueForPeriod(d.schedule,p.period);
   if(p.period && !p.periodAmount && d.schedule)p.periodAmount=d.schedule.amount;
  }
 }
 if(type==="recurring"){
  d.name=f.get("name").trim();
  const firstDate=f.get("firstDate"),monthly=amount(f,"monthly");
  if(!d.name || !firstDate || !Number.isSafeInteger(monthly) || monthly<=0){hint(tr("Укажите название, сумму и дату первого платежа."));return;}
  d.type="recurring";d.schedule={firstDate,amount:monthly};
 }else if(type==="debt"){
  d.name=f.get("name").trim();d.principal=amount(f,"principal");d.interest=0;
  if(!d.name){hint(tr("Введите название долга."));return;}
  const firstDate=f.get("firstDate"),monthly=amount(f,"monthly"),term=Number(f.get("term"));
  if(firstDate || monthly || term){
    if(!firstDate || monthly<=0 || !Number.isInteger(term) || term<1 || term>1200){hint(tr("Для графика заполните дату, сумму ежемесячного платежа и срок в месяцах."));return;}
    d.schedule={firstDate,amount:monthly,months:term};
  }else delete d.schedule;
  if(d.closed && F.balance(d)>0){hint(tr("Чтобы увеличить сумму завершённого долга, сначала верните его в активные."));return;}
  if(amount(f,"already"))d.payments.push({id:id(),date:F.dateKey(),openingBalance:true,note:"Погашено до начала учёта",amount:amount(f,"already"),done:true});
 }else if(type==="payment"){
  const p={id:editItem||id(),date:f.get("date"),note:f.get("note").trim(),amount:amount(f,"amount"),done:f.has("done")};
  if(f.get("period")){
    p.period=f.get("period");
    const prior=d.payments.find(old=>old.period===p.period && old.dueDate);
    p.dueDate=prior?.dueDate||F.dueForPeriod(d.schedule,p.period);
    p.periodAmount=prior?.periodAmount||d.schedule?.amount;
  }
  const index=d.payments.findIndex(v=>v.id===p.id);if(index<0)d.payments.push(p);else d.payments[index]=p;
 }else if(type==="remove-payment"){d.payments=d.payments.filter(p=>p.id!==editItem);}
 else if(type==="settle"){d.payments.push({id:id(),date:F.dateKey(),note:tr("Окончательное погашение"),amount:F.balance(d),done:true});d.closed=true;}
 const returnDay=Number(f.get("returnDay"));
 await persist("debts",editKey,editRev,d,type==="settle"?null:()=>returnDay?dayDetail(returnDay):detail(editKey));
}
function lockSubscription(){
 book.paid=false;
 book.trial_active=false;book.access_locked=true;book.months={};
 book.debts={};
 month=book.trial;
 if(dialog.open)dialog.close();
 render();
}
function checkExpiry(){
 if(!book?.paid || F.fullAccess(book))return false;
 lockSubscription();
 notice(tr("Срок подписки закончился"));upgrade();
 return true;
}
async function run(task){
 if(busy)return;busy=true;document.body.classList.add("working");
 try{if(!checkExpiry())await task();}catch(error){
  const message=String(error.message||error);
  if(RP.error(message)){hint(tr(RP.error(message)));}
  else if(message.includes("STALE_VERSION")){
    try{book=await F.load();if(dialog.open)dialog.close();render();notice(tr("Данные изменились в другом окне. Загружена свежая версия. Повторите изменение."));}catch{hint(tr("Не удалось обновить таблицу. Проверьте подключение."));}
  }else if(message.includes("MONTH_LIMIT") || message.includes("SUBSCRIPTION_REQUIRED")){
    lockSubscription();upgrade();
  }else if(message.includes("FORBIDDEN"))hint(tr("У этого аккаунта нет прав на управление участниками."));
  else if(message.includes("st_delete_debt") && /not find|not exist|schema cache/i.test(message))hint(tr("Удаление ещё не подключено. Владельцу сайта нужно выполнить обновлённый setup.sql в Supabase."));
  else if(message.includes("ACCOUNT_UNAVAILABLE"))hint(tr("Доступ к аккаунту изменился. Откройте вкладку «Участники» заново."));
  else if(/invalid login/i.test(message))hint(tr("Проверьте адрес почты и пароль."));
  else if(/email not confirmed/i.test(message))hint(tr("Подтвердите почту по ссылке из письма."));
  else if(/rate limit/i.test(message))hint(tr("Слишком много попыток. Попробуйте ещё раз позже."));
  else hint(tr("Действие не завершено. Проверьте подключение и настройки доступа, затем повторите попытку."));
 }finally{busy=false;document.body.classList.remove("working");}
}
document.addEventListener("click",e=>{
 const date=e.target.closest('input[type="date"][name="firstDate"]');
 if(date&&typeof date.showPicker==='function'){try{date.showPicker();}catch{}return;}
 const el=e.target.closest('[data-action]');if(el){run(()=>handleAction(el));return;}
 const card=e.target.closest('[data-open-debt]');if(card&&!e.target.closest('button,a,input,select,textarea'))run(()=>detail(card.dataset.openDebt));
});
document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-open-debt]')){e.preventDefault();run(()=>detail(e.target.dataset.openDebt));}});
document.addEventListener("submit",e=>{if(e.target.dataset.form){e.preventDefault();run(()=>submit(e.target));}});
document.addEventListener("change",e=>{
 if(!book||busy)return;
 if(e.target.name==="projectChoice"){
   const input=e.target.form.elements.project;
   const adding=e.target.value==="+";
   input.hidden=input.disabled=!adding;
   input.required=adding;
   if(adding)input.focus();
   return;
 }
 if(e.target.name==="period" && !editItem){
   if(e.target.type==="select-one"){
     const suggested=Number(e.target.selectedOptions[0].dataset.amount);
     if(suggested)e.target.form.elements.amount.value=numberInput(suggested);
   }else if(e.target.value && e.target.validity.valid){
     const period=e.target.value;
     const item=F.installments(book.debts[editKey].data,period,period)[0];
     e.target.form.elements.amount.value=numberInput(item?.amount);
   }
   return;
 }
 if(e.target.id==="months")month=e.target.value;
 else if(e.target.id==="years")year=e.target.value;
 else if(e.target.id==="comparison")compare=e.target.value;
 else return;
 render();
});
let dragged=null;
document.addEventListener("dragstart",e=>{const card=e.target.closest("[data-debt]");if(card){dragged=card.dataset.debt;e.dataTransfer.setData("text/plain",dragged);e.dataTransfer.effectAllowed="move";}});
document.addEventListener("dragover",e=>{const lane=e.target.closest("[data-lane]");if(lane&&dragged){e.preventDefault();lane.classList.add("over");}});
document.addEventListener("dragleave",e=>{const lane=e.target.closest("[data-lane]");if(lane && !lane.contains(e.relatedTarget))lane.classList.remove("over");});
document.addEventListener("drop",e=>{const lane=e.target.closest("[data-lane]"),key=dragged;if(lane&&key){e.preventDefault();lane.classList.remove("over");dragged=null;run(()=>moveDebt(key,lane.dataset.lane==="closed"));}});
document.addEventListener("dragend",()=>{dragged=null;document.querySelectorAll(".over").forEach(l=>l.classList.remove("over"));});
function rollover(){
 if(!busy && checkExpiry())return;
 const today=F.dateKey();if(today===lastDate || !book || busy || dialog.open)return;
 const previous=lastDate;
 run(async()=>{if(book.paid && F.monthKey()!==previous.slice(0,7) && month===previous.slice(0,7)){
  if(!book.months[F.monthKey()])await createMonth(F.monthKey());month=F.monthKey();
 }lastDate=today;render();});
}
setInterval(rollover,60000);document.addEventListener("visibilitychange",()=>{if(!document.hidden)rollover();});
async function init(){
 if(!F.configured){document.documentElement.classList.remove('pin-start');try{if(sessionStorage.getItem("st-preview-open")==="1")await workspace(true);}catch{home();}return;}
 try{
   if(siteLocale!==pageLanguage)return;
   const fragment=new URLSearchParams(location.hash.slice(1));
   const recovery=fragment.get("type")==="recovery";
   const failed=fragment.has("error") || new URLSearchParams(location.search).has("error");
   const token=recovery?fragment.get("access_token"):null;
   const candidate=window.pinStartupAccount;
   window.pinStartupAccount=null;
   const early=startupUnlock;
   startupUnlock=null;
   const signedIn=await F.openSession(token);
   if(early && signedIn?.id!==candidate)appLock.cancelStartup();
   if(recovery || failed){
     home();
     if(recovery && token && signedIn && !failed)renderGate("new-password");
     else {renderGate("reset");hint(tr("Ссылка недействительна или устарела. Запросите новую."));}
   }else if(signedIn)await workspace(false,signedIn.id===candidate?early:null);
   F.observeSession(user=>{if(book && !F.local){home();if(user)run(()=>workspace());}});
 }catch{appLock.cancelStartup();home();$("#gate").insertAdjacentHTML("beforeend",("<p class=\"error\" role=\"alert\">"+tr("Не удалось подключиться к облачной таблице")+".</p>")+button("retry-cloud",tr("Повторить подключение"),"text-btn"));}
 finally{document.documentElement.classList.remove('pin-start','pin-wait');}
}
init();

let currencyIsChanging=false;
document.addEventListener('currency-changing',()=>{currencyIsChanging=!!book;if(currencyIsChanging)document.body.classList.add('currency-transition');});
document.addEventListener('currency-changed',()=>{if(!book)return;const delay=currencyIsChanging && !matchMedia('(prefers-reduced-motion: reduce)').matches?220:0;setTimeout(()=>{document.body.classList.remove('currency-transition');render();if(delay){document.body.classList.add('currency-updated');setTimeout(()=>document.body.classList.remove('currency-updated'),340);}currencyIsChanging=false;},delay);});
