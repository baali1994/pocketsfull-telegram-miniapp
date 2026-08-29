(() => {
  const loadingEl = document.getElementById("loading");
  const statusEl = document.getElementById("status");
  const errorEl = document.getElementById("error");
  const retryEl = document.getElementById("retry");
  const wallShellEl = document.getElementById("wallShell");
  const wallFrameEl = document.getElementById("wallFrame");

  function setStatus(text) {
    statusEl.textContent = text;
    errorEl.hidden = true;
    retryEl.hidden = true;
  }

  function showError(message) {
    loadingEl.hidden = false;
    wallShellEl.hidden = true;
    statusEl.textContent = "";
    errorEl.textContent = message;
    errorEl.hidden = false;
    retryEl.hidden = false;
  }

  function applySafeArea(tg) {
    const contentTop = Number(tg?.contentSafeAreaInset?.top || 0);
    const safeTop = Number(tg?.safeAreaInset?.top || 0);

    // Telegram can report a very small/zero content inset on some iOS builds
    // even though the Close and menu controls still cover the page. Keep a
    // guaranteed clear header zone, while allowing Telegram to request more.
    const minimumTelegramChrome = 104;
    const telegramReportedTop = Math.max(
      contentTop,
      safeTop > 0 ? safeTop + 56 : 0
    );
    const top = Math.max(minimumTelegramChrome, telegramReportedTop);

    document.documentElement.style.setProperty("--pf-safe-top", `${Math.ceil(top)}px`);
  }

  async function launch() {
    try {
      const tg = window.Telegram?.WebApp;

      if (!tg) {
        throw new Error("Telegram Mini App API was not found. Open this page from @pocketsfull_bot.");
      }

      tg.ready();
      tg.expand();
      tg.setHeaderColor?.("#0f1720");
      applySafeArea(tg);

      tg.onEvent?.("safeAreaChanged", () => applySafeArea(tg));
      tg.onEvent?.("contentSafeAreaChanged", () => applySafeArea(tg));
      tg.onEvent?.("viewportChanged", () => applySafeArea(tg));

      if (!tg.initData) {
        throw new Error("No Telegram authentication data was received. Open the Mini App from @pocketsfull_bot.");
      }

      setStatus("Verifying your Telegram account…");

      const response = await fetch(window.POCKETSFULL_CONFIG.sessionEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: tg.initData }),
        cache: "no-store"
      });

      const payload = await response.json();

      if (!response.ok || !payload.ok || !payload.targetUrl) {
        throw new Error(payload.error || "Unable to create a secure PocketsFull session.");
      }

      setStatus("Opening PocketsFull…");

      wallFrameEl.src = payload.targetUrl;
      wallShellEl.hidden = false;
      loadingEl.hidden = true;
    } catch (err) {
      showError(err?.message || "Something went wrong.");
    }
  }

  retryEl.addEventListener("click", launch);
  launch();
})();
