"use strict";
const F=Finance, config=window.SUPER_TABLE_CONFIG;
const $=selector=>document.querySelector(selector);
const main=$("#main"), accountBox=$("#account"), dialog=$("#editor"), body=$("#dialog-body");
const welcome=main.innerHTML;
const monthNames=["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
const currency=new Intl.NumberFormat("ru-RU",{maximumFractionDigits:2});
const money=cents=>currency.format(cents/100)+" сом";
const numberInput=cents=>cents ? String(cents/100) : "";
const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const monthName=(key,year=true)=>monthNames[Number(key.slice(5))-1]+(year?" "+key.slice(0,4):"");
const len=key=>new Date(F.dateOf(key).getFullYear(),F.dateOf(key).getMonth()+1,0).getDate();
const firstDay=key=>key===F.monthKey()?new Date().getDate():1;
const id=()=>crypto.randomUUID();
let book,month,view="month",year,compare,gate="start",busy=false,workspaceOpening=null,lastDate=F.dateKey();
let editKey,editItem,editRev,flashTimer;
const icons={
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
function cashField(name,label,value=0,required=false){return field(label,'<input type="number" inputmode="decimal" step="0.01" min="'+(required?'0.01':'0')+'" max="99999999999" name="'+name+'" value="'+numberInput(value)+'" '+(required?"required":"")+' placeholder="0">');}
function textField(name,label,value="",required=false){return field(label,'<input name="'+name+'" maxlength="180" value="'+esc(value)+'" '+(required?"required":"")+'>');}
function amount(form,name){return Math.round(Number(form.get(name)||0)*100);}
function notice(message){const node=$("#notice");node.textContent=message;node.classList.add("show");clearTimeout(flashTimer);flashTimer=setTimeout(()=>node.classList.remove("show"),4500);}
function hint(message){const node=dialog.open?body.querySelector(".error"):main.querySelector(".error");if(node)node.textContent=message;else notice(message);}
function modal(title,html){$("#dialog-title").textContent=title;body.innerHTML=html;if(!dialog.open)dialog.showModal();}
function formWrap(name,content,label="Сохранить",extra=""){return '<form data-form="'+name+'">'+content+'<p class="error" role="alert"></p><div class="form-actions">'+extra+'<button class="primary" type="submit">'+label+'</button></div></form>';}
function renderGate(step){
 gate=step;const box=$("#gate");
 main.querySelector(".welcome").classList.toggle("auth-open",step!=="start");
 if(step==="start"){box.innerHTML=button("start","Попробовать бесплатно","primary launch");return;}
 const preview=F.configured?"":button("local","Открыть локальную таблицу","text-btn");
 if(step==="choice"){
   box.innerHTML='<div class="fade gate-actions">'+button("login","Вход","primary")+button("register","Регистрация","secondary")+'</div>'+preview;
 }else{
   const login=step==="login";
   box.innerHTML='<div class="auth-panel fade"><h1>'+(login?"Вход":"Регистрация")+'</h1>'+formWrap("auth",
      field("Электронная почта",'<input name="email" type="email" required autocomplete="email" maxlength="254">')+
      field("Пароль",'<input name="password" type="password" required '+(login?"":'minlength="8"')+' autocomplete="'+(login?"current-password":"new-password")+'">')+
      (!F.configured?'<p class="muted">Облачные аккаунты появятся после подключения Supabase. Сейчас таблицу можно попробовать в этом браузере.</p>':""),
      login?"Войти":"Зарегистрироваться",button("start","Назад","text-btn"))+preview+"</div>";
 }
 box.querySelector("input,button")?.focus({preventScroll:true});
}
function home(){document.body.classList.remove("month-open","workbook-open");memberPage=[];memberOffset=0;book=null;view="month";main.innerHTML=welcome;accountBox.innerHTML="";gate="start";if(dialog.open)dialog.close();}
async function workspace(local=false){
 if(workspaceOpening)return workspaceOpening;
 workspaceOpening=(async()=>{
   book=local?F.startLocal():await F.load();
   month=book.paid?F.monthKey():book.trial;
   if(!book.months[month])await createMonth(month);
   view="month";year=month.slice(0,4);compare=month;render();
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
 accountBox.innerHTML='<span class="account-label">'+(F.local?"На этом устройстве":esc(F.email))+'</span>'+button("leave",icon("logout"),"icon-btn",'aria-label="Выйти" title="Выйти"');
 const tabs=[["month","Месяц"],["debts","Долги"],["year","Годы"]];
 if(book.manager)tabs.push(["members","Участники"]);
 const nav=tabs.map(([key,name])=>button("view",icon(key)+name,"nav-item "+(view===key?"active":""),'data-key="'+key+'" '+(view===key?'aria-current="page"':""))).join("");
 const plan=book.paid?'<span class="plan-label" title="'+(book.paid_until?'До '+accessDate(book.paid_until):'Бессрочный доступ')+'">Полный доступ</span>':button("upgrade","Бесплатный месяц","plan-label");
 const section={month:monthView,debts:debtView,year:yearView,members:membersView}[view];
 main.innerHTML='<div class="desk"><nav class="tabs" aria-label="Разделы таблицы">'+nav+plan+'</nav><section class="content">'+section()+'</section></div>';
}
const weekdays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const shortSum = new Intl.NumberFormat("ru", {notation:"compact", maximumFractionDigits:1});

function sheetDay(day, entries, weekday, today) {
 const {income, expense, net} = F.totals({entries});
 const completed = entries.filter(entry => entry.done).length;
 const first = entries[0];
 const count = entries.length;
 const label = [day, monthName(month), weekdays[weekday], today ? "Сегодня" : "",
   count ? "Записей: "+count+". Итог: "+money(net) : "Добавить запись"].filter(Boolean).join(" · ");
 const value = cents => cents ? currency.format(cents / 100) : "";
 const status = count ? completed+" / "+count : "";
 const summary = count ? (Math.abs(net)<100000 ? currency.format(net/100) : shortSum.format(net/100)) : "";
 const classes = ["sheet-day",today && "is-today",count && completed===count && "finished"].filter(Boolean).join(" ");
 return button("day",'<span class="sheet-date"><b>'+day+'</b><small>'+weekdays[weekday]+'</small></span>'+
   '<span class="sheet-text">'+esc(first?.source || "")+(count>1?' <em>+'+(count-1)+'</em>':"")+'</span>'+
   '<span class="sheet-text">'+esc(first?.purpose || "")+'</span><span class="sheet-number">'+value(income)+'</span>'+
   '<span class="sheet-number">'+value(expense)+'</span><span class="sheet-number">'+(count?currency.format(net/100):"")+'</span>'+
   '<span class="sheet-status">'+status+'</span><span class="calendar-net">'+summary+'</span>',
   classes,'data-day="'+day+'" aria-label="'+esc(label)+'"'+(today?' aria-current="date"':""));
}

function monthView(){
 const data=book.months[month].data, sums=F.totals(data), days=len(month);
 const start=(F.dateOf(month).getDay()+6)%7;
 const weeks=Math.ceil((start+days)/7);
 const grouped=Array.from({length:days+1},()=>[]);
 for(const entry of data.entries)grouped[entry.day].push(entry);
 const cells=grouped.slice(1).map((entries,i)=>sheetDay(i+1,entries,(start+i)%7,month===F.monthKey() && i+1===firstDay(month))).join("");
 const options=Object.keys(book.months).sort().reverse().map(k=>'<option '+(k===month?"selected":"")+' value="'+k+'">'+monthName(k)+'</option>').join("");
 const amounts=[["Доходы",sums.income],["Расходы",sums.expense],["Итог месяца",sums.net]].map(([label,n])=>
   '<div><dt>'+label+'</dt><dd>'+money(n)+'</dd></div>').join("");
 return '<div class="sheet-tools"><select id="months" aria-label="Месячная вкладка">'+options+'</select>'+
   button("new-month",icon("plus")+'<span>Вкладка</span>',"sheet-tool",'aria-label="Новая месячная вкладка" title="Новая месячная вкладка"')+
   button("goals",icon("settings")+'<span>Распределение</span>',"sheet-tool",'aria-label="Распределение дохода" title="Распределение дохода"')+
   button("entry",icon("plus")+"Запись","sheet-add")+'</div><dl class="sheet-totals">'+amounts+'</dl>'+
   '<section class="month-sheet" aria-label="'+monthName(month)+'" style="--days:'+days+';--weeks:'+weeks+';--start:'+(start+1)+'">'+
   '<div class="sheet-labels">'+["День","Откуда","На что","Доход","Расход","Итог дня","Готово"].map(s=>'<span>'+s+'</span>').join("")+'</div>'+
   '<div class="week-labels">'+weekdays.map(s=>'<span>'+s+'</span>').join("")+'</div><div class="sheet-body">'+cells+'</div></section>';
}

function dayDetail(day){
 const entries=book.months[month].data.entries.filter(entry=>entry.day===day);
 if(!entries.length){entryEditor(day);return;}
 const date=F.dateOf(month);date.setDate(day);
 const rows=entries.map(entry=>{
   const key='data-id="'+esc(entry.id)+'"';
   return '<li class="'+(entry.done?'finished':'')+'">'+button("toggle-entry",entry.done?icon("check"):"","check",key+' aria-label="Выполнено" aria-pressed="'+Boolean(entry.done)+'"')+
     button("entry",'<strong>'+esc(entry.source || entry.purpose || "Запись")+'</strong>'+
      (entry.source && entry.purpose?'<span>'+esc(entry.purpose)+'</span>':"")+
      '<small>Доход '+money(entry.income)+' · Расход '+money(entry.expense)+'</small>',"day-entry",key)+'</li>';
 }).join("");
 modal(date.toLocaleDateString("ru",{day:"numeric",month:"long",year:"numeric"}),
   '<ul class="day-entries">'+rows+'</ul><div class="form-actions">'+button("entry",icon("plus")+"Добавить запись","primary",'data-day="'+day+'"')+'</div>');
}
function entryEditor(day,entryId){
 const rec=book.months[month];const entry=rec.data.entries.find(e=>e.id===entryId)||{day:day||firstDay(month)};
 editKey=month;editRev=rec.rev;editItem=entry.id;
 const date=editKey+"-"+String(entry.day).padStart(2,"0");
 const allocation = rec.data.goals.length ? '<div class="daily-goals" aria-live="polite"></div>' : "";
 modal(entry.id?"Изменить запись":"Новая запись",formWrap("entry",
   field("Дата",'<input name="date" type="date" required min="'+month+'-01" max="'+month+'-'+len(month)+'" value="'+date+'">')+
   '<div class="pair">'+cashField("income","Доход, сом",entry.income)+cashField("expense","Расход, сом",entry.expense)+'</div>'+
   textField("source","Откуда поступили деньги",entry.source)+textField("purpose","На что запланирован расход",entry.purpose)+allocation+
   '<label class="tick"><input type="checkbox" name="done" '+(entry.done?"checked":"")+'> Выполнено</label>'+
   '<p class="muted">Итог дня равен доходу за вычетом расхода. Отметка «Выполнено» выделяет запись зелёным.</p>',
   "Сохранить",entry.id?button("remove-entry","Удалить","text-btn danger"):""));
 dailyGoals();
}
function dailyGoals(){
 const output=body.querySelector(".daily-goals");if(!output)return;
 const form=new FormData(output.closest("form"));
 const date=form.get("date");if(!date)return;
 const day=Number(date.slice(-2));
 const other=book.months[editKey].data.entries.filter(e=>e.day===day && e.id!==editItem);
 const net=F.totals({entries:other}).net+amount(form,"income")-amount(form,"expense");
 output.textContent="За день · "+book.months[editKey].data.goals.map(g=>g.name+" "+money(F.allocated(net,g.rate))).join(" · ");
}
document.addEventListener("input",e=>{if(e.target.closest('[data-form="entry"]'))dailyGoals();});
function goalRow(g={name:"",rate:""}){return '<div class="goal-row">'+textField("goalName","Цель",g.name,true)+field("Доля, %",'<input type="number" name="rate" min="0" max="100" step="0.01" required value="'+esc(g.rate)+'">')+button("drop-goal","×","icon-btn",'aria-label="Убрать цель"')+'</div>';}
function goalsEditor(){const data=book.months[month].data,net=F.totals(data).net;
 const allocations=data.goals.map(g=>esc(g.name)+" · "+money(F.allocated(net,g.rate))).join("<br>");
 editKey=month;editRev=book.months[month].rev;modal("Распределение дохода",formWrap("goals",'<p class="muted">Доли считаются от итога месяца и сохраняются для этой вкладки.</p><p class="allocation-preview">'+allocations+'</p><div id="goal-rows">'+book.months[month].data.goals.map(goalRow).join("")+'</div>'+button("add-goal","＋ Ещё цель","text-btn")));}
function yearView(){
 const keys=Object.keys(book.months).sort(), years=[...new Set(keys.map(k=>k.slice(0,4)))].reverse();
 const inYear=keys.filter(k=>k.startsWith(year+"-"));
 const sums=inYear.map(k=>F.totals(book.months[k].data));
 const annual=sums.reduce((a,b)=>({income:a.income+b.income,expense:a.expense+b.expense,net:a.net+b.net}),{income:0,expense:0,net:0});
 const select='<select id="years" aria-label="Год">'+years.map(y=>'<option '+(y===year?"selected":"")+'>'+y+'</option>').join("")+'</select>';
 const monthly=Array.from({length:12},(_,i)=>year+"-"+String(i+1).padStart(2,"0"));
 if(!inYear.includes(compare)) compare=inYear.at(-1);
 const before=F.nextMonth(compare,-1),prev=book.months[before],curr=F.totals(book.months[compare].data);
 const max=Math.max(1,...sums.map(s=>Math.abs(s.net)));
 return heading("Сводка по годам",select)+stats([["Доходы за год",money(annual.income)],["Расходы за год",money(annual.expense)],["Итог за год",money(annual.net)]])+
 '<div class="panel"><div class="panel-head"><h2>Итоги по месяцам</h2></div><div class="table-wrap"><table><thead><tr><th>Месяц</th><th>Доход</th><th>Расход</th><th>Прибыль</th></tr></thead><tbody>'+monthly.map(k=>{
  const d=book.months[k],s=d?F.totals(d.data):null;
  return '<tr><th scope="row">'+(d?button("jump-month",monthName(k,false),"entry-link",'data-key="'+k+'"'):monthName(k,false))+'</th><td>'+(s?money(s.income):"—")+'</td><td>'+(s?money(s.expense):"—")+'</td><td>'+(s?'<div class="net-figure">'+money(s.net)+'<i style="width:'+Math.abs(s.net)/max*100+'%"></i></div>':"—")+'</td></tr>';}).join("")+
 '</tbody></table></div></div><div class="panel"><div class="panel-head"><h2>Сравнение месяцев</h2><select id="comparison" aria-label="Месяц для сравнения">'+inYear.map(k=>'<option value="'+k+'" '+(k===compare?'selected':'')+'>'+monthName(k)+'</option>').join("")+'</select></div>'+
 stats([[monthName(before),prev?money(F.totals(prev.data).net):"Нет данных"],[monthName(compare),money(curr.net)],["Изменение прибыли",prev?money(curr.net-F.totals(prev.data).net):"—"]])+'</div>';
}
function debtView(){
 const records=Object.entries(book.debts),active=records.filter(([,r])=>!r.data.closed);
 const remaining=active.reduce((sum,[,r])=>sum+F.balance(r.data),0);
 function lane(closed){
   const cards=records.filter(([,r])=>Boolean(r.data.closed)===closed);
   return '<section class="lane" data-lane="'+(closed?"closed":"active")+'"><h2>'+ (closed?"Выполнено":"Активные долги")+' <small>'+cards.length+'</small></h2>'+cards.map(([key,rec])=>{
     const d=rec.data,b=F.balance(d),total=d.principal+d.interest;
     return '<article class="debt-card '+(closed?"done-card":"")+'" draggable="true" data-debt="'+key+'"><h3>'+button("debt-detail",esc(d.name),"entry-link",'data-key="'+key+'"')+'</h3><span class="muted">Осталось</span><strong>'+money(b)+'</strong><div class="meter"><i style="width:'+Math.min(100,(1-b/total)*100)+'%"></i></div><div class="card-foot"><span>из '+money(total)+'</span>'+button("move-debt",closed?"Вернуть":"Завершить","text-btn",'data-key="'+key+'"')+'</div></article>';
   }).join("")+(cards.length?"":'<div class="lane-empty">'+(closed?"Сюда можно перенести погашенный долг.":"Добавьте долг, чтобы вести график платежей.")+'</div>')+'</section>';
 }
 return heading("Трекер долгов",button("new-debt",icon("plus")+"Добавить долг","primary"))+
 stats([["Сумма активных долгов",money(active.reduce((s,[,r])=>s+r.data.principal,0))],["Осталось погасить",money(remaining)],["Переплата по активным долгам",money(active.reduce((s,[,r])=>s+r.data.interest,0))]])+
 '<div class="board">'+lane(false)+lane(true)+'</div>';
}
function debtEditor(key){
 const rec=book.debts[key],d=rec?.data||{};
 editKey=key||id();editRev=rec?.rev||0;
 modal(rec?"Изменить долг":"Новый долг",formWrap("debt",textField("name","Название или кредитор",d.name,true)+
 cashField("principal","Основная сумма, сом",d.principal,true)+cashField("interest","Переплата сверх основной суммы, сом",d.interest)+
 (!rec?cashField("already","Уже погашено, сом"):"")));
}
function detail(key){
 const rec=book.debts[key],d=rec.data; editKey=key;editRev=rec.rev;
 const payments=[...d.payments].sort((a,b)=>a.date.localeCompare(b.date));
 modal(d.name,'<p class="muted">Остаток долга</p><p class="big-money">'+money(F.balance(d))+'</p><p class="muted">Основная сумма '+money(d.principal)+' · Переплата '+money(d.interest)+'</p>'+
 '<div class="panel-head"><h3>График платежей</h3>'+(!d.closed?button("payment","＋ Платёж","secondary small"):"")+'</div>'+
 (payments.length?'<ul class="payments">'+payments.map(p=>'<li class="'+(p.done?"paid":"")+'">'+button("toggle-payment",p.done?icon("check"):"","check",'data-id="'+esc(p.id)+'" aria-label="Платёж внесён" aria-pressed="'+Boolean(p.done)+'" '+(d.closed?"disabled":""))+'<span>'+esc(p.date.split("-").reverse().join("."))+'<small>'+esc(p.note||(p.done?"Внесён":"Запланирован"))+'</small></span><b>'+money(p.amount)+'</b>'+(!d.closed?button("payment","Изменить","text-btn",'data-id="'+esc(p.id)+'"'):"")+'</li>').join("")+'</ul>':'<p class="muted">Пока нет платежей.</p>')+
 '<p class="error" role="alert"></p><div class="form-actions">'+(!d.closed?button("edit-debt","Изменить долг","text-btn"):"")+button("move-debt",d.closed?"Вернуть в активные":"Перенести в выполнено","secondary",'data-key="'+key+'"')+'</div>');
}
function paymentEditor(paymentId){
 const debt=book.debts[editKey].data, payment=debt.payments.find(p=>p.id===paymentId);
 editItem=payment?.id;editRev=book.debts[editKey].rev;
 modal(payment?"Изменить платёж":"Новый платёж",formWrap("payment",field("Дата платежа",'<input required type="date" name="date" value="'+esc(payment?.date||F.dateKey())+'">')+
 cashField("amount","Сумма, сом",payment?.amount,true)+textField("note","Примечание",payment?.note)+
 '<label class="tick"><input name="done" type="checkbox" '+(!payment||payment.done?"checked":"")+'> Платёж внесён</label>',
 "Сохранить",payment?button("remove-payment","Удалить","text-btn danger"):""));
}
async function persist(kind,key,rev,data,after){
 if(kind==="debts" && F.balance(data)<0){hint("Внесённые платежи превышают сумму долга с переплатой.");return false;}
 book[kind][key]=await F.save(kind,key,rev,data);
 render();
 if(after)after();else if(dialog.open)dialog.close();
 return true;
}
function upgrade(){
 const url=config.paymentUrl||config.supportUrl;
 modal("Полный доступ",'<p class="intro">В бесплатной версии доступна одна месячная вкладка — <b>'+esc(monthName(book.trial))+'</b>. Полный доступ открывает новые месяцы и сравнение результатов за разные годы.</p>'+
 '<p class="muted">'+(F.local?"Сейчас вы ведёте локальную таблицу. Полный доступ привязывается к облачному аккаунту.":"После подтверждения оплаты владелец активирует доступ для "+esc(F.email)+".")+'</p>'+
 (!F.local?'<p class="error" role="status"></p><div class="form-actions">'+button("refresh-plan","Проверить доступ","secondary")+'<a class="primary" href="'+esc(url)+'" target="_blank" rel="noopener">'+(config.paymentUrl?"Перейти к оплате":"Запросить оплату")+'</a></div>':""));
}
async function moveDebt(key,closing){
 const rec=book.debts[key],d=structuredClone(rec.data);
 if(Boolean(d.closed)===closing)return;
 editKey=key;editRev=rec.rev;
 if(closing && F.balance(d)>0){
  modal("Завершить долг",formWrap("settle",'<p class="intro">Записать последний платёж на <b>'+money(F.balance(d))+'</b> и перенести «'+esc(d.name)+'» в выполнено?</p><p class="muted">Будущие платежи останутся в истории как запланированные.</p>',"Погасить и завершить",button("close","Отмена","text-btn")));return;
 }
 d.closed=closing;await persist("debts",key,rec.rev,d);
}
const memberPageSize=25;
let memberPage=[],memberOffset=0;

function accessDate(value){
 return new Date(value).toLocaleDateString("ru",{day:"2-digit",month:"2-digit",year:"numeric",timeZone:"Asia/Bishkek"});
}
function memberStatus(member){
 if(member.active)return member.paid_until?"До "+accessDate(member.paid_until):"Бессрочный";
 return member.paid_until?"Истёк "+accessDate(member.paid_until):"Бесплатный";
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
     button("grant-dialog","Выдать доступ","secondary small",'data-key="'+esc(m.id)+'"');
   return '<tr><th scope="row">'+esc(m.email)+'</th><td>'+accessDate(m.joined)+'</td><td>'+esc(memberStatus(m))+'</td><td>'+grant+'</td></tr>';
 }).join("");
 const prev=button("members-prev","Назад","secondary small",memberOffset?"":"disabled");
 const next=button("members-next","Далее","secondary small",memberPage.length>memberPageSize?"":"disabled");
 return heading("Участники")+ '<div class="panel member-panel"><div class="table-wrap"><table><thead><tr><th>Почта</th><th>Регистрация</th><th>Полный доступ</th><th>Действие</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
   (memberPage.length?"":'<p class="muted">Нет зарегистрированных пользователей.</p>')+
   (memberOffset || memberPage.length>memberPageSize?'<div class="member-pages">'+prev+'<span>Страница '+(memberOffset/memberPageSize+1)+'</span>'+next+'</div>':"")+'</div>';
}
function grantDialog(member){
 editKey=member.id;
 modal("Выдать полный доступ",formWrap("grant-member",
   '<p class="intro"><b>'+esc(member.email)+'</b><br>Сейчас: '+esc(memberStatus(member))+'</p>'+
   field("Срок от сегодняшнего дня",'<select name="years"><option value="1">1 год</option><option value="3">3 года</option></select>')+
   '<p class="muted">Выбранный срок заменит текущую дату окончания доступа.</p>',"Выдать доступ",button("close","Отмена","text-btn")));
}

async function handleAction(el){
 const action=el.dataset.action,key=el.dataset.key,item=el.dataset.id;
 if(action==="close"){dialog.close();return;}
 if(action==="start"){renderGate("choice");return;}
 if(action==="login"||action==="register"){renderGate(action);return;}
 if(action==="local"){await workspace(true);sessionStorage.setItem("st-preview-open","1");return;}
 if(action==="leave"){await F.leave();sessionStorage.removeItem("st-preview-open");home();return;}
 if(action==="retry-cloud"){await init();return;}
 if(action==="view" && key==="members"){await loadMembers(0);return;}
 if(action==="members-next"){await loadMembers(memberOffset+memberPageSize);return;}
 if(action==="members-prev"){await loadMembers(Math.max(0,memberOffset-memberPageSize));return;}
 if(action==="grant-dialog" && book.manager){const m=memberPage.find(member=>member.id===key);if(m)grantDialog(m);return;}
 if(action==="view"){view=key;if(view==="year"){year=month.slice(0,4);compare=month;}render();return;}
 if(action==="jump-month"){month=key;view="month";render();return;}
 if(action==="new-month"){
  if(!book.paid){upgrade();return;}
  modal("Новая месячная вкладка",formWrap("month",field("Месяц",'<input required type="month" min="1000-01" max="9999-12" name="month" value="'+F.nextMonth(month,1)+'">'),"Создать вкладку"));return;
 }
 if(action==="upgrade"){upgrade();return;}
 if(action==="refresh-plan"){book=await F.load();render();if(book.paid){dialog.close();notice("Полный доступ активирован");}else hint("Оплата пока ожидает подтверждения");return;}
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
   const what=action==="remove-entry"?"запись":"платёж";
   modal("Удалить "+what+"?",formWrap(action,'<p>Это действие удалит '+what+' и пересчитает итог.</p>',"Удалить",button("close","Отмена","text-btn")));return;
 }
 if(action==="new-debt"){debtEditor();return;}
 if(action==="debt-detail"){detail(key);return;}
 if(action==="edit-debt"){debtEditor(editKey);return;}
 if(action==="payment"){paymentEditor(item);return;}
 if(action==="move-debt"){await moveDebt(key,!book.debts[key].data.closed);return;}
 if(action==="toggle-payment"){
  const rec=book.debts[editKey],d=structuredClone(rec.data);
  if(!d.closed){const p=d.payments.find(p=>p.id===item);p.done=!p.done;await persist("debts",editKey,editRev,d,()=>detail(editKey));}
 }
}
async function submit(form){
 const f=new FormData(form),type=form.dataset.form;
 if(type==="grant-member"){
   const ownerBook=book;
   if(!ownerBook?.manager)return;
   const member=memberPage.find(m=>m.id===editKey);
   if(!member)return;
   const expiry=await F.grantMember(member.id,Number(f.get("years")));
   if(book!==ownerBook)return;
   member.paid_until=expiry;member.active=true;dialog.close();render();
   notice("Полный доступ до "+accessDate(expiry));return;
 }
 if(type==="auth"){
  if(!F.configured){hint("Пока доступен локальный режим. Кнопка находится под формой.");return;}
  const started=await F.authenticate(gate,f.get("email").trim(),f.get("password"));
  if(started){await workspace();}else{renderGate("login");hint("Проверьте почту и подтвердите регистрацию по ссылке.");}return;
 }
 if(type==="month"){const key=f.get("month");if(!book.months[key])await createMonth(key);month=key;dialog.close();render();return;}
 if(["entry","goals","remove-entry"].includes(type)){
  const d=structuredClone(book.months[editKey].data);
  if(type==="goals"){
    const rates=f.getAll("rate");d.goals=f.getAll("goalName").map((name,i)=>({name:name.trim(),rate:Number(rates[i])}));
    if(d.goals.some(g=>!g.name) || d.goals.reduce((s,g)=>s+Math.round(g.rate*100),0)>10000){hint("Введите названия целей. Сумма долей должна быть не больше 100%.");return;}
  }else if(type==="remove-entry"){d.entries=d.entries.filter(e=>e.id!==editItem);}
  else{
    const entry={id:editItem||id(),day:Number(f.get("date").slice(-2)),income:amount(f,"income"),expense:amount(f,"expense"),source:f.get("source").trim(),purpose:f.get("purpose").trim(),done:f.has("done")};
    if(!(entry.income||entry.expense||entry.source||entry.purpose)){hint("Введите сумму или описание записи.");return;}
    const index=d.entries.findIndex(e=>e.id===entry.id);if(index<0)d.entries.push(entry);else d.entries[index]=entry;
  }
  await persist("months",editKey,editRev,d);return;
 }
 const rec=book.debts[editKey],d=structuredClone(rec?.data||{closed:false,payments:[]});
 if(type==="debt"){
  d.name=f.get("name").trim();d.principal=amount(f,"principal");d.interest=amount(f,"interest");
  if(!d.name){hint("Введите название долга.");return;}
  if(amount(f,"already"))d.payments.push({id:id(),date:F.dateKey(),note:"Погашено до начала учёта",amount:amount(f,"already"),done:true});
 }else if(type==="payment"){
  const p={id:editItem||id(),date:f.get("date"),note:f.get("note").trim(),amount:amount(f,"amount"),done:f.has("done")};
  const index=d.payments.findIndex(v=>v.id===p.id);if(index<0)d.payments.push(p);else d.payments[index]=p;
 }else if(type==="remove-payment"){d.payments=d.payments.filter(p=>p.id!==editItem);}
 else if(type==="settle"){d.payments.push({id:id(),date:F.dateKey(),note:"Окончательное погашение",amount:F.balance(d),done:true});d.closed=true;}
 await persist("debts",editKey,editRev,d,type==="settle"?null:()=>detail(editKey));
}
async function run(task){
 if(busy)return;busy=true;document.body.classList.add("working");
 try{await task();}catch(error){
  const message=String(error.message||error);
  if(message.includes("STALE_VERSION")){
    try{book=await F.load();if(dialog.open)dialog.close();render();notice("Данные изменились в другом окне. Загружена свежая версия. Повторите изменение.");}catch{hint("Не удалось обновить таблицу. Проверьте подключение.");}
  }else if(message.includes("MONTH_LIMIT")){
    book.paid=false;month=book.trial;render();upgrade();
  }else if(message.includes("FORBIDDEN"))hint("У этого аккаунта нет прав на управление участниками.");
  else if(message.includes("ACCOUNT_UNAVAILABLE"))hint("Доступ к аккаунту изменился. Откройте вкладку «Участники» заново.");
  else if(/invalid login/i.test(message))hint("Проверьте адрес почты и пароль.");
  else if(/email not confirmed/i.test(message))hint("Подтвердите почту по ссылке из письма.");
  else if(/rate limit/i.test(message))hint("Слишком много попыток. Попробуйте ещё раз позже.");
  else hint("Действие не завершено. Проверьте подключение и настройки доступа, затем повторите попытку.");
 }finally{busy=false;document.body.classList.remove("working");}
}
document.addEventListener("click",e=>{const el=e.target.closest("[data-action]");if(el)run(()=>handleAction(el));});
document.addEventListener("submit",e=>{if(e.target.dataset.form){e.preventDefault();run(()=>submit(e.target));}});
document.addEventListener("change",e=>{
 if(!book||busy)return;
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
 const today=F.dateKey();if(today===lastDate || !book || busy || dialog.open)return;
 const previous=lastDate;
 run(async()=>{if(book.paid && F.monthKey()!==previous.slice(0,7) && month===previous.slice(0,7)){
  if(!book.months[F.monthKey()])await createMonth(F.monthKey());month=F.monthKey();
 }lastDate=today;render();});
}
setInterval(rollover,60000);document.addEventListener("visibilitychange",()=>{if(!document.hidden)rollover();});
async function init(){
 if(!F.configured){try{if(sessionStorage.getItem("st-preview-open")==="1")await workspace(true);}catch{home();}return;}
 try{
   const signedIn=await F.openSession();
   if(signedIn)await workspace();
   F.observeSession(user=>{if(book && !F.local){home();if(user)run(()=>workspace());}});
 }catch{home();$("#gate").insertAdjacentHTML("beforeend",'<p class="error" role="alert">Не удалось подключиться к облачной таблице.</p>'+button("retry-cloud","Повторить подключение","text-btn"));}
}
init();
