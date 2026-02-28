// assets/js/auth.js
(function () {
  "use strict";

  function alertBox() {
    return document.querySelector("[data-auth-alert]");
  }

  function setAlert(box, msg, type = "danger") {
    if (!box) return;
    box.innerHTML = `<div class="alert alert-${type}">${msg}</div>`;
  }

  function clearAlert(box) {
    if (!box) return;
    box.innerHTML = "";
  }

  function setLoading(btn, loading, text) {
    if (!btn) return;
    btn.disabled = !!loading;
    if (loading) {
      btn.dataset._oldText = btn.innerHTML;
      btn.innerHTML = text || "Loading...";
    } else if (btn.dataset._oldText) {
      btn.innerHTML = btn.dataset._oldText;
      delete btn.dataset._oldText;
    }
  }

  const TOKEN_KEY = window.APP_CONFIG?.STORAGE_KEYS?.ACCESS_TOKEN || "jh_access_token";
  const USER_KEY = window.APP_CONFIG?.STORAGE_KEYS?.USER || "jh_user";

  function saveAuth(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user || {}));
  }

  function clearAuth() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  // ✅ Your backend uses /api/v1/auth/*
  const AUTH = "/auth";

  function getVal(form, name) {
    return (form[name]?.value || "").trim();
  }

  // ---------- SIGNUP (Unified DB: users + profiles) ----------
  window.handleSignup = async function handleSignup(form) {
    const box = alertBox();
    clearAlert(box);

    const btn = form.querySelector('button[type="submit"]');
    setLoading(btn, true, "Creating...");

    // Required: users
    const role = getVal(form, "role") || "client";
    const email = getVal(form, "email");          // ✅ email (not username)
    const phone = getVal(form, "phone");
    const password = form.password?.value || "";

    // Required: profiles
    const firstName = getVal(form, "firstName");
    const lastName = getVal(form, "lastName");
    const sex = getVal(form, "sex");              // 'm' or 'f'
    const dateOfBirth = getVal(form, "dateOfBirth"); // YYYY-MM-DD
    const address = getVal(form, "address");

    // Optional role-specific
    const location = getVal(form, "location");    // broker/owner/photographer
    const branch = getVal(form, "branch");        // staff
    const position = getVal(form, "position");    // staff

    // Basic required checks
    if (!firstName || !lastName || !sex || !dateOfBirth || !address || !email || !phone || !password) {
      setLoading(btn, false);
      setAlert(box, "Please fill in all required fields (including sex, date of birth, and address).", "warning");
      return;
    }

    // Role-specific required checks
    if (["broker", "owner", "photographer"].includes(role) && !location) {
      setLoading(btn, false);
      setAlert(box, "Location is required for Broker/Owner/Photographer.", "warning");
      return;
    }
    if (role === "staff" && (!branch || !position)) {
      setLoading(btn, false);
      setAlert(box, "Branch and Position are required for Staff.", "warning");
      return;
    }

    const payload = {
      role,
      email,
      phone,
      password,
      firstName,
      lastName,
      sex,
      dateOfBirth,
      address,
      location: location || null,
      branch: branch || null,
      position: position || null,
    };

    try {
      const res = await window.http.post(`${AUTH}/register`, payload);

      if (res?.token) saveAuth(res.token, res.user);

      setAlert(box, res?.message || "Account created successfully. Redirecting…", "success");
      setTimeout(() => (window.location.href = "login.html"), 800);
    } catch (err) {
      setAlert(box, err.message || "Sign up failed.", "danger");
    } finally {
      setLoading(btn, false);
    }
  };

  // ---------- LOGIN ----------
  // Backend should accept { username, password } OR { email, password }.
  // We send username=email to stay compatible with your current login handler.
  window.handleLogin = async function handleLogin(form) {
    const box = alertBox();
    clearAlert(box);

    const btn = form.querySelector('button[type="submit"]');
    setLoading(btn, true, "Signing in...");

    const username = getVal(form, "username") || getVal(form, "email"); // support either input name
    const password = form.password?.value || "";

    if (!username || !password) {
      setLoading(btn, false);
      setAlert(box, "Please enter your email and password.", "warning");
      return;
    }

    try {
      const res = await window.http.post(`${AUTH}/login`, { username, password });

      if (!res?.token) throw new Error(res?.message || "Login response missing token.");

      saveAuth(res.token, res.user);
      setAlert(box, "Login successful. Redirecting…", "success");

      setTimeout(() => (window.location.href = "../index.html"), 600);
    } catch (err) {
      setAlert(box, err.message || "Login failed.", "danger");
    } finally {
      setLoading(btn, false);
    }
  };

  // ---------- FORGOT PASSWORD ----------
  window.handleForgot = async function handleForgot(form) {
    const box = alertBox();
    clearAlert(box);

    const btn = form.querySelector('button[type="submit"]');
    setLoading(btn, true, "Sending...");

    const email = getVal(form, "email");
    if (!email) {
      setLoading(btn, false);
      setAlert(box, "Please enter your email address.", "warning");
      return;
    }

    try {
      const res = await window.http.post(`${AUTH}/password/forgot`, { email });
      setAlert(box, res?.message || "If the email exists, a reset link has been sent.", "success");
      form.reset();
    } catch (err) {
      setAlert(box, err.message || "Could not send reset link.", "danger");
    } finally {
      setLoading(btn, false);
    }
  };

  // ---------- RESET PASSWORD ----------
  window.handleReset = async function handleReset(form) {
    const box = alertBox();
    clearAlert(box);

    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setAlert(box, "Missing reset token in the URL.", "danger");
      return;
    }

    const newPassword = form.newPassword?.value || "";
    const confirmPassword = form.confirmPassword?.value || "";

    if (!newPassword || newPassword.length < 6) {
      setAlert(box, "Password must be at least 6 characters.", "warning");
      return;
    }
    if (newPassword !== confirmPassword) {
      setAlert(box, "Passwords do not match.", "warning");
      return;
    }

    const btn = form.querySelector('button[type="submit"]');
    setLoading(btn, true, "Resetting...");

    try {
      const res = await window.http.post(`${AUTH}/password/reset`, { token, newPassword });
      setAlert(box, res?.message || "Password reset successful. You can now sign in.", "success");
      clearAuth();
      setTimeout(() => (window.location.href = "login.html"), 900);
    } catch (err) {
      setAlert(box, err.message || "Reset failed.", "danger");
    } finally {
      setLoading(btn, false);
    }
  };

  window.logout = function logout(redirectTo = "../index.html") {
    clearAuth();
    window.location.href = redirectTo;
  };
})();
