(() => {
  const configuredApiBase = String(window.SNAP_API_BASE || "").trim();
  const baseHostname = window.location.hostname.replace(/^www\./i, "");
  const isLocalHost =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
  const API_BASE =
    configuredApiBase ||
    (isLocalHost
      ? window.location.origin
      : `${window.location.protocol}//api.${baseHostname}`);

  const state = {
    user: null,
    listeners: []
  };

  function toApiUrl(path) {
    const cleanBase = API_BASE.replace(/\/+$/, "");
    if (/^https?:\/\//i.test(path)) return path;
    if (path.startsWith("/")) return `${cleanBase}${path}`;
    return `${cleanBase}/${path}`;
  }

  function apiFetch(path, options = {}) {
    return fetch(toApiUrl(path), {
      credentials: "include",
      ...options
    });
  }

  const params = new URLSearchParams(window.location.search);
  const incomingInvite = params.get("invite");
  if (incomingInvite) {
    localStorage.setItem("snap_invite_code", incomingInvite);
  }

  // Also catch /invite/:code redirects that land as path without query (handled server-side, but just in case)
  const pathParts = window.location.pathname.split("/").filter(Boolean);
  if (!incomingInvite && pathParts[0] === "invite" && pathParts[1]) {
    localStorage.setItem("snap_invite_code", pathParts[1]);
  }

  function storedInviteCode() {
    return localStorage.getItem("snap_invite_code") || "";
  }

  function onUser(cb) {
    state.listeners.push(cb);
    if (state.user) cb(state.user);
  }

  function setUser(user) {
    state.user = user;
    state.listeners.forEach(cb => cb(user));
  }

  function injectStyles() {
    if (document.getElementById("auth-styles")) return;
    const style = document.createElement("style");
    style.id = "auth-styles";
    style.textContent = `
      .auth-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 999;
      }
      .auth-card {
        width: min(420px, 90vw);
        background: #020617;
        border: 1px solid #111827;
        box-shadow: 0 0 40px rgba(15, 23, 42, 0.9);
        border-radius: 18px;
        padding: 22px 20px 18px;
        color: #f9fafb;
      }
      .auth-brand {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 12px;
      }
      .auth-brand img {
        width: 36px;
        height: 36px;
        border-radius: 8px;
        border: 1px solid #f9fafb;
        box-shadow: 0 0 12px rgba(249, 250, 251, 0.7);
        object-fit: cover;
      }
      .auth-brand-text {
        display: flex;
        flex-direction: column;
        line-height: 1.1;
      }
      .auth-brand-main {
        font-weight: 800;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        font-size: 14px;
      }
      .auth-brand-sub {
        font-size: 10px;
        color: #9ca3af;
        text-transform: uppercase;
        letter-spacing: 0.22em;
      }
      .auth-tabs {
        display: flex;
        gap: 8px;
        margin-bottom: 14px;
      }
      .auth-tab {
        flex: 1;
        padding: 10px;
        border-radius: 12px;
        border: 1px solid #111827;
        background: #000;
        color: #e5e7eb;
        cursor: pointer;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font-size: 12px;
        transition: 0.15s ease;
      }
      .auth-tab.active {
        border-color: #f9fafb;
        color: #000;
        background: #f9fafb;
      }
      .auth-form .form-group {
        margin-bottom: 12px;
      }
      .auth-form label {
        display: block;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.18em;
        color: #6b7280;
        margin-bottom: 4px;
      }
      .auth-form .inline {
        display: flex;
        gap: 10px;
      }
      .auth-form input {
        width: 100%;
        padding: 10px 12px;
        border-radius: 10px;
        border: 1px solid #1f2937;
        background: #020617;
        color: #f9fafb;
        outline: none;
        transition: border 0.15s ease, box-shadow 0.15s ease;
      }
      .auth-form input:focus {
        border-color: #f9fafb;
        box-shadow: 0 0 0 1px #f9fafb;
      }
      .auth-button {
        width: 100%;
        margin-top: 4px;
        padding: 10px 12px;
        border-radius: 12px;
        border: 1px solid #f9fafb;
        background: #000;
        color: #f9fafb;
        text-transform: uppercase;
        letter-spacing: 0.18em;
        cursor: pointer;
        font-size: 12px;
        transition: 0.15s ease;
      }
      .auth-button:hover {
        background: #f9fafb;
        color: #000;
        box-shadow: 0 0 22px rgba(249, 250, 251, 0.9);
      }
      .auth-hint {
        font-size: 11px;
        color: #9ca3af;
        margin-top: 8px;
        text-align: center;
        letter-spacing: 0.08em;
      }
      .auth-error {
        margin-top: 8px;
        font-size: 12px;
        color: #fca5a5;
        text-align: center;
        display: none;
      }
      .captcha-wrap {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .captcha-box {
        position: relative;
        border-radius: 10px;
        overflow: hidden;
        border: 1px solid #111827;
        background: linear-gradient(135deg, #0b1224, #020617);
        box-shadow: 0 0 18px rgba(15, 23, 42, 0.6);
      }
      .captcha-canvas {
        width: 140px;
        height: 50px;
        display: block;
      }
    `;
    document.head.appendChild(style);
  }

  function buildOverlay() {
    if (document.getElementById("auth-overlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "auth-overlay";
    overlay.className = "auth-overlay";
    overlay.innerHTML = `
      <div class="auth-card">
        <div class="auth-brand">
          <img src="logo.jpg" alt="logo">
          <div class="auth-brand-text">
            <span class="auth-brand-main">SNAPGHOST</span>
            <span class="auth-brand-sub">ACCESS SUITE</span>
          </div>
        </div>
        <div class="auth-tabs">
          <button class="auth-tab active" data-mode="login">Login</button>
          <button class="auth-tab" data-mode="register">Register</button>
        </div>
        <div class="auth-form" id="authForm">
          <div class="form-group">
            <label for="authUsername">Username</label>
            <input id="authUsername" type="text" placeholder="@user" autocomplete="username">
          </div>
          <div class="form-group">
            <label for="authPassword">Password</label>
            <input id="authPassword" type="password" placeholder="••••" autocomplete="current-password">
          </div>
          <div class="form-group" id="confirmRow" style="display:none;">
            <label for="authPassword2">Confirm Password</label>
            <input id="authPassword2" type="password" placeholder="••••" autocomplete="new-password">
          </div>
          <div class="form-group">
            <label>Captcha</label>
            <div class="captcha-wrap">
              <div class="captcha-box">
                <canvas id="captchaCanvas" class="captcha-canvas" width="140" height="50"></canvas>
              </div>
            </div>
          </div>
          <div class="form-group">
            <label for="captchaInput">Enter Captcha</label>
            <input id="captchaInput" type="text" placeholder="Type the code" autocomplete="off">
          </div>
          <button id="authSubmit" class="auth-button">Continue</button>
          <div class="auth-error" id="authError"></div>
          <div class="auth-hint">Authentication required before entering.</div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const tabs = overlay.querySelectorAll(".auth-tab");
    const usernameInput = overlay.querySelector("#authUsername");
    const passwordInput = overlay.querySelector("#authPassword");
    const passwordInput2 = overlay.querySelector("#authPassword2");
    const errorBox = overlay.querySelector("#authError");
    const confirmRow = overlay.querySelector("#confirmRow");
    const captchaCanvas = overlay.querySelector("#captchaCanvas");
    const captchaInput = overlay.querySelector("#captchaInput");

    let mode = "login";
    let captchaAnswer = "";

    function drawCaptcha() {
      const ctx = captchaCanvas.getContext("2d");
      const text = Math.random().toString(36).slice(2, 7).toUpperCase();
      captchaAnswer = text;
      ctx.clearRect(0, 0, 140, 50);
      const gradient = ctx.createLinearGradient(0, 0, 140, 50);
      gradient.addColorStop(0, "#0ea5e9");
      gradient.addColorStop(1, "#6366f1");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 140, 50);
      for (let i = 0; i < 8; i++) {
        ctx.strokeStyle = `rgba(255,255,255,${0.2 + Math.random() * 0.4})`;
        ctx.beginPath();
        ctx.moveTo(Math.random() * 140, Math.random() * 50);
        ctx.lineTo(Math.random() * 140, Math.random() * 50);
        ctx.stroke();
      }
      ctx.font = "700 26px 'Segoe UI'";
      ctx.fillStyle = "#0b1224";
      const offsetX = 18;
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        const x = offsetX + i * 20;
        const y = 30 + Math.random() * 10;
        const angle = (Math.random() - 0.5) * 0.4;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.fillText(ch, 0, 0);
        ctx.restore();
      }
      for (let i = 0; i < 30; i++) {
        ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.4})`;
        ctx.fillRect(Math.random() * 140, Math.random() * 50, 2, 2);
      }
    }

    function setMode(nextMode) {
      mode = nextMode;
      tabs.forEach(t => t.classList.toggle("active", t.dataset.mode === mode));
      passwordInput.setAttribute(
        "autocomplete",
        mode === "login" ? "current-password" : "new-password"
      );
      errorBox.style.display = "none";
      confirmRow.style.display = mode === "register" ? "block" : "none";
      drawCaptcha();
    }

    tabs.forEach(tab => {
      tab.addEventListener("click", () => setMode(tab.dataset.mode));
    });

    overlay.querySelector("#authSubmit").addEventListener("click", async () => {
      const username = usernameInput.value.trim();
      const password = passwordInput.value;
      const invite = storedInviteCode();
      const captchaValue = (captchaInput.value || "").trim().toUpperCase();
      const password2 = passwordInput2.value;

      if (!username || !password) {
        errorBox.textContent = "Username and password required.";
        errorBox.style.display = "block";
        return;
      }

      if (mode === "register" && password !== password2) {
        errorBox.textContent = "Passwords do not match.";
        errorBox.style.display = "block";
        return;
      }

      if (!captchaValue || captchaValue !== captchaAnswer) {
        errorBox.textContent = "Captcha incorrect. Try again.";
        errorBox.style.display = "block";
        drawCaptcha();
        captchaInput.value = "";
        return;
      }

      try {
        const path = mode === "login" ? "/api/login" : "/api/register";
        const body =
          mode === "login"
            ? { username, password }
            : { username, password, inviteCode: invite || null };

        const res = await apiFetch(path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          const msg =
            data.error === "username_taken"
              ? "Username already exists."
              : data.error === "invalid_credentials"
              ? "Invalid credentials."
              : data.error === "too_many_attempts"
              ? "Too many attempts. Please wait a few minutes."
              : data.error === "signup_limit_reached"
              ? "Signup limit reached from this network. Try later."
              : "Unable to sign in.";
          errorBox.textContent = msg;
          errorBox.style.display = "block";
          drawCaptcha();
          return;
        }

        const data = await res.json();
        if (data.user) {
          setUser(data.user);
          overlay.style.display = "none";
        }
      } catch (err) {
        console.error(err);
        errorBox.textContent = "Network error. Try again.";
        errorBox.style.display = "block";
      } finally {
        drawCaptcha();
      }
    });

    drawCaptcha();
  }

  async function fetchMe() {
    try {
      const res = await apiFetch("/api/me");
      if (!res.ok) return null;
      const data = await res.json();
      return data.user;
    } catch (err) {
      return null;
    }
  }

  async function refreshUser() {
    const user = await fetchMe();
    if (user) {
      setUser(user);
    }
    return user;
  }

  async function init(onReady) {
    injectStyles();
    buildOverlay();
    const overlay = document.getElementById("auth-overlay");
    const current = await fetchMe();
    if (current) {
      setUser(current);
      overlay.style.display = "none";
      if (onReady) onReady(current);
    } else {
      overlay.style.display = "flex";
    }
  }

  async function logout() {
    try {
      await apiFetch("/api/logout", { method: "POST" });
    } finally {
      setUser(null);
      const overlay = document.getElementById("auth-overlay");
      if (overlay) overlay.style.display = "flex";
    }
  }

  window.snapAuth = {
    init,
    onUser,
    getUser: () => state.user,
    refreshUser,
    logout,
    storedInviteCode,
    apiFetch
  };
})();
