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

  function forceDarkTelegramChrome(tg) {
    try { tg.setHeaderColor?.("#000000"); } catch {}
    try { tg.setBackgroundColor?.("#000000"); } catch {}
    try { tg.setBottomBarColor?.("#000000"); } catch {}
    document.documentElement.style.background = "#000000";
    document.body.style.background = "#000000";
  }

  function applyContentTop(tg) {
    let top = 0;

    if (tg?.isFullscreen) {
      const contentTop = Number(tg?.contentSafeAreaInset?.top || 0);
      const safeTop = Number(tg?.safeAreaInset?.top || 0);

      // In fullscreen Telegram overlays its Close / menu controls on our page.
      // Use Telegram's own content-safe inset so the black strip ends exactly
      // where tappable app content can safely begin.
      top = contentTop > 0 ? contentTop : Math.max(68, safeTop + 44);
    }

    document.documentElement.style.setProperty("--pf-safe-top", `${Math.ceil(top)}px`);
  }

  async function launch() {
    try {
      const tg = window.Telegram?.WebApp;

      if (!tg) {
        throw new Error("Telegram Mini App API was not found. Open this page from @pocketsfull_bot.");
      }

      forceDarkTelegramChrome(tg);
      tg.ready();
      tg.expand();
      forceDarkTelegramChrome(tg);

      // Fullscreen lets our black background occupy the Telegram header zone.
      // Telegram then tells us the exact content-safe inset for its controls.
      try {
        if (tg.isVersionAtLeast?.("8.0") && !tg.isFullscreen) {
          tg.requestFullscreen?.();
        }
      } catch {}

      const refreshLayout = () => {
        forceDarkTelegramChrome(tg);
        applyContentTop(tg);
      };

      tg.onEvent?.("fullscreenChanged", refreshLayout);
      tg.onEvent?.("fullscreenFailed", refreshLayout);
      tg.onEvent?.("safeAreaChanged", refreshLayout);
      tg.onEvent?.("contentSafeAreaChanged", refreshLayout);
      tg.onEvent?.("themeChanged", refreshLayout);
      tg.onEvent?.("viewportChanged", refreshLayout);

      refreshLayout();
      setTimeout(refreshLayout, 250);
      setTimeout(refreshLayout, 700);

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
