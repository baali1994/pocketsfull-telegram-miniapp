(() => {
  const button = document.getElementById("onlineUsersButton");
  const countEl = document.getElementById("onlineUsersCount");
  const panel = document.getElementById("onlineUsersPanel");
  const closeButton = document.getElementById("onlineUsersClose");
  const statusEl = document.getElementById("onlineUsersStatus");
  const listEl = document.getElementById("onlineUsersList");
  const chatOnlineEl = document.getElementById("chatOnline");

  if (!button || !countEl || !panel || !closeButton || !statusEl || !listEl) return;

  function countryFlag(code) {
    const value = String(code || "").trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(value)) return "";
    return String.fromCodePoint(...[...value].map((letter) => 127397 + letter.charCodeAt(0)));
  }

  function syncCount() {
    const text = String(chatOnlineEl?.textContent || "").trim();
    countEl.textContent = text || "Online";
  }

  function renderUsers(users) {
    listEl.textContent = "";
    const safeUsers = Array.isArray(users) ? users : [];
    statusEl.textContent = `${safeUsers.length} online`;
    countEl.textContent = `${safeUsers.length} online`;

    if (!safeUsers.length) {
      const empty = document.createElement("div");
      empty.className = "online-users-status";
      empty.textContent = "No users online right now.";
      listEl.appendChild(empty);
      return;
    }

    safeUsers.forEach((user) => {
      const row = document.createElement("div");
      row.className = "online-user-row";

      const dot = document.createElement("span");
      dot.className = "online-user-dot";

      const name = document.createElement("span");
      name.className = "online-user-name";
      name.textContent = String(user?.displayName || "Telegram User");

      const flag = document.createElement("span");
      flag.className = "online-user-flag";
      flag.textContent = countryFlag(user?.countryCode);

      row.appendChild(dot);
      row.appendChild(name);
      if (flag.textContent) row.appendChild(flag);
      listEl.appendChild(row);
    });
  }

  async function openOnlineUsers() {
    const tg = window.Telegram?.WebApp;
    if (!tg?.initData) return;

    panel.hidden = false;
    statusEl.textContent = "Loading online users…";
    listEl.textContent = "";
    button.disabled = true;
    try { document.getElementById("chatInput")?.blur(); } catch {}

    try {
      const response = await fetch(window.POCKETSFULL_CONFIG.onlineUsersEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: tg.initData }),
        cache: "no-store"
      });
      let payload = null;
      try { payload = await response.json(); } catch {}
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Unable to load online users");
      renderUsers(payload.users);
    } catch (error) {
      statusEl.textContent = error?.message || "Unable to load online users";
    } finally {
      button.disabled = false;
    }
  }

  function closeOnlineUsers() {
    panel.hidden = true;
  }

  button.addEventListener("click", openOnlineUsers);
  closeButton.addEventListener("click", closeOnlineUsers);

  if (chatOnlineEl) {
    new MutationObserver(syncCount).observe(chatOnlineEl, { childList: true, characterData: true, subtree: true });
  }
  syncCount();
})();
