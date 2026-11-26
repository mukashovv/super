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
let choosingCurrency=false;
function showLanguages(){
 choosingCurrency=false;languageSelect.replaceChildren();
 for(const [tag,name] of Object.entries(languages)){const option=new Option(name,tag,false,tag===siteLocale);option.lang=tag;languageSelect.add(option);}
 languageSelect.add(new Option(tr('Валюта')+'…','currency-settings'));
 languageSelect.setAttribute('aria-label','Язык / Тил');
}
function showCurrencies(){
 choosingCurrency=true;languageSelect.replaceChildren();
 languageSelect.add(new Option(tr('Назад'),'back'));
 const names=new Intl.DisplayNames([siteLocale],{type:'currency'});
 const codes=typeof Intl.supportedValuesOf==='function'?Intl.supportedValuesOf('currency'):Object.values(localeCurrencies);
 for(const code of [...new Set([currencyCode,...codes])].sort())languageSelect.add(new Option(code+' · '+(code==='KGS'&&siteLocale==='ru'?'Кыргызский сом':names.of(code)),code,false,code===currencyCode));
 languageSelect.setAttribute('aria-label',tr('Валюта'));languageSelect.focus();
 try{languageSelect.showPicker?.();}catch{}
}
showLanguages();
languageSelect.addEventListener('change',()=>{
 const value=languageSelect.value;
 if(choosingCurrency){
  if(value==='back'){showLanguages();try{languageSelect.showPicker?.();}catch{}return;}
  setDisplayCurrency(value);document.dispatchEvent(new Event('currency-changed'));showLanguages();return;
 }
 if(value==='currency-settings'){showCurrencies();return;}
 try{localStorage.setItem('supertable.language',value);}catch{}
 location.replace(languageUrl(value).href);
});
// Translate the static shell before the app renders any personal records.
for (const el of document.querySelectorAll("title,.brand span,#gate button,#install-app,#install-title,noscript")) {
  for (const node of el.childNodes) if (node.nodeType === Node.TEXT_NODE) node.textContent = tr(node.textContent);
}
for (const el of document.querySelectorAll("[alt],[aria-label],[title],meta[name=description]")) {
  for (const attr of ["alt","aria-label","title","content"]) if (el.hasAttribute(attr)) el.setAttribute(attr,tr(el.getAttribute(attr)));
}
