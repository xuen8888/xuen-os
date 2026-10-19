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

const siteCursor = document.querySelector('.site-cursor');
const cursorRing = siteCursor?.querySelector('.site-cursor__ring');
const cursorDot = siteCursor?.querySelector('.site-cursor__dot');
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

if (siteCursor && cursorRing && cursorDot) {
  let cursorFrame;
  let targetCursorX = window.innerWidth / 2;
  let targetCursorY = window.innerHeight / 2;
  let currentCursorX = targetCursorX;
  let currentCursorY = targetCursorY;

  const cursorEnabled = () => finePointer.matches && !reducedMotion.matches;
  const isNativeCursorTarget = (target) => target instanceof Element && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
  const isInteractiveTarget = (target) => target instanceof Element && Boolean(target.closest('a, button, summary, [role="button"], [data-cursor]'));

  const renderSiteCursor = () => {
    currentCursorX += (targetCursorX - currentCursorX) * 0.16;
    currentCursorY += (targetCursorY - currentCursorY) * 0.16;
    siteCursor.style.transform = `translate3d(${currentCursorX.toFixed(2)}px, ${currentCursorY.toFixed(2)}px, 0)`;
    cursorDot.style.left = `${(targetCursorX - currentCursorX).toFixed(2)}px`;
    cursorDot.style.top = `${(targetCursorY - currentCursorY).toFixed(2)}px`;

    if (Math.abs(targetCursorX - currentCursorX) > 0.05 || Math.abs(targetCursorY - currentCursorY) > 0.05) {
      cursorFrame = window.requestAnimationFrame(renderSiteCursor);
    } else {
      cursorFrame = undefined;
    }
  };

  const queueSiteCursor = () => {
    if (!cursorFrame && cursorEnabled()) cursorFrame = window.requestAnimationFrame(renderSiteCursor);
  };

  const syncSiteCursor = () => {
    const enabled = cursorEnabled();
    document.documentElement.classList.toggle('has-site-cursor', enabled);
    if (!enabled) {
      if (cursorFrame) window.cancelAnimationFrame(cursorFrame);
      cursorFrame = undefined;
      siteCursor.classList.remove('is-visible', 'is-hovering');
    }
  };

  document.addEventListener('pointermove', (event) => {
    if (!cursorEnabled() || isNativeCursorTarget(event.target)) {
      siteCursor.classList.remove('is-visible', 'is-hovering');
      return;
    }

    targetCursorX = event.clientX;
    targetCursorY = event.clientY;
    siteCursor.classList.add('is-visible');
    siteCursor.classList.toggle('is-hovering', isInteractiveTarget(event.target));
    queueSiteCursor();
  }, { passive: true });

  document.addEventListener('pointerout', (event) => {
    if (!event.relatedTarget) siteCursor.classList.remove('is-visible', 'is-hovering');
  }, { passive: true });
  window.addEventListener('blur', () => siteCursor.classList.remove('is-visible', 'is-hovering'));
  reducedMotion.addEventListener?.('change', syncSiteCursor);
  finePointer.addEventListener?.('change', syncSiteCursor);
  syncSiteCursor();
}
