(function () {
  "use strict";

  const STORAGE_KEY = "CG_UI_MOTION_ENABLED";

  function initAmbientGraph() {
    const canvas = document.getElementById("ambient-graph-canvas");
    if (!canvas) return;

    const root = canvas.parentElement;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    // #02: the system setting can change while the page is open.
    const motionQuery = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    let prefersReducedMotion = Boolean(motionQuery && motionQuery.matches);
    let persistedEnabled = true;
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "false") persistedEnabled = false;
    } catch (_) {
      persistedEnabled = true;
    }

    let enabled = prefersReducedMotion ? false : persistedEnabled;
    let rafId = 0;
    let resizeRafId = 0;
    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let nodes = [];
    let mouse = { x: -9999, y: -9999, active: false };

    const config = {
      nodeCount: () => window.innerWidth < 640 ? 30 : window.innerWidth < 1024 ? 46 : window.innerWidth < 1440 ? 64 : 76,
      speed: 0.24,
      radiusMin: 1.9,
      radiusMax: 4.8,
      linkDistance: 175,
      glowDistance: 220,
      palette: {
        line: "rgba(54, 139, 76, 0.34)",
        lineStrong: "rgba(89, 196, 91, 0.66)",
        node: "rgba(83, 180, 83, 0.98)",
        nodeAlt: "rgba(7, 112, 72, 0.98)",
        nodeSoft: "rgba(134, 239, 172, 0.38)"
      }
    };

    function random(min, max) {
      return Math.random() * (max - min) + min;
    }

    function seedNodes() {
      const count = config.nodeCount();
      nodes = Array.from({ length: count }, (_, index) => ({
        id: index,
        x: random(0, width),
        y: random(0, height),
        vx: random(-config.speed, config.speed),
        vy: random(-config.speed, config.speed),
        radius: random(config.radiusMin, config.radiusMax),
        accent: Math.random() > 0.62,
        glow: Math.random() > 0.72
      }));
    }

    function resize() {
      const previousWidth = width;
      const previousHeight = height;
      width = Math.max(1, root.clientWidth || window.innerWidth);
      height = Math.max(1, root.clientHeight || window.innerHeight);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Preserve positions when resizing; recreating all nodes caused a
      // visible jump during laptop resizing / mobile browser chrome changes.
      if (!nodes.length) {
        seedNodes();
      } else {
        nodes.forEach((node) => {
          node.x = Math.max(0, Math.min(width, node.x * width / previousWidth));
          node.y = Math.max(0, Math.min(height, node.y * height / previousHeight));
        });
        const targetCount = config.nodeCount();
        nodes.length = Math.min(nodes.length, targetCount);
        while (nodes.length < targetCount) {
          const index = nodes.length;
          nodes.push({
            id: index,
            x: random(0, width),
            y: random(0, height),
            vx: random(-config.speed, config.speed),
            vy: random(-config.speed, config.speed),
            radius: random(config.radiusMin, config.radiusMax),
            accent: Math.random() > 0.62,
            glow: Math.random() > 0.72
          });
        }
      }
      draw();
    }

    function requestResize() {
      if (resizeRafId) return;
      resizeRafId = window.requestAnimationFrame(() => {
        resizeRafId = 0;
        resize();
      });
    }

    function drawBackdrop() {
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, "rgba(243, 250, 244, 0.86)");
      gradient.addColorStop(0.55, "rgba(240, 249, 240, 0.72)");
      gradient.addColorStop(1, "rgba(235, 247, 236, 0.84)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    }

    function drawGlow(x, y, radius) {
      const radial = ctx.createRadialGradient(x, y, 0, x, y, radius);
      radial.addColorStop(0, "rgba(74, 222, 128, 0.24)");
      radial.addColorStop(1, "rgba(134, 239, 172, 0)");
      ctx.fillStyle = radial;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);
      drawBackdrop();

      if (mouse.active && enabled) drawGlow(mouse.x, mouse.y, 120);

      for (let i = 0; i < nodes.length; i += 1) {
        const a = nodes[i];
        if (a.glow) drawGlow(a.x, a.y, 36);

        for (let j = i + 1; j < nodes.length; j += 1) {
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distance = Math.hypot(dx, dy);
          if (distance < config.linkDistance) {
            const alpha = 1 - distance / config.linkDistance;
            ctx.strokeStyle = alpha > 0.74 ? config.palette.lineStrong : config.palette.line;
            ctx.globalAlpha = Math.max(alpha * 1.02, 0.10);
            ctx.lineWidth = alpha > 0.70 ? 1.5 : 1.0;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
        }

        if (mouse.active && enabled) {
          const md = Math.hypot(a.x - mouse.x, a.y - mouse.y);
          if (md < config.glowDistance) {
            ctx.strokeStyle = config.palette.lineStrong;
            ctx.globalAlpha = Math.max(0.28, 1 - md / config.glowDistance);
            ctx.lineWidth = 1.25;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
        }

        ctx.beginPath();
        ctx.fillStyle = a.accent ? config.palette.nodeAlt : config.palette.node;
        ctx.arc(a.x, a.y, a.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.fillStyle = config.palette.nodeSoft;
        ctx.arc(a.x, a.y, a.radius * 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function tick() {
      if (!enabled) {
        rafId = 0;
        draw();
        return;
      }
      for (const node of nodes) {
        node.x += node.vx;
        node.y += node.vy;
        if (node.x <= -10 || node.x >= width + 10) node.vx *= -1;
        if (node.y <= -10 || node.y >= height + 10) node.vy *= -1;
      }
      draw();
      rafId = window.requestAnimationFrame(tick);
    }

    function start() {
      if (!enabled || rafId || document.hidden) return;
      rafId = window.requestAnimationFrame(tick);
    }

    function stop() {
      if (rafId) window.cancelAnimationFrame(rafId);
      rafId = 0;
      draw();
    }

    function applyMotionPreference() {
      enabled = persistedEnabled && !prefersReducedMotion;
      root.classList.toggle("is-paused", !enabled);
      if (enabled) start(); else stop();
      document.dispatchEvent(new CustomEvent("cg:motionchange", { detail: { enabled } }));
      return enabled;
    }

    function setEnabled(next) {
      // Persist the user's choice, not a temporary OS reduced-motion override.
      persistedEnabled = Boolean(next);
      try { window.localStorage.setItem(STORAGE_KEY, String(persistedEnabled)); } catch (_) {}
      return applyMotionPreference();
    }

    function onMotionPreferenceChange(event) {
      prefersReducedMotion = event.matches;
      applyMotionPreference();
    }

    function setMouse(event) {
      if (!enabled) return;
      const rect = canvas.getBoundingClientRect();
      mouse.x = event.clientX - rect.left;
      mouse.y = event.clientY - rect.top;
      mouse.active = true;
    }

    function clearMouse() {
      mouse.active = false;
      mouse.x = -9999;
      mouse.y = -9999;
    }

    window.CGAmbientGraph = {
      setEnabled,
      toggle: () => setEnabled(!enabled),
      isEnabled: () => enabled,
      prefersReducedMotion: () => prefersReducedMotion
    };

    resize();
    root.classList.toggle("is-paused", !enabled);
    if (enabled) start();

    window.addEventListener("resize", requestResize, { passive: true });
    if (motionQuery) {
      if (typeof motionQuery.addEventListener === "function") {
        motionQuery.addEventListener("change", onMotionPreferenceChange);
      } else if (typeof motionQuery.addListener === "function") {
        motionQuery.addListener(onMotionPreferenceChange);
      }
    }
    window.addEventListener("pointermove", setMouse, { passive: true });
    window.addEventListener("pointerleave", clearMouse, { passive: true });
    window.addEventListener("blur", clearMouse, { passive: true });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stop(); else if (enabled) start();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAmbientGraph, { once: true });
  } else {
    initAmbientGraph();
  }
})();
