// ROK Task Manager website - production browser code.
// Public browser code only. No payment-provider or server secrets are stored here.

const LINKS = {
  discord: "https://discord.gg/Em3Yn2Rv4"
};

document.querySelectorAll(".js-discord-link").forEach((a) => {
  a.href = LINKS.discord;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
});

const agreement = document.getElementById("checkout-agreement");
const fulfillmentResult = document.getElementById("fulfillment-result");

// ----------------------------------------------------------
// Production Whop checkout integration
// ----------------------------------------------------------
// The checkout claim stays in sessionStorage for the lifetime of this browser
// tab. It survives refreshes, is never placed in the URL, and is sent only to
// the licensing server. If the tab/session is lost, an LC-ROK license key can
// recover access through the server-side recovery endpoint.
const WHOP_CREATE_CHECKOUT_URL =
  "https://loners-corner-license-server.onrender.com/whop/create-checkout";
const WHOP_CLAIM_LICENSE_URL =
  "https://loners-corner-license-server.onrender.com/whop/claim-license";
const WHOP_RECOVER_LICENSE_URL =
  "https://loners-corner-license-server.onrender.com/whop/recover-license";
const WHOP_CLAIM_STORAGE_KEY = "lc_rok_whop_claim_v1";

const whopPanel = document.getElementById("whop-test-panel");
const whopButton = document.getElementById("whop-checkout-button");
const whopStatus = document.getElementById("whop-checkout-status");
const checkoutProviderCopy = document.getElementById("checkout-provider-copy");
const checkoutFulfillmentNote = document.getElementById("checkout-fulfillment-note");
const whopRecovery = document.getElementById("whop-recovery");
const whopRecoveryKey = document.getElementById("whop-recovery-license-key");
const whopRecoveryButton = document.getElementById("whop-recovery-button");
const whopRecoveryStatus = document.getElementById("whop-recovery-status");
const whopRecoveryToggle = document.getElementById("whop-recovery-toggle");
const pageParams = new URLSearchParams(window.location.search);
const whopReturnMode = pageParams.get("whop") === "complete";


// ----------------------------------------------------------
// Public PayPal one-time Orders v2 checkout
// ----------------------------------------------------------
// The browser never chooses the amount. Render creates the fixed $50 USD order,
// then captures and verifies the approved order before returning the LC-ROK key.
// ?paypal=complete remains supported only for legacy Hosted Button recovery.
const PAYPAL_PUBLIC_ENABLED = true;
const PAYPAL_ONE_TIME_RETURN_MODE = pageParams.get("paypal") === "complete";
const PAYPAL_PUBLIC_CLIENT_ID =
  "BAA_AuZKrPiywBR6mlKzE8Plni5gHF_ivKqs1ZIiVE7alZ1xdGqytzR1br1eooOhZKxr5AgK59FZcVnrwM";
const PAYPAL_ONE_TIME_CREATE_ORDER_URL =
  "https://loners-corner-license-server.onrender.com/paypal/one-time/create-order";
const PAYPAL_ONE_TIME_CAPTURE_ORDER_URL =
  "https://loners-corner-license-server.onrender.com/paypal/one-time/capture-order";
const PAYPAL_ONE_TIME_CLAIM_URL =
  "https://loners-corner-license-server.onrender.com/paypal/one-time/claim";
const PAYPAL_ONE_TIME_RECOVER_URL =
  "https://loners-corner-license-server.onrender.com/paypal/one-time/recover-license";
const PAYPAL_ONE_TIME_VALIDATE_RENEWAL_URL =
  "https://loners-corner-license-server.onrender.com/paypal/one-time/validate-renewal-license";
const PAYPAL_RENEWAL_STORAGE_KEY = "lc_rok_paypal_pending_renewal_v1";
const PAYPAL_RENEWAL_STORAGE_TTL_MS = 2 * 60 * 60 * 1000;
const PAYPAL_APPROVED_ORDER_STORAGE_KEY = "lc_rok_paypal_approved_order_v1";

