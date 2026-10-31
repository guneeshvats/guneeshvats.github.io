/* ==========================================================================
   "Inside the papers": paper tabs, figure lightbox, and interactive charts
   redrawn from the WCNC 2026 paper's Fig. 3 data (values from the LaTeX source).
   ========================================================================== */
(() => {
  const root = document.getElementById('papers');
  if (!root) return;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Tabs (shared by the paper switcher and the chart switcher) ---------- */
  function tablist(list, onSelect) {
    const tabs = $$('[role="tab"]', list);
    const select = (tab, focus) => {
      tabs.forEach(t => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
      });
      if (focus) tab.focus();
      onSelect(tab);
    };
    tabs.forEach(t => t.addEventListener('click', () => select(t)));
    list.addEventListener('keydown', e => {
      const i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (next === undefined) return;
      e.preventDefault();
      select(tabs[(next + tabs.length) % tabs.length], true);
    });
    return select;
  }

  const selectPaper = tablist($('.tabs', root), tab => {
    $$('.panel', root).forEach(p => (p.hidden = p.id !== tab.getAttribute('aria-controls')));
    if (tab.id === 'tab-wcnc') renderView(currentView, true);
  });

  // "Figures" links in the publication list jump here and open the right tab.
  $$('[data-open-paper]').forEach(a => a.addEventListener('click', () => {
    selectPaper(document.getElementById(`tab-${a.dataset.openPaper}`));
  }));

  /* ---------- Lightbox ---------- */
  const box = document.getElementById('lightbox');
  const boxImg = $('[data-lightbox-img]', box);
  $$('[data-zoom]', root).forEach(btn => btn.addEventListener('click', () => {
    const img = $('img', btn) || $('img', btn.closest('.fig'));
    boxImg.src = btn.dataset.zoom;
    boxImg.alt = (img && img.alt) || 'Figure from the paper';
    box.showModal();
    box.scrollTop = 0;
  }));
  $('[data-lightbox-close]', box).addEventListener('click', () => box.close());
  box.addEventListener('click', e => { if (e.target === box) box.close(); });

  /* ---------- Charts ---------- */
  const SURFACE = '#0a0b11';
  // Categorical slots in fixed order: cyan, violet, rose, amber (validated on SURFACE).
  const SLOT = ['#0fa3c0', '#8e78f0', '#e05a7a', '#b8860b'];
  const P = [0.01, 0.05, 0.1, 0.15, 0.2];
  const M = [20, 60, 100, 140, 180, 220];
  const pd = { label: 'Detection probability Pd', domain: [0, 1], ticks: [0, 0.2, 0.4, 0.6, 0.8, 1], fmt: v => v.toFixed(2) };
  const pAxis = { label: 'Crossover probability p', domain: [0, 0.2], ticks: [0, 0.05, 0.1, 0.15, 0.2], name: 'p' };
  const mAxis = { label: 'Sequence length M (codewords)', domain: [0, 220], ticks: [0, 50, 100, 150, 200], name: 'M' };

  const NN = [
    { name: 'NN, AWGN (known σ)', short: 'AWGN', slot: 0 },
    { name: 'NN, BSC (known p)', short: 'BSC, known p', slot: 1 },
    { name: 'NN, BSC (unknown p)', short: 'BSC, unknown p', slot: 2 },
    { name: 'Coarse MLE (baseline)', short: 'MLE', slot: 3 },
  ];
  const N = [{ name: 'n = 15', short: 'n = 15', slot: 0 }, { name: 'n = 31', short: 'n = 31', slot: 1 }];
  const PV = [
    { name: 'p = 0.001', short: 'p = .001', slot: 0 },
    { name: 'p = 0.01', short: 'p = .01', slot: 1 },
    { name: 'p = 0.05', short: 'p = .05', slot: 2 },
    { name: 'p = 0.10', short: 'p = .10', slot: 3 },
  ];

  const VIEWS = {
    noise: {
      note: 'Neural refinement beats the coarse MLE baseline at every noise level, and AWGN-trained models hold up best as the channel gets noisier.',
      legend: NN,
      charts: [
        { title: '(a) n = 15, T = 5', x: pAxis, y: pd, xs: P, series: [[0.99, 0.94, 0.83, 0.66, 0.45], [0.97, 0.85, 0.69, 0.56, 0.37], [0.93, 0.76, 0.60, 0.50, 0.26], [0.54, 0.38, 0.26, 0.21, 0.18]].map((ys, i) => ({ ...NN[i], ys })) },
        { title: '(b) n = 31, T = 5', x: pAxis, y: pd, xs: P, series: [[0.975, 0.94, 0.86, 0.76, 0.65], [0.96, 0.93, 0.78, 0.60, 0.30], [0.86, 0.73, 0.50, 0.45, 0.22], [0.54, 0.38, 0.26, 0.21, 0.18]].map((ys, i) => ({ ...NN[i], ys })) },
      ],
    },
    pipeline: {
      note: 'The full two-stage pipeline (M = 50, T = 5, BSC). Without knowing p, a single model trained across 21 noise levels still generalises to unseen channels, at some cost in accuracy.',
      legend: N,
      charts: [
        { title: '(e) Two-stage CPD, known p', x: { ...pAxis, domain: [0, 0.1], ticks: [0, 0.025, 0.05, 0.075, 0.1] }, y: pd, xs: [0.001, 0.025, 0.05, 0.08, 0.1], series: [[0.83, 0.75, 0.67, 0.41, 0.28], [0.86, 0.83, 0.79, 0.71, 0.42]].map((ys, i) => ({ ...N[i], ys })) },
        { title: '(f) Two-stage CPD, unknown p', x: pAxis, y: pd, xs: P, series: [[0.64, 0.525, 0.31, 0.23, 0.06], [0.59, 0.62, 0.34, 0.14, 0.065]].map((ys, i) => ({ ...N[i], ys })) },
      ],
    },
    scaling: {
      note: 'As sequences grow to 220 codewords, detection probability stays flat, and at low noise the localisation error stays under one codeword (n = 15, T = 5).',
      legend: PV,
      charts: [
        { title: '(g) Detection probability vs M', x: mAxis, y: pd, xs: M, series: [[0.84, 0.83, 0.817, 0.8153, 0.8113, 0.80], [0.75, 0.73, 0.72, 0.716, 0.71, 0.70], [0.66, 0.65, 0.64, 0.62, 0.61, 0.61], [0.26, 0.25, 0.245, 0.231, 0.221, 0.22]].map((ys, i) => ({ ...PV[i], ys })) },
        { title: '(h) Mean absolute error vs M', x: mAxis, y: { label: 'MAE (codewords)', domain: [0, 5], ticks: [0, 1, 2, 3, 4, 5], fmt: v => v.toFixed(2) }, xs: M, series: [[0.46, 0.549, 0.628, 0.5866, 0.602, 0.85], [0.72, 1.02, 1.16, 1.27, 1.36, 1.48], [1.61, 2.86, 3.73, 4.33, 4.78, 4.98]].map((ys, i) => ({ ...PV[i], ys })) },
      ],
    },
  };

  const NS = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.append(e);
    return e;
  };
  const tickFmt = v => String(+v.toFixed(3));

  function drawChart(host, spec, animate) {
    host.textContent = '';
    const wrap = document.createElement('div');
    wrap.className = 'chart' + (animate && !reduceMotion ? ' draw' : '');
    const title = document.createElement('p');
    title.className = 'chart__title';
    title.textContent = spec.title;
    const plot = document.createElement('div');
    plot.className = 'chart__plot';
    plot.tabIndex = 0;
    plot.setAttribute('role', 'img');
    plot.setAttribute('aria-label', `${spec.title}: ${spec.y.label} against ${spec.x.label}. Use the arrow keys to read values, or open the table view.`);
    wrap.append(title, plot);
    host.append(wrap);

    const W = Math.max(260, plot.clientWidth), H = 260;
    const xOf = (v, l, r) => l + ((v - spec.x.domain[0]) / (spec.x.domain[1] - spec.x.domain[0])) * (r - l);

    // Direct end labels only when they don't collide; otherwise the legend + tooltip carry identity.
    const top = 8, bottom = H - 44;
    const yOf = v => bottom - ((v - spec.y.domain[0]) / (spec.y.domain[1] - spec.y.domain[0])) * (bottom - top);
    const ends = spec.series.map(s => yOf(s.ys[s.ys.length - 1])).sort((a, b) => a - b);
    const labelled = W > 340 && ends.every((y, i) => !i || y - ends[i - 1] >= 13);
    const L = 52, R = W - (labelled ? 104 : 14);
    const X = v => xOf(v, L, R);

    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true' }, plot);

    // Grid + y ticks (solid hairlines).
    spec.y.ticks.forEach(t => {
      svgEl('line', { x1: L, x2: R, y1: yOf(t), y2: yOf(t), stroke: t === spec.y.domain[0] ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.07)', 'stroke-width': 1 }, svg);
      const tx = svgEl('text', { x: L - 8, y: yOf(t) + 3.5, 'text-anchor': 'end' }, svg);
      tx.textContent = tickFmt(t);
    });
    spec.x.ticks.forEach(t => {
      const tx = svgEl('text', { x: X(t), y: bottom + 16, 'text-anchor': 'middle' }, svg);
      tx.textContent = tickFmt(t);
    });
    const xl = svgEl('text', { x: (L + R) / 2, y: H - 6, 'text-anchor': 'middle', class: 'axis-label' }, svg);
    xl.textContent = spec.x.label;
    const yl = svgEl('text', { x: -(top + bottom) / 2, y: 11, transform: 'rotate(-90)', 'text-anchor': 'middle', class: 'axis-label' }, svg);
    yl.textContent = spec.y.label;

    // Crosshair (under the marks).
    const cross = svgEl('line', { y1: top, y2: bottom, stroke: 'rgba(255,255,255,.35)', 'stroke-width': 1, visibility: 'hidden' }, svg);

    // Lines, markers with a 2px surface ring, optional end labels.
    const dots = spec.series.map(s => {
      const c = SLOT[s.slot];
      const d = s.ys.map((y, i) => `${i ? 'L' : 'M'}${X(spec.xs[i]).toFixed(1)} ${yOf(y).toFixed(1)}`).join('');
      svgEl('path', { d, stroke: c, class: 'chart__line', pathLength: 1 }, svg);
      const g = svgEl('g', {}, svg);
      s.ys.forEach((y, i) => svgEl('circle', { cx: X(spec.xs[i]), cy: yOf(y), r: 4, fill: c, stroke: SURFACE, 'stroke-width': 2 }, g));
      if (labelled) {
        const last = s.ys.length - 1;
        const t = svgEl('text', { x: X(spec.xs[last]) + 10, y: yOf(s.ys[last]) + 3.5, class: 'end-label' }, svg);
        t.textContent = s.short;
      }
      return g;
    });

    // Tooltip: one readout listing every series at the snapped x.
    const tip = document.createElement('div');
    tip.className = 'chart__tip';
    tip.hidden = true;
    plot.append(tip);
    let idx = -1;

    function show(i) {
      idx = i;
      const scale = plot.clientWidth / W;
      const cx = X(spec.xs[i]);
      cross.setAttribute('x1', cx);
      cross.setAttribute('x2', cx);
      cross.setAttribute('visibility', 'visible');
      dots.forEach(g => [...g.children].forEach((c, j) => c.setAttribute('r', j === i ? 5.5 : 4)));
      tip.textContent = '';
      const head = document.createElement('p');
      head.textContent = `${spec.x.name} = ${spec.xs[i]}`;
      tip.append(head);
      [...spec.series].sort((a, b) => b.ys[i] - a.ys[i]).forEach(s => {
        const row = document.createElement('div');
        const key = document.createElement('i');
        key.style.background = SLOT[s.slot];
        const val = document.createElement('b');
        val.textContent = spec.y.fmt(s.ys[i]);
        const name = document.createElement('span');
        name.textContent = s.name;
        row.append(key, val, name);
        tip.append(row);
      });
      tip.hidden = false;
      const px = cx * scale;
      const tw = tip.offsetWidth;
      tip.style.left = `${px + 14 + tw > plot.clientWidth ? px - 14 - tw : px + 14}px`;
    }
    function hide() {
      idx = -1;
      tip.hidden = true;
      cross.setAttribute('visibility', 'hidden');
      dots.forEach(g => [...g.children].forEach(c => c.setAttribute('r', 4)));
    }
    function nearest(clientX) {
      const r = plot.getBoundingClientRect();
      const x = ((clientX - r.left) / r.width) * W;
      let best = 0;
      spec.xs.forEach((v, i) => { if (Math.abs(X(v) - x) < Math.abs(X(spec.xs[best]) - x)) best = i; });
      return best;
    }
    plot.addEventListener('pointermove', e => show(nearest(e.clientX)));
    plot.addEventListener('pointerdown', e => show(nearest(e.clientX)));
    plot.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') hide(); });
    plot.addEventListener('focus', () => show(idx < 0 ? spec.xs.length - 1 : idx));
    plot.addEventListener('blur', hide);
    plot.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        show(Math.min(spec.xs.length - 1, Math.max(0, idx + (e.key === 'ArrowRight' ? 1 : -1))));
      } else if (e.key === 'Escape') hide();
    });
  }

  function drawTable(host, spec) {
    const wrap = document.createElement('div');
    const t = document.createElement('table');
    const cap = document.createElement('caption');
    cap.textContent = `${spec.title} · ${spec.y.label}`;
    t.append(cap);
    const head = t.insertRow();
    [spec.x.name, ...spec.series.map(s => s.name)].forEach(h => {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = h;
      head.append(th);
    });
    spec.xs.forEach((x, i) => {
      const r = t.insertRow();
      r.insertCell().textContent = x;
      spec.series.forEach(s => (r.insertCell().textContent = spec.y.fmt(s.ys[i])));
    });
    wrap.append(t);
    host.append(wrap);
  }

  const panel = document.getElementById('panel-wcnc');
  const chartsEl = $('[data-charts]', panel);
  const tablesEl = $('[data-chart-tables]', panel);
  const legendEl = $('[data-legend]', panel);
  const noteEl = $('[data-chart-note]', panel);
  const tableBtn = $('[data-table-toggle]', panel);
  let currentView = 'noise';
  let lastW = 0;
  const drawn = new Set();

  function renderView(name, animate) {
    currentView = name;
    if (panel.hidden) return;
    const v = VIEWS[name];
    noteEl.textContent = v.note;
    legendEl.textContent = '';
    v.legend.forEach(s => {
      const li = document.createElement('li');
      li.innerHTML = `<svg viewBox="0 0 22 10" aria-hidden="true"><line x1="1" y1="5" x2="21" y2="5" stroke="${SLOT[s.slot]}" stroke-width="2" stroke-linecap="round"/><circle cx="11" cy="5" r="3.5" fill="${SLOT[s.slot]}" stroke="${SURFACE}" stroke-width="1.5"/></svg>`;
      li.append(document.createTextNode(s.name));
      legendEl.append(li);
    });
    chartsEl.textContent = '';
    tablesEl.textContent = '';
    v.charts.forEach(spec => {
      const cell = document.createElement('div');
      chartsEl.append(cell);
      drawChart(cell, spec, animate && !drawn.has(name));
      drawTable(tablesEl, spec);
    });
    if (animate) drawn.add(name);
    lastW = Math.round(chartsEl.getBoundingClientRect().width);
  }

  tablist($('.seg', panel), tab => renderView(tab.dataset.view, true));
  tableBtn.addEventListener('click', () => {
    const open = tablesEl.hidden;
    tablesEl.hidden = !open;
    tableBtn.setAttribute('aria-expanded', String(open));
    tableBtn.textContent = open ? 'Hide table' : 'View as table';
  });

  new ResizeObserver(([e]) => {
    const w = Math.round(e.contentRect.width);
    if (w && w !== lastW) { lastW = w; renderView(currentView, false); }
  }).observe(chartsEl);
})();
