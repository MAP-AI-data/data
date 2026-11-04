// Regions: every NUTS region as a dot, one row per country, and a table to sort and search.
const MX = window.MX;
const root = document.getElementById('dash-root') || document;

// Place circles along their x, each at the height nearest the middle that touches none placed before.
const dodge = (items, pad) => {
  const placed = [];
  for (const it of [...items].sort((a, b) => b.r - a.r)) {
    const blocked = [];
    for (const p of placed) {
      const reach = p.r + it.r + pad;
      const dx = Math.abs(p.x - it.x);
      if (dx < reach) {
        const dy = Math.sqrt(reach * reach - dx * dx);
        blocked.push([p.y - dy, p.y + dy]);
      }
    }
    const free = (y) => blocked.every(([lo, hi]) => y <= lo + 1e-6 || y >= hi - 1e-6);
    let y = 0;
    if (!free(0)) {
      const candidates = blocked.flat().sort((a, b) => Math.abs(a) - Math.abs(b));
      y = candidates.find(free) ?? 0;
    }
    it.y = y;
    placed.push(it);
  }
  return items;
};

dash.draw('swarm', (el) => {
  const st = MX.get('region_rows');
  if (!MX.chartState(el, st)) return;
  const level = Number(MX.param('level'));
  const atLevel = st.data[0].filter((r) => r.nuts_level === level && r.ai_adoption_share != null);
  const svg = MX.svg(el, Math.max(300, el.clientWidth), 10, 'Dot chart of regions by AI-active share, one row per country');
  if (!atLevel.length) {
    svg.selectAll('*').remove();
    return;
  }
  const years = MX.yearsOf(atLevel);
  const sel = MX.selYear(years);
  const first = years[0];
  const now = atLevel.filter((r) => r.year === sel);
  const W = Math.max(300, el.clientWidth);
  const narrow = W < 560;
  const nX = narrow ? 4 : 7;
  const x = d3.scaleLinear([0, d3.max(atLevel, (r) => r.ai_adoption_share)], [0, 1]).nice(nX);
  const ticks = x.ticks(nX);
  const fx = x.tickFormat(nX, '%');
  const tw = MX.textWidths(svg, ticks.map(fx), 'mx-tick');
  const m = {left: Math.ceil(tw[0] / 2) + 4, right: Math.ceil(tw[tw.length - 1] / 2) + 6, bottom: 30};
  const iw = W - m.left - m.right;
  x.range([0, iw]);
  const maxFirms = d3.max(atLevel, (r) => r.n_firms);
  const rMax = ({1: 22, 2: 17, 3: 14}[level] || 14) * (narrow ? 0.72 : 1);
  const rMin = level === 3 ? 2 : 3;
  const radius = (n) => Math.max(rMin, rMax * Math.sqrt(n / maxFirms));
  const headH = 26;
  let cursor = 2;
  const bands = MX.COUNTRIES.map((country) => ({
    country,
    items: now.filter((r) => r.country === country).map((d) => ({d, x: x(d.ai_adoption_share), r: radius(d.n_firms), y: 0})),
  }))
    .filter((b) => b.items.length)
    .map((b) => {
      dodge(b.items, level === 3 ? 0.6 : 1.2);
      const half = Math.max(14, d3.max(b.items, (it) => Math.abs(it.y) + it.r)) + 4;
      const band = {...b, top: cursor, cy: cursor + headH + half, half};
      cursor = band.cy + half + 12;
      return band;
    });
  const H = cursor + m.bottom;
  MX.svg(el, W, H);
  const g = MX.layer(svg, 'mx-plot').attr('transform', `translate(${m.left},0)`);

  const axis = MX.layer(g, 'mx-axis');
  axis.selectAll('*').remove();
  for (const t of ticks) {
    axis.append('line').attr('class', t === 0 ? 'mx-baseline' : 'mx-gridline').attr('x1', x(t)).attr('x2', x(t)).attr('y1', 2).attr('y2', H - m.bottom);
    axis.append('text').attr('class', 'mx-tick').attr('x', x(t)).attr('y', H - m.bottom + 18).attr('text-anchor', 'middle').text(fx(t));
  }

  const heads = MX.layer(g, 'mx-heads');
  heads.selectAll('*').remove();
  for (const b of bands) {
    const med = d3.median(b.items, (it) => it.d.ai_adoption_share);
    const t = heads.append('text').attr('class', 'mx-halo').attr('x', 0).attr('y', b.top + 16);
    t.append('tspan').attr('class', 'mx-strong').text(b.country);
    t.append('tspan')
      .attr('dx', 8)
      .text(b.items.length > 1 ? 'median ' + MX.fmtPct(med) + ' · ' + MX.fmtInt(b.items.length) + ' regions' : MX.fmtPct(med));
  }

  const flat = bands.flatMap((b) => b.items.map((it) => ({...it, cy: b.cy + it.y, country: b.country})));
  MX.layer(g, 'mx-dots')
    .selectAll('circle')
    .data(flat, (p) => p.d.nuts_code)
    .join(
      (enter) => enter.append('circle').attr('class', 'mx-dot').attr('cx', (p) => p.x).attr('cy', (p) => p.cy).attr('r', 0),
      (update) => update,
      (exit) => exit.remove(),
    )
    .style('fill', (p) => MX.colorOf(p.country))
    .transition()
    .duration(MX.dur)
    .ease(d3.easeCubicOut)
    .attr('cx', (p) => p.x)
    .attr('cy', (p) => p.cy)
    .attr('r', (p) => p.r);

  const medians = MX.layer(g, 'mx-medians');
  medians.selectAll('*').remove();
  for (const b of bands) {
    if (b.items.length < 2) continue;
    const mx = x(d3.median(b.items, (it) => it.d.ai_adoption_share));
    for (const cls of ['mx-median-halo', 'mx-median']) {
      medians.append('line').attr('class', cls).attr('x1', mx).attr('x2', mx).attr('y1', b.cy - b.half + 2).attr('y2', b.cy + b.half - 2);
    }
  }

  const notes = MX.layer(g, 'mx-notes');
  notes.selectAll('*').remove();
  for (const b of bands) {
    if (b.items.length < 2) continue;
    const top = b.items.reduce((a, c) => (c.d.ai_adoption_share > a.d.ai_adoption_share ? c : a));
    const t = notes
      .append('text')
      .attr('class', 'mx-note mx-halo')
      .attr('dy', '0.32em')
      .text((level === 3 ? top.d.nuts_code : top.d.label) + ' ' + MX.fmtPct(top.d.ai_adoption_share));
    const w = t.node().getComputedTextLength();
    const cy = b.cy + top.y;
    const lo = b.cy - b.half + 7;
    const hi = b.cy + b.half - 7;
    if (top.x + top.r + 6 + w <= iw + m.right - 2) {
      t.attr('x', top.x + top.r + 6).attr('y', Math.max(lo, Math.min(hi, cy))).attr('text-anchor', 'start');
    } else {
      // No room to the right: set the label just above the dot (or below it), ending at the dot's right edge.
      const above = cy - top.r - 9;
      t.attr('x', Math.max(w - m.left + 2, top.x + top.r))
        .attr('y', above >= lo ? above : Math.min(hi, cy + top.r + 9))
        .attr('text-anchor', 'end');
    }
  }

  const ring = MX.layer(g, 'mx-ring', 'circle').style('display', 'none');
  const tip = MX.tip(el);
  const delaunay = d3.Delaunay.from(flat, (p) => p.x, (p) => p.cy);
  const find = (event) => {
    const [px, py] = d3.pointer(event, g.node());
    const p = flat[delaunay.find(px, py)];
    return p && Math.hypot(p.x - px, p.cy - py) <= Math.max(16, p.r + 6) ? p : null;
  };
  MX.layer(svg, 'mx-overlay', 'rect')
    .attr('width', W)
    .attr('height', H)
    .style('cursor', 'pointer')
    .on('pointermove', (event) => {
      const p = find(event);
      if (!p) {
        ring.style('display', 'none');
        tip.hide();
        return;
      }
      ring.style('display', null).attr('cx', p.x).attr('cy', p.cy).attr('r', p.r + 3);
      const [ex, ey] = MX.rel(event, el);
      const rows = [
        {color: MX.colorOf(p.country), shape: 'dot', name: 'AI-active, ' + sel, value: MX.fmtPct(p.d.ai_adoption_share), strong: true},
        {name: 'classified firms', value: MX.fmtInt(p.d.n_firms)},
      ];
      if (p.d.since_first_pp != null && sel !== first) rows.push({name: 'pp since ' + first, value: MX.fmtPP(p.d.since_first_pp)});
      tip.show({title: p.d.label + ' · ' + p.d.nuts_code, rows}, ex, ey);
    })
    .on('pointerleave', () => {
      ring.style('display', 'none');
      tip.hide();
    })
    .on('click', (event) => {
      const p = find(event);
      if (!p) return;
      MX.regionQuery = p.d.nuts_code;
      for (const input of root.querySelectorAll('.mx-search[data-for="region-table"]')) input.value = p.d.nuts_code;
      dash.draw('region-table');
    });
});

