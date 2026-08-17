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

const systemVisual = document.querySelector('.system-visual');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

if (systemVisual && !reducedMotion.matches) {
  const parallaxLayers = [...systemVisual.querySelectorAll('[data-parallax-depth]')];
  let targetX = 0;
  let targetY = 0;
  let currentX = 0;
  let currentY = 0;
  let parallaxFrame;

  const renderParallax = () => {
    currentX += (targetX - currentX) * 0.075;
    currentY += (targetY - currentY) * 0.075;

    parallaxLayers.forEach((layer) => {
      const depth = Number(layer.dataset.parallaxDepth);
      layer.style.setProperty('--parallax-x', `${(currentX * depth).toFixed(2)}px`);
      layer.style.setProperty('--parallax-y', `${(currentY * depth).toFixed(2)}px`);
    });

    if (Math.abs(targetX - currentX) > 0.01 || Math.abs(targetY - currentY) > 0.01) {
      parallaxFrame = window.requestAnimationFrame(renderParallax);
    } else {
      parallaxFrame = undefined;
    }
  };

  const queueParallax = () => {
    if (!parallaxFrame) parallaxFrame = window.requestAnimationFrame(renderParallax);
  };

  systemVisual.addEventListener('pointermove', (event) => {
    const bounds = systemVisual.getBoundingClientRect();
    targetX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 10;
    targetY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 8;
    queueParallax();
  });

  systemVisual.addEventListener('pointerleave', () => {
    targetX = 0;
    targetY = 0;
    queueParallax();
  });
}
