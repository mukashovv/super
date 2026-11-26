const internationalBrand = !["ru","ky"].includes(siteLocale);
const brandImage = internationalBrand ? "./s-english-192.png" : "./brand.png";
const localeCurrencies = {
  ru:"RUB", ky:"KGS", en:"USD", kk:"KZT", es:"EUR", de:"EUR",
  "pt-BR":"BRL", fr:"EUR", tr:"TRY", id:"IDR", ja:"JPY"
};
let currencyCode = localeCurrencies[siteLocale];
try{const saved=localStorage.getItem('supertable.currency');if(saved&&/^[A-Z]{3}$/.test(saved))currencyCode=saved;}catch{}
let moneyFormat = new Intl.NumberFormat(siteLocale, {
  style:"currency", currency:currencyCode, currencyDisplay:"narrowSymbol",
  minimumFractionDigits:0, maximumFractionDigits:2
});
let currencyUnit = currencyCode === "KGS" ? "сом" : moneyFormat.formatToParts(0).find(part => part.type === "currency").value;
function setDisplayCurrency(code){
 currencyCode=code;
 moneyFormat=new Intl.NumberFormat(siteLocale,{style:'currency',currency:code,currencyDisplay:'narrowSymbol',minimumFractionDigits:0,maximumFractionDigits:2});
 currencyUnit=code==='KGS'?'сом':moneyFormat.formatToParts(0).find(p=>p.type==='currency').value;
 try{localStorage.setItem('supertable.currency',code);}catch{}
}
function tr(source) {
  const dict = siteLocale === "kk" ? kazakh : siteLocale === "ky" ? kyrgyz : typeof pageTranslations !== "undefined" ? pageTranslations : internationalBrand ? english : null;
  const label = regionalTranslations[siteLocale]?.[source] ?? dict?.[source] ?? source;
  if (source === "сом") return currencyUnit;
  if (source.endsWith(", сом")) return label.slice(0, label.lastIndexOf(",") + 1) + " " + currencyUnit;
  return label;
}
document.documentElement.lang = siteLocale;
document.querySelector(".brand img").src = brandImage;
document.querySelector('link[rel="icon"]').href = brandImage;
document.querySelector('link[rel="apple-touch-icon"]').href = internationalBrand ? "./s-english-192.png" : "./icon-192.png";
if (siteLocale !== "ru") document.querySelector('link[rel="manifest"]').href = "./manifest-"+siteLocale+".webmanifest";
document.querySelector('meta[name="apple-mobile-web-app-title"]').content = tr("Супер Таблица");
const languageSelect=document.getElementById('language');
function showLanguages(){
 languageSelect.replaceChildren();
 for(const [tag,name] of Object.entries(languages)){const option=new Option(name,tag,false,tag===siteLocale);option.lang=tag;languageSelect.add(option);}
 languageSelect.add(new Option(tr('Валюта')+'…','currency-settings'));
 languageSelect.setAttribute('aria-label','Язык / Тил');
}
const currencyDialog=document.createElement('dialog');
currencyDialog.className='currency-dialog';
currencyDialog.innerHTML='<div class="currency-dialog-head"><h2>'+tr('Валюта')+'</h2><button type="button" data-currency-back>'+tr('Назад')+'</button></div><input class="currency-search" type="search" data-currency-search placeholder="'+(siteLocale==='ru'?'Поиск валюты':siteLocale==='ky'?'Валютаны издөө':'Search currency')+'" aria-label="'+(siteLocale==='ru'?'Поиск валюты':siteLocale==='ky'?'Валютаны издөө':'Search currency')+'"><div class="currency-dialog-list" role="listbox"></div>';
document.body.append(currencyDialog);
const currencyList=currencyDialog.querySelector('.currency-dialog-list');
function showCurrencies(){
 currencyList.replaceChildren();
 const search=currencyDialog.querySelector('[data-currency-search]');search.value='';
 const names=new Intl.DisplayNames([siteLocale],{type:'currency'});
 const codes=typeof Intl.supportedValuesOf==='function'?Intl.supportedValuesOf('currency'):Object.values(localeCurrencies);
 for(const code of [...new Set([currencyCode,...codes])].sort()){
  const item=document.createElement('button'); item.type='button'; item.dataset.currency=code; item.setAttribute('role','option'); item.setAttribute('aria-selected',String(code===currencyCode));
  item.textContent=code+' · '+(code==='KGS'&&siteLocale==='ru'?'Кыргызский сом':names.of(code));
  item.addEventListener('click',()=>{if(code!==currencyCode)document.dispatchEvent(new Event('currency-changing'));setDisplayCurrency(code);currencyDialog.close();languageSelect.value=siteLocale;languageSelect.blur();document.activeElement?.blur();document.dispatchEvent(new Event('currency-changed'));});
  currencyList.append(item);
 }
 currencyDialog.showModal();
 positionCurrencyDialog();
 currencyDialog.querySelector('[data-currency-back]').focus({preventScroll:true});
 search.oninput=()=>{const query=search.value.trim().toLocaleLowerCase(siteLocale);for(const item of currencyList.children)item.hidden=!item.textContent.toLocaleLowerCase(siteLocale).includes(query);currencyList.scrollTop=0;};
}
function positionCurrencyDialog(){if(!currencyDialog.open||!window.visualViewport)return;currencyDialog.style.setProperty('--currency-view-top',window.visualViewport.offsetTop+'px');currencyDialog.style.setProperty('--currency-view-height',window.visualViewport.height+'px');}
window.visualViewport?.addEventListener('resize',positionCurrencyDialog);
window.visualViewport?.addEventListener('scroll',positionCurrencyDialog);
currencyDialog.addEventListener('toggle',positionCurrencyDialog);
showLanguages();
languageSelect.addEventListener('change',()=>{
 const value=languageSelect.value;
 if(value==='currency-settings'){languageSelect.value=siteLocale;languageSelect.blur();setTimeout(showCurrencies,0);return;}
 try{localStorage.setItem('supertable.language',value);}catch{}
 location.replace(languageUrl(value).href);
});
currencyDialog.querySelector('[data-currency-back]').addEventListener('click',()=>currencyDialog.close());
currencyDialog.addEventListener('cancel',event=>{event.preventDefault();currencyDialog.close();});
// Translate the static shell before the app renders any personal records.
for (const el of document.querySelectorAll("title,.brand span,#gate button,#install-app,#install-title,noscript")) {
  for (const node of el.childNodes) if (node.nodeType === Node.TEXT_NODE) node.textContent = tr(node.textContent);
}
for (const el of document.querySelectorAll("[alt],[aria-label],[title],meta[name=description]")) {
  for (const attr of ["alt","aria-label","title","content"]) if (el.hasAttribute(attr)) el.setAttribute(attr,tr(el.getAttribute(attr)));
}
