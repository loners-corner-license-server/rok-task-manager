// ROK Task Manager website - production browser code.
// Public browser code only. No payment-provider or server secrets are stored here.

const LINKS = {
  discord: "https://discord.gg/bmzc7x5ZA"
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
// Private LIVE PayPal one-time Hosted Button test
// ----------------------------------------------------------
// Enabled with ?paypalbuytest=1. The normal public page remains Whop-only.
// PayPal auto-return uses ?paypal=complete after a successful payment.
const PAYPAL_BUY_TEST_MODE = pageParams.get("paypalbuytest") === "1";
const PAYPAL_ONE_TIME_RETURN_MODE = pageParams.get("paypal") === "complete";
const PAYPAL_HOSTED_CLIENT_ID =
  "BAA_AuZKrPiywBR6mlKzE8Plni5gHF_ivKqs1ZIiVE7alZ1xdGqytzR1br1eooOhZKxr5AgK59FZcVnrwM";
const PAYPAL_HOSTED_BUTTON_ID = "U9JKAPLL78JQW";
const PAYPAL_ONE_TIME_CLAIM_URL =
  "https://loners-corner-license-server.onrender.com/paypal/one-time/claim";
const PAYPAL_ONE_TIME_RECOVER_URL =
  "https://loners-corner-license-server.onrender.com/paypal/one-time/recover-license";

function loadPayPalHostedButtonSdk() {
  if (window.paypal && typeof window.paypal.HostedButtons === "function") {
    return Promise.resolve(window.paypal);
  }
  return new Promise((resolve, reject) => {
    const existing = document.getElementById("lc-paypal-hosted-sdk");
    if (existing) {
      existing.addEventListener("load", () => resolve(window.paypal), { once: true });
      existing.addEventListener("error", () => reject(new Error("PayPal checkout could not be loaded.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.id = "lc-paypal-hosted-sdk";
    script.src =
      `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(PAYPAL_HOSTED_CLIENT_ID)}` +
      "&components=hosted-buttons&disable-funding=venmo&currency=USD";
    script.async = true;
    script.onload = () => resolve(window.paypal);
    script.onerror = () => reject(new Error("PayPal checkout could not be loaded."));
    document.head.appendChild(script);
  });
}

async function postPayPalOneTimeJson(url, body, fallbackMessage) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  let result = null;
  try { result = await response.json(); } catch (error) {}
  if (!response.ok) {
    throw new Error((result && (result.detail || result.reason)) || fallbackMessage);
  }
  return result;
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
  title.textContent = "Subscription verified — your license is ready.";
  fulfillmentResult.appendChild(title);

  const key = document.createElement("div");
  key.className = "license-key";
  key.textContent = result.license_key;
  fulfillmentResult.appendChild(key);

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
      setWhopStatus([
        { text: "The private download link could not be refreshed.", strong: true },
        {
          text:
            error && error.message
              ? error.message
              : "Please use Recover existing purchase below or contact Loner's Corner support."
        }
      ]);
      showRecoveryPanel("Enter the LC-ROK license key shown above to recover a fresh download link.");
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


async function setupPrivatePayPalHostedButtonTest() {
  if (!PAYPAL_BUY_TEST_MODE || !whopPanel) return;

  const panel = document.createElement("div");
  panel.id = "paypal-hosted-test-panel";
  panel.style.marginTop = "18px";
  panel.style.padding = "16px";
  panel.style.border = "1px solid var(--line)";
  panel.style.borderRadius = "14px";
  panel.style.background = "rgba(255,255,255,.025)";
  panel.innerHTML = `
    <p style="margin:0 0 10px;"><strong>Private PayPal LIVE one-time payment test</strong></p>
    <p style="margin:0 0 10px;color:var(--muted);font-size:13px;line-height:1.5;">
      PayPal: $50.00 USD one-time payment for 30 days of access. Whop remains the normal $50/month automatic-renewal option.
    </p>
    <p style="margin:0 0 12px;color:#ffcf80;font-size:13px;line-height:1.5;">
      LIVE PAYMENT: clicking Pay in PayPal charges real money. Fulfillment is verified server-side before an LC-ROK license is issued.
    </p>
    <div id="paypal-hosted-button-wrap" hidden>
      <div id="paypal-container-${PAYPAL_HOSTED_BUTTON_ID}"></div>
    </div>
    <div id="paypal-hosted-test-status" style="margin-top:10px;color:var(--muted);font-size:13px;line-height:1.5;"></div>`;
  whopPanel.insertAdjacentElement("afterend", panel);

  const wrap = panel.querySelector("#paypal-hosted-button-wrap");
  const status = panel.querySelector("#paypal-hosted-test-status");
  const update = () => {
    const allowed = Boolean(agreement && agreement.checked);
    wrap.hidden = !allowed;
    status.textContent = allowed
      ? "PayPal button ready. This is a LIVE $50 USD one-time payment."
      : "Agree to the terms above to reveal the private PayPal test button.";
  };
  agreement?.addEventListener("change", update);
  update();

  try {
    const paypalSdk = await loadPayPalHostedButtonSdk();
    if (!paypalSdk || typeof paypalSdk.HostedButtons !== "function") {
      throw new Error("PayPal Hosted Buttons are unavailable in this browser.");
    }
    paypalSdk.HostedButtons({ hostedButtonId: PAYPAL_HOSTED_BUTTON_ID })
      .render(`#paypal-container-${PAYPAL_HOSTED_BUTTON_ID}`);
  } catch (error) {
    console.error("PayPal Hosted Button setup error:", error);
    wrap.hidden = false;
    status.textContent = error && error.message ? error.message : "PayPal checkout could not be loaded.";
  }
}

function showPayPalOneTimeFulfillment(result) {
  if (!result || result.fulfilled !== true) return;
  showFulfillment(result, {
    freshDownload: () => {
      if (result.order_id) {
        return claimPayPalOneTime({ order_id: result.order_id, transaction_id: "" });
      }
      return claimPayPalOneTime({ order_id: "", transaction_id: result.transaction_id || "" });
    }
  });
}

function setupPayPalOneTimeReturnRecovery() {
  if (!PAYPAL_ONE_TIME_RETURN_MODE && !PAYPAL_BUY_TEST_MODE) return;

  const token = String(
    pageParams.get("token") || pageParams.get("order_id") || pageParams.get("orderID") || ""
  ).trim();
  const txFromUrl = String(pageParams.get("transaction_id") || pageParams.get("tx") || "").trim();

  const panel = document.createElement("div");
  panel.id = "paypal-one-time-recovery-panel";
  panel.style.marginTop = "18px";
  panel.style.padding = "16px";
  panel.style.border = "1px solid var(--line)";
  panel.style.borderRadius = "14px";
  panel.style.background = "rgba(255,255,255,.025)";
  panel.innerHTML = `
    <p style="margin:0 0 10px;"><strong>PayPal one-time purchase access</strong></p>
    <p id="paypal-one-time-status" style="margin:0 0 12px;color:var(--muted);font-size:13px;line-height:1.5;"></p>
    <div id="paypal-one-time-manual">
      <p style="margin:0 0 8px;color:var(--muted);font-size:13px;line-height:1.5;">If PayPal did not return the order automatically, enter the PayPal Transaction ID from your receipt or PayPal Activity.</p>
      <div class="whop-recovery-row">
        <input id="paypal-one-time-transaction" type="text" autocomplete="off" spellcheck="false" placeholder="PayPal Transaction ID" aria-label="PayPal Transaction ID"/>
        <button class="btn btn-secondary" id="paypal-one-time-claim-button" type="button">Verify Payment</button>
      </div>
      <p style="margin:14px 0 8px;color:var(--muted);font-size:13px;">Already have an LC-ROK key from PayPal?</p>
      <div class="whop-recovery-row">
        <input id="paypal-one-time-license" type="text" autocomplete="off" spellcheck="false" placeholder="LC-ROK-..." aria-label="PayPal one-time license key"/>
        <button class="btn btn-secondary" id="paypal-one-time-recover-button" type="button">Recover Access</button>
      </div>
    </div>`;

  const target = document.getElementById("paypal-hosted-test-panel") || whopPanel;
  target?.insertAdjacentElement("afterend", panel);
  const status = panel.querySelector("#paypal-one-time-status");
  const manual = panel.querySelector("#paypal-one-time-manual");
  const txInput = panel.querySelector("#paypal-one-time-transaction");
  const claimButton = panel.querySelector("#paypal-one-time-claim-button");
  const licenseInput = panel.querySelector("#paypal-one-time-license");
  const recoverButton = panel.querySelector("#paypal-one-time-recover-button");

  const setStatus = (text, error = false) => {
    status.textContent = String(text || "");
    status.style.color = error ? "#ffb4b4" : "var(--muted)";
  };

  const claim = async (payload) => {
    setStatus("Verifying the completed PayPal payment...");
    try {
      const result = await claimPayPalOneTime(payload);
      if (result && result.fulfilled === true && result.license_key) {
        setStatus("PayPal payment verified. Your 30-day license is ready.");
        manual.hidden = true;
        showPayPalOneTimeFulfillment(result);
        return;
      }
      setStatus((result && result.reason) || "PayPal payment is still processing.", true);
      manual.hidden = false;
    } catch (error) {
      setStatus(error && error.message ? error.message : "PayPal payment verification failed.", true);
      manual.hidden = false;
    }
  };

  claimButton?.addEventListener("click", () => {
    const value = String(txInput?.value || "").trim();
    if (!value) return setStatus("Enter the PayPal Transaction ID first.", true);
    claim({ order_id: "", transaction_id: value });
  });

  recoverButton?.addEventListener("click", async () => {
    const key = String(licenseInput?.value || "").trim().toUpperCase();
    if (!isLonerLicenseKey(key)) return setStatus("Enter the LC-ROK license key issued for the PayPal purchase.", true);
    setStatus("Recovering PayPal purchase access...");
    try {
      const result = await recoverPayPalOneTime(key);
      if (!result || result.fulfilled !== true || !result.license_key) {
        throw new Error((result && result.reason) || "PayPal access could not be recovered.");
      }
      setStatus("PayPal purchase access recovered.");
      showPayPalOneTimeFulfillment(result);
    } catch (error) {
      setStatus(error && error.message ? error.message : "PayPal access recovery failed.", true);
    }
  });

  if (PAYPAL_ONE_TIME_RETURN_MODE && (token || txFromUrl)) {
    claim(token
      ? { order_id: token, transaction_id: "" }
      : { order_id: "", transaction_id: txFromUrl });
  } else if (PAYPAL_ONE_TIME_RETURN_MODE) {
    setStatus("Payment return received. Enter the PayPal Transaction ID if PayPal did not include the order ID automatically.");
  } else {
    setStatus("Recovery tools are available after a completed PayPal one-time purchase.");
  }
}

setupPrivatePayPalHostedButtonTest().catch((error) => {
  console.error("Private PayPal Hosted Button test startup error:", error);
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
    checkoutProviderCopy.textContent =
      "$50.00 USD every month. Secure checkout is processed through Whop.";
  }

  if (checkoutFulfillmentNote) {
    checkoutFulfillmentNote.textContent =
      "After Whop confirms payment, the licensing server verifies the subscription and provides your license key and private download access.";
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
