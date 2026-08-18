/**
 * Minimal canvas chart helpers — no external chart library dependency.
 * Keeps the MVP self-contained; swap for a richer lib later if needed.
 */
const Charts = (() => {
  function setupCanvas(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = canvas.height; // keep CSS height attr
    const cssHeight = parseInt(canvas.getAttribute('height'), 10) || 140;
    canvas.height = cssHeight * dpr;
    canvas.style.height = cssHeight + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    return { ctx, w: rect.width, h: cssHeight };
  }

  function line(canvas, values, opts = {}) {
    const { ctx, w, h } = setupCanvas(canvas);
    ctx.clearRect(0, 0, w, h);
    const pad = 10;
    const max = opts.max ?? Math.max(...values, 1);
    const min = opts.min ?? 0;
    const color = opts.color || '#2C8C7F';
    const points = values.map((v, i) => {
      const x = pad + (i / (values.length - 1 || 1)) * (w - pad * 2);
      const y = h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2);
      return [x, y];
    });

    // filled area
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

    // line
    ctx.beginPath();
    points.forEach((p, i) => (i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1])));
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // dots
    ctx.fillStyle = color;
    points.forEach(p => {
      ctx.beginPath();
      ctx.arc(p[0], p[1], 2.5, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function bars(canvas, values, opts = {}) {
    const { ctx, w, h } = setupCanvas(canvas);
    ctx.clearRect(0, 0, w, h);
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
