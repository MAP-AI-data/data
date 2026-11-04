// Overview: headline figures, how AI spread, AI-active firms by country and the country table.
const MX = window.MX;

const pick = (rows, cond) => rows.find((r) => Object.keys(cond).every((k) => String(r[k]) === String(cond[k])));
const allFour = (year) => ({country: MX.ALL, year});
const genAI = (year) => ({kind: 'type', code: 1, country: MX.ALL, year}); // type 1: generative AI & conversational systems

// A figure for the selected year (or the latest), marked with the row it shows.
const figure = (name, source, field, cond, fmt, opts = {}) => {
  dash.draw(name, (el) => {
    const st = MX.get(source);
    if (!MX.textState(el, st)) return;
    const rows = st.data[0];
    const years = MX.yearsOf(rows);
    const where = cond(opts.latest ? years[years.length - 1] : MX.selYear(years));
    el.setAttribute('data-where', MX.where(where));
    const row = pick(rows, where);
    const v = row ? row[field] : null;
    const has = v !== null && v !== undefined && Number.isFinite(Number(v));
    el.textContent = has ? fmt(Number(v)) : '—';
    el.classList.toggle('mx-has', has);
    if (opts.signed) {
      el.classList.toggle('mx-up', has && v > 0);
      el.classList.toggle('mx-down', has && v < 0);
    }
  });
};
figure('lede-share', 'adoption_by_country', 'share', allFour, MX.fmtPct, {latest: true});
figure('lede-firms', 'adoption_by_country', 'n_firms', allFour, MX.fmtInt, {latest: true});
figure('lede-multiple', 'adoption_by_country', 'multiple', allFour, MX.fmtMult, {latest: true});
figure('kpi-share', 'adoption_by_country', 'share', allFour, MX.fmtPct);
figure('kpi-share-delta', 'adoption_by_country', 'change_pp', allFour, MX.fmtPP, {signed: true});
figure('kpi-ai', 'adoption_by_country', 'n_ai', allFour, MX.fmtInt);
figure('kpi-ai-delta', 'adoption_by_country', 'n_ai_change', allFour, MX.fmtSignedInt, {signed: true});
figure('kpi-firms', 'adoption_by_country', 'n_firms', allFour, MX.fmtInt);
figure('kpi-firms-delta', 'adoption_by_country', 'n_firms_change', allFour, MX.fmtRel, {signed: true});
figure('kpi-genai', 'mix_by_country', 'share', genAI, MX.fmtPct);
figure('kpi-genai-delta', 'mix_by_country', 'change_pp', genAI, MX.fmtPP, {signed: true});

// Sparklines under the headline figures.
const spark = (name, source, keep, field, zero) => {
  dash.draw(name, (el) => {
    const st = MX.get(source);
    if (!MX.chartState(el, st)) return;
    const rows = st.data[0]
      .filter(keep)
      .filter((r) => r[field] != null)
      .sort((a, b) => a.year - b.year);
    const W = Math.max(120, el.clientWidth);
    const H = 40;
    const svg = MX.svg(el, W, H).attr('aria-hidden', 'true');
    svg.selectAll('*').remove();
    if (rows.length < 2) return;
    const years = rows.map((r) => r.year);
    const sel = MX.selYear(years);
    const lo = d3.min(rows, (r) => r[field]);
    const hi = d3.max(rows, (r) => r[field]);
    const pad = (hi - lo) * 0.1 || 1;
    const x = d3.scaleLinear([years[0], years[years.length - 1]], [5, W - 5]);
    const y = d3.scaleLinear(zero ? [0, hi] : [lo - pad, hi + pad], [H - 5, 5]);
    svg.append('path').attr('class', 'mx-spark-line').attr('d', d3.line().x((r) => x(r.year)).y((r) => y(r[field]))(rows));
    const s = rows.find((r) => r.year === sel);
    if (s) svg.append('circle').attr('class', 'mx-spark-dot').attr('cx', x(sel)).attr('cy', y(s[field])).attr('r', 3.5);
  });
};
const isAll = (r) => r.country === MX.ALL;
spark('spark-share', 'adoption_by_country', isAll, 'share', true);
spark('spark-ai', 'adoption_by_country', isAll, 'n_ai', true);
spark('spark-firms', 'adoption_by_country', isAll, 'n_firms', false);
spark('spark-genai', 'mix_by_country', (r) => r.kind === 'type' && r.code === 1 && r.country === MX.ALL, 'share', true);

