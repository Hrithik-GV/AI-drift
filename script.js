/* ════════════════════════════════════════════════
   AI DRIFT — Scroll-Driven Cinematic Engine
   ════════════════════════════════════════════════ */
(() => {
  'use strict';

  /* ── Config ── */
  const FRAME_COUNT = 81;
  const FRAME_DIR = 'frames/';
  const LERP_FACTOR = 0.08;
  const DEBOUNCE_MS = 150;

  /* ── DOM refs ── */
  const canvas = document.getElementById('hero-canvas');
  const ctx = canvas.getContext('2d');
  const loader = document.getElementById('loader');
  const loaderPercent = document.getElementById('loader-percent');
  const progressFill = document.getElementById('progress-fill');
  const scrollIndicator = document.getElementById('scroll-indicator');
  const scrollWrapper = document.getElementById('scroll-wrapper');
  const textLayers = [
    document.getElementById('text-1'),
    document.getElementById('text-2'),
    document.getElementById('text-3'),
  ];

  /* ── Timeline Refs ── */
  const timeline = document.getElementById('timeline');
  const timelineProgress = document.getElementById('timeline-progress');
  const timelineItems = document.querySelectorAll('.timeline__item');

  /* ── State ── */
  const images = [];
  let currentIndex = 0;
  let targetIndex = 0;
  let lastDrawnIndex = -1;
  let rafId = null;
  let isReady = false;

  /* ════════════════════════════════════════════════
     IMAGE PRELOADER
     ════════════════════════════════════════════════ */
  function framePath(i) {
    const num = String(i + 1).padStart(3, '0');
    return `${FRAME_DIR}ezgif-frame-${num}.jpg`;
  }

  function preloadImages() {
    let loaded = 0;

    return new Promise((resolve) => {
      for (let i = 0; i < FRAME_COUNT; i++) {
        const img = new Image();
        img.src = framePath(i);

        img.onload = img.onerror = () => {
          loaded++;
          const pct = Math.round((loaded / FRAME_COUNT) * 100);
          loaderPercent.textContent = `${pct} %`;

          if (loaded === FRAME_COUNT) resolve();
        };

        images[i] = img;
      }
    });
  }

  /* ════════════════════════════════════════════════
     CANVAS SIZING
     ════════════════════════════════════════════════ */
  function resizeCanvas() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    canvas.width = vw;
    canvas.height = vh;

    lastDrawnIndex = -1;
  }

  /* ════════════════════════════════════════════════
     DRAW FRAME
     ════════════════════════════════════════════════ */
  function drawFrame(index) {
    const img = images[index];
    if (!img || !img.complete || img.naturalWidth === 0) return;

    const cw = canvas.width;
    const ch = canvas.height;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;

    const scale = Math.max(cw / iw, ch / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = (cw - dw) / 2;
    const dy = (ch - dh) / 2;

    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  /* ════════════════════════════════════════════════
     SCROLL → FRAME INDEX MAPPING
     ════════════════════════════════════════════════ */
  function getAnimationFraction() {
    const wrapperTop = scrollWrapper.offsetTop;
    const wrapperHeight = scrollWrapper.offsetHeight;
    const scrollY = window.scrollY || window.pageYOffset;
    const viewH = window.innerHeight;

    const start = wrapperTop;
    const end = wrapperTop + wrapperHeight - viewH;

    if (end <= start) return 0;

    const frac = (scrollY - start) / (end - start);
    return Math.min(Math.max(frac, 0), 1);
  }

  /* ════════════════════════════════════════════════
     TEXT CHOREOGRAPHY
     ════════════════════════════════════════════════ */
  function updateTextLayers(pct) {
    const p = pct * 100;

    if (p >= 10 && p <= 35) {
      const fadeIn = smoothstep(10, 18, p);
      const fadeOut = 1 - smoothstep(30, 35, p);
      const opacity = fadeIn * fadeOut;
      const yShift = (1 - fadeIn) * 40;
      textLayers[0].style.opacity = opacity;
      textLayers[0].style.transform = `translateY(${yShift}px)`;
    } else {
      textLayers[0].style.opacity = 0;
    }

    if (p >= 45 && p <= 70) {
      const fadeIn = smoothstep(45, 53, p);
      const fadeOut = 1 - smoothstep(65, 70, p);
      const opacity = fadeIn * fadeOut;
      const scale = 0.92 + fadeIn * 0.08;
      textLayers[1].style.opacity = opacity;
      textLayers[1].style.transform = `scale(${scale})`;
    } else {
      textLayers[1].style.opacity = 0;
    }

    if (p >= 80) {
      const fadeIn = smoothstep(80, 88, p);
      const yShift = (1 - fadeIn) * 30;
      textLayers[2].style.opacity = fadeIn;
      textLayers[2].style.transform = `translateY(${yShift}px)`;
    } else {
      textLayers[2].style.opacity = 0;
    }
  }

  function smoothstep(edge0, edge1, x) {
    const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
    return t * t * (3 - 2 * t);
  }

  function updateScrollIndicator(pct) {
    if (pct > 0.03) {
      scrollIndicator.classList.add('fade-out');
    } else {
      scrollIndicator.classList.remove('fade-out');
    }
  }

  /* ════════════════════════════════════════════════
     TIMELINE SCROLL LOGIC
     ════════════════════════════════════════════════ */
  function updateTimeline() {
    if (!timeline) return;

    const rect = timeline.getBoundingClientRect();
    const viewH = window.innerHeight;

    // Calculate progress of timeline within viewport
    // Start drawing line when top of timeline is at 75% of viewport
    const startPoint = viewH * 0.75;
    // Finish drawing when bottom of timeline is at 25% of viewport
    const endPoint = viewH * 0.25;

    let progress = 0;

    if (rect.top <= startPoint) {
      const totalDist = rect.height;
      const currentDist = startPoint - rect.top;
      progress = Math.min(Math.max(currentDist / totalDist, 0), 1);
    }

    // Update the vertical line height
    if (timelineProgress) {
      timelineProgress.style.height = `${progress * 100}%`;
    }

    // Activate individual items based on the line progress
    timelineItems.forEach((item, index) => {
      // Calculate where this item sits relative to the total timeline height
      const itemTop = item.offsetTop;
      const itemProgressTarget = itemTop / rect.height;

      if (progress >= itemProgressTarget) {
        item.classList.add('is-active');
      } else {
        item.classList.remove('is-active');
      }
    });
  }

  /* ════════════════════════════════════════════════
     RAF RENDER LOOP
     ════════════════════════════════════════════════ */
  function tick() {
    if (!isReady) { rafId = requestAnimationFrame(tick); return; }

    const frac = getAnimationFraction();
    targetIndex = frac * (FRAME_COUNT - 1);

    currentIndex += (targetIndex - currentIndex) * LERP_FACTOR;
    const frameIdx = Math.round(currentIndex);

    if (frameIdx !== lastDrawnIndex) {
      drawFrame(frameIdx);
      lastDrawnIndex = frameIdx;
    }

    updateTextLayers(frac);
    progressFill.style.width = `${frac * 100}%`;
    updateScrollIndicator(frac);

    // Update the judging timeline
    updateTimeline();

    rafId = requestAnimationFrame(tick);
  }

  /* ════════════════════════════════════════════════
     TEXT REVEAL UTILITIES
     ════════════════════════════════════════════════ */
  function setupTextSplitting() {
    const titles = document.querySelectorAll('.anim-split-words');
    titles.forEach(title => {
      const text = title.innerHTML;
      // Simple split by space, keeping HTML tags intact if possible, 
      // but here we know the structure has a <span class="accent">
      // A more robust way for this specific markup:
      const newHtml = text.split(/(<[^>]*>)/).map(part => {
        if (!part || part === ' ') return ' ';
        if (part.startsWith('<')) return part; // Keep HTML tags as is

        // Wrap actual words
        return part.split(' ').map(word => {
          if (!word) return '';
          return `<span class="word">${word}</span>`;
        }).join(' ');
      }).join('');

      title.innerHTML = newHtml;
    });
  }

  function initScrollReveals() {
    setupTextSplitting();

    // Intersection Observer for reveals
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');

          // If it's a container of children we want to stagger
          if (entry.target.classList.contains('info-cards')) {
            const cards = entry.target.querySelectorAll('.anim-card-pop');
            cards.forEach((card, i) => {
              card.style.transitionDelay = `${i * 100}ms`;
              card.classList.add('is-visible');
            });
          }

          if (entry.target.classList.contains('rules-list')) {
            const rules = entry.target.querySelectorAll('.anim-rule');
            rules.forEach((rule, i) => {
              rule.style.transitionDelay = `${i * 80}ms`;
              rule.classList.add('is-visible');
            });
          }

          if (entry.target.classList.contains('timeline')) {
            const items = entry.target.querySelectorAll('.timeline__item');
            items.forEach((item, i) => {
              item.style.transitionDelay = `${i * 150}ms`;
              item.classList.add('is-visible');
            })
          }
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: "0px 0px -10% 0px"
    });

    // Observe standalone elements
    document.querySelectorAll('.anim-slide-up, .anim-fade-up, .anim-split-words').forEach(el => {
      observer.observe(el);
    });

    // Observe containers for staggered children
    document.querySelectorAll('.info-cards, .rules-list, .timeline').forEach(el => {
      observer.observe(el);
    });
  }

  /* ════════════════════════════════════════════════
     DEBOUNCED RESIZE
     ════════════════════════════════════════════════ */
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resizeCanvas, DEBOUNCE_MS);
  });

  /* ════════════════════════════════════════════════
     INIT
     ════════════════════════════════════════════════ */
  async function init() {
    resizeCanvas();
    await preloadImages();

    drawFrame(0);
    isReady = true;

    loader.classList.add('hidden');

    initScrollReveals();
    tick();
  }

  init();
})();