function loadPayPalButtonsSdk() {
  if (window.paypal && typeof window.paypal.Buttons === "function") {
    return Promise.resolve(window.paypal);
  }
  return new Promise((resolve, reject) => {
    const existing = document.getElementById("lc-paypal-buttons-sdk");
    if (existing) {
      existing.addEventListener("load", () => resolve(window.paypal), { once: true });
      existing.addEventListener("error", () => reject(new Error("PayPal checkout could not be loaded.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.id = "lc-paypal-buttons-sdk";
    script.src =
      `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(PAYPAL_PUBLIC_CLIENT_ID)}` +
      "&components=buttons&disable-funding=venmo&currency=USD&intent=capture";
    script.async = true;
    script.onload = () => resolve(window.paypal);
    script.onerror = () => reject(new Error("PayPal checkout could not be loaded."));
    document.head.appendChild(script);
  });
}

async function postPayPalOneTimeJson(url, body, fallbackMessage) {
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  } catch (networkError) {
    const error = new Error("The licensing server is temporarily unreachable. Please do not submit another payment.");
    error.networkError = true;
    throw error;
  }
  let result = null;
  try { result = await response.json(); } catch (error) {}
  if (!response.ok) {
    const error = new Error((result && (result.detail || result.reason)) || fallbackMessage);
    error.httpStatus = response.status;
    throw error;
  }
  return result;
}

function createPayPalOneTimeOrder(renewLicenseKey = "") {
  return postPayPalOneTimeJson(
    PAYPAL_ONE_TIME_CREATE_ORDER_URL,
    { renew_license_key: String(renewLicenseKey || "").trim().toUpperCase() },
    "The licensing server could not create this PayPal order."
  );
}

function capturePayPalOneTimeOrder(orderId) {
  return postPayPalOneTimeJson(
    PAYPAL_ONE_TIME_CAPTURE_ORDER_URL,
    { order_id: String(orderId || "").trim() },
    "The licensing server could not capture this PayPal order."
  );
}

function setApprovedPayPalOrder(orderId) {
  const value = String(orderId || "").trim();
  if (!value) return;
  try { sessionStorage.setItem(PAYPAL_APPROVED_ORDER_STORAGE_KEY, value); } catch (error) {}
}

function getApprovedPayPalOrder() {
  try { return String(sessionStorage.getItem(PAYPAL_APPROVED_ORDER_STORAGE_KEY) || "").trim(); }
  catch (error) { return ""; }
}

function clearApprovedPayPalOrder() {
  try { sessionStorage.removeItem(PAYPAL_APPROVED_ORDER_STORAGE_KEY); } catch (error) {}
}

function claimPayPalOneTime(payload) {
  return postPayPalOneTimeJson(
    PAYPAL_ONE_TIME_CLAIM_URL,
    payload,
    "The licensing server could not verify this PayPal payment."
  );
}

function recoverPayPalOneTime(licenseKey) {
  return postPayPalOneTimeJson(
    PAYPAL_ONE_TIME_RECOVER_URL,
    { license_key: licenseKey },
    "The licensing server could not recover this PayPal purchase."
  );
}

function validatePayPalRenewalLicense(licenseKey) {
  return postPayPalOneTimeJson(
    PAYPAL_ONE_TIME_VALIDATE_RENEWAL_URL,
    { license_key: licenseKey },
    "The licensing server could not validate this PayPal renewal license."
  );
}

function setPendingPayPalRenewal(licenseKey) {
  const key = String(licenseKey || "").trim().toUpperCase();
  if (!isLonerLicenseKey(key)) return;
  const record = { license_key: key, saved_at: Date.now() };
  try {
    localStorage.setItem(PAYPAL_RENEWAL_STORAGE_KEY, JSON.stringify(record));
  } catch (error) {
    console.warn("Could not persist PayPal renewal selection:", error);
  }
}

function getPendingPayPalRenewal() {
  try {
    const raw = localStorage.getItem(PAYPAL_RENEWAL_STORAGE_KEY);
    if (!raw) return "";
    const record = JSON.parse(raw);
    const age = Date.now() - Number(record && record.saved_at || 0);
    const key = String(record && record.license_key || "").trim().toUpperCase();
    if (!isLonerLicenseKey(key) || !Number.isFinite(age) || age < 0 || age > PAYPAL_RENEWAL_STORAGE_TTL_MS) {
      localStorage.removeItem(PAYPAL_RENEWAL_STORAGE_KEY);
      return "";
    }
    return key;
  } catch (error) {
    try { localStorage.removeItem(PAYPAL_RENEWAL_STORAGE_KEY); } catch (ignored) {}
    return "";
  }
}

function clearPendingPayPalRenewal() {
  try { localStorage.removeItem(PAYPAL_RENEWAL_STORAGE_KEY); } catch (error) {}
}

function maskLicenseKey(key) {
  const value = String(key || "").trim().toUpperCase();
  if (value.length < 12) return value;
  return `${value.slice(0, 11)}…${value.slice(-8)}`;
}

function setWhopStatus(lines) {
  if (!whopStatus) return;

  whopStatus.replaceChildren();
  const rows = Array.isArray(lines) ? lines : [{ text: String(lines || "") }];

  rows.forEach((line, index) => {
    const row = document.createElement("div");

    if (line.strong) {
      const strong = document.createElement("strong");
      strong.textContent = line.text;
      row.appendChild(strong);
    } else {
      row.textContent = line.text;
    }

    whopStatus.appendChild(row);
    if (index < rows.length - 1) whopStatus.appendChild(document.createElement("br"));
  });
}

function setRecoveryStatus(text, isError = false) {
  if (!whopRecoveryStatus) return;
  whopRecoveryStatus.textContent = String(text || "");
  whopRecoveryStatus.style.color = isError ? "#ffb4b4" : "var(--muted)";
}

function showRecoveryPanel(message = "") {
  if (!whopRecovery) return;
  whopRecovery.hidden = false;
  if (message) setRecoveryStatus(message);
}

function hideRecoveryPanel() {
  if (!whopRecovery) return;
  whopRecovery.hidden = true;
  setRecoveryStatus("");
}

function whopStorageAvailable() {
  try {
    const probe = "__lc_whop_storage_probe__";
    window.sessionStorage.setItem(probe, "1");
    window.sessionStorage.removeItem(probe);
    return true;
  } catch (error) {
    return false;
  }
}

function getWhopClaimToken() {
  try {
    return String(window.sessionStorage.getItem(WHOP_CLAIM_STORAGE_KEY) || "").trim();
  } catch (error) {
    return "";
  }
}

function storeWhopClaimToken(token) {
  window.sessionStorage.setItem(WHOP_CLAIM_STORAGE_KEY, token);
}

function clearWhopClaimToken() {
  try {
    window.sessionStorage.removeItem(WHOP_CLAIM_STORAGE_KEY);
  } catch (error) {
    // Storage cleanup failure should not hide an otherwise successful purchase.
  }
}

function isWhopCheckoutUrl(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "whop.com" || url.hostname.endsWith(".whop.com"))
    );
  } catch (error) {
    return false;
  }
}

function isLonerLicenseKey(value) {
  return /^LC-ROK-[A-Z0-9-]{12,}$/i.test(String(value || "").trim());
}

async function createWhopCheckout() {
  const response = await fetch(WHOP_CREATE_CHECKOUT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" }
  });

  let result = null;
  try {
    result = await response.json();
  } catch (error) {
    throw new Error("The licensing server returned an unreadable checkout response.");
  }

  if (!response.ok || !result || result.created !== true) {
    throw new Error(
      (result && (result.detail || result.reason)) ||
        "The licensing server could not create the Whop checkout."
    );
  }

  const checkoutUrl = String(result.checkout_url || "").trim();
  const claimToken = String(result.claim_token || "").trim();

  if (!isWhopCheckoutUrl(checkoutUrl) || claimToken.length < 32) {
    throw new Error("The licensing server returned incomplete Whop checkout information.");
  }

  return { checkoutUrl, claimToken };
}

async function postWhopJson(url, body, fallbackMessage) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  let result = null;
  try {
    result = await response.json();
  } catch (error) {
    throw new Error("The licensing server returned an unreadable fulfillment response.");
  }

  if (!response.ok) {
    throw new Error(
      (result && (result.detail || result.reason)) || fallbackMessage
    );
  }

  return result;
}

