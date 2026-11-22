const home = new URL(self.registration.scope);
const entry = new URL("index.html", home);
importScripts("./translations.js");
function offlinePage(url) {
  const locale = url.searchParams.get("lang") || self.navigator.language;
  const ky = /^ky(?:-|$)/i.test(locale);
  const international = /^(en|es|de|pt|fr|tr|id|ja)(-|$)/i.test(locale);
  const t = key => ky ? kyrgyz[key] : international ? english[key] : key;
  return `<!doctype html><html lang="${ky ? "ky" : international ? "en" : "ru"}"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${t("Супер Таблица")}</title>
<style>body{font:1rem/1.6 system-ui;margin:10vh auto;padding:1.5rem;max-width:30rem;color:#282b28}a{color:inherit}</style>
<h1>${t("Нет соединения")}</h1><p>${t("Для открытия таблицы нужен интернет.")}</p><a href="./">${t("Попробовать снова")}</a></html>`;
}

self.addEventListener("fetch", event => {
  if (event.request.mode !== "navigate" || event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== home.origin || (url.pathname !== home.pathname && url.pathname !== entry.pathname)) return;
  event.respondWith(fetch(event.request).catch(() => new Response(offlinePage(url), {
    status: 503,
    headers: {"Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store"}
  })));
});