// The table: sort by any column, search by name, code or country.
const regionSort = {key: 'ai_adoption_share', dir: -1};
MX.regionQuery = '';
for (const input of root.querySelectorAll('.mx-search[data-for="region-table"]')) {
  input.addEventListener('input', () => {
    MX.regionQuery = input.value;
    dash.draw('region-table');
  });
}
for (const table of root.querySelectorAll('table[data-sortable="region"]')) {
  table.addEventListener('click', (event) => {
    const b = event.target.closest('button[data-sort]');
    if (!b) return;
    const key = b.dataset.sort;
    regionSort.dir = regionSort.key === key ? -regionSort.dir : ['nuts_code', 'label', 'country'].includes(key) ? 1 : -1;
    regionSort.key = key;
    for (const th of table.querySelectorAll('th[data-field]')) {
      th.setAttribute('aria-sort', th.dataset.field === key ? (regionSort.dir > 0 ? 'ascending' : 'descending') : 'none');
    }
    dash.draw('region-table');
  });
}
const seriesCache = new WeakMap();
const seriesOf = (rows) => {
  if (!seriesCache.has(rows)) seriesCache.set(rows, d3.group(rows, (r) => r.nuts_code));
  return seriesCache.get(rows);
};
dash.draw('region-table', (el) => {
  const st = MX.get('region_rows');
  if (st.status !== 'ok') {
    el.replaceChildren();
    return;
  }
  const all = st.data[0];
  const level = Number(MX.param('level'));
  const atLevel = all.filter((r) => r.nuts_level === level);
  const sel = MX.selYear(MX.yearsOf(atLevel));
  const series = seriesOf(all);
  const q = MX.regionQuery.trim().toLowerCase();
  const rows = atLevel.filter((r) => r.year === sel && (!q || [r.nuts_code, r.label, r.country].some((s) => String(s).toLowerCase().includes(q))));
  rows.sort(MX.sorter(regionSort));
  const max = d3.max(atLevel, (r) => r.ai_adoption_share) || 1;
  el.replaceChildren(
    ...rows.map((r) => {
      const tr = document.createElement('tr');
      tr.dataset.key = MX.key(r.nuts_code, r.year);
      tr.append(
        MX.cell(r.nuts_code, 'mx-code'),
        MX.cell(r.label),
        MX.cell(r.country, 'mx-hide-narrow', MX.colorOf(r.country)),
        MX.barCell(r.ai_adoption_share, max, MX.colorOf(r.country)),
        MX.changeCell(r.since_first_pp, (series.get(r.nuts_code) || []).map((s) => [s.year, s.ai_adoption_share]), sel),
        MX.cell(MX.fmtInt(r.n_firms), 'num mx-hide-narrow'),
      );
      return tr;
    }),
  );
});
