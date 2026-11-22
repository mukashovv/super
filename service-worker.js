const home = new URL(self.registration.scope);
const entry = new URL("index.html", home);
importScripts("./translations.js");
const offlineTranslations = {
  "es": {
    "Супер Таблица": "SuperTable",
    "Нет соединения": "Sin conexión",
    "Для открытия таблицы нужен интернет.": "Conéctate a internet para abrir la hoja.",
    "Попробовать снова": "Reintentar"
  },
  "de": {
    "Супер Таблица": "SuperTable",
    "Нет соединения": "Offline",
    "Для открытия таблицы нужен интернет.": "Stelle eine Internetverbindung her, um das Blatt zu öffnen.",
    "Попробовать снова": "Erneut versuchen"
  },
  "pt-BR": {
    "Супер Таблица": "SuperTable",
    "Нет соединения": "Sem conexão",
    "Для открытия таблицы нужен интернет.": "Conecte-se à internet para abrir a planilha.",
    "Попробовать снова": "Tentar novamente"
  },
  "fr": {
    "Супер Таблица": "SuperTable",
    "Нет соединения": "Hors connexion",
    "Для открытия таблицы нужен интернет.": "Connectez-vous à Internet pour ouvrir le tableau.",
    "Попробовать снова": "Réessayer"
  },
  "tr": {
    "Супер Таблица": "SuperTable",
    "Нет соединения": "Çevrimdışı",
    "Для открытия таблицы нужен интернет.": "Tabloyu açmak için internete bağlanın.",
    "Попробовать снова": "Tekrar dene"
  },
  "id": {
    "Супер Таблица": "SuperTable",
    "Нет соединения": "Luring",
    "Для открытия таблицы нужен интернет.": "Hubungkan ke internet untuk membuka lembar.",
    "Попробовать снова": "Coba lagi"
  },
  "ja": {
    "Супер Таблица": "SuperTable",
    "Нет соединения": "オフライン",
    "Для открытия таблицы нужен интернет.": "シートを開くにはインターネットに接続してください。",
    "Попробовать снова": "再試行"
  }
};
function offlinePage(url) {
  const locale = url.searchParams.get("lang") || /index-([\w-]+)\.html$/.exec(url.pathname)?.[1] || self.navigator.language;
  const tag = locale.toLowerCase().split("-")[0];
  const key = tag==="pt" ? "pt-BR" : tag;
  const dict = offlineTranslations[key] || ({kk:kazakh,ky:kyrgyz,en:english})[key];
  const t = text => dict?.[text] ?? text;
  const language = Object.keys(offlineTranslations).concat(["kk","ky","en"]).includes(key) ? key : "ru";
  return `<!doctype html><html lang="${language}"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${t("Супер Таблица")}</title>
<style>body{font:1rem/1.6 system-ui;margin:10vh auto;padding:1.5rem;max-width:30rem;color:#282b28}a{color:inherit}</style>
<h1>${t("Нет соединения")}</h1><p>${t("Для открытия таблицы нужен интернет.")}</p><a href="./">${t("Попробовать снова")}</a></html>`;
}

self.addEventListener("fetch", event => {
  if (event.request.mode !== "navigate" || event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== home.origin || (url.pathname !== home.pathname && url.pathname !== entry.pathname && !/^index-(ky|en|kk|es|de|pt-BR|fr|tr|id|ja)\.html$/.test(url.pathname.slice(home.pathname.length)))) return;
  event.respondWith(fetch(event.request).catch(() => new Response(offlinePage(url), {
    status: 503,
    headers: {"Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store"}
  })));
});
