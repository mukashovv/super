const legalCopy = {
  "ru": {
    "names": [
      "Политика конфиденциальности",
      "Условия использования",
      "Отказ от финансовых рекомендаций",
      "Управление и удаление данных"
    ],
    "heading": "Конфиденциальность и ответственность",
    "paragraphs": [
      "SuperTable — инструмент для самостоятельного учёта личных финансов и улучшения финансового благополучия.",
      "Мы принимаем разумные технические и организационные меры для защиты пользовательских данных, однако ни один онлайн-сервис не может гарантировать абсолютную безопасность.",
      "Пользователь самостоятельно отвечает за принимаемые финансовые решения. SuperTable не предоставляет индивидуальных инвестиционных, банковских или иных профессиональных финансовых консультаций.",
      "Обработка персональных данных осуществляется в соответствии с нашей Политикой конфиденциальности.",
      "Продолжая регистрацию, вы принимаете Условия использования и подтверждаете ознакомление с Политикой конфиденциальности."
    ],
    "accept": "Принимаю {terms} и подтверждаю ознакомление с {privacy}.",
    "terms": "Условия использования",
    "privacy": "Политикой конфиденциальности"
  },
  "en": {
    "names": [
      "Privacy Policy",
      "Terms of Use",
      "Financial Disclaimer",
      "Manage and Delete Data"
    ],
    "heading": "Privacy and responsibility",
    "paragraphs": [
      "SuperTable helps you track your own finances and improve your financial well-being.",
      "We take reasonable technical and organisational measures to protect your data. No online service can guarantee absolute security.",
      "You are responsible for your financial decisions. SuperTable does not provide individual investment, banking or other professional financial advice.",
      "Our Privacy Policy explains how we process personal data.",
      "By registering, you accept the Terms of Use and acknowledge that you have read the Privacy Policy."
    ],
    "accept": "I accept the {terms} and have read the {privacy}.",
    "terms": "Terms of Use",
    "privacy": "Privacy Policy"
  },
  "ky": {
    "names": [
      "Купуялык саясаты",
      "Колдонуу шарттары",
      "Каржылык кеңештер жөнүндө эскертүү",
      "Маалыматтарды башкаруу жана өчүрүү"
    ],
    "heading": "Купуялык жана жоопкерчилик",
    "paragraphs": [
      "SuperTable жеке каржыны өз алдынча эсепке алууга жана каржылык абалды жакшыртууга жардам берет.",
      "Маалыматыңызды коргоо үчүн техникалык жана уюштуруу чараларын көрөбүз. Интернетте толук коопсуздукка кепилдик берүү мүмкүн эмес.",
      "Каржылык чечимдериңиз үчүн өзүңүз жооп бересиз. SuperTable жеке инвестициялык, банктык же башка кесиптик каржылык кеңеш бербейт.",
      "Жеке маалыматтар Купуялык саясатына ылайык иштетилет.",
      "Катталуу менен Колдонуу шарттарын кабыл алып, Купуялык саясаты менен таанышканыңызды ырастайсыз."
    ],
    "accept": "{terms} кабыл алам жана {privacy} менен тааныштым.",
    "terms": "Колдонуу шарттарын",
    "privacy": "Купуялык саясаты"
  },
  "kk": {
    "names": [
      "Құпиялық саясаты",
      "Пайдалану шарттары",
      "Қаржылық кеңеске қатысты ескерту",
      "Деректерді басқару және жою"
    ],
    "heading": "Құпиялық және жауапкершілік",
    "paragraphs": [
      "SuperTable жеке қаржыңызды өз бетіңізше есепке алуға және қаржылық әл-ауқатыңызды жақсартуға көмектеседі.",
      "Деректеріңізді қорғау үшін техникалық және ұйымдастырушылық шаралар қабылдаймыз. Интернетте толық қауіпсіздікке кепілдік беру мүмкін емес.",
      "Қаржылық шешімдеріңізге өзіңіз жауап бересіз. SuperTable жеке инвестициялық, банктік немесе өзге кәсіби қаржылық кеңес бермейді.",
      "Жеке деректер Құпиялық саясатына сәйкес өңделеді.",
      "Тіркелу арқылы Пайдалану шарттарын қабылдап, Құпиялық саясатымен танысқаныңызды растайсыз."
    ],
    "accept": "{terms} қабылдаймын және {privacy} таныстым.",
    "terms": "Пайдалану шарттарын",
    "privacy": "Құпиялық саясатымен"
  }
};
const legalLocale = Object.prototype.hasOwnProperty.call(legalCopy,siteLocale) ? siteLocale : "en";
const legalText = legalCopy[legalLocale];
const legalRoutes = ["privacy","terms","disclaimer","data-management"];
function documentLink(route,label) {
  const page=legalLocale==="ru" ? (location.protocol==="file:" ? "index.html" : "") : legalLocale+".html";
  return '<a target="_blank" rel="noopener" href="./'+route+'/'+page+'">'+label+'</a>';
}
function legalLinks() {
  return '<nav class="legal-links">'+legalRoutes.map((route,i)=>documentLink(route,legalText.names[i])).join("")+'</nav>';
}
function registrationNotice() {
  const notice=legalText.paragraphs.map(p=>'<p>'+p+'</p>').join("");
  const accept=legalText.accept.replace("{terms}",documentLink("terms",legalText.terms)).replace("{privacy}",documentLink("privacy",legalText.privacy));
  return '<details class="legal-notice"><summary>'+legalText.heading+'</summary>'+notice+'</details>'+
    '<div class="legal-consent"><input id="legal-accept" name="legalAccept" type="checkbox" required><label for="legal-accept">'+accept+'</label></div>';
}
