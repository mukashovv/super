const internationalBrand = !["ru","ky"].includes(siteLocale);
const brandImage = internationalBrand ? "./s-english-192.png" : "./brand.png";
function tr(source) {
  return siteLocale === "ky" ? kyrgyz[source] ?? source : internationalBrand ? english[source] ?? source : source;
}
document.documentElement.lang = siteLocale;
document.querySelector(".brand img").src = brandImage;
document.querySelector('link[rel="icon"]').href = brandImage;
document.querySelector('link[rel="apple-touch-icon"]').href = internationalBrand ? "./s-english-192.png" : "./icon-192.png";
if (siteLocale !== "ru") document.querySelector('link[rel="manifest"]').href = "./manifest-"+siteLocale+".webmanifest";
document.querySelector('meta[name="apple-mobile-web-app-title"]').content = tr("Супер Таблица");
const languageSelect = document.getElementById("language");
for (const [tag,name] of Object.entries(languages)) {
  const option = new Option(name,tag,false,tag===siteLocale);
  option.lang = tag;
  languageSelect.add(option);
}
languageSelect.addEventListener("change", () => {
  const tag = languageSelect.value;
  try { localStorage.setItem("supertable.language",tag); } catch {}
  location.replace(languageUrl(tag).href);
});
// Translate the static shell before the app renders any personal records.
for (const el of document.querySelectorAll("title,.brand span,#gate button,#install-app,#install-title,noscript")) {
  for (const node of el.childNodes) if (node.nodeType === Node.TEXT_NODE) node.textContent = tr(node.textContent);
}
for (const el of document.querySelectorAll("[alt],[aria-label],meta[name=description]")) {
  for (const attr of ["alt","aria-label","content"]) if (el.hasAttribute(attr)) el.setAttribute(attr,tr(el.getAttribute(attr)));
}
