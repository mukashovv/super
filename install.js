(() => {
  if (!window.isSecureContext || !/^https?:$/.test(location.protocol)) return;

  const button = document.getElementById("install-app");
  const help = document.getElementById("install-help");
  const steps = document.getElementById("install-steps");
  const standalone = window.matchMedia("(display-mode: standalone)");
  let installed = false;
  let pendingPrompt = null;

  function updateButton() {
    button.hidden = installed || standalone.matches || navigator.standalone === true;
  }

  function instructions() {
    const ua = navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) {
      const icon = '<svg aria-hidden="true" width="16" height="16" style="vertical-align:-2px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 15V2m-4 4 4-4 4 4M7 9H4v12h16V9h-3"/></svg>';
      const instruction = tr("Нажмите {share}, выберите «На экран Домой» и нажмите «Добавить».");
      return instruction.replace("{share}", '<span style="white-space:nowrap">'+icon+' «'+tr("Поделиться")+'»</span>');
    }
    if (/Android/.test(ua)) {
      return tr("Откройте меню браузера и выберите «Установить приложение» или «Добавить на главный экран». Затем подтвердите установку.");
    }
    if (/Edg\//.test(ua)) {
      return tr("В Microsoft Edge откройте меню «…», найдите раздел «Приложения» и выберите установку этого сайта как приложения.");
    }
    if (/Chrome\//.test(ua)) {
      return tr("В Chrome откройте меню ⋮, выберите «Трансляция, сохранение и отправка», затем «Установить страницу как приложение».");
    }
    if (/Macintosh/.test(ua) && /Safari\//.test(ua) && !/Firefox\//.test(ua)) {
      return tr("В Safari откройте меню «Файл», выберите «Добавить в Dock» и нажмите «Добавить». Эта команда доступна начиная с macOS Sonoma.");
    }
    return tr("Для установки откройте эту страницу в Chrome или Microsoft Edge и нажмите «Установить».");
  }

  function showHelp() {
    steps.innerHTML = instructions();
    if (!help.open) help.showModal();
  }

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    pendingPrompt = event;
    updateButton();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    pendingPrompt = null;
    if (help.open) help.close();
    updateButton();
  });
  standalone.addEventListener("change", updateButton);
  button.addEventListener("click", async () => {
    if (!pendingPrompt) {
      showHelp();
      return;
    }
    const prompt = pendingPrompt;
    pendingPrompt = null;
    button.disabled = true;
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") installed = true;
    } catch {
      if (!installed) showHelp();
    } finally {
      button.disabled = false;
      updateButton();
    }
  });
  updateButton();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(error => {
      console.warn(tr("Регистрация приложения не удалась"), error);
    });
  }
})();
