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
// Enabled only with ?paypalbuytest=1. The normal public page remains Whop-only.
// This is a LIVE $50.00 USD one-time PayPal checkout. The hosted button ID and
// client ID are public browser identifiers; no PayPal secret is stored here.
const PAYPAL_BUY_TEST_MODE = pageParams.get("paypalbuytest") === "1";
const PAYPAL_HOSTED_CLIENT_ID =
  "BAA_AuZKrPiywBR6mlKzE8Plni5gHF_ivKqs1ZIiVE7alZ1xdGqytzR1br1eooOhZKxr5AgK59FZcVnrwM";
const PAYPAL_HOSTED_BUTTON_ID = "U9JKAPLL78JQW";

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

function setPayPalHostedStatus(container, lines) {
  if (!container) return;
  container.replaceChildren();
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
    container.appendChild(row);
    if (index < rows.length - 1) container.appendChild(document.createElement("br"));
  });
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

  const heading = document.createElement("p");
  heading.style.margin = "0 0 10px";
  const strong = document.createElement("strong");
  strong.textContent = "Private PayPal LIVE one-time payment test";
  heading.appendChild(strong);
  panel.appendChild(heading);

  const explanation = document.createElement("p");
  explanation.style.margin = "0 0 10px";
  explanation.style.fontSize = "13px";
  explanation.style.lineHeight = "1.5";
  explanation.textContent =
    "This is PayPal's hosted $50.00 USD one-time checkout. Whop remains unchanged and continues to handle the normal monthly subscription option.";
  panel.appendChild(explanation);

  const warning = document.createElement("p");
  warning.style.margin = "0 0 14px";
  warning.style.color = "#ffcf80";
  warning.style.fontSize = "13px";
  warning.style.lineHeight = "1.5";
  warning.textContent =
    "LIVE TEST: opening checkout is safe, but do not complete payment yet. A completed checkout would charge real money, and automatic Loner's Corner license fulfillment is not connected to this one-time button yet.";
  panel.appendChild(warning);

  const agreementNote = document.createElement("p");
  agreementNote.style.margin = "0 0 12px";
  agreementNote.style.fontSize = "13px";
  agreementNote.style.color = "var(--muted)";
  agreementNote.textContent =
    "For this private test, first tick the Terms/Refund Policy agreement above. The PayPal button will then appear.";
  panel.appendChild(agreementNote);

  const buttonContainer = document.createElement("div");
  buttonContainer.id = `paypal-container-${PAYPAL_HOSTED_BUTTON_ID}`;
  buttonContainer.hidden = true;
  panel.appendChild(buttonContainer);

  const status = document.createElement("div");
  status.id = "paypal-hosted-test-status";
  status.style.marginTop = "12px";
  status.style.color = "var(--muted)";
  status.style.fontSize = "13px";
  status.style.lineHeight = "1.5";
  panel.appendChild(status);

  whopPanel.insertAdjacentElement("afterend", panel);

  if (checkoutProviderCopy) {
    checkoutProviderCopy.textContent =
      "$50.00 USD every month through Whop. A private PayPal one-time $50.00 USD checkout test is also enabled on this page.";
  }

  const updateVisibility = () => {
    const allowed = Boolean(agreement && agreement.checked);
    buttonContainer.hidden = !allowed;
    if (!allowed) {
      setPayPalHostedStatus(status, "Agree to the terms above to reveal the private PayPal test button.");
    } else {
      setPayPalHostedStatus(status, "PayPal button ready. Open checkout only; do not complete payment yet.");
    }
  };

  agreement?.addEventListener("change", updateVisibility);
  updateVisibility();

  try {
    const paypalSdk = await loadPayPalHostedButtonSdk();
    if (!paypalSdk || typeof paypalSdk.HostedButtons !== "function") {
      throw new Error("PayPal Hosted Buttons are unavailable in this browser.");
    }

    paypalSdk.HostedButtons({
      hostedButtonId: PAYPAL_HOSTED_BUTTON_ID
    }).render(`#paypal-container-${PAYPAL_HOSTED_BUTTON_ID}`);
  } catch (error) {
    console.error("PayPal Hosted Button setup error:", error);
    buttonContainer.hidden = false;
    setPayPalHostedStatus(status, [
      { text: "PayPal LIVE one-time test could not be loaded.", strong: true },
      { text: error && error.message ? error.message : "Please refresh and try again." }
    ]);
  }
}

setupPrivatePayPalHostedButtonTest().catch((error) => {
  console.error("Private PayPal Hosted Button test startup error:", error);
});

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