async function claimWhopLicense(claimToken) {
  return postWhopJson(
    WHOP_CLAIM_LICENSE_URL,
    { claim_token: claimToken },
    "The licensing server could not verify this Whop purchase."
  );
}

async function recoverWhopLicense(licenseKey) {
  return postWhopJson(
    WHOP_RECOVER_LICENSE_URL,
    { license_key: licenseKey },
    "The licensing server could not recover this Whop purchase."
  );
}

function openFreshDownload(url) {
  const value = String(url || "").trim();
  if (!value.startsWith("https://")) {
    throw new Error("The licensing server did not return a valid private download URL.");
  }

  const a = document.createElement("a");
  a.href = value;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function getFreshFulfillment(existingLicenseKey = "") {
  const claimToken = getWhopClaimToken();
  if (claimToken.length >= 32) {
    return claimWhopLicense(claimToken);
  }

  const licenseKey = String(existingLicenseKey || "").trim();
  if (isLonerLicenseKey(licenseKey)) {
    return recoverWhopLicense(licenseKey);
  }

  throw new Error(
    "Secure purchase access is no longer stored in this tab. Use Recover existing purchase below."
  );
}

function showFulfillment(result, options = {}) {
  if (!fulfillmentResult) return;

  fulfillmentResult.replaceChildren();
  fulfillmentResult.classList.remove("visible");

  if (!result || result.fulfilled !== true || !result.license_key) return;

  const title = document.createElement("strong");
  title.textContent = options.title || "Subscription verified — your license is ready.";
  fulfillmentResult.appendChild(title);

  const key = document.createElement("div");
  key.className = "license-key";
  key.textContent = result.license_key;
  fulfillmentResult.appendChild(key);

  if (result.expires_at) {
    const expiry = document.createElement("p");
    expiry.style.margin = "10px 0 0";
    expiry.style.color = "var(--muted)";
    expiry.style.fontSize = "13px";
    try {
      expiry.textContent = `Access valid until ${new Date(result.expires_at).toLocaleString()}.`;
    } catch (error) {
      expiry.textContent = `Access valid until ${result.expires_at}.`;
    }
    fulfillmentResult.appendChild(expiry);
  }

  const actions = document.createElement("div");
  actions.className = "result-actions";

  const copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.className = "btn btn-secondary";
  copyButton.textContent = "Copy License Key";
  copyButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(result.license_key);
      copyButton.textContent = "Copied";
      setTimeout(() => {
        copyButton.textContent = "Copy License Key";
      }, 1800);
    } catch (error) {
      console.error("Clipboard error:", error);
    }
  });
  actions.appendChild(copyButton);

  const downloadButton = document.createElement("button");
  downloadButton.type = "button";
  downloadButton.className = "btn btn-primary";
  downloadButton.textContent = "Download ROK Task Manager";
  downloadButton.addEventListener("click", async () => {
    downloadButton.disabled = true;
    const originalText = downloadButton.textContent;
    downloadButton.textContent = "Preparing secure download...";

    try {
      // Always ask Render for a fresh presigned URL at click time. This prevents
      // the 15-minute R2 URL from expiring while the customer leaves the page open.
      const fresh = options.freshDownload
        ? await options.freshDownload()
        : await getFreshFulfillment(result.license_key);
      if (!fresh || fresh.fulfilled !== true || !fresh.download_url) {
        throw new Error(
          (fresh && (fresh.download_error || fresh.reason)) ||
            "Private download is temporarily unavailable."
        );
      }
      openFreshDownload(fresh.download_url);
    } catch (error) {
      console.error("Private download refresh error:", error);
      const errorLines = [
        { text: "The private download link could not be refreshed.", strong: true },
        {
          text:
            error && error.message
              ? error.message
              : "Please recover the purchase or contact Loner's Corner support."
        }
      ];
      if (typeof options.onErrorStatus === "function") {
        options.onErrorStatus(errorLines);
      } else {
        setWhopStatus(errorLines);
        showRecoveryPanel("Enter the LC-ROK license key shown above to recover a fresh download link.");
      }
    } finally {
      downloadButton.disabled = false;
      downloadButton.textContent = originalText;
    }
  });
  actions.appendChild(downloadButton);

  fulfillmentResult.appendChild(actions);

  if (result.download_error) {
    const note = document.createElement("p");
    note.style.marginBottom = "0";
    note.style.color = "var(--muted)";
    note.textContent = result.download_error;
    fulfillmentResult.appendChild(note);
  }

  fulfillmentResult.classList.add("visible");
  hideRecoveryPanel();
}