// How AI spread: one line per country plus all four together.
dash.draw('trend', (el) => {
  const st = MX.get('adoption_by_country');
  if (!MX.chartState(el, st)) return;
  const rows = st.data[0];
  const years = MX.yearsOf(rows);
  const series = [...MX.COUNTRIES, MX.ALL]
    .map((key) => ({
      key,
      color: MX.colorOf(key),
      values: rows.filter((r) => r.country === key && r.share != null).sort((a, b) => a.year - b.year),
    }))
    .filter((s) => s.values.length);
  MX.lineChart(el, {
    series,
    years,
    sel: MX.selYear(years),
    label: 'Line chart of the share of classified firms that are AI-active, by country and year',
    value: (d) => d.share,
    endLabel: (s, narrow) => (narrow ? '' : (s.key === MX.ALL ? 'All four' : s.key) + '  ') + MX.fmtPct(s.values[s.values.length - 1].share),
    widthOf: (s) => (s.key === MX.ALL ? 2.75 : 2),
    tipName: (s) => s.key,
    strong: (s) => s.key === MX.ALL,
    dot: () => true,
  });
});

// AI-active firms by country, stacked per year.
dash.draw('counts', (el) => {
  const st = MX.get('adoption_by_country');
  if (!MX.chartState(el, st)) return;
  const rows = st.data[0].filter((r) => MX.COUNTRIES.includes(r.country));
  const years = MX.yearsOf(rows);
  const sel = MX.selYear(years);
  const byYear = years.map((year) => {
    const o = {year};
    for (const c of MX.COUNTRIES) {
      const r = rows.find((q) => q.country === c && q.year === year);
      o[c] = r ? r.n_ai : 0;
    }
    o.total = d3.sum(MX.COUNTRIES, (c) => o[c]);
    return o;
  });
  const W = Math.max(260, el.clientWidth);
  const H = W < 480 ? 260 : 300;
  const svg = MX.svg(el, W, H, 'Stacked bar chart of AI-active firms by country and year');
  svg.selectAll('*').remove();
  const y = d3.scaleLinear([0, (d3.max(byYear, (d) => d.total) || 1) * 1.1], [1, 0]).nice(4);
  const ticks = y.ticks(4);
  const fy = (v) => (v === 0 ? '0' : MX.fmtCompact(v));
  const totalW = MX.textWidth(svg, byYear.map((d) => MX.fmtCompact(d.total)), 'mx-strong');
  const m = {top: 22, right: Math.ceil(totalW / 2) + 2, bottom: 30, left: MX.textWidth(svg, ticks.map(fy), 'mx-tick') + 12};
  const iw = W - m.left - m.right;
  const ih = H - m.top - m.bottom;
  y.range([ih, 0]);
  const x = d3.scaleBand(years, [0, iw]).paddingInner(0.3).paddingOuter(0.1);
  const bw = Math.min(28, x.bandwidth());
  const left = (yr) => x(yr) + (x.bandwidth() - bw) / 2;
  const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);
  for (const t of ticks) {
    g.append('line').attr('class', t === 0 ? 'mx-baseline' : 'mx-gridline').attr('x1', 0).attr('x2', iw).attr('y1', y(t)).attr('y2', y(t));
    g.append('text').attr('class', 'mx-tick').attr('x', -10).attr('y', y(t)).attr('dy', '0.32em').attr('text-anchor', 'end').text(fy(t));
  }
  const yearW = MX.textWidth(svg, years.map(String), 'mx-tick mx-strong');
  const every = Math.max(1, Math.ceil((yearW + 10) / x.step()));
  years.forEach((yr, i) => {
    if (i % every) return;
    g.append('text')
      .attr('class', yr === sel ? 'mx-tick mx-strong' : 'mx-tick')
      .attr('x', x(yr) + x.bandwidth() / 2)
      .attr('y', ih + 20)
      .attr('text-anchor', 'middle')
      .text(yr);
  });
  const segs = [];
  d3.stack().keys(MX.COUNTRIES)(byYear).forEach((layer, li) => {
    for (const d of layer) if (d[1] > d[0]) segs.push({country: layer.key, li, year: d.data.year, y0: d[0], y1: d[1]});
  });
  const topLayer = {};
  for (const s of segs) topLayer[s.year] = Math.max(topLayer[s.year] ?? -1, s.li);
  const bottomLayer = {};
  for (const s of segs) bottomLayer[s.year] = Math.min(bottomLayer[s.year] ?? Infinity, s.li);
  g.append('g')
    .selectAll('path')
    .data(segs)
    .join('path')
    .attr('d', (s) => {
      let top = y(s.y1);
      let bottom = y(s.y0);
      if (s.li !== bottomLayer[s.year]) bottom -= 1;
      if (s.li !== topLayer[s.year]) top += 1;
      const h = Math.max(0, bottom - top);
      return s.li === topLayer[s.year] ? MX.roundTop(left(s.year), top, bw, h, 3) : `M${left(s.year)},${top}h${bw}v${h}h${-bw}Z`;
    })
    .style('fill', (s) => MX.colorOf(s.country))
    .style('opacity', (s) => (s.year === sel ? 1 : 0.5));
  const selTotal = byYear.find((d) => d.year === sel);
  if (selTotal) {
    g.append('text')
      .attr('class', 'mx-strong')
      .attr('x', left(sel) + bw / 2)
      .attr('y', y(selTotal.total) - 7)
      .attr('text-anchor', 'middle')
      .text(MX.fmtCompact(selTotal.total));
  }
  const tip = MX.tip(el);
  g.append('g')
    .selectAll('rect')
    .data(byYear)
    .join('rect')
    .attr('class', 'mx-overlay')
    .style('cursor', 'pointer')
    .attr('x', (d) => x(d.year) - (x.step() - x.bandwidth()) / 2)
    .attr('width', x.step())
    .attr('y', 0)
    .attr('height', ih)
    .on('pointermove', (event, d) => {
      const [px, py] = MX.rel(event, el);
      tip.show(
        {
          title: String(d.year),
          rows: [
            ...[...MX.COUNTRIES].reverse().map((c) => ({color: MX.colorOf(c), shape: 'box', name: c, value: MX.fmtInt(d[c])})),
            {name: 'all four countries', value: MX.fmtInt(d.total), strong: true},
          ],
        },
        px,
        py,
      );
    })
    .on('pointerleave', () => tip.hide())
    .on('click', (event, d) => {
      MX.stop();
      dash.setParams({year: d.year});
    });
});

