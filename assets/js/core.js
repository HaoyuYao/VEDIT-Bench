/* VEDIT-Bench project page — shared runtime (no dependencies, works from file://) */
(function () {
  'use strict';
  const D = window.VEDIT;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(c));
    return el;
  }
  const NS = 'http://www.w3.org/2000/svg';
  function s(tag, attrs, ...kids) {
    const el = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'text') el.textContent = v;
      else el.setAttribute(k, v);
    }
    for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(c));
    return el;
  }
  const clear = el => { while (el.firstChild) el.removeChild(el.firstChild); return el; };
  const fmt = (v, d = 1) => (v == null || isNaN(v)) ? '–' : Number(v).toFixed(d);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const mean = a => { const f = a.filter(x => x != null); return f.length ? f.reduce((p, c) => p + c, 0) / f.length : null; };

  /* ---------- reference data ---------- */
  const SYS = {}; D.systems.forEach((x, i) => { x.i = i; SYS[x.key] = x; });
  const SYS_KEYS = D.systems.map(x => x.key);
  const logo = k => `assets/img/logos/logo_${SYS[k].logo}.png`;
  const DOMS = [
    { key: 'algorithms', name: 'Algorithms', abbr: 'Algo.', fam: 'SVG', famName: 'SVG' },
    { key: 'charts', name: 'Charts', abbr: 'Charts', fam: 'HTML', famName: 'HTML/JS' },
    { key: 'chemistry', name: 'Chemistry', abbr: 'Chem.', fam: 'HTML', famName: 'HTML/JS' },
    { key: 'electric', name: 'Circuits', abbr: 'Circ.', fam: 'PY', famName: 'Python' },
    { key: 'math', name: 'Mathematics', abbr: 'Math', fam: 'PY', famName: 'Python' },
    { key: 'physics', name: 'Physics', abbr: 'Phys.', fam: 'PY', famName: 'Python' },
    { key: 'web', name: 'Web interfaces', abbr: 'Web', fam: 'HTML', famName: 'HTML/JS' },
  ];
  const DOM = {}; DOMS.forEach(d => DOM[d.key] = d);
  const LEVELS = ['L1', 'L2', 'L3'];
  const LCOL = { L1: '#A3AEE0', L2: '#6E7DC8', L3: '#35418F' };
  const CAT = { D: { name: 'Direct', col: '#7466D0' }, R: { name: 'Derived', col: '#D98E2B' }, I: { name: 'Invariant', col: '#3B9883' } };
  const TASK = {}; D.tasks.forEach(t => TASK[t.key] = t);

  /* ---------- reveal on scroll ---------- */
  const revealIO = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('is-in');
    e.target.dispatchEvent(new CustomEvent('reveal'));
    revealIO.unobserve(e.target);
  }), { threshold: 0.16, rootMargin: '0px 0px -6% 0px' });
  const reveal = el => { revealIO.observe(el); return el; };
  function onReveal(el, fn) {
    if (el.classList.contains('is-in')) { fn(); return; }
    el.addEventListener('reveal', fn, { once: true });
    reveal(el);
  }

  /* ---------- counters ---------- */
  function countUp(el, to, { dur = 1600, dec = 0, sep = false, prefix = '', suffix = '' } = {}) {
    const t0 = performance.now();
    const f = n => prefix + (sep ? Number(n.toFixed(dec)).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : n.toFixed(dec)) + suffix;
    (function tick(t) {
      const p = clamp((t - t0) / dur, 0, 1), e = 1 - Math.pow(1 - p, 4);
      el.textContent = f(to * e);
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  }

  /* ---------- tooltip ---------- */
  const tipEl = $('#tip');
  const tip = {
    show(html, ev) { tipEl.innerHTML = html; tipEl.classList.add('on'); tip.move(ev); },
    move(ev) {
      if (!ev) return;
      const pad = 14, r = tipEl.getBoundingClientRect();
      let x = ev.clientX + pad, y = ev.clientY + pad;
      if (x + r.width > innerWidth - 8) x = ev.clientX - r.width - pad;
      if (y + r.height > innerHeight - 8) y = ev.clientY - r.height - pad;
      tipEl.style.left = x + 'px'; tipEl.style.top = y + 'px';
    },
    hide() { tipEl.classList.remove('on'); },
  };
  function bindTip(el, htmlFn, { onEnter, onLeave } = {}) {
    el.addEventListener('pointerenter', ev => { tip.show(htmlFn(), ev); onEnter && onEnter(); });
    el.addEventListener('pointermove', ev => tip.move(ev));
    el.addEventListener('pointerleave', () => { tip.hide(); onLeave && onLeave(); });
    el.setAttribute('tabindex', '0');
    el.addEventListener('focus', () => { const r = el.getBoundingClientRect(); tip.show(htmlFn(), { clientX: r.right, clientY: r.top }); onEnter && onEnter(); });
    el.addEventListener('blur', () => { tip.hide(); onLeave && onLeave(); });
  }

  /* ---------- autoplay-when-visible videos ---------- */
  const playIO = new IntersectionObserver(es => es.forEach(e => {
    const v = e.target;
    if (e.isIntersecting) {
      if (!v.src && v.dataset.src) v.src = v.dataset.src;
      const p = v.play(); if (p && p.catch) p.catch(() => {});
    } else if (!v.paused) v.pause();
  }), { rootMargin: '120px 0px' });
  function autoVideo(src, { poster, cls } = {}) {
    const v = h('video', { muted: true, loop: true, playsinline: true, preload: 'none', poster, class: cls });
    v.muted = true; v.dataset.src = src;
    playIO.observe(v);
    return v;
  }

  /* ---------- synchronised playback by relative time ---------- */
  class SyncGroup {
    constructor({ onTick } = {}) {
      this.items = []; this.p = 0; this.speed = 1; this.playing = false; this.T = 2; this.onTick = onTick;
      this.visible = true; this._last = 0; this._raf = null;
    }
    set(videos, baseDur) {
      this.items = videos.filter(Boolean);
      this.T = baseDur || 2;
      this.items.forEach(v => { v.muted = true; v.playsInline = true; v.loop = false; v.preload = 'auto'; });
      this.seek(0);
    }
    dur(v) { return isFinite(v.duration) && v.duration > 0 ? v.duration : null; }
    rate(v) { const d = this.dur(v); return d ? clamp(d / this.T * this.speed, .0625, 8) : this.speed; }
    play() {
      this.playing = true;
      this.items.forEach(v => { v.playbackRate = this.rate(v); const p = v.play(); if (p && p.catch) p.catch(() => {}); });
      this._last = performance.now();
      if (!this._raf) this._raf = requestAnimationFrame(t => this.loop(t));
      this.onTick && this.onTick(this.p, true);
    }
    pause() {
      this.playing = false;
      this.items.forEach(v => v.pause());
      this.onTick && this.onTick(this.p, false);
    }
    toggle() { this.playing ? this.pause() : this.play(); }
    seek(p) {
      this.p = clamp(p, 0, .9999);
      this.items.forEach(v => { const d = this.dur(v); if (d) { try { v.currentTime = this.p * d; } catch (e) {} } });
      this.onTick && this.onTick(this.p, this.playing);
    }
    setSpeed(sp) { this.speed = sp; this.items.forEach(v => v.playbackRate = this.rate(v)); }
    loop(t) {
      this._raf = null;
      if (!this.playing) return;
      const dt = Math.min(.1, (t - this._last) / 1000); this._last = t;
      if (this.visible) {
        this.p += dt * this.speed / this.T;
        if (this.p >= 1) {
          this.p = 0;
          this.items.forEach(v => { try { v.currentTime = 0; } catch (e) {} const pr = v.play(); if (pr && pr.catch) pr.catch(() => {}); });
        } else {
          this.items.forEach(v => {
            const d = this.dur(v); if (!d) return;
            const r = this.rate(v); if (Math.abs(v.playbackRate - r) > .01) v.playbackRate = r;
            const target = this.p * d;
            if (Math.abs(v.currentTime - target) > .18 * Math.max(1, r)) { try { v.currentTime = target; } catch (e) {} }
            if (v.paused && v.readyState >= 2 && !v.ended) { const pr = v.play(); if (pr && pr.catch) pr.catch(() => {}); }
          });
        }
        this.onTick && this.onTick(this.p, true);
      }
      this._raf = requestAnimationFrame(tt => this.loop(tt));
    }
    watch(container) {
      new IntersectionObserver(es => es.forEach(e => {
        this.visible = e.isIntersecting;
        if (!this.visible) this.items.forEach(v => v.pause());
        else if (this.playing) this.play();
      }), { threshold: 0.05 }).observe(container);
      return this;
    }
  }

  /* ---------- wipe comparer ---------- */
  function makeWipe(el, initial = 50) {
    let x = initial;
    const set = v => { x = clamp(v, 0, 100); el.style.setProperty('--x', x + '%'); };
    set(initial);
    let drag = false;
    const pos = ev => { const r = el.getBoundingClientRect(); set((ev.clientX - r.left) / r.width * 100); };
    el.addEventListener('pointerdown', ev => { drag = true; el.setPointerCapture(ev.pointerId); pos(ev); });
    el.addEventListener('pointermove', ev => { if (drag) pos(ev); });
    el.addEventListener('pointerup', () => { drag = false; });
    el.addEventListener('pointercancel', () => { drag = false; });
    return { set, get: () => x, sweep(from = 8, to = 50, ms = 1400) {
      const t0 = performance.now();
      (function f(t) { const p = clamp((t - t0) / ms, 0, 1); const e = p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; set(lerp(from, to, e)); if (p < 1 && !drag) requestAnimationFrame(f); })(t0);
    } };
  }

  /* ---------- segmented control with sliding indicator ---------- */
  function seg(el, items, onChange, active) {
    clear(el);
    const ind = h('span', { class: 'seg-ind' });
    el.append(ind);
    const btns = items.map(it => {
      const b = h('button', { type: 'button', 'data-v': it.v, html: it.html || '' });
      if (!it.html) b.textContent = it.label;
      b.addEventListener('click', () => api.set(it.v, true));
      el.append(b);
      return b;
    });
    const api = {
      value: active ?? items[0].v,
      set(v, fire) {
        api.value = v;
        btns.forEach(b => b.classList.toggle('on', b.dataset.v === String(v)));
        place();
        if (fire) onChange && onChange(v);
      },
    };
    function place() {
      const b = btns.find(x => x.classList.contains('on'));
      if (!b) return;
      ind.style.width = b.offsetWidth + 'px';
      ind.style.transform = `translate(${b.offsetLeft}px, ${b.offsetTop - 4}px)`;
      ind.style.height = b.offsetHeight + 'px';
      ind.style.top = '4px';
    }
    new ResizeObserver(place).observe(el);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(place);
    addEventListener('resize', place);
    api.set(api.value, false);
    return api;
  }
  // upgrade static .seg markup (buttons already in HTML)
  function segStatic(el, onChange) {
    const items = $$('button', el).map(b => ({ v: b.dataset.v, html: b.innerHTML }));
    const act = ($('button.on', el) || $('button', el)).dataset.v;
    return seg(el, items, onChange, act);
  }

  /* ---------- lightbox ---------- */
  const lb = $('#lightbox'), lbContent = $('#lbContent');
  let lbClose = null;
  function openLB(node, { onClose, cls } = {}) {
    clear(lbContent).append(node);
    lb.className = 'lb open' + (cls ? ' ' + cls : '');
    document.body.style.overflow = 'hidden';
    lbClose = onClose || null;
  }
  function closeLB() {
    lb.classList.remove('open');
    document.body.style.overflow = '';
    $$('video', lbContent).forEach(v => { v.pause(); v.removeAttribute('src'); v.load(); });
    lbClose && lbClose(); lbClose = null;
    setTimeout(() => { if (!lb.classList.contains('open')) clear(lbContent); }, 400);
  }
  lb.addEventListener('click', e => { if (e.target === lb || e.target.closest('.lb-x')) closeLB(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && lb.classList.contains('open')) closeLB(); });

  /* ---------- typewriter ---------- */
  function typeText(el, text, { speed = 28, onDone } = {}) {
    if (el._typing) clearTimeout(el._typing);
    let i = 0; el.textContent = '';
    const chars = Array.from(text);
    (function step() {
      el.textContent = chars.slice(0, i).join('');
      if (i++ < chars.length) el._typing = setTimeout(step, speed + (/[,.;]/.test(chars[i - 1]) ? speed * 4 : Math.random() * speed * .6));
      else { el._typing = null; onDone && onDone(); }
    })();
  }

  window.VB = { D, $, $$, h, s, clear, fmt, clamp, lerp, mean, SYS, SYS_KEYS, logo, DOMS, DOM, LEVELS, LCOL, CAT, TASK,
    reveal, onReveal, countUp, tip, bindTip, autoVideo, SyncGroup, makeWipe, seg, segStatic, openLB, closeLB, typeText };
})();