async function setupPublicPayPalOrdersCheckout() {
  if (!PAYPAL_PUBLIC_ENABLED || !whopPanel) return;

  const panel = document.createElement("div");
  panel.id = "paypal-orders-panel";
  panel.className = "checkout-option-panel";
  panel.style.marginTop = "0";
  panel.style.padding = "16px";
  panel.style.border = "1px solid var(--line)";
  panel.style.borderRadius = "14px";
  panel.style.background = "rgba(255,255,255,.025)";
  panel.innerHTML = `
    <p style="margin:0 0 10px;"><strong>Pay with PayPal — $50 USD / 30 days</strong></p>
    <p style="margin:0 0 10px;color:var(--muted);font-size:13px;line-height:1.5;">
      One-time PayPal payment. This option does not auto-renew. After approval, the payment is verified and your LC-ROK license and private download are provided here automatically.
    </p>
    <div id="paypal-terms-reminder" role="status" aria-live="polite" style="margin:14px 0 16px;padding:14px 15px;border:1px solid rgba(255,193,92,.55);border-radius:12px;background:rgba(255,174,56,.10);color:#ffe0a3;font-size:14px;line-height:1.45;font-weight:800;letter-spacing:.01em;">
      PLEASE AGREE TO THE TERMS &amp; POLICY ABOVE BEFORE PAYING.<br>
      <span style="font-weight:600;color:#ffd28b;">The PayPal checkout is disabled until the agreement box is checked.</span>
    </div>
    <div id="paypal-buttons-wrap">
      <div id="paypal-buttons-container"></div>
    </div>
    <div id="paypal-orders-status" aria-live="polite" style="margin-top:10px;color:var(--muted);font-size:13px;line-height:1.5;"></div>

    <button type="button" id="paypal-renew-toggle" style="margin-top:12px;padding:0;border:0;background:none;color:var(--accent);font:inherit;font-size:13px;font-weight:700;text-decoration:underline;cursor:pointer;">
      Renew an existing PayPal license
    </button>
    <div id="paypal-renew-box" hidden style="margin-top:10px;">
      <p style="margin:0 0 8px;color:var(--muted);font-size:13px;line-height:1.5;">
        Enter your existing PayPal-issued LC-ROK key first. After validation, the next $50 PayPal payment will add 30 days to that same key.
      </p>
      <div class="whop-recovery-row">
        <input id="paypal-renew-license" type="text" autocomplete="off" spellcheck="false" placeholder="LC-ROK-..." aria-label="Existing PayPal license key"/>
        <button class="btn btn-secondary" id="paypal-renew-validate" type="button">Use This License</button>
      </div>
      <p id="paypal-renew-status" style="margin:8px 0 0;color:var(--muted);font-size:13px;line-height:1.5;"></p>
    </div>

    <button type="button" id="paypal-recover-toggle" style="margin-top:12px;padding:0;border:0;background:none;color:var(--accent);font:inherit;font-size:13px;font-weight:700;text-decoration:underline;cursor:pointer;">
      Already have an LC-ROK key? Recover access
    </button>
    <div id="paypal-recover-box" hidden style="margin-top:10px;">
      <div class="whop-recovery-row">
        <input id="paypal-recover-license" type="text" autocomplete="off" spellcheck="false" placeholder="LC-ROK-..." aria-label="PayPal license key"/>
        <button class="btn btn-secondary" id="paypal-recover-button" type="button">Recover Access</button>
      </div>
      <p id="paypal-recover-status" style="margin:8px 0 0;color:var(--muted);font-size:13px;line-height:1.5;"></p>
    </div>

    <button type="button" id="paypal-manual-toggle" style="margin-top:10px;padding:0;border:0;background:none;color:var(--muted);font:inherit;font-size:12px;font-weight:700;text-decoration:underline;cursor:pointer;">
      Payment completed but license did not appear?
    </button>
    <div id="paypal-manual-box" hidden style="margin-top:10px;">
      <p style="margin:0 0 8px;color:var(--muted);font-size:12px;line-height:1.5;">
        Emergency fallback only. Enter the PayPal Transaction ID from your receipt or Activity. For a renewal, also enter the existing LC-ROK key.
      </p>
      <div class="whop-recovery-row">
        <input id="paypal-manual-transaction" type="text" autocomplete="off" spellcheck="false" placeholder="PayPal Transaction ID" aria-label="PayPal Transaction ID"/>
      </div>
      <div class="whop-recovery-row" style="margin-top:8px;">
        <input id="paypal-manual-renew-key" type="text" autocomplete="off" spellcheck="false" placeholder="Existing LC-ROK key (renewals only)" aria-label="Existing renewal license key"/>
        <button class="btn btn-secondary" id="paypal-manual-verify" type="button">Verify Payment</button>
      </div>
      <p id="paypal-manual-status" style="margin:8px 0 0;color:var(--muted);font-size:12px;line-height:1.5;"></p>
    </div>`;

  const checkoutCard = whopPanel.closest(".feature-card");
  let dualGrid = document.getElementById("dual-checkout-grid");
  if (!dualGrid) {
    dualGrid = document.createElement("div");
    dualGrid.id = "dual-checkout-grid";
    dualGrid.className = "dual-checkout-grid";
    whopPanel.parentNode.insertBefore(dualGrid, whopPanel);
    dualGrid.appendChild(whopPanel);
    whopPanel.classList.add("checkout-option-panel");
    whopPanel.style.marginBottom = "0";
    if (checkoutCard) checkoutCard.style.maxWidth = "1120px";
  }
  dualGrid.appendChild(panel);

  const termsReminder = panel.querySelector("#paypal-terms-reminder");
  const wrap = panel.querySelector("#paypal-buttons-wrap");
  const status = panel.querySelector("#paypal-orders-status");
  const renewToggle = panel.querySelector("#paypal-renew-toggle");
  const renewBox = panel.querySelector("#paypal-renew-box");
  const renewInput = panel.querySelector("#paypal-renew-license");
  const renewValidate = panel.querySelector("#paypal-renew-validate");
  const renewStatus = panel.querySelector("#paypal-renew-status");
  const recoverToggle = panel.querySelector("#paypal-recover-toggle");
  const recoverBox = panel.querySelector("#paypal-recover-box");
  const recoverInput = panel.querySelector("#paypal-recover-license");
  const recoverButton = panel.querySelector("#paypal-recover-button");
  const recoverStatus = panel.querySelector("#paypal-recover-status");
  const manualToggle = panel.querySelector("#paypal-manual-toggle");
  const manualBox = panel.querySelector("#paypal-manual-box");
  const manualTx = panel.querySelector("#paypal-manual-transaction");
  const manualRenewKey = panel.querySelector("#paypal-manual-renew-key");
  const manualVerify = panel.querySelector("#paypal-manual-verify");
  const manualStatus = panel.querySelector("#paypal-manual-status");

  let paypalButtonRendered = false;

  const setReadyStatus = () => {
    const pending = getPendingPayPalRenewal();
    status.style.color = "var(--muted)";
    status.textContent = pending
      ? `Renewal selected for ${maskLicenseKey(pending)}. The next $50 payment will extend that same key by 30 days.`
      : "PayPal checkout is ready. A new $50 payment creates a 30-day LC-ROK license.";
  };

  const update = () => {
    const allowed = Boolean(agreement && agreement.checked);
    wrap.style.pointerEvents = allowed ? "auto" : "none";
    wrap.style.opacity = allowed ? "1" : "0.55";
    wrap.setAttribute("aria-disabled", allowed ? "false" : "true");
    if (allowed) wrap.removeAttribute("inert");
    else wrap.setAttribute("inert", "");

    if (termsReminder) {
      if (allowed) {
        termsReminder.innerHTML = '<strong>✓ TERMS ACCEPTED</strong><br><span style="font-weight:600;">PayPal checkout is enabled.</span>';
        termsReminder.style.borderColor = "rgba(83,226,143,.45)";
        termsReminder.style.background = "rgba(83,226,143,.08)";
        termsReminder.style.color = "#b8f4d1";
      } else {
        termsReminder.innerHTML = '<strong>PLEASE AGREE TO THE TERMS &amp; POLICY ABOVE BEFORE PAYING.</strong><br><span style="font-weight:600;color:#ffd28b;">The PayPal checkout is disabled until the agreement box is checked.</span>';
        termsReminder.style.borderColor = "rgba(255,193,92,.55)";
        termsReminder.style.background = "rgba(255,174,56,.10)";
        termsReminder.style.color = "#ffe0a3";
      }
    }

    if (!paypalButtonRendered) {
      status.textContent = "Loading secure PayPal checkout...";
      return;
    }
    if (!allowed) {
      status.textContent = "PayPal checkout is ready. Agree to the terms above to enable payment.";
      return;
    }
    setReadyStatus();
  };

  const finalizeApprovedOrder = async (orderId) => {
    const retryDelays = [0, 2000, 4000];
    let lastError = null;
    for (let index = 0; index < retryDelays.length; index += 1) {
      if (retryDelays[index]) await delay(retryDelays[index]);
      status.style.color = "var(--muted)";
      status.textContent = index === 0
        ? "Payment approved. Verifying your purchase and preparing your license..."
        : `Licensing server retry ${index + 1} of ${retryDelays.length}... Do not pay again.`;
      try {
        const result = await capturePayPalOneTimeOrder(orderId);
        if (!result || result.fulfilled !== true || !result.license_key) {
          throw new Error((result && result.reason) || "PayPal payment could not be fulfilled.");
        }
        clearApprovedPayPalOrder();
        clearPendingPayPalRenewal();
        status.textContent = result.renewed
          ? "Payment verified. Your existing license has been extended by 30 days."
          : "Payment verified. Your 30-day license is ready.";
        showPayPalOneTimeFulfillment(result);
        return true;
      } catch (error) {
        lastError = error;
        const retryable = Boolean(error && (error.networkError || error.httpStatus === 429 || error.httpStatus >= 500));
        if (!retryable) break;
      }
    }
    status.style.color = "#ffb4b4";
    status.textContent = `${lastError && lastError.message ? lastError.message : "Payment verification could not be completed."} If PayPal shows a completed charge, do not pay again. Refresh this page to retry or use the fallback below.`;
    manualBox.hidden = false;
    return false;
  };

  try {
    const paypalSdk = await loadPayPalButtonsSdk();
    if (!paypalSdk || typeof paypalSdk.Buttons !== "function") {
      throw new Error("PayPal Buttons are unavailable in this browser.");
    }

    await paypalSdk.Buttons({
      style: { layout: "vertical", shape: "rect", label: "paypal" },
      createOrder: async () => {
        if (!agreement || !agreement.checked) {
          status.style.color = "#ffb4b4";
          status.textContent = "Please agree to the Terms & Policy before paying.";
          throw new Error("Terms not accepted.");
        }
        status.style.color = "var(--muted)";
        status.textContent = "Creating your secure $50 PayPal order...";
        const renewalKey = getPendingPayPalRenewal();
        const result = await createPayPalOneTimeOrder(renewalKey);
        if (!result || result.created !== true || !result.order_id) {
          throw new Error((result && result.reason) || "PayPal order could not be created.");
        }
        status.textContent = "PayPal order created. Complete approval in the PayPal window.";
        return result.order_id;
      },
      onApprove: async (data) => {
        const orderId = String(data && data.orderID || "").trim();
        if (!orderId) throw new Error("PayPal did not return the approved order ID.");
        setApprovedPayPalOrder(orderId);
        await finalizeApprovedOrder(orderId);
      },
      onCancel: () => {
        status.style.color = "var(--muted)";
        status.textContent = "PayPal checkout was cancelled. No new license was issued.";
      },
      onError: (error) => {
        console.error("PayPal Orders checkout error:", error);
        status.style.color = "#ffb4b4";
        status.textContent = getApprovedPayPalOrder()
          ? "PayPal approval was received, but license verification did not finish. Do not pay again. Refresh this page to retry."
          : "PayPal checkout could not be completed. If PayPal shows a completed charge, do not pay again; use the recovery option below.";
      }
    }).render("#paypal-buttons-container");

    paypalButtonRendered = true;
    update();
  } catch (error) {
    console.error("PayPal Buttons startup error:", error);
    status.style.color = "#ffb4b4";
    status.textContent = error && error.message ? error.message : "PayPal checkout could not be loaded.";
  }

  agreement?.addEventListener("change", () => {
    update();
    if (agreement.checked && whopStatus && /Please agree to the Subscription/i.test(whopStatus.textContent || "")) {
      whopStatus.textContent = "";
    }
  });
  update();

  renewToggle?.addEventListener("click", () => {
    renewBox.hidden = !renewBox.hidden;
    if (!renewBox.hidden) renewInput?.focus();
  });

  renewValidate?.addEventListener("click", async () => {
    const key = String(renewInput?.value || "").trim().toUpperCase();
    if (!isLonerLicenseKey(key)) {
      renewStatus.textContent = "Enter your existing LC-ROK license key.";
      renewStatus.style.color = "#ffb4b4";
      return;
    }
    renewValidate.disabled = true;
    renewStatus.textContent = "Checking the existing PayPal license...";
    renewStatus.style.color = "var(--muted)";
    try {
      const result = await validatePayPalRenewalLicense(key);
      if (!result || result.valid !== true) {
        throw new Error((result && result.reason) || "This license cannot be renewed through PayPal.");
      }
      setPendingPayPalRenewal(result.license_key || key);
      const expiryText = result.expires_at
        ? ` Current access ends ${new Date(result.expires_at).toLocaleString()}.`
        : "";
      renewStatus.textContent = `Ready. Your next $50 PayPal payment will keep ${maskLicenseKey(key)} and add 30 days.${expiryText}`;
      renewStatus.style.color = "var(--muted)";
      renewBox.hidden = false;
      update();
    } catch (error) {
      clearPendingPayPalRenewal();
      renewStatus.textContent = error && error.message ? error.message : "PayPal renewal validation failed.";
      renewStatus.style.color = "#ffb4b4";
      update();
    } finally {
      renewValidate.disabled = false;
    }
  });

  recoverToggle?.addEventListener("click", () => {
    recoverBox.hidden = !recoverBox.hidden;
    if (!recoverBox.hidden) recoverInput?.focus();
  });

  recoverButton?.addEventListener("click", async () => {
    const key = String(recoverInput?.value || "").trim().toUpperCase();
    if (!isLonerLicenseKey(key)) {
      recoverStatus.textContent = "Enter the LC-ROK key issued for your PayPal purchase.";
      recoverStatus.style.color = "#ffb4b4";
      return;
    }
    recoverButton.disabled = true;
    recoverStatus.textContent = "Recovering PayPal purchase access...";
    recoverStatus.style.color = "var(--muted)";
    try {
      const result = await recoverPayPalOneTime(key);
      if (!result || result.fulfilled !== true || !result.license_key) {
        throw new Error((result && result.reason) || "PayPal access could not be recovered.");
      }
      recoverStatus.textContent = "PayPal purchase access recovered.";
      showPayPalOneTimeFulfillment(result);
    } catch (error) {
      recoverStatus.textContent = error && error.message ? error.message : "PayPal access recovery failed.";
      recoverStatus.style.color = "#ffb4b4";
    } finally {
      recoverButton.disabled = false;
    }
  });

  manualToggle?.addEventListener("click", () => {
    manualBox.hidden = !manualBox.hidden;
    if (!manualBox.hidden) manualTx?.focus();
  });

  manualVerify?.addEventListener("click", async () => {
    const tx = String(manualTx?.value || "").trim();
    const renewKey = String(manualRenewKey?.value || "").trim().toUpperCase();
    if (!tx) {
      manualStatus.textContent = "Enter the PayPal Transaction ID first.";
      manualStatus.style.color = "#ffb4b4";
      return;
    }
    if (renewKey && !isLonerLicenseKey(renewKey)) {
      manualStatus.textContent = "The renewal LC-ROK key is not valid.";
      manualStatus.style.color = "#ffb4b4";
      return;
    }
    manualVerify.disabled = true;
    manualStatus.textContent = "Verifying the completed PayPal transaction...";
    manualStatus.style.color = "var(--muted)";
    try {
      const result = await claimPayPalOneTime({ order_id: "", transaction_id: tx, renew_license_key: renewKey });
      if (!result || result.fulfilled !== true || !result.license_key) {
        throw new Error((result && result.reason) || "PayPal payment could not be verified.");
      }
      manualStatus.textContent = "Payment verified. Your license and download are ready.";
      clearPendingPayPalRenewal();
      showPayPalOneTimeFulfillment(result);
    } catch (error) {
      manualStatus.textContent = error && error.message ? error.message : "PayPal verification failed.";
      manualStatus.style.color = "#ffb4b4";
    } finally {
      manualVerify.disabled = false;
    }
  });

  const approvedOrder = getApprovedPayPalOrder();
  if (approvedOrder) {
    status.textContent = "An approved PayPal order is waiting for verification. Retrying now — do not pay again.";
    void finalizeApprovedOrder(approvedOrder);
  }
}

