/* ==========================================================================
   Hero: "latent space"
   A live 2-D projection of the topics I work on. Each cluster is a field,
   each point a concept. The cursor acts as a query vector: its k nearest
   neighbours light up with their labels and similarity scores.
   Click anywhere in the hero to "re-embed" (clusters swap places).
   ========================================================================== */
(() => {
  const canvas = document.getElementById('latent');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const hero = canvas.closest('.hero');
  const hudQ = document.querySelector('[data-hud="q"]');
  const hudNN = document.querySelector('[data-hud="nn"]');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const K = 6;
  const CLUSTERS = [
    { name: 'llms', color: [94, 231, 255], desk: [0.58, 0.30], mob: [0.22, 0.16],
      vocab: ['lora', 'peft', 'prompt caching', 'fine-tuning', 'llm eval', 'rubric grading', 'transformers', 'deberta-v3', 'cosent', 'prompt versioning'] },
    { name: 'retrieval', color: [167, 139, 250], desk: [0.83, 0.27], mob: [0.78, 0.12],
      vocab: ['rag', 'milvus', 'cross-encoder', 're-ranking', 'sbert', 'pgvector', 'cosine sim', 'hard negatives', 'chromadb', 'metadata filters'] },
    { name: 'vision', color: [244, 114, 182], desk: [0.90, 0.52], mob: [0.86, 0.38],
      vocab: ['yolov11', 'vlm grading', 'ocr', 'textract', 'mAP50 0.975', 'handwriting', 'segmentation', 'document ai'] },
    { name: 'speech', color: [251, 191, 36], desk: [0.80, 0.72], mob: [0.70, 0.88],
      vocab: ['whisper', 'pyannote', 'diarization', 'nvidia riva', 'log-mel', 'asr', 'wer 21.4%', 'prosody', 'emotion'] },
    { name: 'agents', color: [52, 211, 153], desk: [0.60, 0.70], mob: [0.22, 0.82],
      vocab: ['react agents', 'tool calls', 'itsm', 'triage', 'routing', 'workflows', '75+ metrics', 'abstention'] },
    { name: 'signals', color: [96, 165, 250], desk: [0.72, 0.49], mob: [0.42, 0.48],
      vocab: ['change-point', 'cusum', 'mle', 'bch codes', 'viterbi', 'markov chain', '1d-cnn', 'hinkley'] },
  ];

  let W = 0, H = 0, DPR = 1, unit = 60, narrow = false;
  let points = [], edges = [], sprites = [];
  let centers = [], tween = null, ripple = null;
  let running = false, visible = true, raf = 0, lastHud = 0;
  const q = { x: 0, y: 0, tx: 0, ty: 0, lastMove: -1e9 };
  const order = [];

  // Glow sprites, one per cluster colour, so we never use shadowBlur per frame.
  function makeSprite([r, g, b]) {
    const s = 64, c = document.createElement('canvas');
    c.width = c.height = s;
    const g2 = c.getContext('2d');
    const grd = g2.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.1, `rgba(${r},${g},${b},1)`);
    grd.addColorStop(0.32, `rgba(${r},${g},${b},.32)`);
    grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
    g2.fillStyle = grd;
    g2.fillRect(0, 0, s, s);
    return c;
  }

  function gauss() {
    let u = 0, v = 0;
    while (!u) u = Math.random();
    while (!v) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function build() {
    points = [];
    const per = narrow ? 12 : W < 1300 ? 18 : 22;
    CLUSTERS.forEach((c, ci) => {
      for (let i = 0; i < per; i++) {
        points.push({
          c: ci,
          ox: gauss() * 0.9, oy: gauss() * 0.75,
          ph: Math.random() * Math.PI * 2,
          fx: 0.25 + Math.random() * 0.35, fy: 0.2 + Math.random() * 0.35,
          amp: 0.06 + Math.random() * 0.1,
          size: 0.75 + Math.random() * 0.55,
          label: c.vocab[i % c.vocab.length],
          x: 0, y: 0, d: 0,
        });
      }
    });
    // A sparse within-cluster k-NN graph (2 neighbours each), computed once.
    const seen = new Set();
    edges = [];
    points.forEach((p, i) => {
      const near = [];
      points.forEach((o, j) => {
        if (j !== i && o.c === p.c) near.push([(o.ox - p.ox) ** 2 + (o.oy - p.oy) ** 2, j]);
      });
      near.sort((a, b) => a[0] - b[0]);
      near.slice(0, 2).forEach(([, j]) => {
        const key = Math.min(i, j) * 1000 + Math.max(i, j);
        if (!seen.has(key)) { seen.add(key); edges.push([i, j]); }
      });
    });
    order.length = 0;
    for (let i = 0; i < points.length; i++) order.push(i);
  }

  function layout() {
    return CLUSTERS.map(c => {
      const [x, y] = narrow ? c.mob : c.desk;
      return { x, y };
    });
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    const wasNarrow = narrow;
    W = Math.max(1, r.width);
    H = Math.max(1, r.height);
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    narrow = W < 900;
    unit = Math.min(W, H) * (narrow ? 0.075 : 0.068);
    if (!points.length || wasNarrow !== narrow) { build(); centers = layout(); tween = null; }
    if (!q.x && !q.y) { q.x = q.tx = W * (narrow ? 0.5 : 0.72); q.y = q.ty = H * 0.5; }
    if (!running) draw(performance.now());
  }

  function reembed(x, y) {
    const from = centers.map(c => ({ ...c }));
    const slots = from.map(c => ({ ...c }));
    // Shuffle until every cluster moves somewhere new.
    for (let tries = 0; tries < 20; tries++) {
      for (let i = slots.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [slots[i], slots[j]] = [slots[j], slots[i]];
      }
      if (slots.every((s, i) => s.x !== from[i].x || s.y !== from[i].y)) break;
    }
    const to = slots.map(s => ({ x: s.x + (Math.random() - 0.5) * 0.04, y: s.y + (Math.random() - 0.5) * 0.04 }));
    tween = { from, to, start: performance.now(), dur: 1400 };
    ripple = { x, y, start: performance.now() };
    if (!running) loopOnce();
  }

  const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  function update(now) {
    const t = now / 1000;

    if (tween) {
      const k = Math.min(1, (now - tween.start) / tween.dur);
      const e = ease(k);
      centers = tween.from.map((f, i) => ({ x: f.x + (tween.to[i].x - f.x) * e, y: f.y + (tween.to[i].y - f.y) * e }));
      if (k >= 1) tween = null;
    }

    // Autopilot query when the visitor isn't steering.
    if (!reduceMotion && now - q.lastMove > 3500) {
      if (narrow) {
        q.tx = W * (0.5 + 0.36 * Math.sin(t * 0.21));
        q.ty = H * (0.48 + 0.34 * Math.sin(t * 0.29 + 1.2));
      } else {
        q.tx = W * (0.74 + 0.17 * Math.sin(t * 0.19));
        q.ty = H * (0.5 + 0.3 * Math.sin(t * 0.27 + 1.1));
      }
    }
    const follow = now - q.lastMove > 3500 ? 0.03 : 0.14;
    q.x += (q.tx - q.x) * follow;
    q.y += (q.ty - q.y) * follow;

    const R = unit * 2.6;
    for (const p of points) {
      const c = centers[p.c];
      const drift = reduceMotion ? 0 : 1;
      let x = c.x * W + (p.ox + Math.sin(t * p.fx + p.ph) * p.amp * drift) * unit;
      let y = c.y * H + (p.oy + Math.cos(t * p.fy + p.ph) * p.amp * drift) * unit;
      // Gentle "attention" pull towards the query.
      const dx = q.x - x, dy = q.y - y, d = Math.hypot(dx, dy);
      if (d < R) {
        const f = (1 - d / R) * 0.14;
        x += dx * f;
        y += dy * f;
      }
      p.x = x;
      p.y = y;
      p.d = Math.hypot(q.x - x, q.y - y);
    }
    order.sort((a, b) => points[a].d - points[b].d);
  }

  function sim(d) {
    return Math.exp(-d / (Math.min(W, H) * 0.9));
  }

  function draw(now) {
    update(now);
    ctx.clearRect(0, 0, W, H);

    const top = order.slice(0, K);
    const topSet = new Set(top);
    const nearestCluster = points[top[0]].c;

    // 1. Within-cluster graph edges.
    ctx.lineWidth = 1;
    for (let ci = 0; ci < CLUSTERS.length; ci++) {
      const [r, g, b] = CLUSTERS[ci].color;
      ctx.strokeStyle = `rgba(${r},${g},${b},${ci === nearestCluster ? 0.22 : 0.1})`;
      ctx.beginPath();
      for (const [i, j] of edges) {
        if (points[i].c !== ci) continue;
        ctx.moveTo(points[i].x, points[i].y);
        ctx.lineTo(points[j].x, points[j].y);
      }
      ctx.stroke();
    }

    // 2. Cluster names.
    ctx.font = '500 11px "JetBrains Mono", ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    CLUSTERS.forEach((c, ci) => {
      const [r, g, b] = c.color;
      const a = ci === nearestCluster ? 0.85 : 0.32;
      ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
      ctx.fillText(c.name.toUpperCase(), centers[ci].x * W, Math.max(96, centers[ci].y * H - unit * 2.1));
    });

    // 3. k-NN ball: radius = distance to the k-th neighbour.
    const kd = points[top[K - 1]].d;
    ctx.save();
    ctx.setLineDash([3, 5]);
    ctx.strokeStyle = 'rgba(233,236,243,.18)';
    ctx.beginPath();
    ctx.arc(q.x, q.y, kd + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // 4. Query → neighbour lines.
    top.forEach((idx, rank) => {
      const p = points[idx];
      const [r, g, b] = CLUSTERS[p.c].color;
      const grd = ctx.createLinearGradient(q.x, q.y, p.x, p.y);
      grd.addColorStop(0, 'rgba(255,255,255,.05)');
      grd.addColorStop(1, `rgba(${r},${g},${b},${0.75 - rank * 0.09})`);
      ctx.strokeStyle = grd;
      ctx.lineWidth = rank === 0 ? 1.4 : 1;
      ctx.beginPath();
      ctx.moveTo(q.x, q.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    });

    // 5. Points.
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const hot = topSet.has(i);
      const s = (hot ? 30 : 15) * p.size;
      ctx.globalAlpha = hot ? 1 : p.c === nearestCluster ? 0.85 : 0.55;
      ctx.drawImage(sprites[p.c], p.x - s / 2, p.y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;

    // 6. Labels for the top-k neighbours.
    ctx.font = '500 11px "JetBrains Mono", ui-monospace, monospace';
    ctx.textAlign = 'left';
    const placed = [], used = new Set();
    top.forEach((idx, rank) => {
      const p = points[idx];
      if (used.has(p.label)) return;
      const [r, g, b] = CLUSTERS[p.c].color;
      const text = `${p.label}  ${sim(p.d).toFixed(2)}`;
      const tw = ctx.measureText(text).width;
      // Try four spots around the point; skip the label if all of them collide.
      const right = p.x + 16 + tw < W - 6;
      const spots = [[right ? p.x + 10 : p.x - 16 - tw, p.y - 12], [right ? p.x + 10 : p.x - 16 - tw, p.y + 14],
        [right ? p.x - 16 - tw : p.x + 10, p.y - 12], [right ? p.x - 16 - tw : p.x + 10, p.y + 14]];
      const spot = spots.find(([sx, sy]) => !placed.some(o => sx - 6 < o.x + o.w && sx + tw + 6 > o.x && sy - 9 < o.y + 18 && sy + 9 > o.y));
      if (!spot) return;
      const [lx, ly] = spot;
      placed.push({ x: lx - 6, y: ly - 9, w: tw + 12 });
      used.add(p.label);
      ctx.globalAlpha = 1 - rank * 0.11;
      ctx.fillStyle = 'rgba(6,8,13,.78)';
      roundRect(lx - 6, ly - 9, tw + 12, 18, 5);
      ctx.fill();
      ctx.strokeStyle = `rgba(${r},${g},${b},.45)`;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = 'rgba(233,236,243,.95)';
      ctx.fillText(p.label, lx, ly + 0.5);
      ctx.fillStyle = `rgba(${r},${g},${b},1)`;
      ctx.fillText(sim(p.d).toFixed(2), lx + ctx.measureText(p.label + '  ').width, ly + 0.5);
    });
    ctx.globalAlpha = 1;

    // 7. The query itself.
    ctx.strokeStyle = 'rgba(255,255,255,.9)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(q.x, q.y, 5, 0, Math.PI * 2);
    ctx.moveTo(q.x - 12, q.y); ctx.lineTo(q.x - 8, q.y);
    ctx.moveTo(q.x + 8, q.y); ctx.lineTo(q.x + 12, q.y);
    ctx.moveTo(q.x, q.y - 12); ctx.lineTo(q.x, q.y - 8);
    ctx.moveTo(q.x, q.y + 8); ctx.lineTo(q.x, q.y + 12);
    ctx.stroke();

    // 8. Click ripple.
    if (ripple) {
      const k = (now - ripple.start) / 900;
      if (k >= 1) ripple = null;
      else {
        ctx.strokeStyle = `rgba(94,231,255,${0.6 * (1 - k)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(ripple.x, ripple.y, 10 + k * 220, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // HUD (throttled DOM writes).
    if (hudQ && now - lastHud > 120) {
      lastHud = now;
      hudQ.textContent = `[${(q.x / W).toFixed(2)}, ${(1 - q.y / H).toFixed(2)}]`;
      const p = points[top[0]];
      hudNN.textContent = `${p.label} · ${sim(p.d).toFixed(2)}`;
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
    ctx.rect(x, y, w, h);
  }

  function frame(now) {
    draw(now);
    raf = running ? requestAnimationFrame(frame) : 0;
  }

  // For reduced motion: animate only while something is actually moving.
  function loopOnce() {
    if (raf) return;
    const step = now => {
      draw(now);
      raf = (tween || ripple || Math.abs(q.tx - q.x) + Math.abs(q.ty - q.y) > 0.5) ? requestAnimationFrame(step) : 0;
    };
    raf = requestAnimationFrame(step);
  }

  function setRunning() {
    const should = visible && !document.hidden && !reduceMotion;
    if (should && !running) { running = true; raf = requestAnimationFrame(frame); }
    else if (!should && running) { running = false; cancelAnimationFrame(raf); raf = 0; }
  }

  // ---- Events ----
  hero.addEventListener('pointermove', e => {
    const r = canvas.getBoundingClientRect();
    q.tx = e.clientX - r.left;
    q.ty = e.clientY - r.top;
    q.lastMove = performance.now();
    if (!running) loopOnce();
  }, { passive: true });

  hero.addEventListener('click', e => {
    if (e.target.closest('a, button')) return;
    const r = canvas.getBoundingClientRect();
    reembed(e.clientX - r.left, e.clientY - r.top);
  });

  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; setRunning(); }).observe(hero);
  document.addEventListener('visibilitychange', setRunning);

  let resizeRaf = 0;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(resize);
  });

  sprites = CLUSTERS.map(c => makeSprite(c.color));
  resize();
  setRunning();
  requestAnimationFrame(() => canvas.classList.add('ready'));
  // Canvas text needs the mono font; redraw once it has loaded.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!running) draw(performance.now()); });
})();
