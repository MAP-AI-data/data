// Industries: the first year against the selected one, and every industry by country, for the picked countries.
const MX = window.MX;
const root = document.getElementById('dash-root') || document;

const LEVELS = {nace1: ['nace', 1], nace2: ['nace', 2], naics2: ['naics', 2]};
const COLS = ['all_four', 'belgium', 'france', 'germany', 'luxembourg'];
const TOP_DIVISIONS = 25; // divisions shown before "Show all divisions"
const level = () => LEVELS[MX.param('ind')] || LEVELS.nace1;
const atLevel = (rows) => {
  const [cls, lvl] = level();
  return rows.filter((r) => r.classification === cls && r.digit_level === lvl);
};

// One country, or all four (the tables' Pooled rows), reads a column of industry_wide; two or three countries
// read the industry_pooled calculation.
const isGroup = () => MX.selected().length > 1 && !MX.isAll();
const load = () => (isGroup() ? MX.get('industry_wide', 'industry_pooled') : MX.get('industry_wide'));
const pooledCache = new WeakMap();
const pooledOf = (rows) => {
  if (!rows || !isGroup()) return null;
  const group = MX.groupKey();
  if (!pooledCache.has(rows)) pooledCache.set(rows, new Map());
  const byGroup = pooledCache.get(rows);
  if (!byGroup.has(group)) {
    byGroup.set(group, new Map(rows.filter((r) => r.group === group).map((r) => [r.id.slice(0, -(group.length + 1)), r])));
  }
  return byGroup.get(group);
};
// The selection's share and classified firms in a row of industry_wide.
const valueOf = (r, pooled) => {
  if (pooled) {
    const p = pooled.get(r.id);
    return p ? {v: p.share, n: p.n_firms} : {v: null, n: null};
  }
  const col = MX.COL[MX.groupKey()];
  return {v: r[col], n: r['n_' + col]};
};
// Classified firms in the picked countries.
const firmsOf = (r) => {
  if (MX.isAll()) return r.n_firms;
  const parts = MX.selected().map((c) => r['n_' + MX.COL[c]]).filter((n) => n != null);
  return parts.length ? d3.sum(parts) : null;
};

let showAll = false;
for (const b of root.querySelectorAll('.mx-more')) {
  b.addEventListener('click', () => {
    showAll = !showAll;
    for (const more of root.querySelectorAll('.mx-more')) {
      more.setAttribute('aria-expanded', String(showAll));
      for (const s of more.querySelectorAll('[data-more]')) s.hidden = (s.dataset.more === 'all') === showAll;
    }
    dash.draw('dumbbell-ind');
  });
}

dash.draw('dumbbell-ind', (el) => {
  const st = load();
  if (!MX.chartState(el, st)) return;
  const rows = atLevel(st.data[0]);
  const pooled = pooledOf(st.data[1]);
  const years = MX.yearsOf(rows);
  const sel = MX.selYear(years);
  const first = years[0];
  const color = MX.groupColor();
  const none = {v: null, n: null};
  let items = Array.from(d3.group(rows, (r) => r.code), ([code, list]) => {
    const a = list.find((r) => r.year === first);
    const b = list.find((r) => r.year === sel);
    const ref = b || a || list[0];
    const va = a ? valueOf(a, pooled) : none;
    const vb = b ? valueOf(b, pooled) : none;
    return {key: code, label: MX.L(ref, 'short'), name: MX.L(ref, 'name'), v0: va.v, v1: vb.v, n: vb.n, color};
  });
  items.sort((p, q) => (q.v1 ?? -1) - (p.v1 ?? -1) || String(p.key).localeCompare(String(q.key)));
  if (level()[0] === 'nace' && level()[1] === 2 && !showAll) items = items.slice(0, TOP_DIVISIONS);
  MX.dumbbell(el, {
    items,
    max: d3.max(rows, (r) => valueOf(r, pooled).v),
    label: MX.t('ariaDumbbell'),
    naText: MX.t('fewerFirms', MX.fmtInt(MX.MIN_FIRMS)),
    tip: (d) => {
      const tipRows = [
        {color: d.color, shape: 'dot', name: MX.t('aiActiveIn', sel), value: d.v1 == null ? MX.t('withheld') : MX.fmtPct(d.v1), strong: true},
        {name: MX.t('aiActiveIn', first), value: d.v0 == null ? MX.t('withheld') : MX.fmtPct(d.v0)},
      ];
      if (d.v0 != null && d.v1 != null && sel !== first) tipRows.push({name: MX.t('ppChange'), value: MX.fmtPP((d.v1 - d.v0) * 100)});
      if (d.n != null) tipRows.push({name: MX.t('classified'), value: MX.fmtInt(d.n)});
      return {title: d.name + ' (' + d.key + ')', rows: tipRows};
    },
  });
});

// ---------------------------------------------------------------- every industry by country, as a heat table