function showPayPalOneTimeFulfillment(result) {
  if (!result || result.fulfilled !== true) return;
  const title = result.renewed
    ? "PayPal renewal verified — your existing license was extended by 30 days."
    : "PayPal payment verified — your license is ready.";
  showFulfillment(result, {
    title,
    freshDownload: () => {
      if (result.order_id) {
        return claimPayPalOneTime({ order_id: result.order_id, transaction_id: "", renew_license_key: "" });
      }
      return claimPayPalOneTime({ order_id: "", transaction_id: result.transaction_id || "", renew_license_key: "" });
    }
  });
}

function setupPayPalOneTimeReturnRecovery() {
  if (!PAYPAL_ONE_TIME_RETURN_MODE) return;

  const token = String(
    pageParams.get("token") || pageParams.get("order_id") || pageParams.get("orderID") || ""
  ).trim();
  const txFromUrl = String(pageParams.get("transaction_id") || pageParams.get("tx") || "").trim();
  const pendingRenewalKey = getPendingPayPalRenewal();

  const panel = document.createElement("div");
  panel.id = "paypal-one-time-return-panel";
  panel.style.marginTop = "18px";
  panel.style.padding = "16px";
  panel.style.border = "1px solid var(--line)";
  panel.style.borderRadius = "14px";
  panel.style.background = "rgba(255,255,255,.025)";
  panel.innerHTML = `
    <p style="margin:0 0 10px;"><strong>PayPal payment received</strong></p>
    <p id="paypal-one-time-status" style="margin:0;color:var(--muted);font-size:13px;line-height:1.5;"></p>
    <div id="paypal-one-time-fallback" hidden style="margin-top:12px;">
      <p style="margin:0 0 8px;color:var(--muted);font-size:13px;line-height:1.5;">
        If PayPal did not return the order automatically, enter the Transaction ID from your PayPal receipt or Activity. If this payment was a renewal, also enter the existing LC-ROK key.
      </p>
      <div class="whop-recovery-row">
        <input id="paypal-one-time-transaction" type="text" autocomplete="off" spellcheck="false" placeholder="PayPal Transaction ID" aria-label="PayPal Transaction ID"/>
      </div>
      <div class="whop-recovery-row" style="margin-top:8px;">
        <input id="paypal-one-time-renew-key" type="text" autocomplete="off" spellcheck="false" placeholder="Existing LC-ROK key (renewals only)" aria-label="Existing renewal license key"/>
        <button class="btn btn-secondary" id="paypal-one-time-claim-button" type="button">Verify Payment</button>
      </div>
    </div>`;
  whopPanel?.insertAdjacentElement("afterend", panel);

  const status = panel.querySelector("#paypal-one-time-status");
  const fallback = panel.querySelector("#paypal-one-time-fallback");
  const txInput = panel.querySelector("#paypal-one-time-transaction");
  const renewInput = panel.querySelector("#paypal-one-time-renew-key");
  const claimButton = panel.querySelector("#paypal-one-time-claim-button");
  if (renewInput && pendingRenewalKey) renewInput.value = pendingRenewalKey;

  const setStatus = (text, error = false) => {
    status.textContent = String(text || "");
    status.style.color = error ? "#ffb4b4" : "var(--muted)";
  };

  const claim = async (payload) => {
    setStatus(pendingRenewalKey
      ? "Verifying your PayPal renewal and extending the existing license..."
      : "Verifying the completed PayPal payment and preparing your license...");
    try {
      const result = await claimPayPalOneTime(payload);
      if (result && result.fulfilled === true && result.license_key) {
        setStatus(result.renewed
          ? "PayPal renewal verified. The same license key has been extended by 30 days."
          : "PayPal payment verified. Your 30-day license is ready.");
        fallback.hidden = true;
        clearPendingPayPalRenewal();
        showPayPalOneTimeFulfillment(result);
        window.history.replaceState(null, "", `${window.location.pathname}#subscribe`);
        return true;
      }
      throw new Error((result && result.reason) || "PayPal payment is still processing.");
    } catch (error) {
      setStatus(error && error.message ? error.message : "PayPal payment verification failed.", true);
      fallback.hidden = false;
      return false;
    }
  };

  claimButton?.addEventListener("click", () => {
    const value = String(txInput?.value || "").trim();
    const renewKey = String(renewInput?.value || "").trim().toUpperCase();
    if (!value) {
      setStatus("Enter the PayPal Transaction ID first.", true);
      return;
    }
    if (renewKey && !isLonerLicenseKey(renewKey)) {
      setStatus("The renewal LC-ROK key is not valid.", true);
      return;
    }
    claim({ order_id: "", transaction_id: value, renew_license_key: renewKey });
  });

  if (token || txFromUrl) {
    claim(token
      ? { order_id: token, transaction_id: "", renew_license_key: pendingRenewalKey }
      : { order_id: "", transaction_id: txFromUrl, renew_license_key: pendingRenewalKey });
  } else {
    setStatus("PayPal returned you to Loner's Corner, but the order reference was not included. Use the fallback below — do not pay again.", true);
    fallback.hidden = false;
  }
}

