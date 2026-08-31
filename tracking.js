(() => {
  const endpoint = "https://lfnjernrgkdtfetyoghq.supabase.co/functions/v1/pocketsfull-attribution";
  let sent = false;

  async function sendAttribution() {
    if (sent) return;
    const tg = window.Telegram?.WebApp;
    if (!tg?.initData) return;
    sent = true;
    try {
      await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: tg.initData }),
        cache: "no-store",
        keepalive: true
      });
    } catch {}
  }

  const loading = document.getElementById("loading");
  if (!loading) {
    sendAttribution();
    return;
  }

  if (loading.hidden) {
    sendAttribution();
    return;
  }

  const observer = new MutationObserver(() => {
    if (loading.hidden) {
      observer.disconnect();
      sendAttribution();
    }
  });
  observer.observe(loading, { attributes: true, attributeFilter: ["hidden"] });
})();
