"use strict";
const languages = {ru:"Русский",ky:"Кыргызча",en:"English",es:"Español",de:"Deutsch","pt-BR":"Português (Brasil)",fr:"Français",tr:"Türkçe",id:"Bahasa Indonesia",ja:"日本語"};
function supportedLocale(tag) {
  const base = String(tag || "").toLowerCase().split("-")[0];
  return Object.keys(languages).find(key => key.split("-")[0] === base);
}
const currentUrl = new URL(location.href);
let savedLanguage;
try { savedLanguage = localStorage.getItem("supertable.language"); } catch {}
const siteLocale = supportedLocale(currentUrl.searchParams.get("lang")) || supportedLocale(savedLanguage) || Array.from(navigator.languages || [navigator.language]).map(supportedLocale).find(Boolean) || "ru";
function tr(source) {
  return siteLocale === "ky" ? kyrgyz[source] ?? source : source;
}
document.documentElement.lang = siteLocale;
const languageSelect = document.getElementById("language");
for (const [tag,name] of Object.entries(languages)) {
  const option = new Option(name,tag,false,tag===siteLocale);
  option.lang = tag;
  languageSelect.add(option);
}
languageSelect.addEventListener("change", () => {
  const tag = languageSelect.value;
  try { localStorage.setItem("supertable.language",tag); } catch {}
  const url = new URL(location.href);
  url.searchParams.set("lang",tag);
  location.replace(url.href);
});
// Translate the static shell before the app renders any personal records.
for (const el of document.querySelectorAll("title,.brand span,#gate button,#install-app,#install-title,noscript")) {
  for (const node of el.childNodes) if (node.nodeType === Node.TEXT_NODE) node.textContent = tr(node.textContent);
}
for (const el of document.querySelectorAll("[alt],[aria-label],meta[name=description]")) {
  for (const attr of ["alt","aria-label","content"]) if (el.hasAttribute(attr)) el.setAttribute(attr,tr(el.getAttribute(attr)));
}
