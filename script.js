const bootScreen = document.querySelector('.boot-screen');
const menuButton = document.querySelector('.menu-toggle');
const mobileNav = document.querySelector('.mobile-nav');
const navLinks = document.querySelectorAll('.desktop-nav a, .mobile-nav a');
const revealElements = document.querySelectorAll('.reveal');

window.addEventListener('load', () => {
  if (bootScreen) window.setTimeout(() => bootScreen.classList.add('done'), 650);
});

if (menuButton && mobileNav) {
  menuButton.addEventListener('click', () => {
    const open = mobileNav.classList.toggle('open');
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.textContent = open ? 'Close' : 'Menu';
  });
}

navLinks.forEach((link) => {
  link.addEventListener('click', () => {
    mobileNav?.classList.remove('open');
    if (menuButton) {
      menuButton.setAttribute('aria-expanded', 'false');
      menuButton.textContent = 'Menu';
    }
  });
});

if ('IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  revealElements.forEach((element) => revealObserver.observe(element));
} else {
  revealElements.forEach((element) => element.classList.add('visible'));
}

const sections = document.querySelectorAll('section[id], header[id]');
const localDesktopLinks = document.querySelectorAll('.desktop-nav a[href^="#"]');
if ('IntersectionObserver' in window && localDesktopLinks.length) {
  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      localDesktopLinks.forEach((link) => {
        link.classList.toggle('active', link.getAttribute('href') === `#${entry.target.id}`);
      });
    });
  }, { rootMargin: '-35% 0px -55%', threshold: 0 });

  sections.forEach((section) => sectionObserver.observe(section));
}

const labStack = document.querySelector('.lab-stack');
const shuffleButton = document.querySelector('#shuffle-lab');
if (labStack && shuffleButton) {
  shuffleButton.addEventListener('click', () => {
    const cards = [...labStack.children];
    cards.sort(() => Math.random() - 0.5).forEach((card) => labStack.appendChild(card));
    cards.forEach((card, index) => {
      card.animate(
        [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'translateY(0)' }],
        { duration: 350, delay: index * 55, easing: 'ease-out' }
      );
    });
  });
}
