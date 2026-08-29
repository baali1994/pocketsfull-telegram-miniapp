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

  function makeTelegramChromeBlack(tg) {
    try { tg.setHeaderColor?.("#000000"); } catch {}
    try { tg.setBackgroundColor?.("#000000"); } catch {}
    try { tg.setBottomBarColor?.("#000000"); } catch {}
  }

  async function launch() {
    try {
      const tg = window.Telegram?.WebApp;

      if (!tg) {
        throw new Error("Telegram Mini App API was not found. Open this page from @pocketsfull_bot.");
      }

      makeTelegramChromeBlack(tg);
      tg.ready();
      tg.expand();

      // Fullscreen lets the fixed black strip sit behind Telegram's own
      // Close / menu controls. The PocketsFull wall itself starts 90px lower.
      try {
        if (tg.isVersionAtLeast?.("8.0") && !tg.isFullscreen) {
          tg.requestFullscreen?.();
        }
      } catch {}

      makeTelegramChromeBlack(tg);

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
