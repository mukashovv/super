"use strict";
const languages = {ru:"Русский",ky:"Кыргызча",en:"English",kk:"Қазақша",es:"Español",de:"Deutsch","pt-BR":"Português (Brasil)",fr:"Français",tr:"Türkçe",id:"Bahasa Indonesia",ja:"日本語"};
function supportedLocale(tag) {
  const base = String(tag || "").toLowerCase().split("-")[0];
  return Object.keys(languages).find(key => key.split("-")[0] === base);
}
const currentUrl = new URL(location.href);
let savedLanguage;
try { savedLanguage = localStorage.getItem("supertable.language"); } catch {}
const pageLanguage = document.documentElement.lang;
const siteLocale = supportedLocale(currentUrl.searchParams.get("lang")) || (pageLanguage !== "ru" && supportedLocale(pageLanguage)) || supportedLocale(savedLanguage) || Array.from(navigator.languages || [navigator.language]).map(supportedLocale).find(Boolean) || "ru";

function languageUrl(tag) {
  const url = new URL(location.href);
  const page = tag === "ru" ? "index.html" : "index-"+tag+".html";
  url.pathname = new URL(page,url).pathname;
  url.searchParams.set("lang",tag);
  return url;
}
if (siteLocale !== pageLanguage) location.replace(languageUrl(siteLocale).href);
