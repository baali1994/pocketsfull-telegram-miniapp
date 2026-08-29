(() => {
  const statusEl = document.getElementById("status");
  const errorEl = document.getElementById("error");
  const retryEl = document.getElementById("retry");

  function setStatus(text) {
    statusEl.textContent = text;
    errorEl.hidden = true;
    retryEl.hidden = true;
  }

  function showError(message) {
    statusEl.textContent = "";
    errorEl.textContent = message;
    errorEl.hidden = false;
    retryEl.hidden = false;
  }

  async function launch() {
    try {
      const tg = window.Telegram?.WebApp;

      if (!tg) {
        throw new Error("Telegram Mini App API was not found. Open this page from @pocketsfull_bot.");
      }

      tg.ready();
      tg.expand();

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
      window.location.replace(payload.targetUrl);
    } catch (err) {
      showError(err?.message || "Something went wrong.");
    }
  }

  retryEl.addEventListener("click", launch);
  launch();
})();
