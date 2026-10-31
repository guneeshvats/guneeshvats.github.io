/* ==========================================================================
   Page behaviour: nav, scroll effects, reveal, counters, token streaming,
   experience toggles, publication filters, command palette, loss HUD.
   ========================================================================== */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

  if (!isMac) $$('[data-mod]').forEach(k => (k.textContent = 'Ctrl'));
  $$('[data-year]').forEach(el => (el.textContent = new Date().getFullYear()));

  /* ---------- Toast ---------- */
  const toastEl = $('[data-toast]');
  let toastTimer = 0;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.append(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    toast('Email copied to clipboard ✓');
  }
  $$('[data-copy]').forEach(b => b.addEventListener('click', () => copy(b.dataset.copy)));

  /* ---------- Mobile menu ---------- */
  const toggle = $('.nav__toggle');
  const menu = $('#mobile-menu');
  function setMenu(open) {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.hidden = !open;
    document.body.style.overflow = open ? 'hidden' : '';
  }
  toggle.addEventListener('click', () => setMenu(menu.hidden));
  $$('a', menu).forEach(a => a.addEventListener('click', () => setMenu(false)));
  window.addEventListener('resize', () => { if (window.innerWidth > 900 && !menu.hidden) setMenu(false); });

  /* ---------- Reveal on scroll ---------- */
  const revealIO = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      revealIO.unobserve(e.target);
      $$('[data-count]', e.target).forEach(countUp);
      $$('[data-scramble]', e.target).forEach(scramble);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  $$('.reveal, [data-detect]').forEach(el => revealIO.observe(el));

  /* ---------- Counters ---------- */
  function countUp(el) {
    const end = parseFloat(el.dataset.count);
    if (reduceMotion) { el.textContent = end; return; }
    const dur = 1500, t0 = performance.now();
    const tick = now => {
      const k = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(2, -10 * k);
      el.textContent = Math.round(end * e);
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ---------- Kicker "decode" effect ---------- */
  const GLYPHS = '01<>/[]{}=+*#%&ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  function scramble(el) {
    if (reduceMotion) return;
    const final = el.textContent;
    let frame = 0;
    const total = 18;
    const run = () => {
      el.textContent = final.split('').map((ch, i) => {
        if (ch === ' ') return ' ';
        return i < (frame / total) * final.length ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }).join('');
      if (++frame <= total) setTimeout(run, 38);
      else el.textContent = final;
    };
    run();
  }

  /* ---------- Hero: stream phrases token-by-token, like an LLM ---------- */
  const PHRASES = [
    'production LLM systems.',
    'benchmarks that find where models break.',
    'VLM pipelines that grade handwriting.',
    'retrieval that cuts prompt tokens.',
    'real-time speech recognition.',
    'agents, and the environments that test them.',
  ];
  // Rough BPE-ish split: words, with long words broken into 3–5 char chunks.
  const tokenize = s => s.match(/\s?[^\s]+/g).flatMap(w => {
    const out = [];
    let i = 0;
    while (i < w.length) {
      const n = w.length - i <= 6 ? w.length - i : 3 + ((w.charCodeAt(i) + i) % 3);
      out.push(w.slice(i, i + n));
      i += n;
    }
    return out;
  });
  const stream = $('[data-stream]');
  if (stream) {
    if (reduceMotion) {
      stream.textContent = PHRASES[0];
    } else {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      (async () => {
        await sleep(900);
        for (let p = 0; ; p = (p + 1) % PHRASES.length) {
          const toks = tokenize(PHRASES[p]);
          for (let i = 1; i <= toks.length; i++) {
            stream.textContent = toks.slice(0, i).join('');
            await sleep(55 + Math.random() * 70);
          }
          await sleep(2300);
          for (let i = toks.length - 1; i >= 0; i--) {
            stream.textContent = toks.slice(0, i).join('');
            await sleep(26);
          }
          await sleep(320);
        }
      })();
    }
  }

  /* ---------- Spotlight cards ---------- */
  if (window.matchMedia('(hover: hover)').matches) {
    document.addEventListener('pointermove', e => {
      const card = e.target.closest && e.target.closest('.spot');
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    }, { passive: true });
  }

  /* ---------- Experience: expand / collapse ---------- */
  $$('.xp__toggle').forEach(btn => {
    const xp = btn.closest('.xp');
    const label = btn.textContent;
    btn.addEventListener('click', () => {
      const open = xp.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(open));
      btn.textContent = open ? 'Show less' : label;
    });
  });

  /* ---------- Publication filters ---------- */
  const filters = $$('.filter');
  filters.forEach(f => f.addEventListener('click', () => {
    filters.forEach(o => o.setAttribute('aria-pressed', String(o === f)));
    const tag = f.dataset.filter;
    $$('.pub').forEach(p => {
      const show = tag === 'all' || p.dataset.tags.split(' ').includes(tag);
      p.classList.toggle('hide', !show);
      if (show) p.classList.add('in');
    });
  }));

  /* ---------- Clock (IST) ---------- */
  const clock = $('[data-clock]');
  if (clock) {
    const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
    const tick = () => (clock.textContent = fmt.format(new Date()));
    tick();
    setInterval(tick, 20000);
  }

  /* ---------- Active nav link ---------- */
  const links = $$('.nav__links a');
  const sections = $$('[data-section]');
  const navIO = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const id = e.target.id;
      links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === `#${id}`));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach(s => navIO.observe(s));

  /* ---------- Scroll-driven: progress bar, nav, timeline, loss HUD ---------- */
  const nav = $('#nav');
  const bar = $('.progress span');
  const fill = $('.timeline__fill');
  const timeline = $('.timeline');
  const xps = $$('.xp');
  const hud = $('.losshud');
  const lossVal = $('[data-loss]');
  const epochEl = $('[data-epoch]');
  const epochName = $('[data-epoch-name]');
  const lossPath = $('.losshud__line');
  const ghostPath = $('.losshud__ghost');
  const dot = $('.losshud__dot');

  // A believable training curve: exponential decay plus a little deterministic noise.
  // Starts at ln(10) = 2.303, the cross-entropy of a 10-way classifier at init.
  const loss = p => 0.04 + 2.263 * Math.exp(-4.2 * p) + 0.05 * Math.sin(p * 47) * Math.exp(-2 * p) + 0.02 * Math.sin(p * 131) * (1 - p);
  const SAMPLES = 120;
  const pts = Array.from({ length: SAMPLES + 1 }, (_, i) => {
    const p = i / SAMPLES;
    return [p * 160, 4 + (1 - loss(p) / 2.4) * 38];
  });
  const pathFor = n => pts.slice(0, n + 1).map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');
  if (ghostPath) ghostPath.setAttribute('d', pathFor(SAMPLES));

  let ticking = false;
  function onScroll() {
    ticking = false;
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const p = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;

    bar.style.transform = `scaleX(${p})`;
    nav.classList.toggle('scrolled', y > 20);

    if (timeline) {
      const r = timeline.getBoundingClientRect();
      const mid = window.innerHeight * 0.6;
      const tp = Math.min(1, Math.max(0, (mid - r.top) / r.height));
      fill.style.setProperty('--p', tp.toFixed(4));
      xps.forEach(xp => {
        const node = xp.getBoundingClientRect().top + 40;
        xp.classList.toggle('lit', node < mid);
      });
    }

    if (hud) {
      hud.classList.toggle('show', y > window.innerHeight * 0.6);
      const n = Math.round(p * SAMPLES);
      lossPath.setAttribute('d', pathFor(Math.max(1, n)));
      const [dx, dy] = pts[n];
      dot.setAttribute('cx', dx);
      dot.setAttribute('cy', dy);
      lossVal.textContent = loss(p).toFixed(3);
      let idx = 0;
      sections.forEach((s, i) => { if (s.getBoundingClientRect().top < window.innerHeight * 0.5) idx = i; });
      epochEl.textContent = `epoch ${idx}/${sections.length - 1}`;
      epochName.textContent = idx === 0 ? 'init' : sections[idx].id;
    }
  }
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  /* ---------- Command palette ---------- */
  const palette = $('#palette');
  const input = $('[data-palette-input]');
  const list = $('[data-palette-list]');
  const go = id => () => document.getElementById(id).scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  const open = url => () => window.open(url, '_blank', 'noopener');
  const COMMANDS = [
    { group: 'Navigate', label: 'About', icon: 'i-arrow', hint: '01', run: go('about') },
    { group: 'Navigate', label: 'Experience', icon: 'i-arrow', hint: '02', run: go('experience') },
    { group: 'Navigate', label: 'Research & publications', icon: 'i-arrow', hint: '03', run: go('research') },
    { group: 'Navigate', label: 'Projects', icon: 'i-arrow', hint: '04', run: go('projects') },
    { group: 'Navigate', label: 'Toolkit', icon: 'i-arrow', hint: '05', run: go('skills') },
    { group: 'Navigate', label: 'Education & honors', icon: 'i-arrow', hint: '06', run: go('education') },
    { group: 'Navigate', label: 'Contact', icon: 'i-arrow', hint: '07', run: go('contact') },
    { group: 'Actions', label: 'Copy email address', icon: 'i-copy', hint: 'guneeshvats12@gmail.com', run: () => copy('guneeshvats12@gmail.com') },
    { group: 'Actions', label: 'Send an email', icon: 'i-mail', hint: 'mailto', run: () => (location.href = 'mailto:guneeshvats12@gmail.com') },
    { group: 'Actions', label: 'Open résumé (ML Engineering)', icon: 'i-down', hint: 'PDF', run: open('assets/docs/Guneesh_Vats_Resume_ML.pdf') },
    { group: 'Actions', label: 'Open résumé (Research)', icon: 'i-down', hint: 'PDF', run: open('assets/docs/Guneesh_Vats_Resume_Research.pdf') },
    { group: 'Profiles', label: 'GitHub', icon: 'i-github', hint: '@guneeshvats', run: open('https://github.com/guneeshvats') },
    { group: 'Profiles', label: 'LinkedIn', icon: 'i-linkedin', hint: 'in/guneeshvats', run: open('https://www.linkedin.com/in/guneeshvats/') },
    { group: 'Profiles', label: 'Google Scholar', icon: 'i-scholar', hint: 'publications', run: open('https://scholar.google.com/citations?user=8d4WIgEAAAAJ&hl=en') },
    { group: 'Profiles', label: 'REDACT paper (arXiv)', icon: 'i-paper', hint: 'EMNLP 2026', run: open('https://arxiv.org/abs/2606.19881') },
  ];
  let shown = [], sel = 0;

  // Subsequence fuzzy match: "exp" → "Experience", "cpy em" → "Copy email".
  const match = (q, s) => {
    s = s.toLowerCase();
    let i = 0;
    for (const ch of q.toLowerCase().replace(/\s+/g, '')) {
      i = s.indexOf(ch, i);
      if (i < 0) return false;
      i++;
    }
    return true;
  };

  function renderPalette() {
    const q = input.value.trim();
    shown = COMMANDS.filter(c => !q || match(q, `${c.group} ${c.label} ${c.hint}`));
    sel = Math.min(sel, Math.max(0, shown.length - 1));
    list.textContent = '';
    if (!shown.length) {
      const li = document.createElement('li');
      li.className = 'palette__empty';
      li.textContent = 'No matches. Try "email" or "research".';
      list.append(li);
      return;
    }
    let group = '';
    shown.forEach((c, i) => {
      if (c.group !== group) {
        group = c.group;
        const g = document.createElement('li');
        g.className = 'palette__group';
        g.setAttribute('role', 'presentation');
        g.textContent = group;
        list.append(g);
      }
      const li = document.createElement('li');
      li.className = 'palette__item';
      li.id = `cmd-${i}`;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', String(i === sel));
      li.innerHTML = `<svg class="ico" aria-hidden="true"><use href="#${c.icon}"/></svg><span></span><small></small>`;
      li.querySelector('span').textContent = c.label;
      li.querySelector('small').textContent = c.hint;
      li.addEventListener('click', () => runCmd(i));
      li.addEventListener('pointermove', () => { if (sel !== i) { sel = i; mark(); } });
      list.append(li);
    });
    input.setAttribute('aria-activedescendant', `cmd-${sel}`);
  }
  function mark() {
    $$('.palette__item', list).forEach(li => li.setAttribute('aria-selected', String(li.id === `cmd-${sel}`)));
    const cur = $(`#cmd-${sel}`);
    if (cur) cur.scrollIntoView({ block: 'nearest' });
    input.setAttribute('aria-activedescendant', `cmd-${sel}`);
  }
  function runCmd(i) {
    const c = shown[i];
    if (!c) return;
    closePalette();
    setTimeout(c.run, 60);
  }
  function openPalette() {
    if (palette.open) return;
    if (!menu.hidden) setMenu(false);
    input.value = '';
    sel = 0;
    renderPalette();
    palette.showModal();
    input.focus();
  }
  function closePalette() { if (palette.open) palette.close(); }

  $$('[data-open-palette]').forEach(b => b.addEventListener('click', openPalette));
  input.addEventListener('input', () => { sel = 0; renderPalette(); });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = (sel + 1) % Math.max(1, shown.length); mark(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = (sel - 1 + shown.length) % Math.max(1, shown.length); mark(); }
    else if (e.key === 'Enter') { e.preventDefault(); runCmd(sel); }
  });
  palette.addEventListener('click', e => { if (e.target === palette) closePalette(); });
  document.addEventListener('keydown', e => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); palette.open ? closePalette() : openPalette(); }
    else if (e.key === '/' && !typing && !palette.open) { e.preventDefault(); openPalette(); }
    else if (e.key === 'Escape' && !menu.hidden) setMenu(false);
  });

  /* ---------- Hello, fellow engineer ---------- */
  console.log(
    '%cHey there, fellow engineer 👋%c\nThis site is hand-written HTML, CSS and canvas, with no frameworks.\nSource: https://github.com/guneeshvats/guneeshvats.github.io\nSay hi: guneeshvats12@gmail.com',
    'font: 600 14px system-ui; color: #5ee7ff', 'font: 12px ui-monospace, monospace; color: #a6aec0'
  );
})();
