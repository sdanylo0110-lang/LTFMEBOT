/**
 * Minimal canvas chart helpers — no external chart library dependency.
 *
 * Bug fix note: previously cssHeight was read back from canvas.getAttribute
 * ('height'), but setting canvas.height (a DPR-scaled pixel value) reflects
 * into that same attribute — so every re-render multiplied the height by
 * devicePixelRatio again, making the canvas grow without bound. Height is
 * now always passed in explicitly (default 140) instead of read back from
 * the element, so it can never compound.
 */
const Charts = (() => {
  function setupCanvas(canvas, height) {
    const dpr = window.devicePixelRatio || 1;
    const cssHeight = height || 140;
    const cssWidth = canvas.getBoundingClientRect().width || canvas.parentElement.clientWidth || 300;
    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;
    canvas.style.height = cssHeight + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w: cssWidth, h: cssHeight };
  }

  function line(canvas, values, opts = {}) {
    const { ctx, w, h } = setupCanvas(canvas, opts.height);
    ctx.clearRect(0, 0, w, h);
    if (!values.length) return;
    const pad = 10;
    const max = opts.max ?? Math.max(...values, 1);
    const min = opts.min ?? 0;
    const color = opts.color || '#2C8C7F';
    const points = values.map((v, i) => {
      const x = pad + (i / (values.length - 1 || 1)) * (w - pad * 2);
      const y = h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2);
      return [x, y];
    });

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, color + '33');
    grad.addColorStop(1, color + '00');
    ctx.beginPath();
    ctx.moveTo(points[0][0], h - pad);
    points.forEach(p => ctx.lineTo(p[0], p[1]));
    ctx.lineTo(points[points.length - 1][0], h - pad);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    points.forEach((p, i) => (i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1])));
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.fillStyle = color;
    points.forEach(p => { ctx.beginPath(); ctx.arc(p[0], p[1], 2.5, 0, Math.PI * 2); ctx.fill(); });
  }

  function bars(canvas, values, opts = {}) {
    const { ctx, w, h } = setupCanvas(canvas, opts.height);
    ctx.clearRect(0, 0, w, h);
    if (!values.length) return;
    const pad = 10;
    const max = opts.max ?? Math.max(...values, 1);
    const color = opts.color || '#A9803D';
    const gap = 4;
    const barW = (w - pad * 2 - gap * (values.length - 1)) / values.length;
    values.forEach((v, i) => {
      const x = pad + i * (barW + gap);
      const bh = ((v || 0) / (max || 1)) * (h - pad * 2);
      const y = h - pad - bh;
      ctx.fillStyle = color;
      ctx.beginPath();
      const r = Math.min(3, barW / 2);
      ctx.moveTo(x, y + r);
      ctx.arcTo(x, y, x + r, y, r);
      ctx.lineTo(x + barW - r, y);
      ctx.arcTo(x + barW, y, x + barW, y + r, r);
      ctx.lineTo(x + barW, h - pad);
      ctx.lineTo(x, h - pad);
      ctx.closePath();
      ctx.fill();
    });
  }

  return { line, bars };
})();
