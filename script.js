// ROK Task Manager website - production browser code.
// Public browser identifiers only. No PayPal secret or server secret is stored here.

const LINKS = {
  discord: "https://discord.gg/bmzc7x5ZA"
};

document.querySelectorAll(".js-discord-link").forEach((a) => {
  a.href = LINKS.discord;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
});

const PAYPAL_PLAN_ID = "P-1SL81894FA907780YNKTKVGI";
const PAYPAL_CLAIM_URL =
  "https://loners-corner-license-server.onrender.com/paypal/claim-license";

const paypalStatus = document.getElementById("paypal-subscription-status");
const paypalResult = document.getElementById("paypal-fulfillment-result");
const agreement = document.getElementById("checkout-agreement");
let activeClaimToken = null;

function setPayPalStatus(lines) {
  if (!paypalStatus) return;

  paypalStatus.replaceChildren();
  const rows = Array.isArray(lines) ? lines : [{ text: String(lines || "") }];

  rows.forEach((line, index) => {
    const row = document.createElement("div");

    if (line.strong) {
      const strong = document.createElement("strong");
      strong.textContent = line.text;
      row.appendChild(strong);
    } else if (line.code) {
      row.append(document.createTextNode(line.prefix || ""));
      const code = document.createElement("code");
      code.textContent = line.text;
      row.appendChild(code);
    } else {
      row.textContent = line.text;
    }

    paypalStatus.appendChild(row);

    if (index < rows.length - 1) {
      paypalStatus.appendChild(document.createElement("br"));
    }
  });
}

function createClaimToken() {
  if (!window.crypto || !window.crypto.getRandomValues) {
    throw new Error("Secure browser random generation is unavailable.");
  }

  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function claimPayPalLicense(subscriptionID, claimToken) {
  const response = await fetch(PAYPAL_CLAIM_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subscription_id: subscriptionID,
      claim_token: claimToken
    })
  });

  let result = null;

  try {
    result = await response.json();
  } catch (error) {
    throw new Error("The licensing server returned an unreadable response.");
  }

  if (!response.ok) {
    throw new Error(
      (result && (result.detail || result.reason)) ||
        "The licensing server could not fulfill this subscription."
    );
  }

  return result;
}

function showFulfillment(result) {
  if (!paypalResult) return;

  paypalResult.replaceChildren();
  paypalResult.classList.remove("visible");

  if (!result || result.fulfilled !== true || !result.license_key) return;

  const title = document.createElement("strong");
  title.textContent = "Subscription verified — your license is ready.";
  paypalResult.appendChild(title);

  const key = document.createElement("div");
  key.className = "paypal-license-key";
  key.textContent = result.license_key;
  paypalResult.appendChild(key);

  const actions = document.createElement("div");
  actions.className = "paypal-result-actions";

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

  if (result.download_url) {
    const download = document.createElement("a");
    download.className = "btn btn-primary";
    download.href = result.download_url;
    download.target = "_blank";
    download.rel = "noopener noreferrer";
    download.textContent = "Download ROK Task Manager";
    actions.appendChild(download);
  }

  paypalResult.appendChild(actions);

  if (result.download_error) {
    const note = document.createElement("p");
    note.style.marginBottom = "0";
    note.style.color = "var(--muted)";
    note.textContent = result.download_error;
    paypalResult.appendChild(note);
  }

  paypalResult.classList.add("visible");
}

const paypalContainer = document.getElementById(
  `paypal-button-container-${PAYPAL_PLAN_ID}`
);