setupPublicPayPalOrdersCheckout().catch((error) => {
  console.error("PayPal Orders checkout startup error:", error);
});
setupPayPalOneTimeReturnRecovery();

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function completeWhopPurchase() {
  if (!whopReturnMode) return;

  const claimToken = getWhopClaimToken();
  if (claimToken.length < 32) {
    setWhopStatus([
      {
        text: "The payment return was received, but this browser tab no longer has the secure checkout claim.",
        strong: true
      },
      {
        text: "If you completed payment, do not pay again. Use Recover existing purchase below with your LC-ROK license key."
      }
    ]);
    showRecoveryPanel("Your payment is not lost. Enter your LC-ROK license key to recover the license and a fresh private download link.");
    return;
  }

  setWhopStatus([
    { text: "Whop returned you to Loner's Corner.", strong: true },
    { text: "Confirming the payment and preparing your license..." }
  ]);

  // Keep automatic retries below the server's per-claim rate limit. A signed
  // payment webhook can arrive a few seconds after the browser redirect.
  const retryDelays = [0, 1800, 2800, 3800, 5000];
  let lastResult = null;
  let lastError = null;

  for (let index = 0; index < retryDelays.length; index += 1) {
    if (retryDelays[index] > 0) await delay(retryDelays[index]);

    try {
      const result = await claimWhopLicense(claimToken);
      lastResult = result;
      lastError = null;

      if (result && result.fulfilled === true && result.license_key) {
        showFulfillment(result);
        // IMPORTANT: keep the claim token in sessionStorage so a normal refresh
        // can restore the same verified purchase and mint a fresh R2 URL.
        setWhopStatus([
          { text: "Whop payment verified successfully.", strong: true },
          { text: "Your license and private download access are ready below." }
        ]);

        window.history.replaceState(null, "", `${window.location.pathname}#subscribe`);
        return;
      }

      if (result && result.pending === false) {
        setWhopStatus([
          { text: "Whop checkout could not be fulfilled.", strong: true },
          { text: result.reason || "Please contact Loner's Corner support before paying again." }
        ]);
        showRecoveryPanel();
        return;
      }

      setWhopStatus([
        { text: "Payment confirmation is still processing.", strong: true },
        { text: `Secure verification attempt ${index + 1} of ${retryDelays.length}...` }
      ]);
    } catch (error) {
      lastError = error;
    }
  }

  setWhopStatus([
    { text: "Whop payment verification is still pending.", strong: true },
    {
      text:
        (lastResult && lastResult.reason) ||
        (lastError && lastError.message) ||
        "Please wait a minute and refresh this same browser tab. Do not submit another payment."
    }
  ]);
}

