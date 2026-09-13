// Add your real Discord invite before live publishing. PayPal below is Sandbox-only for now.
const LINKS = {
  discord: "https://discord.gg/REPLACE-WITH-YOUR-INVITE"
};

document.querySelectorAll('.js-discord-link').forEach(a => {
  a.href = LINKS.discord;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
});


// PayPal Sandbox subscription integration.
// Client ID and Plan ID are public browser identifiers; no PayPal secret is stored here.
const PAYPAL_PLAN_ID = "P-9VG75437BF639664ANKSXXQI";
const PAYPAL_CLAIM_URL =
  "https://loners-corner-license-server.onrender.com/paypal/claim-license";
const paypalStatus = document.getElementById('paypal-subscription-status');
const policyConsentCheckbox = document.getElementById('policy-consent-checkbox');

function setPayPalStatus(lines) {
  if (!paypalStatus) return;

  paypalStatus.replaceChildren();

  lines.forEach((line, index) => {
    const row = document.createElement('div');

    if (line.strong) {
      const strong = document.createElement('strong');
      strong.textContent = line.text;
      row.appendChild(strong);
    } else if (line.code) {
      row.append(document.createTextNode(line.prefix || ''));
      const code = document.createElement('code');
      code.textContent = line.text;
      row.appendChild(code);
    } else if (line.link) {
      const link = document.createElement('a');
      link.href = line.href;
      link.textContent = line.text;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.setAttribute('download', '');
      row.appendChild(link);
    } else {
      row.textContent = line.text;
    }

    paypalStatus.appendChild(row);

    if (index < lines.length - 1) {
      paypalStatus.appendChild(document.createElement('br'));
    }
  });
}

function createClaimToken() {
  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

async function claimPayPalLicense(subscriptionID, claimToken) {
  const response = await fetch(PAYPAL_CLAIM_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      subscription_id: subscriptionID,
      claim_token: claimToken
    })
  });

  let result = null;

  try {
    result = await response.json();
  } catch (error) {
    throw new Error('The licensing server returned an unreadable response.');
  }

  if (!response.ok) {
    throw new Error(
      (result && (result.detail || result.reason)) ||
      'The licensing server could not issue the license.'
    );
  }

  return result;
}

if (window.paypal && document.getElementById(`paypal-button-container-${PAYPAL_PLAN_ID}`)) {
  let activeClaimToken = null;

  paypal.Buttons({
    style: {
      shape: 'pill',
      color: 'gold',
      layout: 'vertical',
      label: 'subscribe'
    },
    onClick: function(data, actions) {
      if (!policyConsentCheckbox || !policyConsentCheckbox.checked) {
        setPayPalStatus([
          {
            text: 'Please agree to the Subscription, Cancellation & Refund Policy and Terms before checkout.',
            strong: true
          }
        ]);
        policyConsentCheckbox?.focus();
        return actions.reject();
      }

      return actions.resolve();
    },
    createSubscription: function(data, actions) {
      if (paypalStatus) {
        paypalStatus.textContent = 'Opening PayPal Sandbox checkout...';
      }

      activeClaimToken = createClaimToken();

      return actions.subscription.create({
        plan_id: PAYPAL_PLAN_ID,
        custom_id: activeClaimToken
      });
    },
    onApprove: async function(data) {
      const subscriptionID = String(data.subscriptionID || '').trim();
      const claimToken = String(activeClaimToken || '').trim();

      if (!subscriptionID || !claimToken) {
        setPayPalStatus([
          {
            text: 'PayPal approved the checkout, but the license claim could not be completed.',
            strong: true
          }
        ]);
        return;
      }

      try {
        window.localStorage.setItem(
          `rok-paypal-claim-${subscriptionID}`,
          claimToken
        );
      } catch (error) {
        // The current checkout can still finish even when browser storage is blocked.
      }

      setPayPalStatus([
        {
          text: 'PayPal approved the Sandbox subscription.',
          strong: true
        },
        {
          prefix: 'Subscription ID: ',
          text: subscriptionID,
          code: true
        },
        {
          text: 'Verifying payment and creating your license...'
        }
      ]);

      try {
        const result = await claimPayPalLicense(subscriptionID, claimToken);

        if (result && result.fulfilled === true && result.license_key) {
          const statusLines = [
            {
              text: 'Sandbox payment verified — license created.',
              strong: true
            },
            {
              prefix: 'Subscription ID: ',
              text: subscriptionID,
              code: true
            },
            {
              prefix: 'Your license key: ',
              text: result.license_key,
              code: true
            }
          ];

          if (result.download_url) {
            const minutes = Math.max(1, Math.floor((result.download_expires_in || 900) / 60));
            statusLines.push({
              text: `Download ROK Task Manager v1.0.1 — link expires in ${minutes} minutes`,
              href: result.download_url,
              link: true
            });
            statusLines.push({
              text: 'Keep your license key. The private download link is temporary and is issued only after server-side PayPal verification.'
            });
          } else {
            statusLines.push({
              text: result.download_error || 'Your license was created, but the private download is temporarily unavailable.'
            });
          }

          setPayPalStatus(statusLines);
          return;
        }

        setPayPalStatus([
          {
            text: 'The subscription was approved, but a license was not issued.',
            strong: true
          },
          {
            text:
              (result && result.reason) ||
              'Please contact support if the problem continues.'
          }
        ]);
      } catch (error) {
        console.error('PayPal license fulfillment error:', error);

        setPayPalStatus([
          {
            text: 'PayPal checkout was approved, but license creation failed.',
            strong: true
          },
          {
            prefix: 'Subscription ID: ',
            text: subscriptionID,
            code: true
          },
          {
            text: 'Please try again or contact support if the problem continues.'
          }
        ]);
      }
    },
    onCancel: function() {
      if (paypalStatus) {
        paypalStatus.textContent = 'PayPal checkout was cancelled.';
      }
    },
    onError: function(err) {
      console.error('PayPal subscription error:', err);

      if (paypalStatus) {
        paypalStatus.textContent =
          'PayPal Sandbox checkout encountered an error. Please try again.';
      }
    }
  }).render(`#paypal-button-container-${PAYPAL_PLAN_ID}`);
}

document.getElementById('year').textContent = new Date().getFullYear();

const menuBtn = document.querySelector('.menu-btn');
const nav = document.getElementById('nav-links');
menuBtn?.addEventListener('click', () => {
  const isOpen = nav.classList.toggle('open');
  menuBtn.setAttribute('aria-expanded', String(isOpen));
});
nav?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
  nav.classList.remove('open');
  menuBtn?.setAttribute('aria-expanded', 'false');
}));

const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxTitle = document.getElementById('lightbox-title');

document.querySelectorAll('.gallery-card').forEach(card => {
  card.addEventListener('click', () => {
    lightboxImg.src = card.dataset.img;
    lightboxImg.alt = card.dataset.title;
    lightboxTitle.textContent = card.dataset.title;
    lightbox.showModal();
  });
});

document.querySelector('.lightbox-close')?.addEventListener('click', () => lightbox.close());
lightbox?.addEventListener('click', e => {
  if (e.target === lightbox) lightbox.close();
});
