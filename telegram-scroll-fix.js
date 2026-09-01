(() => {
  function applyTelegramScrollFix() {
    try {
      const tg = window.Telegram?.WebApp;
      if (!tg) return;

      // Telegram Bot API 7.7+: prevent the app's own vertical scrolling
      // from being interpreted as a swipe to minimize/close the Mini App.
      if (tg.isVersionAtLeast?.("7.7") && tg.disableVerticalSwipes) {
        tg.disableVerticalSwipes();
      }

      // Keep the Main Mini App expanded while the survey wall is active.
      try { tg.expand?.(); } catch {}
    } catch (_) {}
  }

  applyTelegramScrollFix();
  window.addEventListener("focus", applyTelegramScrollFix, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) applyTelegramScrollFix();
  }, { passive: true });
})();
