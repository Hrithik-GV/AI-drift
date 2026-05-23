/* ════════════════════════════════════════════════
   AI DRIFT — Scroll-Driven Cinematic Engine
   ════════════════════════════════════════════════ */
(() => {
  'use strict';

  /* ── Config ── */
  const FRAME_COUNT   = 81;
  const FRAME_DIR     = 'frames/';
  const LERP_FACTOR   = 0.08;        // smoothing speed (lower = smoother)
  const DEBOUNCE_MS   = 150;

  /* ── DOM refs ── */
  const canvas        = document.getElementById('hero-canvas');
  const ctx           = canvas.getContext('2d');
  const loader        = document.getElementById('loader');
  const loaderPercent = document.getElementById('loader-percent');
  const progressFill  = document.getElementById('progress-fill');
  const scrollIndicator = document.getElementById('scroll-indicator');
  const textLayers    = [
    document.getElementById('text-1'),
    document.getElementById('text-2'),
    document.getElementById('text-3'),
  ];

  /* ── State ── */
  const images        = [];
  let currentIndex    = 0;          // lerp-smoothed float
  let targetIndex     = 0;          // raw scroll-mapped index
  let lastDrawnIndex  = -1;         // avoid redundant draws
  let rafId           = null;
  let isReady         = false;

  /* ════════════════════════════════════════════════
     IMAGE PRELOADER
     ════════════════════════════════════════════════ */
  function framePath(i) {
    // ezgif-frame-001.jpg … ezgif-frame-081.jpg
    const num = String(i + 1).padStart(3, '0');
    return `${FRAME_DIR}ezgif-frame-${num}.jpg`;
  }

  function preloadImages() {
    let loaded = 0;

    return new Promise((resolve) => {
      for (let i = 0; i < FRAME_COUNT; i++) {
        const img = new Image();
        img.src   = framePath(i);

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
     CANVAS SIZING  (object-fit:cover via JS)
     ════════════════════════════════════════════════ */
  function resizeCanvas() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    canvas.width  = vw;
    canvas.height = vh;

    // Force a redraw after resize
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

    // Cover algorithm
    const scale = Math.max(cw / iw, ch / ih);
    const dw    = iw * scale;
    const dh    = ih * scale;
    const dx    = (cw - dw) / 2;
    const dy    = (ch - dh) / 2;

    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  /* ════════════════════════════════════════════════
     SCROLL  →  FRAME INDEX MAPPING
     ════════════════════════════════════════════════ */
  function getScrollFraction() {
    const scrollTop    = window.scrollY || window.pageYOffset;
    const scrollHeight = document.body.scrollHeight - window.innerHeight;
    if (scrollHeight <= 0) return 0;
    return Math.min(Math.max(scrollTop / scrollHeight, 0), 1);
  }

  /* ════════════════════════════════════════════════
     TEXT CHOREOGRAPHY
     ════════════════════════════════════════════════ */
  function updateTextLayers(pct) {
    // pct is 0 – 1;  multiply by 100 for readability
    const p = pct * 100;

    // ── Layer 1: "6HRS HACKATHON" ──
    // visible 10% – 30%, fade out by 35%
    if (p >= 10 && p <= 35) {
      const fadeIn   = smoothstep(10, 18, p);   // fade in
      const fadeOut  = 1 - smoothstep(30, 35, p); // fade out
      const opacity  = fadeIn * fadeOut;
      const yShift   = (1 - fadeIn) * 40;        // translate up effect
      textLayers[0].style.opacity   = opacity;
      textLayers[0].style.transform = `translateY(${yShift}px)`;
    } else {
      textLayers[0].style.opacity = 0;
    }

    // ── Layer 2: "BUILD FAST AND RAPID" ──
    // visible 45% – 65%, fade out by 70%
    if (p >= 45 && p <= 70) {
      const fadeIn   = smoothstep(45, 53, p);
      const fadeOut  = 1 - smoothstep(65, 70, p);
      const opacity  = fadeIn * fadeOut;
      const scale    = 0.92 + fadeIn * 0.08;     // subtle scale-up
      textLayers[1].style.opacity   = opacity;
      textLayers[1].style.transform = `scale(${scale})`;
    } else {
      textLayers[1].style.opacity = 0;
    }

    // ── Layer 3: "CROSS THE FINISH LINE" ──
    // visible 80% – 100%
    if (p >= 80) {
      const fadeIn  = smoothstep(80, 88, p);
      const yShift  = (1 - fadeIn) * 30;
      textLayers[2].style.opacity   = fadeIn;
      textLayers[2].style.transform = `translateY(${yShift}px)`;
    } else {
      textLayers[2].style.opacity = 0;
    }
  }

  /* Hermite smoothstep helper */
  function smoothstep(edge0, edge1, x) {
    const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
    return t * t * (3 - 2 * t);
  }

  /* ════════════════════════════════════════════════
     SCROLL INDICATOR
     ════════════════════════════════════════════════ */
  function updateScrollIndicator(pct) {
    if (pct > 0.03) {
      scrollIndicator.classList.add('fade-out');
    } else {
      scrollIndicator.classList.remove('fade-out');
    }
  }

  /* ════════════════════════════════════════════════
     RAF RENDER LOOP
     ════════════════════════════════════════════════ */
  function tick() {
    if (!isReady) { rafId = requestAnimationFrame(tick); return; }

    // Update target from scroll
    const frac   = getScrollFraction();
    targetIndex  = frac * (FRAME_COUNT - 1);

    // Lerp smoothing
    currentIndex += (targetIndex - currentIndex) * LERP_FACTOR;

    const frameIdx = Math.round(currentIndex);

    // Only draw when index actually changes
    if (frameIdx !== lastDrawnIndex) {
      drawFrame(frameIdx);
      lastDrawnIndex = frameIdx;
    }

    // Update overlays
    updateTextLayers(frac);
    progressFill.style.width = `${frac * 100}%`;
    updateScrollIndicator(frac);

    rafId = requestAnimationFrame(tick);
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

    // Draw first frame
    drawFrame(0);
    isReady = true;

    // Hide loader
    loader.classList.add('hidden');

    // Start render loop
    tick();
  }

  init();
})();
