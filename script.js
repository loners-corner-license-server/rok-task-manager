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
const PAYPAL_VERIFY_URL =
  "https://loners-corner-license-server.onrender.com/paypal/verify-subscription";
const paypalStatus = document.getElementById('paypal-subscription-status');

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
    } else {
      row.textContent = line.text;
    }

    paypalStatus.appendChild(row);

    if (index < lines.length - 1) {
      paypalStatus.appendChild(document.createElement('br'));
    }
  });
}

async function verifyPayPalSubscription(subscriptionID) {
  const response = await fetch(PAYPAL_VERIFY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      subscription_id: subscriptionID
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
      'The licensing server could not verify the subscription.'
    );
  }

  return result;
}

if (window.paypal && document.getElementById(`paypal-button-container-${PAYPAL_PLAN_ID}`)) {
  paypal.Buttons({
    style: {
      shape: 'pill',
      color: 'gold',
      layout: 'vertical',
      label: 'subscribe'
    },
    createSubscription: function(data, actions) {
      if (paypalStatus) {
        paypalStatus.textContent = 'Opening PayPal Sandbox checkout...';
      }

      return actions.subscription.create({
        plan_id: PAYPAL_PLAN_ID
      });
    },
    onApprove: async function(data) {
      const subscriptionID = String(data.subscriptionID || '').trim();

      if (!subscriptionID) {
        setPayPalStatus([
          {
            text: 'PayPal approved the checkout, but no subscription ID was returned.',
            strong: true
          }
        ]);
        return;
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
          text: 'Verifying subscription directly with the licensing server...'
        }
      ]);

      try {
        const result = await verifyPayPalSubscription(subscriptionID);

        if (
          result &&
          result.verified === true &&
          result.subscription_id === subscriptionID &&
          result.status === 'ACTIVE' &&
          result.plan_id === PAYPAL_PLAN_ID
        ) {
          setPayPalStatus([
            {
              text: 'Sandbox payment verification successful.',
              strong: true
            },
            {
              prefix: 'Subscription ID: ',
              text: subscriptionID,
              code: true
            },
            {
              text: 'PayPal confirmed this is the active ROK Task Manager Monthly plan.'
            },
            {
              text: 'License creation and private download delivery will be connected next.'
            }
          ]);
          return;
        }

        setPayPalStatus([
          {
            text: 'Subscription could not be verified.',
            strong: true
          },
          {
            prefix: 'Subscription ID: ',
            text: subscriptionID,
            code: true
          },
          {
            text:
              (result && result.reason) ||
              'The subscription is not active or does not match this product plan.'
          }
        ]);
      } catch (error) {
        console.error('PayPal server verification error:', error);

        setPayPalStatus([
          {
            text: 'PayPal checkout was approved, but server verification failed.',
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
