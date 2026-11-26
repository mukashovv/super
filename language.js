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
const localeMenu=document.createElement('details');localeMenu.className='locale-menu';
const localeToggle=document.createElement('summary');localeToggle.id='language';localeToggle.textContent=languages[siteLocale];localeToggle.setAttribute('aria-label','Язык / Тил');
const localePanel=document.createElement('div');localePanel.className='locale-panel';
for(const [tag,name] of Object.entries(languages)){
 const item=document.createElement('button');item.type='button';item.textContent=name;item.lang=tag;item.setAttribute('aria-pressed',String(tag===siteLocale));
 item.addEventListener('click',()=>{try{localStorage.setItem('supertable.language',tag);}catch{}location.replace(languageUrl(tag).href);});
 localePanel.append(item);
}
const currencyMenu=document.createElement('div');currencyMenu.className='currency-menu';currencyMenu.hidden=true;
const currencyToggle=document.createElement('button');currencyToggle.type='button';currencyToggle.textContent=tr('Валюта');
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
  localeMenu.open=false;localeToggle.focus();
 });
 currencyList.append(item);
}
function showCurrencyList(show){
 for(const child of localePanel.children)child.hidden=show;
 currencyMenu.hidden=!show;localePanel.scrollTop=0;
 (show?currencyBack:currencyToggle).focus();
}
currencyToggle.addEventListener('click',()=>showCurrencyList(true));
currencyBack.addEventListener('click',()=>showCurrencyList(false));
localeMenu.addEventListener('toggle',()=>{if(!localeMenu.open){for(const child of localePanel.children)child.hidden=false;currencyMenu.hidden=true;}});
currencyMenu.append(currencyBack,currencyList);localePanel.append(currencyToggle,currencyMenu);localeMenu.append(localeToggle,localePanel);languageSelect.replaceWith(localeMenu);
document.addEventListener('click',event=>{if(!localeMenu.contains(event.target))localeMenu.open=false;});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&localeMenu.open){localeMenu.open=false;localeToggle.focus();}});
// Translate the static shell before the app renders any personal records.
for (const el of document.querySelectorAll("title,.brand span,#gate button,#install-app,#install-title,noscript")) {
  for (const node of el.childNodes) if (node.nodeType === Node.TEXT_NODE) node.textContent = tr(node.textContent);
}
for (const el of document.querySelectorAll("[alt],[aria-label],[title],meta[name=description]")) {
  for (const attr of ["alt","aria-label","title","content"]) if (el.hasAttribute(attr)) el.setAttribute(attr,tr(el.getAttribute(attr)));
}
