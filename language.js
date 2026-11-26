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
const languageSelect = document.getElementById("language");
const localeMenu=document.createElement('div');localeMenu.className='locale-menu';
languageSelect.before(localeMenu);localeMenu.append(languageSelect);
const localePanel=document.createElement('div');localePanel.className='locale-panel';localePanel.hidden=true;
for(const [tag,name] of Object.entries(languages)){
 const option=new Option(name,tag,false,tag===siteLocale);option.lang=tag;languageSelect.add(option);
}
languageSelect.add(new Option(tr('Валюта')+'…','currency-settings'));
languageSelect.addEventListener('change',()=>{
 if(languageSelect.value==='currency-settings'){
  languageSelect.value=siteLocale;localePanel.hidden=false;localePanel.scrollTop=0;currencyBack.focus();return;
 }
 const tag=languageSelect.value;
 try{localStorage.setItem('supertable.language',tag);}catch{}
 location.replace(languageUrl(tag).href);
});
languageSelect.addEventListener('pointerdown',()=>{localePanel.hidden=true;});
const currencyMenu=document.createElement('div');currencyMenu.className='currency-menu';
const currencyBack=document.createElement('button');currencyBack.type='button';currencyBack.textContent=tr('Назад');
const currencyList=document.createElement('div');currencyList.className='currency-list';
const currencyNames=new Intl.DisplayNames([siteLocale],{type:'currency'});
const supportedCurrencies=typeof Intl.supportedValuesOf==='function'?Intl.supportedValuesOf('currency'):Object.values(localeCurrencies);
for(const code of [...new Set([currencyCode,...supportedCurrencies])].sort()){
 const item=document.createElement('button');item.type='button';item.dataset.currency=code;
 item.textContent=code+' · '+(code==='KGS'&&siteLocale==='ru'?'Кыргызский сом':currencyNames.of(code));
 item.setAttribute('aria-pressed',String(code===currencyCode));
 item.addEventListener('click',()=>{
  setDisplayCurrency(code);
  currencyList.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.currency===code)));
  document.dispatchEvent(new Event('currency-changed'));
  localePanel.hidden=true;languageSelect.focus();
 });
 currencyList.append(item);
}
currencyBack.addEventListener('click',()=>{
 localePanel.hidden=true;languageSelect.focus();
 try{languageSelect.showPicker?.();}catch{}
});
currencyMenu.append(currencyBack,currencyList);localePanel.append(currencyMenu);localeMenu.append(localePanel);
document.addEventListener('click',event=>{if(!localeMenu.contains(event.target))localePanel.hidden=true;});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!localePanel.hidden){localePanel.hidden=true;languageSelect.focus();}});
// Translate the static shell before the app renders any personal records.
for (const el of document.querySelectorAll("title,.brand span,#gate button,#install-app,#install-title,noscript")) {
  for (const node of el.childNodes) if (node.nodeType === Node.TEXT_NODE) node.textContent = tr(node.textContent);
}
for (const el of document.querySelectorAll("[alt],[aria-label],[title],meta[name=description]")) {
  for (const attr of ["alt","aria-label","title","content"]) if (el.hasAttribute(attr)) el.setAttribute(attr,tr(el.getAttribute(attr)));
}
