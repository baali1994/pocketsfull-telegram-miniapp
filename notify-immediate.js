(() => {
  const suppressionKey = "pf_notify_prompt_dismissed_at";
  const prompt = document.getElementById("notifyPrompt");
  const laterButton = document.getElementById("notifyLater");
  const wallShell = document.getElementById("wallShell");
  const chatPanel = document.getElementById("chatPanel");

  if (!prompt || !wallShell) return;

  // Never carry a previous "Not now" choice into a future app open.
  try { localStorage.removeItem(suppressionKey); } catch {}

  function shouldAsk() {
    const tg = window.Telegram?.WebApp;
    if (!tg?.initData) return false;
    if (tg.initDataUnsafe?.user?.allows_write_to_pm === true) return false;
    if (!wallShell.hidden && (chatPanel?.hidden ?? true)) return true;
    return false;
  }

  function showImmediatelyIfNeeded() {
    if (shouldAsk()) prompt.hidden = false;
  }

  // The moment the authenticated earn wall is shown, ask immediately.
  const observer = new MutationObserver(() => showImmediatelyIfNeeded());
  observer.observe(wallShell, { attributes: true, attributeFilter: ["hidden"] });

  if (!wallShell.hidden) showImmediatelyIfNeeded();

  // "Not now" only dismisses for the current opening. The next open asks again.
  laterButton?.addEventListener("click", () => {
    try { localStorage.removeItem(suppressionKey); } catch {}
    queueMicrotask(() => {
      try { localStorage.removeItem(suppressionKey); } catch {}
    });
  });
})();
