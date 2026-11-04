// Industries: the first year against the selected one, and every industry by country.
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
  const st = MX.get('industry_wide');
  if (!MX.chartState(el, st)) return;
  const rows = atLevel(st.data[0]);
  const country = MX.param('country');
  const col = MX.COL[country] || 'all_four';
  const years = MX.yearsOf(rows);
  const sel = MX.selYear(years);
  const first = years[0];
  let items = Array.from(d3.group(rows, (r) => r.code), ([code, list]) => {
    const a = list.find((r) => r.year === first);
    const b = list.find((r) => r.year === sel);
    const ref = b || a || list[0];
    return {
      key: code,
      label: ref.short,
      name: ref.name,
      v0: a ? a[col] : null,
      v1: b ? b[col] : null,
      n: b ? b['n_' + col] : null,
      color: MX.colorOf(country),
    };
  });
  items.sort((p, q) => (q.v1 ?? -1) - (p.v1 ?? -1) || String(p.key).localeCompare(String(q.key)));
  if (level()[0] === 'nace' && level()[1] === 2 && !showAll) items = items.slice(0, TOP_DIVISIONS);
  MX.dumbbell(el, {
    items,
    max: d3.max(rows, (r) => r[col]),
    label: 'Dot plot of the AI-active share of each industry in the first and the selected year',
    naText: 'fewer than ' + MX.fmtInt(MX.MIN_FIRMS) + ' firms',
    tip: (d) => {
      const tipRows = [
        {color: d.color, shape: 'dot', name: 'AI-active, ' + sel, value: d.v1 == null ? 'withheld' : MX.fmtPct(d.v1), strong: true},
        {name: 'AI-active, ' + first, value: d.v0 == null ? 'withheld' : MX.fmtPct(d.v0)},
      ];
      if (d.v0 != null && d.v1 != null && sel !== first) tipRows.push({name: 'pp change', value: MX.fmtPP((d.v1 - d.v0) * 100)});
      if (d.n != null) tipRows.push({name: 'classified firms', value: MX.fmtInt(d.n)});
      return {title: d.name + ' (' + d.key + ')', rows: tipRows};
    },
  });
});

// Every industry by country, as a heat table.
let indSort = null;
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
    const current = indSort || {key: MX.COL[MX.param('country')] || 'all_four', dir: -1};
    indSort = {key, dir: current.key === key ? -current.dir : ['code', 'name'].includes(key) ? 1 : -1};
    for (const th of table.querySelectorAll('th[data-field]')) {
      th.setAttribute('aria-sort', th.dataset.field === key ? (indSort.dir > 0 ? 'ascending' : 'descending') : 'none');
    }
    dash.draw('industry-table');
  });
}
// The darkest color goes to the 97th percentile of shares at this level, so a few tiny industries don't wash out the rest.
const capOf = (rows) => {
  const values = rows.flatMap((r) => COLS.map((c) => r[c])).filter((v) => v != null).sort(d3.ascending);
  return d3.quantile(values, 0.97) || d3.max(values) || 1;
};

dash.draw('industry-table', (el) => {
  const st = MX.get('industry_wide');
  if (st.status !== 'ok') {
    el.replaceChildren();
    return;
  }
  const rows = atLevel(st.data[0]);
  const sel = MX.selYear(MX.yearsOf(rows));
  const cap = capOf(rows);
  const pal = MX.palette(el);
  const q = MX.indQuery.trim().toLowerCase();
  const shown = rows.filter((r) => r.year === sel && (!q || [r.code, r.name, r.short].some((s) => String(s).toLowerCase().includes(q))));
  shown.sort(MX.sorter(indSort || {key: MX.COL[MX.param('country')] || 'all_four', dir: -1}));
  el.replaceChildren(
    ...shown.map((r) => {
      const tr = document.createElement('tr');
      tr.dataset.key = r.id;
      tr.append(MX.cell(r.code, 'mx-code mx-hide-narrow'), MX.cell(r.name, 'mx-name'));
      for (const c of COLS) {
        const td = document.createElement('td');
        td.className = 'num mx-heat';
        const v = r[c];
        if (v == null) td.classList.add('mx-na');
        else {
          td.style.background = pal.fill(v / cap);
          td.style.color = pal.ink(v / cap);
          td.textContent = MX.fmtPct(v);
        }
        tr.append(td);
      }
      tr.append(MX.cell(r.n_firms == null ? '' : MX.fmtInt(r.n_firms), 'num mx-hide-narrow'));
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
  lo.textContent = d3.format('.0%')(0);
  const bar = document.createElement('span');
  bar.className = 'mx-scale-bar';
  bar.style.background = `linear-gradient(90deg, ${[0, 0.25, 0.5, 0.75, 1].map((t) => pal.fill(t)).join(', ')})`;
  const hi = document.createElement('span');
  hi.textContent = MX.fmtPct(cap) + ' or more';
  el.replaceChildren(lo, bar, hi);
});

// Until a header is clicked, the table sorts by the chosen country's column.
dash.onData(() => {
  if (indSort) return;
  const key = MX.COL[MX.param('country')] || 'all_four';
  for (const th of root.querySelectorAll('table[data-sortable="industry"] th[data-field]')) {
    th.setAttribute('aria-sort', th.dataset.field === key ? 'descending' : 'none');
  }
});