// Country table for the selected year.
dash.draw('country-table', (el) => {
  const st = MX.get('adoption_by_country');
  if (st.status !== 'ok') {
    el.replaceChildren();
    return;
  }
  const rows = st.data[0];
  const sel = MX.selYear(MX.yearsOf(rows));
  const list = [...MX.COUNTRIES, MX.ALL].map((c) => rows.find((r) => r.country === c && r.year === sel)).filter(Boolean);
  const max = d3.max(list, (r) => r.share) || 1;
  el.replaceChildren(
    ...list.map((r) => {
      const tr = document.createElement('tr');
      tr.dataset.key = MX.key(r.country, r.year);
      if (r.country === MX.ALL) tr.className = 'mx-total';
      tr.append(
        MX.cell(r.country, '', MX.colorOf(r.country)),
        MX.barCell(r.share, max, MX.colorOf(r.country)),
        MX.cell(r.change_pp == null ? '' : MX.fmtPP(r.change_pp), 'num'),
        MX.cell(MX.fmtInt(r.n_ai), 'num mx-hide-narrow'),
        MX.cell(MX.fmtInt(r.n_firms), 'num mx-hide-narrow'),
        MX.cell(MX.fmtMult(r.multiple), 'num mx-x'),
      );
      return tr;
    }),
  );
});
