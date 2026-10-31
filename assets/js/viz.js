/* ==========================================================================
   Small live demos inside the Research and Education sections:
   1. REDACT: multilingual PII spans get detected, tagged and redacted
   2. ITSM agents: a mock incident flows through the agent workflow
   3. Change-point detection: a CUSUM detector finds a regime shift
   Each one only runs while it is on screen.
   ========================================================================== */
(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Runs `loop(wait)` forever; `wait(ms)` also blocks while the element is off screen.
  function whileVisible(el, loop) {
    let visible = false;
    let waiters = [];
    const release = () => { if (visible && !document.hidden) waiters.splice(0).forEach(r => r()); };
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; release(); }, { rootMargin: '80px' }).observe(el);
    document.addEventListener('visibilitychange', release);
    const gate = () => (visible && !document.hidden ? Promise.resolve() : new Promise(r => waiters.push(r)));
    const wait = ms => new Promise(r => setTimeout(r, ms)).then(gate);
    gate().then(() => loop(wait));
  }

  /* ---------------------------------------------------------------- REDACT */
  const SAMPLES = [
    ['EN', 'Please call {Priya Sharma|PERSON} at {+1 415 555 0132|PHONE}.'],
    ['HI', '{राहुल वर्मा|PERSON} का ईमेल {rahul.v@example.in|EMAIL} है।'],
    ['ES', 'Envía la factura a {Lucía Gómez|PERSON}, {Calle Mayor 12, Madrid|ADDRESS}.'],
    ['JA', '{田中 花子|PERSON}さんの電話番号は{090-1234-5678|PHONE}です。'],
    ['DE', 'Überweisung an {Jonas Weber|PERSON}, IBAN {DE44 5001 0517 5407 3249 31|IBAN}.'],
    ['ZH', '请联系{王伟|PERSON}，邮箱 {wang.wei@example.cn|EMAIL}。'],
    ['FR', 'Le patient {Marc Dubois|PERSON}, né le {12/03/1987|DOB}.'],
    ['KO', '{김민준|PERSON} 님의 여권 번호는 {M12345678|PASSPORT}입니다.'],
    ['RU', 'Позвоните {Анне Ивановой|PERSON} по номеру {+7 912 345-67-89|PHONE}.'],
    ['PT', 'O CPF de {Ana Souza|PERSON} é {123.456.789-09|NATIONAL_ID}.'],
  ];
  const PER_ROUND = 4;

  function renderLine([lang, src]) {
    const row = document.createElement('div');
    row.className = 'rline';
    const tag = document.createElement('span');
    tag.className = 'rline__lang';
    tag.textContent = lang;
    const p = document.createElement('p');
    p.className = 'rline__text';
    const re = /\{([^|}]+)\|([A-Z_]+)\}/g;
    let last = 0, m;
    while ((m = re.exec(src))) {
      p.append(src.slice(last, m.index));
      const mark = document.createElement('mark');
      mark.className = 'pii';
      mark.dataset.type = m[2];
      mark.textContent = m[1];
      p.append(mark);
      last = re.lastIndex;
    }
    p.append(src.slice(last));
    row.append(tag, p);
    return row;
  }

  const redact = document.querySelector('[data-redact]');
  if (redact) {
    const box = redact.querySelector('[data-redact-lines]');
    const langEl = redact.querySelector('[data-redact-lang]');
    const countEl = redact.querySelector('[data-redact-count]');

    if (reduceMotion) {
      SAMPLES.slice(0, PER_ROUND).forEach(s => {
        const row = renderLine(s);
        row.querySelectorAll('.pii').forEach(m => m.classList.add('found', 'redacted'));
        box.append(row);
      });
      countEl.textContent = `${box.querySelectorAll('.pii').length} spans`;
    } else {
      whileVisible(redact, async wait => {
        let start = 0;
        for (;;) {
          const batch = Array.from({ length: PER_ROUND }, (_, i) => SAMPLES[(start + i) % SAMPLES.length]);
          start = (start + PER_ROUND) % SAMPLES.length;
          box.textContent = '';
          countEl.textContent = '0 spans';
          const rows = batch.map(s => {
            const r = renderLine(s);
            r.classList.add('enter');
            box.append(r);
            return r;
          });
          for (const r of rows) { await wait(90); r.classList.remove('enter'); }
          await wait(500);

          let found = 0;
          for (let i = 0; i < rows.length; i++) {
            langEl.textContent = `"${batch[i][0].toLowerCase()}"`;
            rows[i].classList.add('scan');
            await wait(320);
            for (const m of rows[i].querySelectorAll('.pii')) {
              m.classList.add('found');
              countEl.textContent = `${++found} spans`;
              await wait(160);
            }
            await wait(260);
          }
          await wait(500);
          for (const m of box.querySelectorAll('.pii')) { m.classList.add('redacted'); await wait(90); }
          await wait(2600);
          rows.forEach(r => r.classList.add('out'));
          await wait(520);
        }
      });
    }
  }

  /* ----------------------------------------------------------- ITSM agents */
  const STEPS = [
    ['triage', 'triage_agent', 'classify("INC0042817")', 'Network · VPN · P2'],
    ['retrieve', 'retrieval_agent', 'kb.search("vpn drops every 10 min")', '3 hits · decoy rejected'],
    ['route', 'routing_agent', 'assign_group(category="network")', 'Network Operations'],
    ['plan', 'planner_agent', 'plan_resolution(kb=["KB0019", "KB0244"])', '4-step plan'],
    ['act', 'executor_agent', 'run("rotate_ipsec_sa")', 'tunnel stable'],
    ['review', 'review_agent', 'post_incident_review()', 'resolved, root cause logged'],
  ];

  const agent = document.querySelector('[data-agent]');
  if (agent) {
    const log = agent.querySelector('[data-agent-log]');
    const nodes = [...agent.querySelectorAll('[data-step]')];

    const line = (ag, fn) => {
      const p = document.createElement('p');
      const a = document.createElement('span'); a.className = 'ag'; a.textContent = ag;
      const f = document.createElement('span'); f.className = 'fn'; f.textContent = ` ${fn}`;
      p.append(a, f);
      return p;
    };
    const result = (p, text) => {
      const ok = document.createElement('span'); ok.className = 'ok'; ok.textContent = '  ✓ ';
      const r = document.createElement('span'); r.className = 'res'; r.textContent = text;
      p.append(ok, r);
    };

    if (reduceMotion) {
      STEPS.forEach(([, ag, fn, res]) => { const p = line(ag, fn); result(p, res); log.append(p); });
      nodes.forEach(n => n.classList.add('done'));
    } else {
      whileVisible(agent, async wait => {
        for (;;) {
          log.textContent = '';
          nodes.forEach(n => n.classList.remove('on', 'done'));
          await wait(500);
          for (let i = 0; i < STEPS.length; i++) {
            const [, ag, fn, res] = STEPS[i];
            if (i) { nodes[i - 1].classList.remove('on'); nodes[i - 1].classList.add('done'); }
            nodes[i].classList.add('on');
            const p = line(ag, fn);
            log.append(p);
            await wait(750);
            result(p, res);
            await wait(520);
          }
          nodes[STEPS.length - 1].classList.remove('on');
          nodes[STEPS.length - 1].classList.add('done');
          await wait(2800);
        }
      });
    }
  }

  /* ------------------------------------------------- Change-point detection */
  const cpdCanvas = document.querySelector('[data-cpd]');
  if (cpdCanvas) {
    const ctx = cpdCanvas.getContext('2d');
    const N = 150, M0 = 0, M1 = 1.15, NOISE = 0.75, H = 6.5;
    let W = 0, Hc = 0, data = [], cus = [], tau = 0, detect = -1;

    const gauss = () => {
      let u = 0, v = 0;
      while (!u) u = Math.random();
      while (!v) v = Math.random();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };

    function generate() {
      do {
        tau = 55 + Math.floor(Math.random() * 45);
        data = []; cus = []; detect = -1;
        let s = 0;
        for (let k = 0; k < N; k++) {
          const y = (k < tau ? M0 : M1) + gauss() * NOISE;
          data.push(y);
          s = Math.max(0, s + (y - (M0 + M1) / 2)); // one-sided CUSUM for an upward mean shift
          cus.push(s);
          if (detect < 0 && s > H) detect = k;
        }
      } while (detect < tau || detect > tau + 25);
    }

    function size() {
      const r = cpdCanvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = r.width; Hc = r.height;
      cpdCanvas.width = Math.round(W * dpr);
      cpdCanvas.height = Math.round(Hc * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw(upto) {
      ctx.clearRect(0, 0, W, Hc);
      const padX = 14, top = 14, split = Hc * 0.58, bottom = Hc - 12;
      const x = k => padX + (k / (N - 1)) * (W - padX * 2);
      const y1 = v => top + (1 - (v + 2.2) / 5.6) * (split - top - 8);
      const smax = Math.max(H * 1.6, ...cus.slice(0, upto + 1));
      const y2 = v => bottom - (v / smax) * (bottom - split - 6);

      // panel divider + threshold
      ctx.strokeStyle = 'rgba(255,255,255,.06)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(padX, split); ctx.lineTo(W - padX, split); ctx.stroke();
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(251,191,36,.7)';
      ctx.beginPath(); ctx.moveTo(padX, y2(H)); ctx.lineTo(W - padX, y2(H)); ctx.stroke();
      ctx.restore();

      ctx.font = '500 10px "JetBrains Mono", ui-monospace, monospace';
      ctx.fillStyle = 'rgba(251,191,36,.8)';
      ctx.textAlign = 'right';
      ctx.fillText('h', W - padX, y2(H) - 5);
      ctx.fillStyle = 'rgba(166,174,192,.55)';
      ctx.textAlign = 'left';
      ctx.fillText('x[k]', padX, top + 2);
      ctx.fillText('S[k]', padX, split + 14);

      // samples
      for (let k = 0; k <= upto; k++) {
        ctx.fillStyle = k < tau ? 'rgba(94,231,255,.85)' : 'rgba(244,114,182,.9)';
        ctx.beginPath();
        ctx.arc(x(k), y1(data[k]), 1.9, 0, Math.PI * 2);
        ctx.fill();
      }

      // CUSUM statistic
      ctx.strokeStyle = 'rgba(167,139,250,1)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let k = 0; k <= upto; k++) {
        const px = x(k), py = y2(cus[k]);
        k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.stroke();

      // detection
      if (detect >= 0 && upto >= detect) {
        // segment means
        const mean = (a, b) => data.slice(a, b).reduce((s, v) => s + v, 0) / Math.max(1, b - a);
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(94,231,255,.7)';
        ctx.beginPath(); ctx.moveTo(x(0), y1(mean(0, tau))); ctx.lineTo(x(tau), y1(mean(0, tau))); ctx.stroke();
        ctx.strokeStyle = 'rgba(244,114,182,.7)';
        ctx.beginPath(); ctx.moveTo(x(tau), y1(mean(tau, upto + 1))); ctx.lineTo(x(upto), y1(mean(tau, upto + 1))); ctx.stroke();

        ctx.save();
        ctx.setLineDash([3, 4]);
        ctx.strokeStyle = 'rgba(255,255,255,.28)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x(tau), top); ctx.lineTo(x(tau), bottom); ctx.stroke();
        ctx.strokeStyle = 'rgba(52,211,153,.95)';
        ctx.beginPath(); ctx.moveTo(x(detect), top); ctx.lineTo(x(detect), bottom); ctx.stroke();
        ctx.restore();

        ctx.fillStyle = 'rgba(52,211,153,1)';
        ctx.beginPath(); ctx.arc(x(detect), y2(cus[detect]), 3.5, 0, Math.PI * 2); ctx.fill();

        const label = `τ = ${tau}   τ̂ = ${detect}   alarm`;
        ctx.font = '500 10.5px "JetBrains Mono", ui-monospace, monospace';
        const tw = ctx.measureText(label).width;
        const lx = Math.min(x(detect) + 8, W - padX - tw - 10);
        ctx.fillStyle = 'rgba(6,8,13,.85)';
        ctx.fillRect(lx - 5, top - 2, tw + 10, 17);
        ctx.fillStyle = 'rgba(52,211,153,1)';
        ctx.textAlign = 'left';
        ctx.fillText(label, lx, top + 10);
      }
    }

    size();
    generate();
    new ResizeObserver(() => { size(); draw(N - 1); }).observe(cpdCanvas);

    if (reduceMotion) {
      draw(N - 1);
    } else {
      whileVisible(cpdCanvas, async wait => {
        for (;;) {
          generate();
          // stream samples in, ~45 per second
          for (let k = 0; k < N; k += 2) {
            draw(k);
            await wait(44);
          }
          draw(N - 1);
          await wait(2600);
        }
      });
    }
  }
})();
