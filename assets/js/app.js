/* VEDIT-Bench project page — sections */
(function () {
  'use strict';
  const VB = window.VB, C = window.VBCharts;
  const { D, $, $$, h, s, clear, fmt, clamp, SYS, SYS_KEYS, logo, DOMS, DOM, LEVELS, CAT, TASK, reveal, onReveal, countUp, bindTip, autoVideo, SyncGroup, makeWipe, seg, openLB, typeText } = VB;

  const PICKS = {
    L1: { algorithms: 'dijkstra-relax', charts: '06-heatmap', chemistry: 'atom-ca', electric: '21_full_adder', math: '033_LinearRegression', physics: 'billiards_break', web: '19-editorial' },
    L2: { algorithms: 'quick-sort-partition', charts: '07-histogram', chemistry: 'atom-f', electric: '10_noninverting_amp', math: '040_PythagoreanProofSketch', physics: 'billiards_break', web: '17-workflow' },
    L3: { algorithms: 'avl-rotation', charts: '06-heatmap', chemistry: 'atom-ca', electric: '04_rc_low_pass', math: '056_HowVarianceAdds', physics: 'three_gear_chain', web: '15-salon-calendar' },
  };
  const FAILS = [
    { t: 'physics/three_gear_chain/L3', m: 'gpt-6-astra', c: ['R', 0], note: 'keeps turning while detached', e: 'The right gear slides out as asked (Direct 100), but its pointer keeps rotating while disengaged — the scene still obeys the old rule that meshed gears turn.' },
    { t: 'charts/06-heatmap/L3', m: 'claude-opus5.5', c: ['R', 0], note: 'summary still “≥80% · 2”', e: 'Even the overall leader slips: the two colour levels are re-binned at 70%, yet both weekly summaries still count cells ≥ 80% and show 2 instead of 4.' },
    { t: 'web/15-salon-calendar/L3', m: 'kimi-k3', c: ['R', 1], note: '“Confirmed” — double-booked', e: 'A single exclusive room means the 10:30 request must fail. Instead the request is confirmed for Nia + Ivo in Room 1, and the busy slots are never marked.' },
    { t: 'math/056_HowVarianceAdds/L3', m: 'kimi-k3', c: ['R', 0], note: 'sum runs 1–11, peak at 6', e: 'Two fair dice make X + Y run from 2 to 12 with a peak at 7. The candidate swaps in dice but its sum distribution is shifted by one.' },
    { t: 'algorithms/avl-rotation/L3', m: 'kimi-k3', c: ['R', 0], note: 'skips the first rotation', e: 'Inserting 30, 10, 20 needs a left–right double rotation. The candidate cuts straight from the unbalanced chain to the final tree.' },
    { t: 'chemistry/atom-ca/L3', m: 'claude-opus5.5', c: ['R', 3], note: 'valence electrons: 0', e: 'Ca²⁺ is drawn with 18 electrons and an emptied fourth shell, but the VALENCE ELECTRONS field reads 0 where the reference shows 8.' },
    { t: 'algorithms/quick-sort-partition/L2', m: 'kimi-k3', c: ['R', 1], note: '35 lands at index 1', e: 'With pivot 35, partitioning must settle it at index 2 with larger values to its right. The candidate places it at index 1, leaving 30 on the wrong side.' },
    { t: 'charts/07-histogram/L2', m: 'gpt-5.6-sol', c: ['D', 0], note: 'the new delivery never appears', e: 'One more 18-minute night delivery should lift the 10–20 min bar to 6, the order count to 11 and the average to 17.2 min. All three stay put.' },
    { t: 'math/040_PythagoreanProofSketch/L2', m: 'deepseek-v4.1-flash', c: ['D', 0], note: 'puzzle never moves right', e: 'The whole area puzzle should move into the right half. It stays centred across the midline while its pieces rearrange in place.' },
    { t: 'algorithms/dijkstra-relax/L1', m: 'gpt-6-astra', c: ['D', 0], note: 'sign shown while G = ∞', e: 'The cost sign belongs to the result phase. Here it is visible from the first frame, long before the shortest path to G is known.' },
    { t: 'physics/billiards_break/L1', m: 'deepseek-v4.1-flash', c: ['D', 2], note: 'the trail fades away', e: 'The cue ball should leave a persistent white trail. The trail fades within a second, so the earlier route disappears.' },
  ];
  const FAIL_AT = {}; FAILS.forEach(f => FAIL_AT[f.t + '|' + f.m] = f);
  const ICON = {
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4.5" width="4" height="15" rx="1"/><rect x="14" y="4.5" width="4" height="15" rx="1"/></svg>',
  };
  const rng = (seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647)(42);
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  /* ======================================================================
     NAV
     ====================================================================== */
  function nav() {
    const navEl = $('#nav'), prog = $('#progress');
    const onScroll = () => {
      navEl.classList.toggle('scrolled', scrollY > 40);
      const max = document.documentElement.scrollHeight - innerHeight;
      prog.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
    };
    addEventListener('scroll', onScroll, { passive: true }); onScroll();
    const links = $$('#navLinks a');
    const map = { abstract: null, task: 'task', levels: 'levels', atlas: 'atlas', metrics: 'metrics', results: 'results', leaderboard: 'results', arena: 'arena', failures: 'failures', related: 'failures', bibtex: 'bibtex' };
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      const id = map[e.target.id];
      links.forEach(a => a.classList.toggle('active', id && a.getAttribute('href') === '#' + id));
    }), { rootMargin: '-45% 0px -50% 0px' });
    $$('section[id]').forEach(sec => io.observe(sec));
    $('#navToggle').addEventListener('click', () => $('#navLinks').classList.toggle('open'));
    links.forEach(a => a.addEventListener('click', () => $('#navLinks').classList.remove('open')));
    $$('[data-soon]').forEach(a => a.addEventListener('click', e => {
      e.preventDefault();
      VB.tip.show('<b>Coming soon</b><div style="opacity:.75">Released with the camera-ready version.</div>', e);
      setTimeout(() => VB.tip.hide(), 1600);
    }));
  }

  /* ======================================================================
     HERO
     ====================================================================== */
  function hero() {
    // title letters
    const t = $('#heroTitle'); const txt = 'VEDIT-Bench'; clear(t);
    let i = 0; const bench = h('span', { class: 'bench' });
    Array.from(txt).forEach((ch, k) => {
      const sp = h('span', { class: 'ch' + (ch === '-' ? ' dash' : ''), style: `--i:${i++}`, 'aria-hidden': 'true' }, ch);
      (k > 5 ? bench : t).append(sp);
    });
    t.append(bench);
    setTimeout(() => { $$('.squig', document).forEach(x => x.classList.add('is-in')); }, 1300);

    // drifting wall of benchmark scenes
    const plane = $('#wallPlane');
    const per = {}; D.raw.forEach(r => (per[r.d] = per[r.d] || []).push(r));
    const pick = [];
    DOMS.forEach(d => { const a = per[d.key]; for (let j = 0; j < 6; j++) pick.push(a[Math.floor((j + .5) * a.length / 6)]); });
    const rows = [[], [], [], []];
    shuffle(pick).forEach((r, j) => rows[j % 4].push(r));
    const speeds = ['150s', '120s', '170s', '135s'];
    rows.forEach((row, ri) => {
      const el = h('div', { class: 'wall-row' + (ri % 2 ? ' rev' : ''), style: `--spd:${speeds[ri]}` });
      [...row, ...row].forEach(r => {
        el.append(h('div', { class: 'wtile' }, h('div', { class: 'wv' }, autoVideo(r.v, { poster: r.p })),
          h('div', { class: 'wc' }, h('b', null, r.title), h('span', null, DOM[r.d].abbr))));
      });
      plane.append(el);
    });
    const heroEl = $('#top');
    heroEl.addEventListener('pointermove', e => {
      const x = e.clientX / innerWidth - .5, y = e.clientY / innerHeight - .5;
      plane.style.transform = `rotateY(${-20 + x * 8}deg) rotateX(${9 - y * 6}deg) rotateZ(-4deg)`;
    });

    // instruction note
    const pool = D.raw.filter(r => r.L3.length < 78 && r.L3.length > 30);
    const chosen = [];
    DOMS.forEach(d => { const a = pool.filter(r => r.d === d.key); for (let j = 0; j < 3 && a.length; j++) chosen.push(a[Math.floor((j + .3) * a.length / 3)]); });
    const seq = shuffle(chosen.slice());
    const ca = D.raw.find(r => r.s === 'atom-na'); if (ca) seq.unshift(ca);
    const nt = $('#heroNoteTxt'), ns = $('#heroNoteSrc');
    let n = 0;
    (function next() {
      const r = seq[n++ % seq.length];
      ns.textContent = ' ';
      typeText(nt, r.L3, { speed: 32, onDone: () => { ns.textContent = `${DOM[r.d].name} · ${r.title}`; setTimeout(next, 3200); } });
    })();
  }

  function tickers() {
    const names = ['Algorithms', 'Charts', 'Chemistry', 'Circuits', 'Mathematics', 'Physics', 'Web interfaces'];
    const t1 = $('#ticker'); [...names, ...names].forEach(n => t1.append(h('span', null, n)));
    const short = [];
    DOMS.forEach(d => D.raw.filter(r => r.d === d.key && r.L3.length <= 52).slice(0, 2).forEach(r => short.push(r.L3.replace(/\.$/, ''))));
    const t2 = $('#ticker2'); t2.style.animationDuration = '90s'; t2.style.animationDirection = 'reverse';
    [...short, ...short].forEach(n => t2.append(h('span', { style: 'font-size:clamp(22px,2.6vw,36px)' }, '“' + n + '”')));
  }

  function stats() {
    $$('[data-reveal]').forEach(reveal);
    $$('.stat').forEach(st => st.addEventListener('reveal', () => {
      const v = $('.v', st); countUp(v, +v.dataset.count, { dur: 1800, sep: !!v.dataset.sep });
    }, { once: true }));
    $$('.abs-body, .sec-head').forEach(el => onReveal(el, () => {}));
  }

  /* ======================================================================
     TASK SCROLLY
     ====================================================================== */
  const CODE = [
    ['cm', '# Procedural reconstruction of the "Calcium" atom-viewer clip'],
    ['cm', '# (1222x750, 24 fps, 2 s), edited: neutral Ca -> Ca2+ ion.'],
    ['cm', '# The ion has lost its two 4s electrons: 20 p+, 20 n, 18 e-;'],
    ['cm', '# the outermost (n=4) shell is empty and therefore not drawn.'],
    ['', ''],
    ['', 'RADII = (<nu>128.04</nu>, <nu>198.96</nu>, <nu>270.02</nu>, <nu>341.18</nu>)'],
    ['', 'OMEGA = (<nu>-0.570</nu>, <nu>-0.500</nu>, <nu>-0.428</nu>, <nu>-0.356</nu>)  <cm># rad/s, from motion</cm>'],
    ['', 'SHELL = [<nu>0</nu>, <nu>0</nu>] + [<nu>1</nu>] * <nu>8</nu> + [<nu>2</nu>] * <nu>8</nu> + [<nu>3</nu>, <nu>3</nu>]'],
    ['', 'fit_text(d, <st2>"2+"</st2>, F_BOLD, (<nu>190</nu>, <nu>24</nu>, <nu>222</nu>, <nu>45</nu>), dark)'],
    ['', ''],
    ['', '<kw>for</kw> f <kw>in</kw> range(NFRAMES):'],
    ['', '    t = f / FPS'],
    ['', '    <kw>for</kw> R <kw>in</kw> RADII[:<nu>3</nu>]:   <cm># n=4 shell is empty in Ca2+</cm>'],
    ['', '        ...'],
    ['', '    <kw>for</kw> e <kw>in</kw> range(<nu>20</nu>):'],
    ['', '        <kw>if</kw> SHELL[e] == <nu>3</nu>:   <cm># the two 4s electrons were removed</cm>'],
    ['', '            <kw>continue</kw>'],
    ['', '        th = PHASE[e] + OMEGA[SHELL[e]] * t'],
    ['cm', '        # ... depth-sorted electrons, trails, nucleus'],
  ];
  const codeHTML = ([c, l]) => (c ? `<span class="${c}">${l}</span>` : l).replace(/<(\/?)(nu|cm|kw|st2)>/g, (m, sl, tg) => sl ? '</span>' : `<span class="${tg}">`);
  function task() {
    const stage = $('#stage'), steps = $$('.step'), title = $('#stageTitle');
    const vs = $('.v-src', stage), ve = $('.v-edit', stage);
    const titles = ['source.mp4 — 2.0 s · 1222×750 · pixels only', 'instruction.txt — 1 sentence', 'render.py — rebuilding the scene from scratch', 'edited.mp4 — judged against the hidden reference'];
    const t = TASK['chemistry/atom-ca/L3'];
    const list = $('#taskCrit');
    ['D', 'R', 'I'].forEach(c => t.crit[c].forEach(q => list.append(h('li', null, h('span', { class: 'cdot ' + c, style: 'margin-top:5px' }), h('span', null, q.replace(/ Check only the parts.*$/, ''))))));
    let cur = -1, codeTimer = null;
    function typeCode() {
      const pre = $('#codePre'); clear(pre);
      let k = 0; clearInterval(codeTimer);
      codeTimer = setInterval(() => {
        if (k >= CODE.length) { clearInterval(codeTimer); return; }
        const line = h('div', { html: codeHTML(CODE[k]) || '&nbsp;', style: 'opacity:0;transform:translateX(-6px);transition:all .35s' });
        pre.append(line); requestAnimationFrame(() => { line.style.opacity = 1; line.style.transform = 'none'; });
        k++;
      }, 110);
    }
    function go(i) {
      if (i === cur) return; cur = i;
      stage.dataset.step = i; steps.forEach((st, j) => st.classList.toggle('on', j === i));
      title.textContent = titles[i];
      if (i === 1) typeText($('#stageNoteTxt'), t.ins, { speed: 34 });
      if (i === 2) typeCode();
      if (i === 3) { try { ve.currentTime = vs.currentTime % (ve.duration || 2); } catch (e) {} }
    }
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) go(+e.target.dataset.step); }), { rootMargin: '-48% 0px -48% 0px' });
    steps.forEach(st => io.observe(st));
    go(0);
    new IntersectionObserver(es => es.forEach(e => { [vs, ve].forEach(v => e.isIntersecting ? v.play().catch(() => {}) : v.pause()); }), { threshold: .05 }).observe(stage);
  }

  /* ======================================================================
     LEVEL GLYPHS
     ====================================================================== */
  function glyphs() {
    const ink = '#CFC5B3', act = { L1: '#A3AEE0', L2: '#6E7DC8', L3: '#35418F' };
    // L1: one element changes
    const g1 = $('#glyphL1'); const c1 = [];
    for (let i = 0; i < 6; i++) { const c = s('circle', { cx: 30 + i * 40, cy: 46, r: 13, fill: ink }); c1.push(c); g1.append(c); }
    let on1 = false;
    setInterval(() => { on1 = !on1; c1[2].setAttribute('fill', on1 ? act.L1 : ink); c1[2].setAttribute('r', on1 ? 17 : 13); }, 1600);
    // L2: element + linked readout
    const g2 = $('#glyphL2');
    g2.append(s('path', { d: 'M30 46 H190', stroke: '#E2D9C8', 'stroke-width': 3 }));
    const c2 = []; for (let i = 0; i < 5; i++) { const c = s('circle', { cx: 30 + i * 40, cy: 46, r: 12, fill: ink }); c2.push(c); g2.append(c); }
    const box = s('rect', { x: 206, y: 28, width: 48, height: 36, rx: 8, fill: '#fff', stroke: ink, 'stroke-width': 2 });
    const num = s('text', { x: 230, y: 52, 'text-anchor': 'middle', style: 'font:700 16px var(--f-ui);fill:var(--ink)', text: 'Σ 10' });
    const link = s('path', { d: 'M110 30 C 140 6, 190 6, 214 28', fill: 'none', stroke: act.L2, 'stroke-width': 2, 'stroke-dasharray': '4 5', opacity: 0 });
    g2.append(link, box, num);
    let on2 = false;
    setInterval(() => {
      on2 = !on2;
      c2[2].setAttribute('fill', on2 ? act.L2 : ink); c2[2].setAttribute('r', on2 ? 16 : 12);
      setTimeout(() => { link.setAttribute('opacity', on2 ? 1 : 0); [1, 3].forEach(j => c2[j].setAttribute('fill', on2 ? '#C3CAEB' : ink)); }, 250);
      setTimeout(() => { box.setAttribute('stroke', on2 ? act.L2 : ink); num.textContent = on2 ? 'Σ 11' : 'Σ 10'; }, 550);
    }, 2000);
    // L3: the rule changes, the structure is re-derived
    const g3 = $('#glyphL3');
    const A = [[130, 16], [80, 46], [180, 46], [55, 78], [105, 78], [155, 78], [205, 78]];
    const B = [[130, 16], [60, 46], [200, 46], [40, 78], [80, 78], [200, 78], [240, 46]];
    const edges = [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [2, 6]];
    const ls = edges.map(() => { const l = s('line', { stroke: '#D8CEBD', 'stroke-width': 2.5 }); g3.append(l); return l; });
    const ns = A.map((p, i) => { const c = s('circle', { r: i ? 10 : 12, fill: i ? ink : act.L3 }); g3.append(c); return c; });
    let st = A, on3 = false;
    function place3(P) {
      ns.forEach((c, i) => { C.tween(c, { cx: P[i][0], cy: P[i][1] }, 900); });
      ls.forEach((l, i) => { const [a, b] = edges[i]; C.tween(l, { x1: P[a][0], y1: P[a][1], x2: P[b][0], y2: P[b][1] }, 900); });
    }
    ns.forEach((c, i) => { c.setAttribute('cx', A[i][0]); c.setAttribute('cy', A[i][1]); });
    ls.forEach((l, i) => { const [a, b] = edges[i]; l.setAttribute('x1', A[a][0]); l.setAttribute('y1', A[a][1]); l.setAttribute('x2', A[b][0]); l.setAttribute('y2', A[b][1]); });
    setInterval(() => {
      on3 = !on3; st = on3 ? B : A; place3(st);
      ns.forEach((c, i) => { if (i) setTimeout(() => c.setAttribute('fill', on3 ? (i % 2 ? act.L3 : '#7D88C9') : ink), 120 * i); });
    }, 2400);
  }

  /* ======================================================================
     TRIPLET EXPLORER
     ====================================================================== */
  function triplet() {
    const scenes = { algorithms: 'backtracking-n-queens', charts: '01-trend', chemistry: 'atom-f', electric: '04_rc_low_pass', math: '056_HowVarianceAdds', physics: 'three_gear_chain', web: '15-salon-calendar' };
    const wipeEl = $('#tripWipe'), base = $('.w-base', wipeEl), top = $('.w-top video', wipeEl);
    const wipe = makeWipe(wipeEl, 50);
    const sync = new SyncGroup().watch(wipeEl);
    const list = $('#tripList');
    let dom = 'physics', lvl = 'L3', first = true;
    function render() {
      const sc = scenes[dom], t1 = TASK[`${dom}/${sc}/L1`];
      base.src = t1.srcv.src; base.poster = t1.srcp;
      clear(list);
      LEVELS.forEach(L => {
        const t = TASK[`${dom}/${sc}/${L}`];
        const it = h('button', { class: 'trip-item' + (L === lvl ? ' on' : ''), type: 'button' },
          h('div', { class: 'tv' }, autoVideo(t.gtv.src, { poster: t.gtp })),
          h('div', null, h('span', { class: 'lv ' + L }, L), h('div', { class: 'ti' }, '“' + t.ins + '”'),
            h('div', { class: 'dots' }, ['D', 'R', 'I'].flatMap(c => t.crit[c].map(() => h('span', { class: 'cdot ' + c }))))));
        it.addEventListener('click', () => { lvl = L; render(); wipe.sweep(92, 50, 1100); });
        list.append(it);
      });
      const t = TASK[`${dom}/${sc}/${lvl}`];
      top.src = t.gtv.src; top.poster = t.gtp;
      $('#tripWipeLab').textContent = 'Reference · ' + lvl;
      $('#tripCap').textContent = `${DOM[dom].name} · ${t.title} · ${t.crit.D.length + t.crit.R.length + t.crit.I.length} criteria at ${lvl}`;
      sync.set([base, top], t1.srcv.dur);
      sync.play();
    }
    seg($('#tripDom'), DOMS.map(d => ({ v: d.key, label: d.abbr })), v => { dom = v; render(); wipe.sweep(10, 50, 1100); }, dom);
    render();
    onReveal(wipeEl, () => { if (first) { first = false; wipe.sweep(6, 50, 1800); } });
  }

  /* ======================================================================
     ATLAS
     ====================================================================== */
  function atlas() {
    const cnt = {}; D.raw.forEach(r => cnt[r.d] = (cnt[r.d] || 0) + 1);
    const showcase = { algorithms: 'dijkstra-relax', charts: '06-heatmap', chemistry: 'atom-ca', electric: '07_rlc_step', math: '044_StereographicProjection', physics: 'double_pendulum', web: '01-atelier-cart' };
    const dc = $('#domCards');
    DOMS.forEach((d, i) => {
      const r = D.raw.find(x => x.d === d.key && x.s === showcase[d.key]) || D.raw.find(x => x.d === d.key);
      const card = h('button', { class: 'dom-card', type: 'button', 'data-reveal': '', style: `--d:${i * .06}s` },
        h('div', { class: 'dv' }, autoVideo(r.v, { poster: r.p })),
        h('div', { class: 'dm' }, h('div', { class: 'dn' }, d.key === 'web' ? 'Web UIs' : d.key === 'math' ? 'Math' : d.name), h('div', { class: 'dd' }, h('span', null, cnt[d.key] + ' scenes'), h('span', { class: 'fam ' + d.fam }, d.famName))));
      card.addEventListener('click', () => { filt.set(d.key, true); $('#atlasGrid').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
      dc.append(card); reveal(card);
    });
    const grid = $('#atlasGrid'), count = $('#atlasCount'), search = $('#atlasSearch');
    // interleave domains so the 'All' view mixes them
    const byDom = DOMS.map(d => D.raw.filter(r => r.d === d.key));
    const mixed = []; for (let i = 0; i < Math.max(...byDom.map(x => x.length)); i++) byDom.forEach(x => { if (x[i]) mixed.push(x[i]); });
    const tiles = mixed.map(r => {
      const tile = h('button', { class: 'at', type: 'button', 'data-d': r.d },
        h('div', { class: 'av' }, h('img', { src: r.p, alt: r.title, loading: 'lazy' })),
        r.evaluated ? h('span', { class: 'ev' }, 'evaluated') : '',
        h('div', { class: 'an' }, r.title, h('small', null, DOM[r.d].name)));
      tile._r = r;
      tile._q = (r.title + ' ' + r.s + ' ' + r.L1 + ' ' + r.L2 + ' ' + r.L3 + ' ' + DOM[r.d].name).toLowerCase();
      let vid = null;
      tile.addEventListener('pointerenter', () => {
        if (vid) return;
        vid = h('video', { src: r.v, muted: true, loop: true, playsinline: true, autoplay: true }); vid.muted = true;
        $('.av', tile).append(vid); vid.play().catch(() => {});
      });
      tile.addEventListener('pointerleave', () => { if (vid) { vid.pause(); vid.remove(); vid = null; } });
      tile.addEventListener('click', () => openScene(r));
      grid.append(tile);
      return tile;
    });
    let dom = 'all', q = '';
    function apply(animate) {
      const before = new Map();
      if (animate) tiles.forEach(t => { if (!t.classList.contains('hide')) before.set(t, t.getBoundingClientRect()); });
      let n = 0;
      tiles.forEach(t => {
        const ok = (dom === 'all' || t._r.d === dom) && (!q || t._q.includes(q));
        t.classList.toggle('hide', !ok); if (ok) n++;
      });
      count.textContent = `${n} of ${tiles.length} scenes`;
      if (!animate) return;
      tiles.forEach(t => {
        if (t.classList.contains('hide')) return;
        const b = before.get(t), a = t.getBoundingClientRect();
        if (b) { const dx = b.left - a.left, dy = b.top - a.top; if (!dx && !dy) return; t.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: 600, easing: 'cubic-bezier(.16,1,.3,1)' }); }
        else t.animate([{ opacity: 0, transform: 'scale(.85)' }, { opacity: 1, transform: 'none' }], { duration: 500, easing: 'cubic-bezier(.16,1,.3,1)' });
      });
    }
    const items = [{ v: 'all', html: `All <span class="cnt">${D.raw.length}</span>` }, ...DOMS.map(d => ({ v: d.key, html: `${d.abbr} <span class="cnt">${cnt[d.key]}</span>` }))];
    const filt = seg($('#atlasFilters'), items, v => { dom = v; apply(true); }, 'all');
    $('#atlasFilters').classList.add('seg');
    search.addEventListener('input', () => { q = search.value.trim().toLowerCase(); apply(true); });
    apply(false);
    VB.openScene = openScene;
  }
  function openScene(r) {
    const node = h('div', { class: 'lb-body' },
      h('div', null, h('video', { src: r.v.replace('/raw/', '/raw_hd/'), poster: r.p, muted: true, loop: true, autoplay: true, playsinline: true, controls: true })),
      h('div', null,
        h('div', { class: 'kicker', style: 'margin-bottom:4px' }, DOM[r.d].name, ' ', h('span', { class: 'fam ' + DOM[r.d].fam }, DOM[r.d].famName)),
        h('h3', null, r.title),
        h('div', { class: 'lb-lv' }, LEVELS.map(L => h('div', null, h('span', { class: 'lv ' + L }, L), h('p', null, r[L])))),
        r.evaluated ? h('div', { style: 'margin-top:16px;display:flex;gap:10px;flex-wrap:wrap' }, LEVELS.map(L => h('button', { class: 'btn', type: 'button', onclick: () => { VB.closeLB(); VB.arenaGo && VB.arenaGo(r.d, r.s, L); } }, `Watch 8 agents · ${L}`))) :
          h('p', { class: 'muted ui small', style: 'margin-top:14px' }, 'Reference edits are hidden for this scene; it is part of the full 678-task benchmark.')));
    openLB(h('div', null, node));
    const v = $('video', node); v.muted = true; v.play().catch(() => {});
  }

  /* ======================================================================
     PIXEL-METRIC DIAGRAMS
     ====================================================================== */
  function pixelDiagrams() {
    // Fidelity: cells outside the edit region light up
    const f = $('#pxFid'); const cells = [];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 14; c++) {
      const inEdit = c >= 6 && c <= 9 && r >= 1 && r <= 2;
      const el = s('rect', { x: 8 + c * 16.5, y: 4 + r * 16, width: 14, height: 13.5, rx: 3, fill: inEdit ? '#fff' : '#E9E1D2', stroke: inEdit ? '#C9BFAE' : 'none', 'stroke-dasharray': inEdit ? '3 2' : null });
      f.append(el); if (!inEdit) cells.push(el);
    }
    f.append(s('text', { x: 8 + 6 * 16.5 + 2, y: 4 + 1 * 16 + 19, style: 'font:700 9.5px var(--f-ui);fill:var(--ink-3)', text: 'edit region' }));
    // Smoothness: reference vs candidate motion, with a freeze
    const m = $('#pxSm');
    const ref = 'M6,52 C40,52 50,14 80,14 S120,50 150,40 S200,12 234,20';
    const cand = 'M6,54 C40,54 50,18 80,18 L118,18 C130,18 140,46 152,44 S200,16 234,24';
    m.append(s('path', { d: ref, fill: 'none', stroke: '#CFC5B3', 'stroke-width': 2.5 }),
      s('path', { d: cand, fill: 'none', stroke: 'var(--ink)', 'stroke-width': 2.2, class: 'pxdraw', style: 'stroke-dasharray:320;stroke-dashoffset:320;transition:stroke-dashoffset 2.2s ease' }),
      s('rect', { x: 82, y: 8, width: 36, height: 18, rx: 4, fill: 'rgba(200,85,61,.12)', class: 'pxfreeze', opacity: 0, style: 'transition:opacity .6s 1.6s' }),
      s('text', { x: 100, y: 37, 'text-anchor': 'middle', style: 'font:700 18px var(--f-hand);fill:var(--bad)', class: 'pxfreeze', opacity: 0, text: 'freeze' }),
      s('text', { x: 236, y: 66, 'text-anchor': 'end', style: 'font:11px var(--f-ui);fill:var(--ink-3)', text: 'motion over time · grey = reference' }));
    // GT improvement: how much of the gap is closed
    const g = $('#pxGt');
    g.append(s('rect', { x: 10, y: 26, width: 220, height: 12, rx: 6, fill: '#E9E1D2' }));
    const fill = s('rect', { x: 10, y: 26, width: 0, height: 12, rx: 6, fill: 'var(--inv)', style: 'transition:width 1.8s cubic-bezier(.16,1,.3,1)' });
    const mk = s('text', { x: 10, y: 18, 'text-anchor': 'middle', style: 'font:700 13px var(--f-ui);fill:var(--ink);transition:transform 1.8s cubic-bezier(.16,1,.3,1)', text: '68' });
    g.append(fill, mk, s('text', { x: 10, y: 58, style: 'font:600 11px var(--f-ui);fill:var(--ink-3)', text: 'source = 0' }), s('text', { x: 230, y: 58, 'text-anchor': 'end', style: 'font:600 11px var(--f-ui);fill:var(--ink-3)', text: '100 = reference' }));
    onReveal($('.px-row'), () => {
      cells.forEach((c, i) => setTimeout(() => c.setAttribute('fill', i % 9 === 4 ? '#F0C9BC' : '#BFE0D6'), 40 * i));
      $$('.pxdraw', m).forEach(p => p.style.strokeDashoffset = 0);
      $$('.pxfreeze', m).forEach(p => p.setAttribute('opacity', 1));
      fill.setAttribute('width', 220 * .68); mk.style.transform = `translateX(${220 * .68}px)`;
    });
  }

  /* ======================================================================
     COMPOSITE CALCULATOR
     ====================================================================== */
  function calculator() {
    const opus = D.level['claude-opus5.5'].L3;
    const F = [
      { k: 'dir', lab: 'Direct', c: 'var(--dir)', v: opus.dir }, { k: 'der', lab: 'Derived', c: 'var(--der)', v: opus.der },
      { k: 'inv', lab: 'Invariant', c: 'var(--inv)', v: opus.inv }, { k: 'fid', lab: 'Fidelity', c: '#8A9099', v: opus.fid },
      { k: 'sm', lab: 'Smoothness', c: '#8A9099', v: opus.sm }, { k: 'gt', lab: 'GT improvement', c: '#8A9099', v: opus.gt },
    ];
    const val = {}, inputs = {}, outs = {};
    const wrap = $('#sliders');
    let copy = false;
    F.forEach(f => {
      val[f.k] = +f.v.toFixed(1);
      const inp = h('input', { type: 'range', min: 0, max: 100, step: .1, value: val[f.k], style: `--c:${f.c}` });
      const out = h('output', null, fmt(val[f.k]));
      inp.addEventListener('input', () => { val[f.k] = +inp.value; copy = false; update(); });
      inputs[f.k] = inp; outs[f.k] = out;
      wrap.append(h('div', { class: 'sl' }, h('label', null, h('i', { style: `background:${f.c}` }), f.lab), inp, out));
    });
    const hasDer = $('#hasDer'); hasDer.addEventListener('change', () => { copy = false; update(); });
    const rc = $('#receipt');
    const L = (a, b, cls) => h('div', { class: 'rl' + (cls ? ' ' + cls : '') }, h('span', null, a), h('span', null, b));
    let shown = 0;
    function update() {
      F.forEach(f => { inputs[f.k].value = val[f.k]; inputs[f.k].style.setProperty('--p', val[f.k] + '%'); outs[f.k].textContent = fmt(val[f.k]); });
      inputs.der.disabled = !hasDer.checked; inputs.der.parentElement.style.opacity = hasDer.checked ? 1 : .4;
      const E = hasDer.checked ? .55 * val.dir + .45 * val.der : val.dir;
      const Q = .75 + (.10 * val.inv + .05 * val.fid + .05 * val.sm + .05 * val.gt) / 100;
      const S = copy ? 0 : E * Q;
      clear(rc).append(h('h5', null, 'VEDIT-Bench · composite'), h('div', { class: 'rsub' }, 'Score = E × Q'),
        hasDer.checked ? L(`Direct ${fmt(val.dir)} × 0.55`, fmt(.55 * val.dir, 2)) : L(`Direct ${fmt(val.dir)} × 1.00`, fmt(val.dir, 2)),
        hasDer.checked ? L(`Derived ${fmt(val.der)} × 0.45`, fmt(.45 * val.der, 2)) : L('Derived', 'n/a'),
        L('Edit term  E', fmt(E, 2), 'b'), h('hr'),
        L('base', '0.750'), L(`Invariant ${fmt(val.inv)} × 0.10`, '+' + (.001 * val.inv).toFixed(3)), L(`Fidelity ${fmt(val.fid)} × 0.05`, '+' + (.0005 * val.fid).toFixed(3)),
        L(`Smoothness ${fmt(val.sm)} × 0.05`, '+' + (.0005 * val.sm).toFixed(3)), L(`GT impr. ${fmt(val.gt)} × 0.05`, '+' + (.0005 * val.gt).toFixed(3)),
        L('Quality factor  Q', Q.toFixed(3)), h('hr'));
      const big = h('b', null, fmt(shown));
      rc.append(h('div', { class: 'tot' }, h('span', null, 'TOTAL'), big),
        h('div', { class: 'gauge' }, h('i', { style: `width:${S}%;background:var(--ink)` }), h('i', { style: `width:${copy ? 0 : E - S}%;background:#D6CFC2` })),
        h('div', { style: 'display:flex;justify-content:space-between;font-family:var(--f-ui);font-size:11px;color:var(--ink-3);margin-top:5px' }, h('span', null, '■ score'), h('span', null, '■ lost to Q')),
        h('div', { class: 'rnote' }, note(E, Q, S)));
      const from = shown, to = S, t0 = performance.now();
      (function f(t) { const p = clamp((t - t0) / 500, 0, 1); shown = from + (to - from) * (1 - Math.pow(1 - p, 3)); big.textContent = fmt(shown); if (p < 1) requestAnimationFrame(f); })(t0);
    }
    function note(E, Q, S) {
      if (copy) return 'unchanged copy of the source ⇒ 0, by rule';
      if (val.dir < 20) return 'perfect preservation can’t rescue a skipped edit';
      if (hasDer.checked && val.der < 50 && val.dir > 85) return 'stated change done, consequences missed — the L3 pattern';
      if (val.gt < 15 && E > 85) return 'a valid edit in another style still scores well: GT weighs only 5%';
      if (Q < .85) return `quality costs ${fmt((1 - Q) * 100, 0)}% of the edit term here`;
      return `Q trims at most 25% — here ${fmt((1 - Q) * 100, 1)}%`;
    }
    const presets = [
      ['Opus 5.5 · L3 mean', () => F.forEach(f => val[f.k] = +f.v.toFixed(1)), true],
      ['Consequences ignored', () => Object.assign(val, { dir: 100, der: 25, inv: 100, fid: 92, sm: 90, gt: 30 }), true],
      ['Right edit, other style', () => Object.assign(val, { dir: 100, der: 100, inv: 96, fid: 80, sm: 92, gt: 4 }), true],
      ['Edit skipped', () => Object.assign(val, { dir: 0, der: 0, inv: 100, fid: 100, sm: 100, gt: 0 }), true],
      ['Unchanged source copy', () => { Object.assign(val, { dir: 0, der: 0, inv: 100, fid: 100, sm: 95, gt: 0 }); return 'copy'; }, true],
    ];
    const pw = $('#presets');
    presets.forEach(([lab, fn, der]) => pw.append(h('button', { class: 'chip', type: 'button', onclick: () => { const r = fn(); copy = r === 'copy'; hasDer.checked = der; update(); } }, lab)));
    update();
  }

  /* ======================================================================
     ARENA
     ====================================================================== */
  function arena() {
    const grid = $('#arGrid'), playBtn = $('#arPlay'), scrub = $('#arScrub'), fillEl = $('.fill', scrub), hd = $('.hd', scrub), tm = $('#arTime');
    let level = 'L3', dom = 'physics', scene = PICKS.L3.physics, sortBy = 'score';
    const sync = new SyncGroup({ onTick: (p, playing) => {
      fillEl.style.width = p * 100 + '%'; hd.style.left = p * 100 + '%';
      tm.textContent = Math.round(p * 100) + '%'; playBtn.innerHTML = playing ? ICON.pause : ICON.play;
    } }).watch(grid);
    playBtn.innerHTML = ICON.play;
    playBtn.addEventListener('click', () => sync.toggle());
    let drag = false, wasPlaying = false;
    const pos = ev => { const r = scrub.getBoundingClientRect(); sync.seek((ev.clientX - r.left) / r.width); };
    scrub.addEventListener('pointerdown', ev => { drag = true; wasPlaying = sync.playing; if (wasPlaying) sync.pause(); scrub.setPointerCapture(ev.pointerId); pos(ev); });
    scrub.addEventListener('pointermove', ev => { if (drag) pos(ev); });
    scrub.addEventListener('pointerup', () => { drag = false; if (wasPlaying) sync.play(); });
    $$('#arSpeed button').forEach(b => b.addEventListener('click', () => { $$('#arSpeed button').forEach(x => x.classList.toggle('on', x === b)); sync.setSpeed(+b.dataset.s); }));
    $('#arSort').addEventListener('click', () => { sortBy = sortBy === 'score' ? 'board' : 'score'; $('#arSort').textContent = 'Sort: ' + (sortBy === 'score' ? 'score' : 'leaderboard'); order(true); });

    const lvSeg = seg($('#arLevel'), LEVELS.map(L => ({ v: L, label: L })), v => { level = v; scene = PICKS[level][dom]; chips(); load(); }, level);
    const domSeg = seg($('#arDomain'), DOMS.map(d => ({ v: d.key, label: d.name })), v => { dom = v; scene = PICKS[level][dom]; chips(); load(); }, dom);
    function chips() {
      const wrap = clear($('#arScene'));
      const scs = [...new Set(D.tasks.filter(t => t.d === dom).map(t => t.s))];
      scs.forEach(sc => {
        const t = TASK[`${dom}/${sc}/${level}`];
        const c = h('button', { class: 'chip' + (sc === scene ? ' on' : ''), type: 'button' }, PICKS[level][dom] === sc ? h('span', { class: 'star' }, '★') : '', t.title);
        c.addEventListener('click', () => { scene = sc; chips(); load(); });
        wrap.append(c);
      });
    }
    let tiles = [];
    function pips(o, t) {
      return ['D', 'R', 'I'].filter(c => t.crit[c].length).map(c => h('div', { class: 'pips' }, h('span', { class: 'k' }, c === 'R' ? 'Der' : c === 'D' ? 'Dir' : 'Inv'),
        t.crit[c].map((q, i) => { const r = o.pts[c][i]; return h('span', { class: 'pip ' + c, title: `${CAT[c].name} ${i + 1}: ${r == null ? '–' : r}/4` }, h('i', { style: `--h:${r == null ? 0 : r / 4 * 100}%` })); })));
    }
    function load() {
      const t = TASK[`${dom}/${scene}/${level}`];
      typeText($('#arInsTxt'), '“' + t.ins + '”', { speed: 20 });
      const meta = clear($('#arInsMeta'));
      meta.append(h('span', { class: 'lv ' + level }, level), `${DOM[dom].name} · ${t.title}`, PICKS[level][dom] === scene ? h('span', { class: 'chip', style: 'cursor:default;padding:3px 10px' }, h('span', { style: 'color:var(--der)' }, '★'), ' shown in the paper') : '');
      const cs = clear($('#arCrit'));
      ['D', 'R', 'I'].forEach(c => { if (t.crit[c].length) cs.append(h('span', { class: 'tag ' + c }, `${CAT[c].name} × ${t.crit[c].length}`)); });
      clear(grid); tiles = [];
      const vids = [];
      const mk = (cls, head, src, poster, extra) => {
        const v = h('video', { muted: true, playsinline: true, preload: 'auto', poster }); v.muted = true; if (src) v.src = src; vids.push(v);
        const tile = h('div', { class: 'tile ' + cls }, h('div', { class: 'th' }, head), h('div', { class: 'tv' }, v), extra || '');
        return tile;
      };
      grid.append(mk('src', [h('span', { class: 'sw', style: 'background:var(--ink)' }), 'Source', h('span', { class: 'sc', style: 'font-size:11px;color:var(--ink-3);font-weight:600' }, 'input')], t.srcv.src, t.srcp, h('div', { class: 'tf' }, h('div', { class: 'pips' }, 'what the agent sees'))));
      grid.append(mk('ref', [h('span', { class: 'sw', style: 'background:var(--der)' }), 'Reference', h('span', { class: 'sc', style: 'font-size:11px;color:var(--ink-3);font-weight:600' }, 'hidden')], t.gtv.src, t.gtp, h('div', { class: 'tf' }, h('div', { class: 'pips' }, 'ground-truth edit'))));
      SYS_KEYS.forEach(k => {
        const o = t.out[k];
        if (!o) {
          const tile = h('div', { class: 'tile missing' }, h('div', { class: 'th' }, h('img', { src: logo(k), alt: '' }), SYS[k].short, h('span', { class: 'sc' }, '0')), h('div', { class: 'tv' }, 'no video delivered'), h('div', { class: 'tf' }, h('div', { class: 'pips' }, 'scored 0 under Auto-zero')));
          tile._k = k; tile._s = -1; tiles.push(tile); grid.append(tile); return;
        }
        const f = FAIL_AT[t.key + '|' + k];
        const tile = mk('agent', [h('img', { src: logo(k), alt: '' }), SYS[k].short, h('span', { class: 'sc' }, fmt(o.score))], o.v.src, null,
          h('div', { class: 'tf' }, h('div', { style: `height:3px;border-radius:2px;background:var(--paper-2);margin-bottom:2px;overflow:hidden` }, h('i', { style: `display:block;height:100%;width:${o.score}%;background:${C.scoreCol(o.score)}` })), pips(o, t)));
        if (f) $('.tv', tile).append(h('span', { class: 'fail-note' }, f.note));
        tile._k = k; tile._s = o.score;
        tile.addEventListener('click', () => judge(t, k));
        tiles.push(tile); grid.append(tile);
      });
      order(false);
      sync.set(vids, t.gtv.dur || t.srcv.dur);
      sync.play();
    }
    function order(animate) {
      const before = new Map(); if (animate) tiles.forEach(x => before.set(x, x.getBoundingClientRect()));
      const sorted = tiles.slice().sort((a, b) => sortBy === 'score' ? (b._s - a._s) || (SYS[a._k].i - SYS[b._k].i) : VB.boardOrder.indexOf(a._k) - VB.boardOrder.indexOf(b._k));
      sorted.forEach(x => grid.append(x));
      if (animate) sorted.forEach(x => { const b = before.get(x), a = x.getBoundingClientRect(); x.animate([{ transform: `translate(${b.left - a.left}px,${b.top - a.top}px)` }, { transform: 'none' }], { duration: 650, easing: 'cubic-bezier(.16,1,.3,1)' }); });
    }
    function judge(t, k) {
      const o = t.out[k];
      const wv = h('div', { class: 'wipe', style: '--x:50%' },
        h('video', { class: 'w-base', src: t.gtv.src, muted: true, playsinline: true }),
        h('div', { class: 'w-top' }, h('video', { src: o.v.src, muted: true, playsinline: true })),
        h('span', { class: 'w-lab l', style: 'background:var(--der);color:#2b1a02' }, 'Reference'), h('span', { class: 'w-lab r', style: 'background:rgba(31,26,21,.85);color:var(--paper)' }, SYS[k].short),
        h('div', { class: 'w-bar' }, h('div', { class: 'w-knob', html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l-6 6 6 6M15 6l6 6-6 6"/></svg>' })));
      const crit = h('div', { class: 'crit' });
      ['D', 'R', 'I'].forEach(c => t.crit[c].forEach((q, i) => {
        const r = o.pts[c][i];
        crit.append(h('div', { class: 'ci ' + c }, h('div', { class: 'q' }, h('span', { class: 'tag ' + c, style: 'margin-right:8px' }, `${CAT[c].name} ${i + 1}`), q.replace(/ Check only the parts.*$/, '')),
          h('div', { class: 'rt' }, [0, 1, 2, 3].map(j => h('i', { class: r != null && j < r ? 'f' : '' })), h('b', { style: 'margin-left:6px;color:var(--ink)' }, r == null ? '–' : `${r} / 4`)),
          o.ev[c][i] ? h('div', { class: 'e' }, '“' + o.ev[c][i] + '”') : ''));
      }));
      const node = h('div', { class: 'jd' },
        h('div', null, wv, h('div', { class: 'wipe-cap' }, h('span', null, '“' + t.ins + '”'), h('span', { class: 'hint-hand' }, 'drag to compare')),
          h('div', { class: 'mrow' }, [['Score', o.score], ['Direct', o.dir], ['Derived', o.der], ['Invariant', o.inv], ['Fidelity', o.fid], ['Smoothness', o.sm], ['GT impr.', o.gt], ['Duration', null]].map(([a, b]) =>
            h('div', null, h('b', null, a === 'Duration' ? o.v.dur.toFixed(1) + ' s' : b == null ? 'n/a' : fmt(b)), h('span', null, a))))),
        h('div', null, h('h3', null, h('img', { src: logo(k), alt: '' }), SYS[k].name), h('div', { class: 'jsub' }, `${SYS[k].harness} · ${DOM[t.d].name} · ${t.title} · ${t.L} · judge: GPT-6.1-Terra`), crit));
      openLB(node, { cls: 'drawer', onClose: () => js.pause() });
      makeWipe(wv, 50).sweep(90, 50, 1200);
      const js = new SyncGroup(); js.set($$('video', wv), t.gtv.dur); js.play();
    }
    VB.arenaGo = (d, sc, L) => {
      level = L; dom = d; scene = sc; lvSeg.set(L); domSeg.set(d); chips(); load();
      $('#arena').scrollIntoView({ behavior: 'smooth' });
    };
    chips(); load();
  }

  /* ======================================================================
     FAILURE CAROUSEL
     ====================================================================== */
  function failures() {
    const wrap = $('#fails');
    const rot = [-1.4, 1, -.6, 1.3, -1.1, .7, -1.5, .9, -.8, 1.2, -1];
    FAILS.forEach((f, i) => {
      const t = TASK[f.t], o = t.out[f.m]; if (!o) return;
      const [cat, idx] = f.c;
      const vr = h('video', { muted: true, playsinline: true, preload: 'none', poster: t.gtp }); vr.muted = true; vr.dataset.src = t.gtv.src;
      const vc = h('video', { muted: true, playsinline: true, preload: 'none' }); vc.muted = true; vc.dataset.src = o.v.src;
      const passed = SYS_KEYS.filter(k => t.out[k] && t.out[k].pts[cat][idx] === 4);
      const card = h('article', { class: 'fcard', style: `--r:${rot[i % rot.length]}deg` },
        h('div', { class: 'fv' },
          h('div', null, vr, h('span', { class: 'lab r' }, 'Reference')),
          h('div', null, vc, h('span', { class: 'lab c' }, h('img', { src: logo(f.m), alt: '' }), SYS[f.m].short), h('span', { class: 'fail-note' }, f.note))),
        h('div', { class: 'fm' },
          h('div', { class: 'fh' }, h('span', { class: 'lv ' + t.L }, t.L), h('b', null, DOM[t.d].name), h('span', null, '· ' + t.title), h('span', { style: 'margin-left:auto' }, h('span', { class: 'tag ' + cat }, `${CAT[cat].name} ${idx + 1}: ${o.pts[cat][idx]}/4`))),
          h('p', { class: 'fq' }, '“' + t.ins + '”'),
          h('p', { class: 'fe' }, f.e),
          h('div', { class: 'who' }, h('span', { style: 'margin-right:4px' }, passed.length ? `Got this criterion fully right (${passed.length}/8):` : 'No agent got this criterion fully right.'),
            SYS_KEYS.filter(k => t.out[k]).map(k => h('span', { class: 'w ' + (passed.includes(k) ? 'ok' : 'no') }, h('i', { style: `background:${SYS[k].color}` }), SYS[k].short)))));
      wrap.append(card);
      const sg = new SyncGroup();
      new IntersectionObserver(es => es.forEach(e => {
        if (e.isIntersecting) {
          card.classList.add('is-in');
          if (!vr.src) { vr.src = vr.dataset.src; vc.src = vc.dataset.src; sg.set([vr, vc], t.gtv.dur); }
          sg.play();
        } else if (sg.playing) sg.pause();
      }), { threshold: .35 }).observe(card);
    });
    // drag to scroll (mouse)
    let down = false, x0 = 0, s0 = 0, moved = false;
    wrap.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') return; down = true; moved = false; x0 = e.clientX; s0 = wrap.scrollLeft; });
    addEventListener('pointermove', e => { if (!down) return; const dx = e.clientX - x0; if (Math.abs(dx) > 4) { moved = true; wrap.classList.add('drag'); } wrap.scrollLeft = s0 - dx; });
    addEventListener('pointerup', () => { if (!down) return; down = false; wrap.classList.remove('drag'); });
    const step = dir => { const c = $('.fcard', wrap); wrap.scrollBy({ left: dir * (c.offsetWidth + 26), behavior: 'smooth' }); };
    $('#fPrev').addEventListener('click', () => step(-1)); $('#fNext').addEventListener('click', () => step(1));
  }

  /* ======================================================================
     RELATED WORK TABLE
     ====================================================================== */
  function related() {
    const t = $('#cmp');
    const Y = 1, N = 0, NA = null;
    const groups = [
      ['Instruction-guided video editing', [['FiVE-Bench', [Y, N, Y, NA, N]], ['IVEBench', [Y, N, Y, NA, N]], ['OmniEdit-Bench', [Y, N, Y, NA, N]]]],
      ['Programmatic video generation', [['VibeVideoBench', [Y, Y, N, NA, N]], ['Animation2Code', [Y, Y, N, Y, N]], ['4DCodeBench', [Y, Y, N, Y, N]], ['Code2Video-Compass', [Y, Y, N, NA, N]]]],
      ['Programmatic artifact editing', [['ChartEdit', [N, Y, Y, Y, N]], ['SVGEditBench', [N, Y, Y, N, N]], ['VAO-Bench', [N, Y, Y, N, Y]]]],
    ];
    const heads = [['Dyn.', 'changes over time'], ['Code', 'output is a program'], ['Edit', 'modifies an artifact'], ['Hidden', 'source not given'], ['Derived', 'implicit effects scored']];
    t.append(h('thead', null, h('tr', null, h('th', null, 'Benchmark'), heads.map(([a, b]) => h('th', null, a, h('small', null, b))))));
    const tb = h('tbody'); t.append(tb);
    let n = 0;
    const mark = v => v == null ? h('span', { class: 'na' }, '–') :
      h('span', { html: `<svg class="mk ${v ? 'y' : 'n'}" viewBox="0 0 22 22" style="--d:${(n++) * .03}s">${v ? '<path d="M4 11.5l5 5 9-11"/>' : '<path d="M6 6l10 10M16 6L6 16"/>'}</svg>` }).firstChild;
    groups.forEach(([g, rows]) => {
      tb.append(h('tr', { class: 'grp' }, h('td', { colspan: 6 }, g)));
      rows.forEach(([name, v]) => tb.append(h('tr', null, h('td', null, name), v.map(x => h('td', null, mark(x))))));
    });
    tb.append(h('tr', { class: 'ours' }, h('td', null, 'VEDIT-Bench (ours)'), [Y, Y, Y, Y, Y].map(x => h('td', null, mark(x)))));
    onReveal(t.parentElement, () => t.classList.add('is-in'));
    t.parentElement.addEventListener('reveal', () => t.parentElement.classList.add('is-in'));
  }

  function bibtex() {
    $('#copyBib').addEventListener('click', () => {
      const txt = $('#bib').textContent.replace(/^Copy(ied!)?/, '').trim();
      const done = () => { $('#copyBib').textContent = 'Copied!'; setTimeout(() => $('#copyBib').textContent = 'Copy', 1500); };
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(txt).then(done, () => fallback(txt, done)); else fallback(txt, done);
    });
    function fallback(txt, done) { const ta = h('textarea', { style: 'position:fixed;opacity:0' }); ta.value = txt; document.body.append(ta); ta.select(); try { document.execCommand('copy'); } catch (e) {} ta.remove(); done(); }
  }

  /* ---------- boot ---------- */
  function boot() {
    const steps = [nav, hero, tickers, stats, task, glyphs, triplet, atlas, pixelDiagrams, calculator,
      C.findings, C.leaderboard, C.bump, C.measures, C.gap, C.radar, C.slope, C.medals, C.matrix, C.ptsBars, C.critChart, C.famBar,
      arena, failures, related, bibtex];
    steps.forEach(fn => { try { fn(); } catch (e) { console.error('[VEDIT]', fn.name, e); } });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
