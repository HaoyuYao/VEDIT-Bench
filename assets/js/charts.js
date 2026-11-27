/* VEDIT-Bench project page — result charts (hand-built SVG, values from reports/*.csv) */
(function () {
  'use strict';
  const { D, $, $$, h, s, clear, fmt, clamp, lerp, mean, SYS, SYS_KEYS, logo, DOMS, LEVELS, LCOL, tip, bindTip, onReveal } = window.VB;

  const ease = t => 1 - Math.pow(1 - t, 3);
  function tween(el, to, dur = 800) {
    const from = {}; for (const k in to) from[k] = parseFloat(el.getAttribute(k)) || 0;
    const t0 = performance.now();
    if (el._tw) cancelAnimationFrame(el._tw);
    (function f(t) {
      const p = clamp((t - t0) / dur, 0, 1), e = ease(p);
      for (const k in to) el.setAttribute(k, lerp(from[k], to[k], e));
      if (p < 1) el._tw = requestAnimationFrame(f);
    })(t0);
  }
  const setLen = path => { const L = path.getTotalLength ? path.getTotalLength() : 1000; path.style.setProperty('--len', Math.ceil(L) + 1); };
  const sysTip = (k, rows) => `<b><span class="sw" style="background:${SYS[k].color}"></span>${SYS[k].name}</b><div style="opacity:.7;margin-bottom:4px">${SYS[k].harness}</div>` +
    rows.map(([a, b]) => `<div class="tr"><span>${a}</span><span>${b}</span></div>`).join('');

  /* ---- derived tables ---- */
  const lvScore = (k, L, m = 'score') => D.level[k][L][m];
  const lvMean = (L, m) => mean(SYS_KEYS.map(k => D.level[k][L][m]));
  const rankAt = L => { const o = SYS_KEYS.slice().sort((a, b) => lvScore(b, L) - lvScore(a, L)); const r = {}; o.forEach((k, i) => r[k] = i + 1); return r; };
  const dlMean = (d, L, m = 'score') => mean(SYS_KEYS.map(k => D.domainLevel[k][d] && D.domainLevel[k][d][L] ? D.domainLevel[k][d][L][m] : null));
  const boardOrder = SYS_KEYS.slice().sort((a, b) => (D.overall[b].AZ.score - D.overall[a].AZ.score) || (D.overall[b].CO.score - D.overall[a].CO.score));
  window.VB.boardOrder = boardOrder; window.VB.lvMean = lvMean; window.VB.rankAt = rankAt; window.VB.dlMean = dlMean;

  /* ======================================================================
     Leaderboard
     ====================================================================== */
  function leaderboard() {
    const table = $('#board');
    const cols = [
      { k: 'deliv', lab: 'Deliv.', grp: 'cov', get: k => 100 * D.overall[k].delivered / D.overall[k].registered },
      { k: 'az', lab: 'Auto-zero', grp: 'comp', bar: true, get: k => D.overall[k].AZ.score },
      { k: 'co', lab: 'Compl.-only', grp: 'comp', bar: true, get: k => D.overall[k].CO.score },
      { k: 'dir', lab: 'Dir.', grp: 'sem', get: k => D.overall[k].CO.dir },
      { k: 'der', lab: 'Der.', grp: 'sem', get: k => D.overall[k].CO.der },
      { k: 'inv', lab: 'Inv.', grp: 'sem', get: k => D.overall[k].CO.inv },
      { k: 'fid', lab: 'Fid.', grp: 'pix', get: k => D.overall[k].CO.fid },
      { k: 'sm', lab: 'Sm.', grp: 'pix', get: k => D.overall[k].CO.sm },
      { k: 'gt', lab: 'GT', grp: 'pix', get: k => D.overall[k].CO.gt },
      { k: 'L1', lab: 'L1', grp: 'lvl', bar: true, get: k => lvScore(k, 'L1') },
      { k: 'L2', lab: 'L2', grp: 'lvl', bar: true, get: k => lvScore(k, 'L2') },
      { k: 'L3', lab: 'L3', grp: 'lvl', bar: true, get: k => lvScore(k, 'L3') },
    ];
    const groups = [['', 2], ['Coverage ↑', 1, 'cov', '#B9BEC9'], ['Composite score ↑', 2, 'comp', '#B6ABED'], ['Semantic ↑', 3, 'sem', '#F1C771'], ['Pixel ↑', 3, 'pix', '#8ABCB2'], ['Composite by level ↑', 3, 'lvl', '#6E7DC8']];
    const thead = h('thead', null,
      h('tr', null, groups.map(([t, n, , c]) => h('th', { class: 'grp', colspan: n, style: c ? `--gc:${c}` : '' }, t ? h('span', null, t) : ''))),
      h('tr', null, h('th', null, '#'), h('th', null, 'System'), cols.map(c => h('th', { 'data-k': c.k }, c.lab))));
    const tbody = h('tbody');
    table.append(thead, tbody);
    // column extremes for bars and best/second marks
    const ext = {};
    cols.forEach(c => {
      const vals = SYS_KEYS.map(c.get), shown = vals.map(v => +v.toFixed(1)), sorted = [...new Set(shown)].sort((a, b) => b - a);
      ext[c.k] = { lo: Math.min(...vals), hi: Math.max(...vals), best: sorted[0], second: sorted[1] };
    });
    const rows = {};
    SYS_KEYS.forEach(k => {
      const sy = SYS[k];
      const tr = h('tr', { 'data-k': k },
        h('td', { class: 'rk' }, ''),
        h('td', { class: 'sys' }, h('div', { class: 'sysn' }, h('span', { class: 'lg', style: `--sc:${sy.color}` }, h('img', { src: logo(k), alt: '' })), h('div', null, h('b', null, sy.name), h('small', null, sy.harness)))),
        cols.map(c => {
          const v = c.get(k), e = ext[c.k], sv = +v.toFixed(1);
          const cls = sv === e.best ? 'best' : sv === e.second ? 'second' : '';
          if (!c.bar) return h('td', { class: cls }, h('span', { class: 'n' }, fmt(v)));
          const lo = Math.floor(e.lo - (e.hi - e.lo) * .9);
          const w = clamp((v - lo) / (100 - lo), .04, 1) * 100;
          return h('td', { class: cls }, h('div', { class: 'cellbar' }, h('span', { class: 'n' }, fmt(v)), h('span', { class: 'b' }, h('i', { style: `background:${sy.color}`, 'data-w': w }))));
        }));
      rows[k] = tr; tbody.append(tr);
    });
    let sortKey = 'az';
    function sort(key, animate) {
      sortKey = key;
      const c = cols.find(x => x.k === key);
      const order = SYS_KEYS.slice().sort((a, b) => (c.get(b) - c.get(a)) || (D.overall[b].AZ.score - D.overall[a].AZ.score));
      const before = {}; if (animate) order.forEach(k => before[k] = rows[k].getBoundingClientRect().top);
      order.forEach((k, i) => { tbody.append(rows[k]); rows[k].querySelector('.rk').textContent = i + 1; });
      $$('th[data-k]', thead).forEach(th => th.classList.toggle('sorted', th.dataset.k === key));
      if (animate) order.forEach(k => {
        const dy = before[k] - rows[k].getBoundingClientRect().top;
        if (!dy) return;
        rows[k].style.transition = 'none'; rows[k].style.transform = `translateY(${dy}px)`;
        requestAnimationFrame(() => requestAnimationFrame(() => { rows[k].style.transition = 'transform .7s cubic-bezier(.16,1,.3,1)'; rows[k].style.transform = ''; }));
      });
    }
    $$('th[data-k]', thead).forEach(th => th.addEventListener('click', () => sort(th.dataset.k, true)));
    sort('az', false);
    window.VB.segStatic($('#popSeg'), v => sort(v === 'AZ' ? 'az' : 'co', true));
    onReveal(table.closest('.board'), () => $$('.cellbar i', table).forEach((i, n) => setTimeout(() => i.style.width = i.dataset.w + '%', 60 + n * 12)));
  }

  /* ======================================================================
     (a) bump chart
     ====================================================================== */
  function bump() {
    const svg = $('#bump');
    const X = { L1: 160, L2: 320, L3: 480 }, Y = r => 58 + (r - 1) * 44;
    const R = { L1: rankAt('L1'), L2: rankAt('L2'), L3: rankAt('L3') };
    svg.append(
      s('text', { x: X.L1, y: 22, 'text-anchor': 'middle', class: 'lbl', style: 'font-size:15px', text: 'L1' }),
      s('text', { x: X.L2, y: 22, 'text-anchor': 'middle', class: 'lbl', style: 'font-size:15px', text: 'L2' }),
      s('text', { x: X.L3, y: 22, 'text-anchor': 'middle', class: 'lbl', style: 'font-size:15px', text: 'L3' }),
      s('text', { x: 118, y: 38, 'text-anchor': 'end', class: 'hand', style: 'font-size:17px', text: 'rank at L1' }),
      s('text', { x: 522, y: 38, class: 'hand', style: 'font-size:17px', text: 'rank at L3' }));
    LEVELS.forEach(L => svg.append(s('line', { x1: X[L], x2: X[L], y1: 40, y2: Y(8) + 18, stroke: 'var(--grid)', 'stroke-width': 1 })));
    const groups = {};
    const order = SYS_KEYS.slice().sort((a, b) => R.L3[b] - R.L3[a]); // draw best last (on top)
    order.forEach(k => {
      const c = SYS[k].color, g = s('g', { class: 'dimmable', 'data-k': k });
      const p = LEVELS.map(L => [X[L], Y(R[L][k])]);
      const d = `M${p[0][0]},${p[0][1]} C${p[0][0] + 80},${p[0][1]} ${p[1][0] - 80},${p[1][1]} ${p[1][0]},${p[1][1]} C${p[1][0] + 80},${p[1][1]} ${p[2][0] - 80},${p[2][1]} ${p[2][0]},${p[2][1]}`;
      const halo = s('path', { d, fill: 'none', stroke: 'var(--card)', 'stroke-width': 8, 'stroke-linecap': 'round' });
      const path = s('path', { d, fill: 'none', stroke: c, 'stroke-width': 3, 'stroke-linecap': 'round', class: 'draw', style: `--d:${SYS[k].i * .07}s` });
      g.append(halo, path);
      LEVELS.forEach((L, li) => {
        const [x, y] = p[li];
        g.append(s('g', { class: 'fade', style: `--d:${.5 + li * .35}s` },
          s('rect', { x: x - 24, y: y - 12, width: 48, height: 24, rx: 12, fill: 'var(--card)', stroke: c, 'stroke-width': 2 }),
          s('text', { x, y: y + 4.5, 'text-anchor': 'middle', style: 'font-size:12.5px;font-weight:700;fill:var(--ink)', text: fmt(lvScore(k, L)) })));
      });
      const ly = Y(R.L1[k]), ry = Y(R.L3[k]);
      g.append(s('image', { href: logo(k), x: 12, y: ly - 8, width: 16, height: 16 }),
        s('text', { x: 34, y: ly + 4.5, style: 'font-size:12.5px;font-weight:600;fill:var(--ink)', text: SYS[k].short }),
        s('image', { href: logo(k), x: 522, y: ry - 8, width: 16, height: 16 }),
        s('text', { x: 544, y: ry + 4.5, style: 'font-size:12.5px;font-weight:600;fill:var(--ink)', text: SYS[k].short }));
      const hit = s('path', { d, fill: 'none', stroke: 'transparent', 'stroke-width': 22 });
      g.append(hit);
      bindTip(g, () => sysTip(k, LEVELS.map(L => [`${L} · rank ${R[L][k]}`, fmt(lvScore(k, L))])),
        { onEnter: () => { svg.classList.add('hovering'); g.classList.add('hi'); }, onLeave: () => { svg.classList.remove('hovering'); g.classList.remove('hi'); } });
      groups[k] = g; svg.append(g);
    });
    // annotation: the biggest faller
    let fall = SYS_KEYS[0]; SYS_KEYS.forEach(k => { if (R.L3[k] - R.L1[k] > R.L3[fall] - R.L1[fall]) fall = k; });
    const ord = n => n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th');
    const fy = Y(R.L3[fall]);
    svg.append(s('g', { class: 'fade', style: '--d:1.6s' },
      s('path', { d: `M392,${Y(8) + 44} C430,${Y(8) + 40} 448,${fy + 30} ${X.L3 - 28},${fy + 8}`, fill: 'none', stroke: 'var(--bad)', 'stroke-width': 1.8, 'stroke-linecap': 'round' }),
      s('path', { d: `M${X.L3 - 37},${fy + 6} L${X.L3 - 27},${fy + 8} L${X.L3 - 33},${fy + 16}`, fill: 'none', stroke: 'var(--bad)', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
      s('text', { x: 386, y: Y(8) + 50, 'text-anchor': 'end', class: 'hand', style: 'fill:var(--bad);font-size:20px', text: `${SYS[fall].short}: ${ord(R.L1[fall])} at L1 → ${ord(R.L3[fall])} at L3` })));
    svg.setAttribute('viewBox', `0 0 640 ${Y(8) + 64}`);
    $$('path.draw', svg).forEach(setLen);
    onReveal(svg.closest('.chart-card'), () => svg.classList.add('is-in'));
  }

  /* ======================================================================
     (b) mean per measure
     ====================================================================== */
  function measures() {
    const svg = $('#measures');
    const rows = [['Composite', 'score'], ['Direct', 'dir'], ['Derived', 'der'], ['Invariant', 'inv'], ['Fidelity', 'fid'], ['Smoothness', 'sm']];
    const x0 = 118, x1 = 384, X = v => x0 + (v - 75) / 25 * (x1 - x0);
    const Y = i => 36 + i * 38;
    [75, 80, 85, 90, 95, 100].forEach(t => svg.append(s('g', { class: 'grid' }, s('line', { x1: X(t), x2: X(t), y1: 18, y2: Y(5) + 18 })),
      s('text', { x: X(t), y: Y(5) + 36, 'text-anchor': 'middle', class: 'ax', style: 'fill:var(--ink-3);font-size:11.5px', text: t })));
    svg.append(s('text', { x: 450, y: 14, 'text-anchor': 'end', style: 'font-size:11.5px;font-style:italic;fill:var(--ink-3)', text: 'Δ L3−L2' }));
    function row(label, vals, y, Xf, dl, strong) {
      const present = LEVELS.filter(L => vals[L] != null);
      const xs = present.map(L => Xf(vals[L]));
      const g = s('g');
      g.append(s('text', { x: 0, y: y + 4.5, style: `font-size:13px;font-weight:${strong ? 700 : 500};fill:var(--ink)`, text: label }));
      g.append(s('line', { x1: Math.min(...xs), x2: Math.max(...xs), y1: y, y2: y, stroke: '#C9CEE6', 'stroke-width': 3, 'stroke-linecap': 'round', class: 'fade', style: '--d:.9s' }));
      present.forEach((L, i) => {
        const cx = Xf(vals[L]);
        const c = s('circle', { cx, cy: y, r: 6.5, fill: LCOL[L], stroke: 'var(--card)', 'stroke-width': 2, class: 'move' });
        c.style.transform = `translateX(${(present.includes('L1') ? Xf(vals.L1) : Xf(vals.L2)) - cx}px)`;
        c.style.transitionDelay = (.25 + i * .12) + 's';
        bindTip(c, () => `<b>${label} · ${L}</b><div class="tr"><span>mean of 8 agents</span><span>${fmt(vals[L], 1)}</span></div>`);
        g.append(c);
      });
      if (dl != null) {
        const t = s('text', { x: 450, y: y + 4.5, 'text-anchor': 'end', style: `font-size:13px;font-weight:${Math.abs(dl) > 10 ? 800 : 600};fill:var(--ink)`, text: (+dl.toFixed(1) > 0 ? '+' : +dl.toFixed(1) < 0 ? '−' : '') + fmt(Math.abs(dl), 1) });
        g.append(t);
        if (Math.abs(dl) > 10) g.insertBefore(s('rect', { x: 404, y: y - 10, width: 50, height: 20, rx: 4, fill: 'var(--marker)', opacity: .8 }), t);
      }
      svg.append(g);
    }
    rows.forEach(([lab, m], i) => {
      const vals = {}; LEVELS.forEach(L => vals[L] = lvMean(L, m));
      if (m === 'der') vals.L1 = null; // a single L1 task has Derived criteria
      row(lab, vals, Y(i), X, vals.L3 - vals.L2, m === 'score');
    });
    // GT improvement on its own scale
    const gy = Y(5) + 78, g0 = 118, g1 = 384, GX = v => g0 + v / 60 * (g1 - g0);
    svg.append(s('line', { x1: 0, x2: 450, y1: Y(5) + 52, y2: Y(5) + 52, stroke: 'var(--rule)', 'stroke-width': 1 }));
    [0, 20, 40, 60].forEach(t => svg.append(s('g', { class: 'grid' }, s('line', { x1: GX(t), x2: GX(t), y1: gy - 14, y2: gy + 14 })),
      s('text', { x: GX(t), y: gy + 30, 'text-anchor': 'middle', style: 'fill:var(--ink-3);font-size:11.5px', text: t })));
    const gv = {}; LEVELS.forEach(L => gv[L] = lvMean(L, 'gt'));
    row('GT impr.', gv, gy, GX, gv.L3 - gv.L2);
    svg.append(s('text', { x: 0, y: gy + 30, style: 'font-size:11px;font-style:italic;fill:var(--ink-3)', text: 'own scale' }));
    svg.setAttribute('viewBox', `0 0 460 ${gy + 40}`);
    svg.append(s('text', { x: 4, y: Y(2) + 22, class: 'hand fade', style: '--d:1.4s;font-size:17px;fill:var(--ink-2)', text: 'L1 has one Derived criterion — omitted' }));
    onReveal(svg.closest('.chart-card'), () => { svg.classList.add('is-in'); $$('circle.move', svg).forEach(c => c.style.transform = 'translateX(0)'); });
  }

  /* ======================================================================
     (c) Direct vs Derived per agent
     ====================================================================== */
  function gap() {
    const svg = $('#gap');
    const x0 = 156, x1 = 500, X = v => x0 + (v - 55) / 45 * (x1 - x0), Y = i => 44 + i * 44;
    [60, 70, 80, 90, 100].forEach(t => svg.append(s('g', { class: 'grid' }, s('line', { x1: X(t), x2: X(t), y1: 22, y2: Y(7) + 20 })),
      s('text', { x: X(t), y: Y(7) + 40, 'text-anchor': 'middle', style: 'fill:var(--ink-3);font-size:11.5px', text: t })));
    svg.append(s('text', { x: 556, y: 16, 'text-anchor': 'end', style: 'font-size:11.5px;font-style:italic;fill:var(--ink-3)', text: 'Der. − Dir.' }));
    const els = {};
    boardOrder.forEach((k, i) => {
      const y = Y(i);
      svg.append(s('image', { href: logo(k), x: 4, y: y - 8, width: 16, height: 16 }),
        s('text', { x: 26, y: y + 4.5, style: 'font-size:12.5px;font-weight:600;fill:var(--ink)', text: SYS[k].short }),
        s('line', { x1: x0, x2: x1, y1: y, y2: y, stroke: 'var(--grid)', 'stroke-width': 1 }));
      const ln = s('line', { x1: X(80), x2: X(80), y1: y, y2: y, stroke: '#B9BEC6', 'stroke-width': 4, 'stroke-linecap': 'round' });
      const cd = s('circle', { cx: X(80), cy: y, r: 7, fill: 'var(--dir)', stroke: 'var(--card)', 'stroke-width': 2 });
      const cr = s('circle', { cx: X(80), cy: y, r: 7, fill: 'var(--der)', stroke: 'var(--card)', 'stroke-width': 2 });
      const dt = s('text', { x: 556, y: y + 4.5, 'text-anchor': 'end', style: 'font-size:13px;font-weight:700;fill:var(--ink)', text: '' });
      const hit = s('rect', { x: 0, y: y - 20, width: 560, height: 40, fill: 'transparent' });
      svg.append(ln, cd, cr, dt, hit);
      els[k] = { ln, cd, cr, dt };
      bindTip(hit, () => sysTip(k, [['Direct', fmt(lvScore(k, cur, 'dir'))], ['Derived', fmt(lvScore(k, cur, 'der'))], ['Gap', fmt(lvScore(k, cur, 'der') - lvScore(k, cur, 'dir'))]]));
    });
    let cur = 'L3', shown = false;
    function draw(L) {
      cur = L;
      boardOrder.forEach(k => {
        const a = X(lvScore(k, L, 'dir')), b = X(lvScore(k, L, 'der')), e = els[k];
        tween(e.ln, { x1: Math.min(a, b), x2: Math.max(a, b) }, 900);
        tween(e.cd, { cx: a }, 900); tween(e.cr, { cx: b }, 900);
        const g = lvScore(k, L, 'der') - lvScore(k, L, 'dir');
        e.dt.textContent = (g < 0 ? '−' : '+') + fmt(Math.abs(g));
      });
    }
    window.VB.segStatic($('#gapSeg'), v => draw(v));
    onReveal(svg.closest('.chart-card'), () => { if (!shown) { shown = true; draw(cur); } });
  }

  /* ======================================================================
     (d) radar
     ====================================================================== */
  function radar() {
    const svg = $('#radar'), leg = $('#radarLegend');
    const cx = 280, cy = 222, Rr = 160, lo = 40, n = DOMS.length;
    const pt = (i, v) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n, r = (clamp(v, lo, 100) - lo) / (100 - lo) * Rr; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
    const poly = vals => vals.map((v, i) => pt(i, v).map(x => x.toFixed(1)).join(',')).join(' ');
    [50, 60, 70, 80, 90, 100].forEach(t => svg.append(s('polygon', { points: poly(DOMS.map(() => t)), fill: t === 100 ? '#FBF8F1' : 'none', stroke: t === 100 ? '#D8CFBF' : 'var(--grid)', 'stroke-width': 1 })));
    [60, 80, 100].forEach(t => { const [x, y] = pt(0, t); svg.append(s('text', { x: x + 5, y: y + 4, style: 'font-size:10.5px;fill:var(--ink-3)', text: t })); });
    DOMS.forEach((d, i) => {
      const [x, y] = pt(i, 100); svg.append(s('line', { x1: cx, y1: cy, x2: x, y2: y, stroke: 'var(--grid)', 'stroke-width': 1 }));
      const a = -Math.PI / 2 + i * 2 * Math.PI / n, lx = cx + (Rr + 26) * Math.cos(a), ly = cy + (Rr + 22) * Math.sin(a);
      const anchor = Math.abs(Math.cos(a)) < .2 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end';
      const m = mean(SYS_KEYS.map(k => D.domain[k][d.key].AZ.score));
      svg.append(s('text', { x: lx, y: ly, 'text-anchor': anchor, style: 'font-size:13px;font-weight:700;fill:var(--ink)', text: d.abbr }),
        s('text', { x: lx, y: ly + 15, 'text-anchor': anchor, style: 'font-size:11.5px;fill:var(--ink-3)', text: fmt(m) }));
    });
    const polys = {}, on = {};
    const drawOrder = SYS_KEYS.slice().reverse();
    drawOrder.forEach(k => {
      const vals = DOMS.map(d => D.domain[k][d.key].AZ.score);
      const g = s('g', { class: 'dimmable', style: `transform-origin:${cx}px ${cy}px;transform:scale(0);transition:transform 1s cubic-bezier(.16,1,.3,1) ${SYS[k].i * .08}s, opacity .3s` });
      g.append(s('polygon', { points: poly(vals), fill: SYS[k].color, 'fill-opacity': .07, stroke: SYS[k].color, 'stroke-width': 2, 'stroke-linejoin': 'round' }));
      vals.forEach((v, i) => { const [x, y] = pt(i, v); g.append(s('circle', { cx: x, cy: y, r: 3.2, fill: SYS[k].color })); });
      bindTip(g, () => sysTip(k, DOMS.map(d => [d.name, fmt(D.domain[k][d.key].AZ.score)])),
        { onEnter: () => { svg.classList.add('hovering'); g.classList.add('hi'); }, onLeave: () => { svg.classList.remove('hovering'); g.classList.remove('hi'); } });
      polys[k] = g; on[k] = true; svg.append(g);
    });
    boardOrder.forEach(k => {
      const c = h('button', { class: 'chip on', type: 'button' }, h('span', { class: 'sw', style: `background:${SYS[k].color}` }), SYS[k].short);
      c.addEventListener('click', () => { on[k] = !on[k]; c.classList.toggle('on', on[k]); polys[k].style.display = on[k] ? '' : 'none'; });
      c.addEventListener('pointerenter', () => { if (on[k]) { svg.classList.add('hovering'); polys[k].classList.add('hi'); } });
      c.addEventListener('pointerleave', () => { svg.classList.remove('hovering'); polys[k].classList.remove('hi'); });
      leg.append(c);
    });
    onReveal(svg.closest('.chart-card'), () => Object.values(polys).forEach(g => g.style.transform = 'scale(1)'));
  }

  /* ======================================================================
     (e) slope per domain
     ====================================================================== */
  const ramp = (stops, v) => {
    if (v <= stops[0][0]) return stops[0][1];
    for (let i = 1; i < stops.length; i++) if (v <= stops[i][0]) {
      const [a, ca] = stops[i - 1], [b, cb] = stops[i], t = (v - a) / (b - a);
      const p = c => [1, 3, 5].map(j => parseInt(c.slice(j, j + 2), 16));
      const A = p(ca), B = p(cb);
      return '#' + A.map((x, j) => Math.round(lerp(x, B[j], t)).toString(16).padStart(2, '0')).join('');
    }
    return stops[stops.length - 1][1];
  };
  function slope() {
    const svg = $('#slope');
    const X = { L1: 70, L2: 230, L3: 390 }, y0 = 360, y1 = 30, Y = v => y0 - (v - 60) / 40 * (y0 - y1);
    [60, 70, 80, 90, 100].forEach(t => svg.append(s('g', { class: 'grid' }, s('line', { x1: 40, x2: 410, y1: Y(t), y2: Y(t) })),
      s('text', { x: 32, y: Y(t) + 4, 'text-anchor': 'end', style: 'fill:var(--ink-3);font-size:11.5px', text: t })));
    LEVELS.forEach(L => svg.append(s('text', { x: X[L], y: y0 + 26, 'text-anchor': 'middle', class: 'lbl', style: 'font-size:13px', text: L })));
    const data = DOMS.map(d => { const v = {}; LEVELS.forEach(L => v[L] = dlMean(d.key, L)); return { d, v, drop: v.L3 - v.L1 }; });
    const col = x => ramp([[-30, '#C8553D'], [-16, '#E1957B'], [-7, '#9FAAB9'], [0, '#3E74AB']], x);
    // label placement with collision avoidance
    const labs = data.map(o => ({ o, y: Y(o.v.L3) })).sort((a, b) => a.y - b.y);
    for (let i = 1; i < labs.length; i++) if (labs[i].y - labs[i - 1].y < 17) labs[i].y = labs[i - 1].y + 17;
    labs.forEach(l => l.o.ly = l.y);
    data.forEach((o, i) => {
      const c = col(o.drop), g = s('g', { class: 'dimmable' });
      const d = `M${X.L1},${Y(o.v.L1)} L${X.L2},${Y(o.v.L2)} L${X.L3},${Y(o.v.L3)}`;
      const p = s('path', { d, fill: 'none', stroke: c, 'stroke-width': 2.6, 'stroke-linejoin': 'round', class: 'draw', style: `--d:${i * .1}s` });
      g.append(p);
      LEVELS.forEach((L, li) => g.append(s('circle', { cx: X[L], cy: Y(o.v[L]), r: 5, fill: c, stroke: 'var(--card)', 'stroke-width': 2, class: 'fade', style: `--d:${.3 + li * .3 + i * .05}s` })));
      if (Math.abs(o.ly - Y(o.v.L3)) > 2) g.append(s('line', { x1: X.L3 + 7, y1: Y(o.v.L3), x2: X.L3 + 22, y2: o.ly, stroke: '#C5C9CF', 'stroke-width': 1 }));
      const big = Math.abs(o.drop) > 20;
      g.append(s('text', { x: X.L3 + 26, y: o.ly + 4.5, style: `font-size:12.5px;font-weight:${big ? 800 : 600};fill:var(--ink)`, text: `${o.d.abbr} ${o.drop < 0 ? '−' : '+'}${fmt(Math.abs(o.drop))}`, class: 'fade' }));
      g.lastChild.style.setProperty('--d', (1.1 + i * .05) + 's');
      const hit = s('path', { d, fill: 'none', stroke: 'transparent', 'stroke-width': 18 });
      g.append(hit);
      bindTip(g, () => `<b>${o.d.name}</b>` + LEVELS.map(L => `<div class="tr"><span>${L}</span><span>${fmt(o.v[L])}</span></div>`).join('') + `<div class="tr"><span>L3 − L1</span><span>${fmt(o.drop)}</span></div>`,
        { onEnter: () => { svg.classList.add('hovering'); g.classList.add('hi'); }, onLeave: () => { svg.classList.remove('hovering'); g.classList.remove('hi'); } });
      svg.append(g);
    });
    $$('path.draw', svg).forEach(setLen);
    onReveal(svg.closest('.chart-card'), () => svg.classList.add('is-in'));
  }

  /* ======================================================================
     (f) leader per domain and level
     ====================================================================== */
  function medals() {
    const el = $('#medals');
    el.append(h('div'), ...LEVELS.map(L => h('div', { class: 'h' }, h('span', { class: 'lv ' + L }, L))));
    let n = 0;
    DOMS.forEach(d => {
      el.append(h('div', { class: 'dn' }, d.abbr));
      LEVELS.forEach(L => {
        const vals = SYS_KEYS.map(k => [k, D.domainLevel[k][d.key] && D.domainLevel[k][d.key][L] ? D.domainLevel[k][d.key][L].score : null]).filter(x => x[1] != null);
        const top = Math.max(...vals.map(x => +x[1].toFixed(1)));
        const winners = vals.filter(x => +x[1].toFixed(1) === top).map(x => x[0]).sort((a, b) => SYS[a].i - SYS[b].i);
        const k = winners[0];
        const m = h('div', { class: 'medal', style: `--mc:${SYS[k].color};--d:${n++ * .04}s` },
          h('span', { class: 'md' }, h('img', { src: logo(k), alt: '' })),
          h('div', { style: 'min-width:0' }, h('b', null, fmt(top)), winners.length > 1 ? h('sup', { style: 'color:var(--ink-3)' }, ' +' + (winners.length - 1)) : '', h('br'), h('small', null, SYS[k].short)));
        bindTip(m, () => `<b>${d.name} · ${L}</b>` + vals.sort((a, b) => b[1] - a[1]).map(([kk, v]) => `<div class="tr"><span><span class="sw" style="background:${SYS[kk].color}"></span>${SYS[kk].short}</span><span>${fmt(v)}</span></div>`).join(''));
        el.append(m);
      });
    });
    onReveal(el.closest('.chart-card'), () => el.closest('.chart-card').classList.add('is-in'));
  }

  /* ======================================================================
     (g) full breakdown dot matrix
     ====================================================================== */
  const scoreCol = v => ramp([[50, '#C8553D'], [70, '#E9A28A'], [82, '#D6CFC2'], [92, '#8FB0D6'], [100, '#3E74AB']], v);
  function matrix() {
    const svg = $('#matrix'), leg = $('#matrixLegend');
    const left = 200, gw = 138, cw = 38, Y = i => 84 + i * 42;
    const X = (g, j) => left + g * gw + 24 + j * cw;
    DOMS.forEach((d, g) => {
      svg.append(s('text', { x: X(g, 1), y: 24, 'text-anchor': 'middle', style: 'font-size:13.5px;font-weight:700;fill:var(--ink)', text: d.abbr }),
        s('line', { x1: X(g, 0) - 14, x2: X(g, 2) + 14, y1: 34, y2: 34, stroke: 'var(--rule)', 'stroke-width': 1.5 }));
      LEVELS.forEach((L, j) => svg.append(s('text', { x: X(g, j), y: 54, 'text-anchor': 'middle', style: 'font-size:11px;fill:var(--ink-3)', text: L })));
      if (g) svg.append(s('line', { x1: X(g, 0) - 31, x2: X(g, 0) - 31, y1: 44, y2: Y(7) + 22, stroke: 'var(--grid)', 'stroke-width': 1 }));
    });
    // column maxima
    const colMax = {};
    DOMS.forEach(d => LEVELS.forEach(L => colMax[d.key + L] = Math.max(...SYS_KEYS.map(k => { const c = D.domainLevel[k][d.key] && D.domainLevel[k][d.key][L]; return c && c.score != null ? +c.score.toFixed(1) : -1; }))));
    const dots = [];
    boardOrder.forEach((k, i) => {
      const y = Y(i);
      svg.append(s('image', { href: logo(k), x: 6, y: y - 8, width: 16, height: 16 }),
        s('text', { x: 28, y: y + 4.5, style: 'font-size:12.5px;font-weight:600;fill:var(--ink)', text: SYS[k].name }));
      DOMS.forEach((d, g) => LEVELS.forEach((L, j) => {
        const c = D.domainLevel[k][d.key] && D.domainLevel[k][d.key][L];
        const x = X(g, j);
        if (!c || c.score == null) { svg.append(s('text', { x, y: y + 4, 'text-anchor': 'middle', style: 'fill:var(--ink-3);font-size:12px', text: '–' })); return; }
        const v = c.score, r = clamp(3 + (v - 40) / 60 * 12.5, 3, 15.5), isMax = +v.toFixed(1) === colMax[d.key + L];
        const dot = s('circle', { cx: x, cy: y, r, fill: scoreCol(v), stroke: isMax ? 'var(--ink)' : 'var(--card)', 'stroke-width': isMax ? 2 : 1.5,
          style: `transform-origin:${x}px ${y}px;transform:scale(0);transition:transform .7s cubic-bezier(.16,1,.3,1) ${(g * 3 + j) * .035 + i * .02}s` });
        const hit = s('rect', { x: x - 19, y: y - 21, width: 38, height: 42, fill: 'transparent' });
        bindTip(hit, () => sysTip(k, [[`${d.name} · ${L}`, fmt(v)], ['Direct', fmt(c.dir)], ['Derived', c.der == null ? 'n/a' : fmt(c.der)], ['Invariant', fmt(c.inv)]]) + (isMax ? '<div style="margin-top:4px;opacity:.75">column maximum</div>' : ''));
        svg.append(dot, hit); dots.push(dot);
      }));
    });
    svg.setAttribute('viewBox', `0 0 1180 ${Y(7) + 30}`);
    [50, 70, 85, 100].forEach(v => {
      const r = clamp(3 + (v - 40) / 60 * 12.5, 3, 15.5);
      leg.append(h('span', { html: `<svg width="${2 * r + 4}" height="34" viewBox="0 0 ${2 * r + 4} 34"><circle cx="${r + 2}" cy="17" r="${r}" fill="${scoreCol(v)}"/></svg>${v}` }));
    });
    leg.append(h('span', { html: '<svg width="22" height="22" viewBox="0 0 22 22"><circle cx="11" cy="11" r="8" fill="none" stroke="#1F1A15" stroke-width="2"/></svg>column max' }));
    onReveal(svg.closest('.chart-card'), () => dots.forEach(d => d.style.transform = 'scale(1)'));
  }

  /* ======================================================================
     dataset statistics (levels section + atlas)
     ====================================================================== */
  function ptsBars() {
    const el = $('#ptsBars');
    const P = { L1: [334, 1, 250], L2: [323, 334, 260], L3: [364, 634, 268] };
    const maxT = Math.max(...LEVELS.map(L => P[L].reduce((a, b) => a + b, 0)));
    LEVELS.forEach(L => {
      const tot = P[L].reduce((a, b) => a + b, 0);
      const track = h('div', { class: 'track', style: `width:${tot / maxT * 100}%` });
      ['D', 'R', 'I'].forEach((c, i) => {
        const part = h('div', { class: 'part ' + c, 'data-g': P[L][i] }, '');
        part.dataset.label = P[L][i];
        bindTip(part, () => `<b>${L} · ${window.VB.CAT[c].name}</b><div class="tr"><span>scoring points</span><span>${P[L][i]}</span></div><div class="tr"><span>share of ${L}</span><span>${fmt(P[L][i] / tot * 100, 0)}%</span></div>`);
        track.append(part);
      });
      el.append(h('div', { class: 'segbar' }, h('span', { class: 'lab' }, L), h('div', null, track, h('div', { style: 'font-family:var(--f-ui);font-size:11.5px;color:var(--ink-3);margin-top:3px' }, `${tot.toLocaleString('en-US')} points`))));
    });
    onReveal(el.closest('.panel'), () => {
      $$('.part', el).forEach(p => p.style.flexGrow = p.dataset.g);
      setTimeout(() => $$('.part', el).forEach(p => { if (p.getBoundingClientRect().width > 40) p.textContent = p.dataset.label; }), 1300);
    });
  }
  function critChart() {
    const svg = $('#critChart');
    const means = { L1: 2.59, L2: 4.06, L3: 5.60 };
    // one row per level: a dot histogram of the 28 evaluated tasks (one dot per task, stacked by
    // criteria count) and a diamond at the full-benchmark mean.
    const all = LEVELS.map(L => D.tasks.filter(t => t.L === L).map(t => t.crit.D.length + t.crit.R.length + t.crit.I.length));
    const hi = Math.max(9, ...all.flat());
    const x0 = 46, x1 = 500, X = v => x0 + v / hi * (x1 - x0);
    const DOT = 5.4, rowH = 92, Y = li => 70 + li * rowH;
    const bottom = Y(2) + 14;
    for (let t = 0; t <= hi; t++) svg.append(s('g', { class: 'grid' }, s('line', { x1: X(t), x2: X(t), y1: 18, y2: bottom })),
      s('text', { x: X(t), y: bottom + 18, 'text-anchor': 'middle', style: 'fill:var(--ink-3);font-size:11.5px', text: t }));
    LEVELS.forEach((L, li) => {
      const y = Y(li);
      svg.append(s('line', { x1: X(0), x2: X(hi), y1: y + 6, y2: y + 6, stroke: 'var(--rule)', 'stroke-width': 1 }),
        s('text', { x: 0, y: y + 4.5, style: 'font-size:13px;font-weight:700;fill:var(--ink)', text: L }));
      const bins = {}; all[li].forEach(c => bins[c] = (bins[c] || 0) + 1);
      const peak = Math.max(...all.flatMap(a => { const b = {}; a.forEach(c => b[c] = (b[c] || 0) + 1); return Object.values(b); }));
      Object.entries(bins).forEach(([c, n], i) => {
        const hgt = n / peak * 56;
        const bar = s('rect', { x: X(+c) - 7, y: y + 6 - hgt, width: 14, height: hgt, rx: 3, fill: LCOL[L], opacity: .55, class: 'fade', style: `--d:${.15 + li * .2 + i * .05}s` });
        bindTip(bar, () => `<b>${L} · ${c} criteria</b><div class="tr"><span>evaluated tasks</span><span>${n} of 28</span></div>`);
        svg.append(bar);
      });
      const m = means[L], dx = X(m);
      svg.append(s('g', { class: 'fade', style: `--d:${.8 + li * .25}s` },
        s('line', { x1: dx, x2: dx, y1: y + 6, y2: y - 52, stroke: 'var(--ink)', 'stroke-width': 1.5 }),
        s('rect', { x: dx - 6, y: y - 58, width: 12, height: 12, fill: 'var(--ink)', stroke: 'var(--card)', 'stroke-width': 2, transform: `rotate(45 ${dx} ${y - 52})` }),
        s('text', { x: dx + 11, y: y - 48, style: 'font-size:13.5px;font-weight:800;fill:var(--ink)', text: m.toFixed(2) })));
      const mm = all[li].reduce((a, b) => a + b, 0) / all[li].length;
      bindTip(svg.lastChild, () => `<b>${L}</b><div class="tr"><span>mean, all 678 tasks</span><span>${m.toFixed(2)}</span></div><div class="tr"><span>mean, 28 evaluated tasks</span><span>${mm.toFixed(2)}</span></div>`);
    });
    svg.setAttribute('viewBox', `0 0 520 ${bottom + 26}`);
    svg.append(s('text', { x: x1, y: 12, 'text-anchor': 'end', style: 'font-size:11px;fill:var(--ink-3)', text: '◆ mean over all 678 tasks · ▮ the 28 evaluated tasks' }));
    onReveal(svg.closest('.panel'), () => svg.classList.add('is-in'));
  }
  function famBar() {
    const el = $('#famBar');
    const order = ['algorithms', 'charts', 'chemistry', 'web', 'electric', 'math', 'physics'];
    const cnt = {}; D.raw.forEach(r => cnt[r.d] = (cnt[r.d] || 0) + 1);
    const track = h('div', { class: 'track', style: 'width:100%' });
    order.forEach(k => {
      const d = window.VB.DOM[k];
      const p = h('div', { class: 'part ' + d.fam, 'data-g': cnt[k] });
      p.dataset.label = `${d.name} ${cnt[k]}`; p.dataset.short = cnt[k];
      bindTip(p, () => `<b>${d.name}</b><div class="tr"><span>scenes</span><span>${cnt[k]}</span></div><div class="tr"><span>program family</span><span>${d.famName}</span></div><div class="tr"><span>tasks (×3 levels)</span><span>${cnt[k] * 3}</span></div>`);
      track.append(p);
    });
    el.append(h('div', { class: 'segbar', style: 'grid-template-columns:1fr' }, track));
    onReveal(el.closest('.panel'), () => {
      $$('.part', el).forEach(p => p.style.flexGrow = p.dataset.g);
      setTimeout(() => $$('.part', el).forEach(p => { const w = p.getBoundingClientRect().width; p.textContent = w > p.dataset.label.length * 7.4 + 18 ? p.dataset.label : w > 30 ? p.dataset.short : ''; }), 1300);
    });
  }

  /* ======================================================================
     Findings
     ====================================================================== */
  function findings() {
    const el = $('#finds');
    const dDer = lvMean('L3', 'der') - lvMean('L2', 'der'), dDir = lvMean('L3', 'dir') - lvMean('L2', 'dir');
    const dInv = lvMean('L3', 'inv') - lvMean('L2', 'inv');
    const R1 = rankAt('L1'), R3 = rankAt('L3');
    let fall = SYS_KEYS[0]; SYS_KEYS.forEach(k => { if (R3[k] - R1[k] > R3[fall] - R1[fall]) fall = k; });
    const ord = n => n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th');
    const drops = DOMS.map(d => ({ d, v: dlMean(d.key, 'L3') - dlMean(d.key, 'L1') })).sort((a, b) => a.v - b.v);
    const worst = drops[0], best = drops[drops.length - 1], second = drops[1];
    const climbers = SYS_KEYS.filter(k => R3[k] <= 3 && R1[k] > R3[k]).sort((a, b) => R3[a] - R3[b]);
    const minus = v => (v < 0 ? '−' : '+') + fmt(Math.abs(v));

    // mini charts
    const m1 = s('svg', { viewBox: '0 0 260 96', class: 'chart', style: 'max-width:300px;margin-top:20px' });
    const yy = v => 86 - (v - 70) / 30 * 76;
    [['dir', 'var(--dir)', 'Direct'], ['der', 'var(--der)', 'Derived']].forEach(([m, c, lab]) => {
      const a = lvMean('L2', m), b = lvMean('L3', m);
      m1.append(s('line', { x1: 40, x2: 190, y1: yy(a), y2: yy(b), stroke: c, 'stroke-width': 2.5, class: 'draw', style: '--len:160;--d:.3s' }),
        s('circle', { cx: 40, cy: yy(a), r: 5, fill: c, stroke: 'var(--paper-2)', 'stroke-width': 2 }), s('circle', { cx: 190, cy: yy(b), r: 5, fill: c, stroke: 'var(--paper-2)', 'stroke-width': 2, class: 'fade', style: '--d:1.2s' }),
        s('text', { x: 200, y: yy(b) + 4, style: 'font-size:12px;font-weight:600;fill:var(--ink)', text: `${lab} ${fmt(b)}`, class: 'fade' }));
      m1.lastChild.style.setProperty('--d', '1.3s');
    });
    m1.append(s('text', { x: 40, y: 96, 'text-anchor': 'middle', style: 'font-size:11px;fill:var(--ink-3)', text: 'L2' }), s('text', { x: 190, y: 96, 'text-anchor': 'middle', style: 'font-size:11px;fill:var(--ink-3)', text: 'L3' }));

    const m2 = s('svg', { viewBox: '0 0 260 96', class: 'chart', style: 'max-width:300px;margin-top:20px' });
    const ry = r => 6 + (r - 1) * 11.5;
    SYS_KEYS.slice().sort((a, b) => (a === fall) - (b === fall) || climbers.includes(a) - climbers.includes(b)).forEach(k => {
      const hi = k === fall || climbers.includes(k);
      const p = [[40, ry(R1[k])], [115, ry(rankAt('L2')[k])], [190, ry(R3[k])]];
      m2.append(s('path', { d: `M${p[0]} C${p[0][0] + 35},${p[0][1]} ${p[1][0] - 35},${p[1][1]} ${p[1]} C${p[1][0] + 35},${p[1][1]} ${p[2][0] - 35},${p[2][1]} ${p[2]}`, fill: 'none', stroke: hi ? SYS[k].color : '#D6CDBD', 'stroke-width': hi ? 2.6 : 1.4, class: 'draw', style: '--len:200;--d:.3s' }));
      if (hi) m2.append(s('text', { x: 198, y: ry(R3[k]) + 4, style: 'font-size:11.5px;font-weight:600;fill:var(--ink)', text: SYS[k].short, class: 'fade' }));
    });
    m2.append(s('text', { x: 40, y: 96, 'text-anchor': 'middle', style: 'font-size:11px;fill:var(--ink-3)', text: 'L1' }), s('text', { x: 190, y: 96, 'text-anchor': 'middle', style: 'font-size:11px;fill:var(--ink-3)', text: 'L3' }));

    const m3 = s('svg', { viewBox: '0 0 260 118', class: 'chart', style: 'max-width:300px;margin-top:20px' });
    const bx = v => 226 + v / 32 * 170;
    drops.forEach((o, i) => {
      const y = 6 + i * 16, w = 226 - bx(o.v);
      m3.append(s('text', { x: 0, y: y + 9, style: 'font-size:11.5px;fill:var(--ink-2)', text: o.d.abbr }),
        s('rect', { x: bx(o.v), y, width: Math.max(w, 1.5), height: 11, rx: 3, fill: ramp([[-30, '#C8553D'], [-16, '#E1957B'], [-7, '#9FAAB9'], [0, '#3E74AB']], o.v), class: 'fade', style: `--d:${.2 + i * .08}s` }),
        s('text', { x: 232, y: y + 9.5, style: 'font-size:11px;font-weight:700;fill:var(--ink)', text: minus(o.v) }));
    });

    const cards = [
      { big: minus(dDer), unit: 'pts', h: 'Derived collapses at L3.', p: `Mean Derived score falls ${fmt(Math.abs(dDer))} points from L2 to L3, against ${fmt(Math.abs(dDir))} for Direct — while Invariant moves ${minus(dInv)}. The stated edit lands; its consequences don’t.`, m: m1 },
      { big: `${ord(R1[fall])}→${ord(R3[fall])}`, unit: '', h: 'Local skill doesn’t transfer.', p: `${SYS[fall].name} ranks ${ord(R1[fall])} on local edits and ${ord(R3[fall])} on rule changes; ${climbers.map(k => SYS[k].name).join(' and ')} climb to the podium behind ${SYS[boardOrder[0]].name}.`, m: m2 },
      { big: minus(worst.v), unit: 'pts', h: `${worst.d.name} suffers most.`, p: `From L1 to L3, ${worst.d.name.toLowerCase()} loses ${fmt(Math.abs(worst.v))} points and ${second.d.name.toLowerCase()} ${fmt(Math.abs(second.v))}, whereas ${best.d.name.toLowerCase()} lose only ${fmt(Math.abs(best.v))}. Difficulty is domain-dependent.`, m: m3 },
    ];
    cards.forEach((c, i) => {
      const card = h('div', { class: 'find', 'data-reveal': '', style: `--d:${i * .12}s` },
        h('div', { class: 'big' }, c.big, c.unit ? h('small', null, c.unit) : ''), h('h3', null, c.h), h('p', null, c.p), c.m);
      el.append(card); window.VB.reveal(card);
      card.addEventListener('reveal', () => c.m.classList.add('is-in'), { once: true });
      $$('path.draw', c.m).forEach(p => requestAnimationFrame(() => setLen(p)));
    });
  }

  window.VBCharts = { leaderboard, bump, measures, gap, radar, slope, medals, matrix, ptsBars, critChart, famBar, findings, scoreCol, ramp, tween };
})();
