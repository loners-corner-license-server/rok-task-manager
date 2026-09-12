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
const paypalStatus = document.getElementById('paypal-subscription-status');

if (window.paypal && document.getElementById(`paypal-button-container-${PAYPAL_PLAN_ID}`)) {
  paypal.Buttons({
    style: {
      shape: 'pill',
      color: 'gold',
      layout: 'vertical',
      label: 'subscribe'
    },
    createSubscription: function(data, actions) {
      if (paypalStatus) paypalStatus.textContent = 'Opening PayPal Sandbox checkout...';
      return actions.subscription.create({ plan_id: PAYPAL_PLAN_ID });
    },
    onApprove: function(data) {
      if (paypalStatus) {
        paypalStatus.innerHTML =
          '<strong>Sandbox subscription approved.</strong><br>' +
          'Subscription ID: <code>' + data.subscriptionID + '</code><br>' +
          'Server-side payment verification is the next step before any license or download is released.';
      }
    },
    onCancel: function() {
      if (paypalStatus) paypalStatus.textContent = 'PayPal checkout was cancelled.';
    },
    onError: function(err) {
      console.error('PayPal subscription error:', err);
      if (paypalStatus) paypalStatus.textContent = 'PayPal Sandbox checkout encountered an error. Please try again.';
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