async function restoreWhopPurchaseFromSession() {
  if (whopReturnMode) return;

  const claimToken = getWhopClaimToken();
  if (claimToken.length < 32) return;

  setWhopStatus([
    { text: "Restoring your verified Whop purchase...", strong: true },
    { text: "Checking the saved secure checkout claim in this browser tab." }
  ]);

  try {
    const result = await claimWhopLicense(claimToken);
    if (result && result.fulfilled === true && result.license_key) {
      showFulfillment(result);
      setWhopStatus([
        { text: "Verified purchase restored.", strong: true },
        { text: "Your license and private download access are ready below." }
      ]);
      return;
    }

    if (result && result.pending === true) {
      setWhopStatus([
        { text: "Your Whop payment is still processing.", strong: true },
        { text: result.reason || "Please refresh this page again shortly. Do not pay again." }
      ]);
      return;
    }

    setWhopStatus([
      { text: "Saved purchase access could not be restored.", strong: true },
      { text: (result && result.reason) || "Use Recover existing purchase below." }
    ]);
    showRecoveryPanel();
  } catch (error) {
    console.error("Whop session restore error:", error);
    setWhopStatus([
      { text: "Saved purchase access could not be restored right now.", strong: true },
      { text: error && error.message ? error.message : "Please try again shortly." }
    ]);
    showRecoveryPanel();
  }
}

