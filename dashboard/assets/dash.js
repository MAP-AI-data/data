/*
 * A small stand-in for the runtime the page scripts were written against: the `dash` object of a hosted
 * Claude dashboard. It lets the same scripts run as a static site. It loads data/<id>.json the first time a
 * drawing asks for it, runs the calculations, and re-runs the drawings when data arrives, a filter changes,
 * a hidden view is shown or a drawing's width changes. Filters live in the URL query, the open view in the
 * URL hash, so any view can be shared as a link.
 */
(() => {
  const DATA_DIR = 'data/';
  const datasets = new Map();
  const calcs = new Map();
  const drawings = new Map();
  const listeners = [];
  const widths = new WeakMap();
  let params = fromQuery();
  let started = false;
  const baseLang = document.documentElement.lang || 'en';
  let queued = false;

  function fromQuery() {
    const out = {};
    for (const [k, v] of new URLSearchParams(location.search)) out[k] = /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v;
    return out;
  }
  function toQuery() {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) q.set(k, String(v));
    const search = q.toString();
    history.replaceState(history.state, '', location.pathname + (search ? '?' + search : '') + location.hash);
  }
  function answer(status, data = [], message = '') {
    const columns = Array.isArray(data) && data.length ? Object.keys(data[0]) : [];
    return {status, data, columns, message, refreshing: false, meta: []};
  }

  function load(id) {
    const entry = {status: 'loading', data: [], message: ''};
    datasets.set(id, entry);
    fetch(DATA_DIR + encodeURIComponent(id) + '.json')
      .then((res) => {
        if (!res.ok) throw new Error(res.status + ' ' + res.statusText);
        return res.json();
      })
      .then((body) => {
        entry.data = Array.isArray(body) ? body : body.rows || body.data || body.results || [];
        entry.status = 'ok';
      })
      .catch((err) => {
        entry.status = 'error';
        entry.message = String((err && err.message) || err);
        console.error('Could not load ' + DATA_DIR + id + '.json:', err);
      })
      .finally(queue);
    return entry;
  }
  function data(id) {
    if (calcs.has(id)) return calculate(id);
    const entry = datasets.get(id) || load(id);
    return answer(entry.status, entry.data, entry.message);
  }
  function calculate(id) {
    const calc = calcs.get(id);
    const inputs = calc.inputs.map((input) => data(input));
    if (inputs.some((r) => r.status === 'error')) return answer('error', [], 'An input of ' + id + ' did not load');
    if (inputs.some((r) => r.status !== 'ok')) return answer('loading');
    const rows = inputs.map((r) => r.data);
    if (!calc.cache || calc.cache.rows.some((d, i) => d !== rows[i])) {
      try {
        calc.cache = {rows, out: calc.fn(...rows), error: null};
      } catch (err) {
        calc.cache = {rows, out: [], error: err};
        console.error('Calculation ' + id + ' failed:', err);
      }
    }
    return calc.cache.error ? answer('error', [], String(calc.cache.error)) : answer('ok', calc.cache.out);
  }

  const shown = (el) => el.isConnected && !el.closest('[hidden]');
  const resized = 'ResizeObserver' in window
    ? new ResizeObserver((entries) => {
        for (const entry of entries) {
          const w = Math.round(entry.contentRect.width);
          if (widths.has(entry.target) && widths.get(entry.target) !== w) queue();
        }
      })
    : null;
  function draw(name) {
    const fn = drawings.get(name);
    if (!fn) return;
    for (const el of document.querySelectorAll('[data-draw="' + CSS.escape(name) + '"]')) {
      if (!shown(el)) continue;
      try {
        fn(el);
      } catch (err) {
        console.error('Drawing ' + name + ' failed:', err);
      }
      widths.set(el, Math.round(el.getBoundingClientRect().width));
      if (resized) resized.observe(el);
    }
  }
  function run() {
    queued = false;
    // The page's language follows a `lang` filter, when there is one.
    const lang = String(params.lang || '');
    document.documentElement.lang = /^[a-z]{2}$/.test(lang) ? lang : baseLang;
    for (const fn of listeners) {
      try {
        fn();
      } catch (err) {
        console.error(err);
      }
    }
    for (const name of drawings.keys()) draw(name);
  }
  function queue() {
    if (!started || queued) return;
    queued = true;
    requestAnimationFrame(run);
  }

  // A view that stops being hidden is drawn then; one that is hidden waits.
  const revealed = new MutationObserver((records) => {
    const change = records.some(
      (m) => (m.oldValue !== null) !== m.target.hasAttribute('hidden') && (m.target.matches('[data-draw]') || m.target.querySelector('[data-draw]')),
    );
    if (change) queue();
  });

  function start() {
    started = true;
    if (location.protocol === 'file:') {
      const note = document.createElement('p');
      note.className = 'dash-note';
      note.textContent =
        'Browsers block data loading for pages opened straight from a file. In the repository folder, run "python3 -m http.server" and open http://localhost:8000/dashboard/ instead.';
      document.body.prepend(note);
    }
    revealed.observe(document.body, {subtree: true, attributes: true, attributeFilter: ['hidden'], attributeOldValue: true});
    run();
  }

  window.dash = {
    colors: Array.from({length: 8}, (_, i) => 'var(--cds-chart-categorical-' + (i + 1) + ')'),
    data,
    calc(id, spec) {
      calcs.set(id, {inputs: spec.inputs || [], fn: spec.fn, title: spec.title, description: spec.description, cache: null});
      queue();
    },
    loader() {},
    draw(name, fn) {
      if (fn === undefined) {
        draw(name);
        return;
      }
      drawings.set(name, fn);
      queue();
    },
    onData(fn) {
      listeners.push(fn);
      try {
        fn();
      } catch (err) {
        console.error(err);
      }
    },
    params: () => ({...params}),
    setParams(patch) {
      for (const [k, v] of Object.entries(patch || {})) {
        if (v === null || v === undefined || v === '') delete params[k];
        else params[k] = v;
      }
      toQuery();
      queue();
    },
    resetParams() {
      params = {};
      toQuery();
      queue();
    },
    setLink(name) {
      history.replaceState(history.state, '', location.pathname + location.search + '#' + encodeURIComponent(name));
    },
    refresh() {},
  };

  // Page scripts are modules, which run before DOMContentLoaded: start once they have all registered.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else queueMicrotask(start);
})();
