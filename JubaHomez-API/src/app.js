/* assets/js/config.js
   JUBA HOMEZ - Frontend App Config (Render + Local)
*/
(() => {
  "use strict";

  const hostname = window.location.hostname;
  const isLocal =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".local");

  // Local backend (change port if yours differs)
  // ✅ Your backend mounts routes at /api/v1
  const DEV_API_BASE_URL = "http://localhost:5000/api/v1";

  // ✅ Render backend (your live API)
  const PROD_API_BASE_URL = "https://juba-homez-backend.onrender.com/api/v1";

  const API_BASE_URL = isLocal ? DEV_API_BASE_URL : PROD_API_BASE_URL;

  window.APP_CONFIG = {
    API_BASE_URL,
    APP_NAME: "JUBA HOMEZ",
    VERSION: "1.0.0",
    STORAGE_KEYS: {
      ACCESS_TOKEN: "jh_access_token",
      REFRESH_TOKEN: "jh_refresh_token",
      USER: "jh_user",
    },
    FEATURES: {
      DEBUG_LOGS: isLocal,
    },
    utils: {
      isLocal,

      apiUrl(path = "") {
        const base = String(API_BASE_URL || "").replace(/\/+$/, "");
        const p = String(path || "");
        if (!p) return base;
        return p.startsWith("/") ? `${base}${p}` : `${base}/${p}`;
      },

      getAccessToken() {
        return localStorage.getItem("jh_access_token");
      },

      setAccessToken(token) {
        if (!token) localStorage.removeItem("jh_access_token");
        else localStorage.setItem("jh_access_token", token);
      },

      clearAuth() {
        localStorage.removeItem("jh_access_token");
        localStorage.removeItem("jh_refresh_token");
        localStorage.removeItem("jh_user");
      },

      getAuthHeaders(extra = {}) {
        const token = localStorage.getItem("jh_access_token");
        const headers = { "Content-Type": "application/json", ...extra };
        if (token) headers.Authorization = `Bearer ${token}`;
        return headers;
      },
    },
  };

  // Validate + log (only locally)
  try {
    new URL(window.APP_CONFIG.API_BASE_URL);
    if (window.APP_CONFIG.FEATURES.DEBUG_LOGS) {
      console.log("APP_CONFIG loaded:", window.APP_CONFIG);
    }
  } catch {
    console.error(
      "APP_CONFIG.API_BASE_URL is invalid or missing:",
      window.APP_CONFIG.API_BASE_URL
    );
  }
})();