// The columns on show: All four when every country is picked, the group's share when two or three are, then
// each picked country, then classified firms (all four's own column, or the picked countries' sum).
const visibleKeys = () => {
  const keys = ['code', 'name', ...MX.selected().map((c) => MX.COL[c])];
  if (MX.isAll()) keys.push('all_four', 'n_firms');
  else keys.push('n_sel');
  if (isGroup()) keys.push('group');
  return keys;
};
const defaultSort = () => ({key: MX.isAll() ? 'all_four' : isGroup() ? 'group' : MX.COL[MX.selected()[0]], dir: -1});
let indSort = null;
const currentSort = () => {
  if (!indSort) return defaultSort();
  const key = indSort.key === 'n_firms' || indSort.key === 'n_sel' ? (MX.isAll() ? 'n_firms' : 'n_sel') : indSort.key;
  return visibleKeys().includes(key) ? {key, dir: indSort.dir} : defaultSort();
};
const sortValue = (r, key, pooled) => {
  if (key === 'group') return valueOf(r, pooled).v;
  if (key === 'n_sel') return firmsOf(r);
  if (key === 'name') return MX.L(r, 'name');
  return r[key];
};
const markSort = () => {
  const cur = currentSort();
  for (const th of root.querySelectorAll('table[data-sortable="industry"] th')) {
    const b = th.querySelector('button[data-sort]');
    if (b) th.setAttribute('aria-sort', b.dataset.sort === cur.key ? (cur.dir > 0 ? 'ascending' : 'descending') : 'none');
  }
};

MX.indQuery = '';
for (const input of root.querySelectorAll('.mx-search[data-for="industry-table"]')) {
  input.addEventListener('input', () => {
    MX.indQuery = input.value;
    dash.draw('industry-table');
  });
}
for (const table of root.querySelectorAll('table[data-sortable="industry"]')) {
  table.addEventListener('click', (event) => {
    const b = event.target.closest('button[data-sort]');
    if (!b) return;
    const key = b.dataset.sort;
    const cur = currentSort();
    indSort = {key, dir: cur.key === key ? -cur.dir : ['code', 'name'].includes(key) ? 1 : -1};
    markSort();
    dash.draw('industry-table');
  });
}
// The darkest color goes to the 97th percentile of shares at this level, so a few tiny industries don't wash out the rest.
const capOf = (rows) => {
  const values = rows.flatMap((r) => COLS.map((c) => r[c])).filter((v) => v != null).sort(d3.ascending);
  return d3.quantile(values, 0.97) || d3.max(values) || 1;
};

dash.draw('industry-table', (el) => {
  const st = load();
  if (st.status !== 'ok') {
    el.replaceChildren();
    return;
  }
  const rows = atLevel(st.data[0]);
  const pooled = pooledOf(st.data[1]);
  const sel = MX.selYear(MX.yearsOf(rows));
  const cap = capOf(rows);
  const pal = MX.palette(el);
  const q = MX.indQuery.trim().toLowerCase();
  const shown = rows.filter(
    (r) => r.year === sel && (!q || [r.code, r.name, r.short, MX.L(r, 'name'), MX.L(r, 'short')].some((s) => String(s).toLowerCase().includes(q))),
  );
  const {key, dir} = currentSort();
  shown.sort((a, b) => {
    const va = sortValue(a, key, pooled);
    const vb = sortValue(b, key, pooled);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    return (typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb))) * dir;
  });
  const heat = (v) => {
    const td = document.createElement('td');
    td.className = 'num mx-heat';
    if (v == null) td.classList.add('mx-na');
    else {
      td.style.background = pal.fill(v / cap);
      td.style.color = pal.ink(v / cap);
      td.textContent = MX.fmtPct(v);
    }
    return td;
  };
  const picked = MX.selected();
  el.replaceChildren(
    ...shown.map((r) => {
      const tr = document.createElement('tr');
      tr.dataset.key = r.id;
      tr.append(MX.cell(r.code, 'mx-code mx-hide-narrow'), MX.cell(MX.L(r, 'name'), 'mx-name'));
      if (MX.isAll()) tr.append(heat(r.all_four));
      if (pooled) tr.append(heat(valueOf(r, pooled).v));
      for (const c of picked) tr.append(heat(r[MX.COL[c]]));
      const n = firmsOf(r);
      tr.append(MX.cell(n == null ? '' : MX.fmtInt(n), 'num mx-hide-narrow'));
      return tr;
    }),
  );
});

dash.draw('ind-scale', (el) => {
  const st = MX.get('industry_wide');
  if (st.status !== 'ok') {
    el.replaceChildren();
    return;
  }
  const cap = capOf(atLevel(st.data[0]));
  const pal = MX.palette(el);
  const lo = document.createElement('span');
  lo.textContent = MX.loc().locale.format('.0%')(0);
  const bar = document.createElement('span');
  bar.className = 'mx-scale-bar';
  bar.style.background = `linear-gradient(90deg, ${[0, 0.25, 0.5, 0.75, 1].map((t) => pal.fill(t)).join(', ')})`;
  const hi = document.createElement('span');
  hi.textContent = MX.t('orMore', MX.fmtPct(cap));
  el.replaceChildren(lo, bar, hi);
});

// The table's group and classified-firms headers follow the selection, and so does the sort mark.
dash.onData(() => {
  for (const th of root.querySelectorAll('table[data-sortable="industry"] th[data-col="group"]')) th.hidden = !isGroup();
  for (const th of root.querySelectorAll('table[data-sortable="industry"] th[data-field="n_firms"]')) th.hidden = !MX.isAll();
  for (const th of root.querySelectorAll('table[data-sortable="industry"] th[data-col="n_sel"]')) th.hidden = MX.isAll();
  markSort();
});