async function handleWhopRecovery() {
  const licenseKey = String(whopRecoveryKey?.value || "").trim().toUpperCase();
  if (!isLonerLicenseKey(licenseKey)) {
    setRecoveryStatus("Enter the LC-ROK license key issued by Loner's Corner.", true);
    whopRecoveryKey?.focus();
    return;
  }

  if (whopRecoveryButton) whopRecoveryButton.disabled = true;
  setRecoveryStatus("Verifying the license and preparing a fresh private download link...");

  try {
    const result = await recoverWhopLicense(licenseKey);
    if (!result || result.fulfilled !== true || !result.license_key) {
      throw new Error(
        (result && result.reason) || "This purchase could not be recovered."
      );
    }

    showFulfillment(result);
    setWhopStatus([
      { text: "Existing Whop purchase recovered successfully.", strong: true },
      { text: "Your license and private download access are ready below." }
    ]);
    setRecoveryStatus("");
  } catch (error) {
    console.error("Whop license recovery error:", error);
    setRecoveryStatus(
      error && error.message
        ? error.message
        : "The purchase could not be recovered. Please contact Loner's Corner support.",
      true
    );
  } finally {
    if (whopRecoveryButton) whopRecoveryButton.disabled = false;
  }
}

if (whopPanel) {
  whopPanel.hidden = false;

  if (checkoutProviderCopy) {
    checkoutProviderCopy.textContent = PAYPAL_PUBLIC_ENABLED
      ? "One Windows PC license. Choose automatic monthly billing with Whop or a one-time 30-day payment with PayPal."
      : "$50.00 USD every month. Secure checkout is processed through Whop.";
  }

  if (checkoutFulfillmentNote) {
    checkoutFulfillmentNote.textContent = PAYPAL_PUBLIC_ENABLED
      ? "After payment is confirmed, the licensing server verifies the purchase and provides your license key and private download access."
      : "After Whop confirms payment, the licensing server verifies the subscription and provides your license key and private download access.";
  }
}

whopRecoveryToggle?.addEventListener("click", () => {
  if (!whopRecovery) return;
  whopRecovery.hidden = !whopRecovery.hidden;
  if (!whopRecovery.hidden) whopRecoveryKey?.focus();
});

whopRecoveryButton?.addEventListener("click", handleWhopRecovery);
whopRecoveryKey?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    handleWhopRecovery();
  }
});

if (whopButton) {
  whopButton.addEventListener("click", async () => {
    if (!agreement || !agreement.checked) {
      setWhopStatus([
        {
          text: "Please agree to the Subscription, Cancellation & Refund Policy and Terms before checkout.",
          strong: true
        }
      ]);
      agreement?.focus();
      return;
    }

    if (!whopStorageAvailable()) {
      setWhopStatus([
        { text: "Secure browser session storage is unavailable.", strong: true },
        { text: "Please enable site storage or use a normal browser window before checkout." }
      ]);
      return;
    }

    // If this tab already owns a verified claim, restore it instead of creating
    // another checkout and risking a duplicate subscription/payment.
    const existingClaim = getWhopClaimToken();
    if (existingClaim.length >= 32) {
      try {
        const existing = await claimWhopLicense(existingClaim);
        if (existing && existing.fulfilled === true && existing.license_key) {
          showFulfillment(existing);
          setWhopStatus([
            { text: "You already have a verified purchase in this browser tab.", strong: true },
            { text: "Your license and private download access are ready below." }
          ]);
          return;
        }
      } catch (error) {
        console.warn("Existing Whop claim check failed before checkout:", error);
      }
    }

    whopButton.disabled = true;
    setWhopStatus("Creating your secure Whop checkout...");

    try {
      clearWhopClaimToken();
      const checkout = await createWhopCheckout();
      storeWhopClaimToken(checkout.claimToken);
      setWhopStatus("Opening secure Whop checkout...");
      window.location.assign(checkout.checkoutUrl);
    } catch (error) {
      console.error("Whop checkout error:", error);
      clearWhopClaimToken();
      setWhopStatus([
        { text: "Whop checkout could not be opened.", strong: true },
        {
          text:
            error && error.message
              ? error.message
              : "Please try again or contact Loner's Corner support."
        }
      ]);
      whopButton.disabled = false;
    }
  });
}

if (whopReturnMode) {
  document.getElementById("subscribe")?.scrollIntoView({ behavior: "smooth", block: "start" });
  completeWhopPurchase().catch((error) => {
    console.error("Whop return fulfillment error:", error);
    setWhopStatus([
      { text: "Whop payment verification could not be completed.", strong: true },
      { text: "Please wait a minute and refresh this same browser tab. Do not submit another payment." }
    ]);
    showRecoveryPanel();
  });
} else {
  restoreWhopPurchaseFromSession().catch((error) => {
    console.error("Whop restore startup error:", error);
  });
}

const year = document.getElementById("year");
if (year) year.textContent = new Date().getFullYear();

const menuBtn = document.querySelector(".menu-btn");
const nav = document.getElementById("nav-links");

menuBtn?.addEventListener("click", () => {
  const isOpen = nav?.classList.toggle("open") || false;
  menuBtn.setAttribute("aria-expanded", String(isOpen));
});

nav?.querySelectorAll("a").forEach((a) =>
  a.addEventListener("click", () => {
    nav.classList.remove("open");
    menuBtn?.setAttribute("aria-expanded", "false");
  })
);

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 }
);

document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));

const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightbox-img");
const lightboxTitle = document.getElementById("lightbox-title");

document.querySelectorAll(".gallery-card").forEach((card) => {
  card.addEventListener("click", () => {
    if (!lightbox || !lightboxImg || !lightboxTitle) return;

    lightboxImg.src = card.dataset.img || "";
    lightboxImg.alt = card.dataset.title || "";
    lightboxTitle.textContent = card.dataset.title || "";
    lightbox.showModal();
  });
});

document
  .querySelector(".lightbox-close")
  ?.addEventListener("click", () => lightbox?.close());

lightbox?.addEventListener("click", (event) => {
  if (event.target === lightbox) lightbox.close();
});
