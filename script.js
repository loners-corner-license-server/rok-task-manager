// Replace these two placeholders with your real links before publishing.
const LINKS = {
  whop: "https://whop.com/dashboard/biz_fTrL3E41mP7hru/",
  discord: "https://discord.gg/bmzc7x5ZA"
};

document.querySelectorAll('.js-whop-link').forEach(a => {
  a.href = LINKS.whop;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
});

document.querySelectorAll('.js-discord-link').forEach(a => {
  a.href = LINKS.discord;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
});

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
