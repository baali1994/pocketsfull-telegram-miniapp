(() => {
  const loadingEl = document.getElementById("loading");
  const statusEl = document.getElementById("status");
  const errorEl = document.getElementById("error");
  const retryEl = document.getElementById("retry");
  const wallShellEl = document.getElementById("wallShell");
  const wallFrameEl = document.getElementById("wallFrame");

  const chatLauncherEl = document.getElementById("chatLauncher");
  const chatUnreadEl = document.getElementById("chatUnread");
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
  const seenMessageIds = new Set();

  function setStatus(text) {
    statusEl.textContent = text;
    errorEl.hidden = true;
    retryEl.hidden = true;
  }

  function showError(message) {
    loadingEl.hidden = false;
    wallShellEl.hidden = true;
    chatLauncherEl.hidden = true;
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
    name.textContent = own ? "You" : (message.display_name || "Telegram User");
    meta.appendChild(name);

    if (!own && message.username) {
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

  async function chatRequest(endpoint, extra = {}) {
    if (!telegramApp?.initData) throw new Error("Telegram session is unavailable");

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData: telegramApp.initData, ...extra }),
      cache: "no-store"
    });

    let payload = null;
    try { payload = await response.json(); } catch {}
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.error || "Chat request failed");
    }
    return payload;
  }

  async function loadChatHistory({ silent = false } = {}) {
    if (!session) return;

    if (!silent) setChatNotice("Loading recent messages…");
    try {
      const payload = await chatRequest(window.POCKETSFULL_CONFIG.chatHistoryEndpoint);
      const messages = Array.isArray(payload.messages) ? payload.messages : [];
      messages.forEach((message) => addMessage(message));
      chatLoaded = true;
      chatEmptyEl.hidden = messages.length > 0 || seenMessageIds.size > 0;
      if (!silent) setChatNotice("Messages are visible to everyone using the PocketsFull Mini App.");
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
    chatPanelEl.hidden = false;
    chatLauncherEl.hidden = true;
    unreadCount = 0;
    updateUnread();
    try { telegramApp?.HapticFeedback?.impactOccurred?.("light"); } catch {}

    if (!chatLoaded) await loadChatHistory();
    else scrollChatToBottom(true);

    setTimeout(() => chatInputEl.focus(), 100);
  }

  function closeChat() {
    chatPanelEl.hidden = true;
    chatLauncherEl.hidden = false;
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
      const payload = await chatRequest(window.POCKETSFULL_CONFIG.chatSendEndpoint, { message });
      chatInputEl.value = "";
      if (payload.message) addMessage(payload.message, { forceScroll: true });
      setChatNotice("Messages are visible to everyone using the PocketsFull Mini App.");
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

  async function launch() {
    try {
      telegramApp = window.Telegram?.WebApp;

      if (!telegramApp) {
        throw new Error("Telegram Mini App API was not found. Open this page from @pocketsfull_bot.");
      }

      makeTelegramChromeBlack(telegramApp);
      telegramApp.ready();
      telegramApp.expand();

      try {
        if (telegramApp.isVersionAtLeast?.("8.0") && !telegramApp.isFullscreen) {
          telegramApp.requestFullscreen?.();
        }
      } catch {}

      makeTelegramChromeBlack(telegramApp);

      if (!telegramApp.initData) {
        throw new Error("No Telegram authentication data was received. Open the Mini App from @pocketsfull_bot.");
      }

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
      chatLauncherEl.hidden = false;
      loadingEl.hidden = true;

      initializeRealtime();
    } catch (err) {
      showError(err?.message || "Something went wrong.");
    }
  }

  chatLauncherEl.addEventListener("click", openChat);
  chatCloseEl.addEventListener("click", closeChat);
  chatFormEl.addEventListener("submit", sendChatMessage);
  retryEl.addEventListener("click", launch);

  launch();
})();
