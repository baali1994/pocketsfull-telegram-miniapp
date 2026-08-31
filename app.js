(() => {
  const loadingEl = document.getElementById("loading");
  const statusEl = document.getElementById("status");
  const errorEl = document.getElementById("error");
  const retryEl = document.getElementById("retry");
  const wallShellEl = document.getElementById("wallShell");
  const wallFrameEl = document.getElementById("wallFrame");

  const topActionsEl = document.getElementById("topActions");
  const checkinButtonEl = document.getElementById("checkinButton");
  const checkinLabelEl = document.getElementById("checkinLabel");
  const chatLauncherEl = document.getElementById("chatLauncher");
  const chatOnlineEl = document.getElementById("chatOnline");
  const chatUnreadEl = document.getElementById("chatUnread");

  const notifyPromptEl = document.getElementById("notifyPrompt");
  const notifyEnableEl = document.getElementById("notifyEnable");
  const notifyLaterEl = document.getElementById("notifyLater");

  const chatPanelEl = document.getElementById("chatPanel");
  const chatCloseEl = document.getElementById("chatClose");
  const chatNoticeEl = document.getElementById("chatNotice");
  const chatMessagesEl = document.getElementById("chatMessages");
  const chatEmptyEl = document.getElementById("chatEmpty");
  const chatFormEl = document.getElementById("chatForm");
  const chatInputEl = document.getElementById("chatInput");
  const chatSendEl = document.getElementById("chatSend");

  let telegramApp = null;
  let session = null;
  let chatLoaded = false;
  let unreadCount = 0;
  let realtimeClient = null;
  let realtimeChannel = null;
  let fallbackTimer = null;
  let communityTimer = null;
  let latestCommunityState = null;
  const seenMessageIds = new Set();

  function setStatus(text) {
    statusEl.textContent = text;
    errorEl.hidden = true;
    retryEl.hidden = true;
  }

  function showError(message) {
    loadingEl.hidden = false;
    wallShellEl.hidden = true;
    topActionsEl.hidden = true;
    notifyPromptEl.hidden = true;
    chatPanelEl.hidden = true;
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

  function setChatNotice(text, isError = false) {
    chatNoticeEl.textContent = text;
    chatNoticeEl.style.color = isError ? "#ff9c9c" : "#96a5b3";
  }

  function formatTime(value) {
    try {
      return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  }

  function countryFlag(code) {
    const value = String(code || "").trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(value)) return "";
    return String.fromCodePoint(...[...value].map((letter) => 127397 + letter.charCodeAt(0)));
  }

  function updateUnread() {
    if (unreadCount <= 0) {
      chatUnreadEl.hidden = true;
      chatUnreadEl.textContent = "0";
      return;
    }
    chatUnreadEl.hidden = false;
    chatUnreadEl.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
  }

  function updateEngagementUi(state) {
    if (!state) return;
    latestCommunityState = state;

    const online = Math.max(1, Number(state.onlineCount || 1));
    chatOnlineEl.hidden = false;
    chatOnlineEl.textContent = `${online} online`;

    const streak = Math.max(0, Number(state.streak || 0));
    if (state.checkedInToday) {
      checkinButtonEl.classList.add("checked");
      checkinLabelEl.textContent = streak > 0 ? `🔥 ${streak} day${streak === 1 ? "" : "s"}` : "✓ Checked in";
    } else {
      checkinButtonEl.classList.remove("checked");
      checkinLabelEl.textContent = streak > 0 ? `🔥 Check in · ${streak}` : "🔥 Check in";
    }
  }

  function scrollChatToBottom(force = false) {
    const distance = chatMessagesEl.scrollHeight - chatMessagesEl.scrollTop - chatMessagesEl.clientHeight;
    if (force || distance < 160) {
      requestAnimationFrame(() => {
        chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
      });
    }
  }

  function addMessage(message, { forceScroll = false } = {}) {
    if (!message?.id || seenMessageIds.has(message.id)) return;
    seenMessageIds.add(message.id);
    chatEmptyEl.hidden = true;

    const own = Boolean(session?.uid && message.user_key === session.uid);
    const wrapper = document.createElement("div");
    wrapper.className = `chat-message${own ? " own" : ""}`;
    wrapper.dataset.messageId = message.id;

    const meta = document.createElement("div");
    meta.className = "chat-meta";

    const name = document.createElement("span");
    name.className = "chat-name";
    name.textContent = message.display_name || "Telegram User";
    meta.appendChild(name);

    if (message.username) {
      const username = document.createElement("span");
      username.className = "chat-username";
      username.textContent = ` · @${message.username}`;
      meta.appendChild(username);
    }

    const flag = countryFlag(message.country_code);
    if (flag) {
      const country = document.createElement("span");
      country.className = "chat-country";
      country.textContent = ` · ${flag}`;
      country.title = String(message.country_code).toUpperCase();
      meta.appendChild(country);
    }

    const time = document.createElement("span");
    time.textContent = ` · ${formatTime(message.created_at)}`;
    meta.appendChild(time);

    const bubble = document.createElement("div");
    bubble.className = "chat-bubble";
    bubble.textContent = message.message || "";

    wrapper.appendChild(meta);
    wrapper.appendChild(bubble);
    chatMessagesEl.appendChild(wrapper);

    if (chatPanelEl.hidden && !own) {
      unreadCount += 1;
      updateUnread();
    }

    scrollChatToBottom(forceScroll || own);
  }

  async function apiRequest(endpoint, extra = {}) {
    if (!telegramApp?.initData) throw new Error("Telegram session is unavailable");
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData: telegramApp.initData, ...extra }),
      cache: "no-store"
    });

    let payload = null;
    try { payload = await response.json(); } catch {}
    if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Request failed");
    return payload;
  }

  async function refreshCommunityState({ silent = true } = {}) {
    if (!session) return;
    try {
      const state = await apiRequest(window.POCKETSFULL_CONFIG.communityStateEndpoint, {
        timezoneOffsetMinutes: new Date().getTimezoneOffset()
      });
      updateEngagementUi(state);
      if (state.writeAccess) notifyPromptEl.hidden = true;
    } catch (error) {
      if (!silent) {
        try { telegramApp?.showAlert?.(error?.message || "Unable to refresh community status"); } catch {}
      }
    }
  }

  async function loadChatHistory({ silent = false } = {}) {
    if (!session) return;
    if (!silent) setChatNotice("Loading recent messages…");

    try {
      const payload = await apiRequest(window.POCKETSFULL_CONFIG.chatHistoryEndpoint);
      const messages = Array.isArray(payload.messages) ? payload.messages : [];
      messages.forEach((message) => addMessage(message));
      chatLoaded = true;
      chatEmptyEl.hidden = messages.length > 0 || seenMessageIds.size > 0;
      if (!silent) {
        const online = Math.max(1, Number(latestCommunityState?.onlineCount || 1));
        setChatNotice(`${online} online · Messages are visible to everyone.`);
      }
      scrollChatToBottom(true);
    } catch (error) {
      if (!silent) setChatNotice(error?.message || "Unable to load chat", true);
    }
  }

  function startFallbackRefresh() {
    if (fallbackTimer) return;
    fallbackTimer = setInterval(() => {
      if (session) loadChatHistory({ silent: true });
    }, 5000);
  }

  function initializeRealtime() {
    try {
      if (!window.supabase?.createClient) {
        startFallbackRefresh();
        return;
      }

      realtimeClient = window.supabase.createClient(
        window.POCKETSFULL_CONFIG.supabaseUrl,
        window.POCKETSFULL_CONFIG.supabasePublishableKey,
        {
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
          realtime: { params: { eventsPerSecond: 10 } }
        }
      );

      realtimeChannel = realtimeClient
        .channel("pocketsfull-global-chat")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "chat_messages" },
          (payload) => addMessage(payload.new, { forceScroll: !chatPanelEl.hidden })
        )
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") startFallbackRefresh();
        });
    } catch {
      startFallbackRefresh();
    }
  }

  async function openChat() {
    if (!session) return;
    notifyPromptEl.hidden = true;
    chatPanelEl.hidden = false;
    topActionsEl.hidden = true;
    unreadCount = 0;
    updateUnread();
    try { telegramApp?.HapticFeedback?.impactOccurred?.("light"); } catch {}

    await refreshCommunityState();
    if (!chatLoaded) await loadChatHistory();
    else {
      const online = Math.max(1, Number(latestCommunityState?.onlineCount || 1));
      setChatNotice(`${online} online · Messages are visible to everyone.`);
      scrollChatToBottom(true);
    }
    setTimeout(() => chatInputEl.focus(), 100);
  }

  function closeChat() {
    chatPanelEl.hidden = true;
    topActionsEl.hidden = false;
    chatInputEl.blur();
  }

  async function sendChatMessage(event) {
    event.preventDefault();
    const message = chatInputEl.value.trim();
    if (!message) return;

    chatInputEl.disabled = true;
    chatSendEl.disabled = true;
    setChatNotice("Sending…");

    try {
      const payload = await apiRequest(window.POCKETSFULL_CONFIG.chatSendEndpoint, { message });
      chatInputEl.value = "";
      if (payload.message) addMessage(payload.message, { forceScroll: true });
      const online = Math.max(1, Number(latestCommunityState?.onlineCount || 1));
      setChatNotice(`${online} online · Messages are visible to everyone.`);
      try { telegramApp?.HapticFeedback?.notificationOccurred?.("success"); } catch {}
    } catch (error) {
      setChatNotice(error?.message || "Unable to send message", true);
      try { telegramApp?.HapticFeedback?.notificationOccurred?.("error"); } catch {}
    } finally {
      chatInputEl.disabled = false;
      chatSendEl.disabled = false;
      chatInputEl.focus();
    }
  }

  async function performCheckin() {
    if (!session || checkinButtonEl.disabled) return;
    checkinButtonEl.disabled = true;
    const previous = checkinLabelEl.textContent;
    checkinLabelEl.textContent = "Checking in…";

    try {
      const payload = await apiRequest(window.POCKETSFULL_CONFIG.dailyCheckinEndpoint, {
        timezoneOffsetMinutes: new Date().getTimezoneOffset()
      });
      updateEngagementUi({
        ...(latestCommunityState || {}),
        checkedInToday: true,
        streak: payload.streak
      });
      try { telegramApp?.HapticFeedback?.notificationOccurred?.("success"); } catch {}
      if (payload.newCheckin) {
        try { telegramApp?.showPopup?.({ title: "Checked in", message: `Your streak is now ${payload.streak} day${payload.streak === 1 ? "" : "s"}.`, buttons: [{ type: "ok" }] }); } catch {}
      }
    } catch (error) {
      checkinLabelEl.textContent = previous;
      try { telegramApp?.showAlert?.(error?.message || "Unable to check in"); } catch {}
    } finally {
      checkinButtonEl.disabled = false;
    }
  }

  function notificationPromptDismissedRecently() {
    try {
      const value = Number(localStorage.getItem("pf_notify_prompt_dismissed_at") || 0);
      return value > 0 && Date.now() - value < 7 * 24 * 60 * 60 * 1000;
    } catch {
      return false;
    }
  }

  function dismissNotificationPrompt() {
    notifyPromptEl.hidden = true;
    try { localStorage.setItem("pf_notify_prompt_dismissed_at", String(Date.now())); } catch {}
  }

  function maybeShowNotificationPrompt() {
    if (!session || session.writeAccess) return;
    if (telegramApp?.initDataUnsafe?.user?.allows_write_to_pm) return;
    if (notificationPromptDismissedRecently()) return;
    setTimeout(() => {
      if (session && chatPanelEl.hidden && !latestCommunityState?.writeAccess) notifyPromptEl.hidden = false;
    }, 1800);
  }

  async function enableNotifications() {
    if (!telegramApp || notifyEnableEl.disabled) return;
    notifyEnableEl.disabled = true;
    notifyLaterEl.disabled = true;

    try {
      if (!telegramApp.isVersionAtLeast?.("6.9") || !telegramApp.requestWriteAccess) {
        throw new Error("Please update Telegram to enable bot alerts.");
      }

      telegramApp.requestWriteAccess(async (allowed) => {
        try {
          const payload = await apiRequest(window.POCKETSFULL_CONFIG.writeAccessEndpoint, { allowed: Boolean(allowed) });
          if (payload.writeAccess) {
            session.writeAccess = true;
            notifyPromptEl.hidden = true;
            try { localStorage.removeItem("pf_notify_prompt_dismissed_at"); } catch {}
            try { telegramApp?.HapticFeedback?.notificationOccurred?.("success"); } catch {}
          } else {
            dismissNotificationPrompt();
          }
        } catch {
          if (!allowed) dismissNotificationPrompt();
        } finally {
          notifyEnableEl.disabled = false;
          notifyLaterEl.disabled = false;
        }
      });
    } catch (error) {
      notifyEnableEl.disabled = false;
      notifyLaterEl.disabled = false;
      try { telegramApp?.showAlert?.(error?.message || "Unable to enable alerts"); } catch {}
    }
  }

  async function launch() {
    try {
      telegramApp = window.Telegram?.WebApp;
      if (!telegramApp) throw new Error("Telegram Mini App API was not found. Open this page from @pocketsfull_bot.");

      makeTelegramChromeBlack(telegramApp);
      telegramApp.ready();
      telegramApp.expand();

      try {
        if (telegramApp.isVersionAtLeast?.("8.0") && !telegramApp.isFullscreen) telegramApp.requestFullscreen?.();
      } catch {}

      makeTelegramChromeBlack(telegramApp);
      if (!telegramApp.initData) throw new Error("No Telegram authentication data was received. Open the Mini App from @pocketsfull_bot.");

      setStatus("Verifying your Telegram account…");
      const response = await fetch(window.POCKETSFULL_CONFIG.sessionEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: telegramApp.initData }),
        cache: "no-store"
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok || !payload.targetUrl) {
        throw new Error(payload.error || "Unable to create a secure PocketsFull session.");
      }

      session = payload;
      setStatus("Opening PocketsFull…");
      wallFrameEl.src = payload.targetUrl;
      wallShellEl.hidden = false;
      topActionsEl.hidden = false;
      loadingEl.hidden = true;

      initializeRealtime();
      await refreshCommunityState();
      maybeShowNotificationPrompt();

      if (communityTimer) clearInterval(communityTimer);
      communityTimer = setInterval(() => refreshCommunityState(), 45_000);
    } catch (err) {
      showError(err?.message || "Something went wrong.");
    }
  }

  checkinButtonEl.addEventListener("click", performCheckin);
  chatLauncherEl.addEventListener("click", openChat);
  chatCloseEl.addEventListener("click", closeChat);
  chatFormEl.addEventListener("submit", sendChatMessage);
  notifyEnableEl.addEventListener("click", enableNotifications);
  notifyLaterEl.addEventListener("click", dismissNotificationPrompt);
  retryEl.addEventListener("click", launch);

  launch();
})();
