(() => {
  const endpoint = "https://lfnjernrgkdtfetyoghq.supabase.co/functions/v1/pocketsfull-attribution";
  let started = false;

  async function postAttribution(initData) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData }),
      cache: "no-store"
    });

    let payload = null;
    try { payload = await response.json(); } catch {}
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.error || "Unable to save campaign attribution");
    }
    return payload;
  }

  function getSurveyUrl() {
    const frame = document.getElementById("wallFrame");
    const src = String(frame?.src || "").trim();
    if (!src || src === "about:blank") return null;
    try {
      const url = new URL(src, window.location.href);
      if (url.protocol !== "https:") return null;
      return url.toString();
    } catch {
      return null;
    }
  }

  async function navigateToSurveyWall() {
    if (started) return;

    const tg = window.Telegram?.WebApp;
    if (!tg?.initData) return;

    const targetUrl = getSurveyUrl();
    if (!targetUrl) return;
    started = true;

    // Attribution must be attempted before leaving the Telegram bootstrap page.
    // Retry once for transient network failures, but never strand paid traffic.
    let attributed = false;
    for (let attempt = 0; attempt < 2 && !attributed; attempt += 1) {
      try {
        await postAttribution(tg.initData);
        attributed = true;
      } catch {
        if (attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
      }
    }

    // Keep the navigation in the same Telegram WebView. This is intentionally
    // NOT Telegram.WebApp.openLink(), which could leave Telegram.
    window.location.replace(targetUrl);
  }

  const loading = document.getElementById("loading");
  if (!loading) {
    setTimeout(navigateToSurveyWall, 0);
    return;
  }

  if (loading.hidden) {
    setTimeout(navigateToSurveyWall, 0);
    return;
  }

  const observer = new MutationObserver(() => {
    if (loading.hidden) {
      observer.disconnect();
      navigateToSurveyWall();
    }
  });
  observer.observe(loading, { attributes: true, attributeFilter: ["hidden"] });
})();