if (window.paypal && paypalContainer) {
  paypal.Buttons({
    style: {
      shape: "pill",
      color: "gold",
      layout: "vertical",
      label: "subscribe"
    },

    onClick: function (data, actions) {
      if (!agreement || !agreement.checked) {
        setPayPalStatus([
          {
            text:
              "Please agree to the Subscription, Cancellation & Refund Policy and Terms before checkout.",
            strong: true
          }
        ]);
        agreement?.focus();
        return actions.reject();
      }

      setPayPalStatus("");
      return actions.resolve();
    },

    createSubscription: function (data, actions) {
      activeClaimToken = createClaimToken();
      setPayPalStatus("Opening secure PayPal checkout...");

      return actions.subscription.create({
        plan_id: PAYPAL_PLAN_ID,
        custom_id: activeClaimToken
      });
    },

    onApprove: async function (data) {
      const subscriptionID = String(data.subscriptionID || "").trim();
      const claimToken = String(activeClaimToken || "").trim();

      if (!subscriptionID || claimToken.length < 32) {
        setPayPalStatus([
          {
            text:
              "PayPal approved the checkout, but the secure fulfillment information is incomplete.",
            strong: true
          },
          {
            text:
              "Please contact Loner's Corner support before attempting another payment."
          }
        ]);
        return;
      }

      setPayPalStatus([
        { text: "PayPal approved the subscription.", strong: true },
        { prefix: "Subscription ID: ", text: subscriptionID, code: true },
        { text: "Verifying the subscription and preparing your license..." }
      ]);

      try {
        const result = await claimPayPalLicense(subscriptionID, claimToken);

        if (result && result.fulfilled === true) {
          setPayPalStatus([
            { text: "Payment verified successfully.", strong: true },
            { prefix: "Subscription ID: ", text: subscriptionID, code: true },
            { text: "Your license and private download access are ready below." }
          ]);

          showFulfillment(result);
          activeClaimToken = null;
          return;
        }

        setPayPalStatus([
          { text: "The subscription could not be fulfilled yet.", strong: true },
          {
            text:
              (result && result.reason) ||
              "Please contact Loner's Corner support with your PayPal subscription ID."
          }
        ]);
      } catch (error) {
        console.error("PayPal fulfillment error:", error);

        setPayPalStatus([
          {
            text:
              "PayPal checkout was approved, but license fulfillment could not be completed.",
            strong: true
          },
          { prefix: "Subscription ID: ", text: subscriptionID, code: true },
          {
            text:
              error && error.message
                ? error.message
                : "Please contact Loner's Corner support."
          }
        ]);
      }
    },

    onCancel: function () {
      activeClaimToken = null;
      setPayPalStatus("PayPal checkout was cancelled.");
    },

    onError: function (err) {
      activeClaimToken = null;
      console.error("PayPal subscription error:", err);

      setPayPalStatus([
        { text: "PayPal checkout encountered an error.", strong: true },
        {
          text:
            "Please try again. If the PayPal window closes immediately, use a buyer PayPal account rather than the seller account."
        }
      ]);
    }
  })
    .render(`#paypal-button-container-${PAYPAL_PLAN_ID}`)
    .catch((error) => {
      console.error("PayPal button render error:", error);
      setPayPalStatus([
        {
          text: "PayPal checkout could not be loaded. Please refresh the page.",
          strong: true
        }
      ]);
    });
} else if (paypalContainer) {
  setPayPalStatus([
    {
      text: "PayPal checkout could not be loaded. Please refresh the page.",
      strong: true
    }
  ]);
}


// ----------------------------------------------------------
// Private Whop checkout integration test
// ----------------------------------------------------------
// The public site remains on its existing PayPal flow unless the page is opened
// with ?whoptest=1 or Whop redirects the buyer back with ?whop=complete.
// The one-time Whop claim token is kept only in sessionStorage for this browser
// tab. It is never placed in a URL or sent anywhere except the licensing server.
const WHOP_CREATE_CHECKOUT_URL =
  "https://loners-corner-license-server.onrender.com/whop/create-checkout";
const WHOP_CLAIM_LICENSE_URL =
  "https://loners-corner-license-server.onrender.com/whop/claim-license";
const WHOP_CLAIM_STORAGE_KEY = "lc_rok_whop_claim_v1";

const whopPanel = document.getElementById("whop-test-panel");
const whopButton = document.getElementById("whop-checkout-button");
const whopStatus = document.getElementById("whop-checkout-status");
const checkoutProviderCopy = document.getElementById("checkout-provider-copy");
const checkoutFulfillmentNote = document.getElementById("checkout-fulfillment-note");
const pageParams = new URLSearchParams(window.location.search);
const whopTestMode = pageParams.get("whoptest") === "1";
const whopReturnMode = pageParams.get("whop") === "complete";

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

async function claimWhopLicense(claimToken) {
  const response = await fetch(WHOP_CLAIM_LICENSE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ claim_token: claimToken })
  });

  let result = null;
  try {
    result = await response.json();
  } catch (error) {
    throw new Error("The licensing server returned an unreadable fulfillment response.");
  }

  if (!response.ok) {
    throw new Error(
      (result && (result.detail || result.reason)) ||
        "The licensing server could not verify this Whop purchase."
    );
  }

  return result;
}

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
        text: "If you completed payment, do not pay again. Contact Loner's Corner support for assistance."
      }
    ]);
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
        clearWhopClaimToken();
        setWhopStatus([
          { text: "Whop payment verified successfully.", strong: true },
          { text: "Your license and private download access are ready below." }
        ]);

        window.history.replaceState(null, "", `${window.location.pathname}#subscribe`);
        return;
      }

      if (result && result.pending === false) {
        clearWhopClaimToken();
        setWhopStatus([
          { text: "Whop checkout could not be fulfilled.", strong: true },
          { text: result.reason || "Please contact Loner's Corner support before paying again." }
        ]);
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

if ((whopTestMode || whopReturnMode) && whopPanel) {
  whopPanel.hidden = false;

  if (paypalContainer) paypalContainer.hidden = true;
  if (paypalStatus) paypalStatus.hidden = true;

  if (checkoutProviderCopy) {
    checkoutProviderCopy.textContent =
      "$50.00 USD every month. This private test uses secure Whop checkout.";
  }

  if (checkoutFulfillmentNote) {
    checkoutFulfillmentNote.textContent =
      "After Whop confirms payment, the licensing server issues the customer license and private download access.";
  }
}

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
