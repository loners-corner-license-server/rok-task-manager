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
