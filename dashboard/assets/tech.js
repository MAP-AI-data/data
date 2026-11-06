// Technologies and roles: the mix of AI-active firms over time, by country and by industry, for the picked countries.
const MX = window.MX;

const categoriesOf = (rows, kind) => {
  const seen = new Map();
  for (const r of rows) if (r.kind === kind && !seen.has(r.code)) seen.set(r.code, r);
  return [...seen.values()].map((r) => ({code: r.code, short: MX.L(r, 'short'), label: MX.L(r, 'label')})).sort((a, b) => a.code - b.code);
};
const context = (rows) => {
  const kind = MX.param('bd');
  const cats = categoriesOf(rows, kind);
  return {kind, cats, focus: MX.focus(kind, cats.map((c) => c.code)), group: MX.groupKey()};
};

dash.draw('focus', (select) => {
  const st = MX.get('mix_by_country');
  if (st.status !== 'ok') {
    select.replaceChildren();
    return;
  }
  const {cats, focus} = context(st.data[0]);
  select.replaceChildren(...cats.map((c) => new Option(c.short, String(c.code))));
  select.value = String(focus);
  select.onchange = () => dash.setParams({focus: Number(select.value)});
});

dash.draw('focus-name', (el) => {
  const st = MX.get('mix_by_country');
  if (!MX.textState(el, st)) return;
  const {cats, focus} = context(st.data[0]);
  const c = cats.find((x) => x.code === focus);
  el.textContent = c ? c.short : '—';
});

// Each category over the years; the highlighted one in color, the rest muted.
dash.draw('mix-trend', (el) => {
  const st = MX.get('mix_by_country');
  if (!MX.chartState(el, st)) return;
  const {kind, cats, focus, group} = context(st.data[0]);
  const rows = st.data[0].filter((r) => r.kind === kind && r.country === group);
  const years = MX.yearsOf(rows);
  const series = cats
    .map((c) => ({
      key: c.code,
      name: c.short,
      focus: c.code === focus,
      color: c.code === focus ? MX.accent() : 'var(--cds-chart-muted)',
      values: rows.filter((r) => r.code === c.code && r.share != null).sort((a, b) => a.year - b.year),
    }))
    .filter((s) => s.values.length);
  MX.lineChart(el, {
    series,
    years,
    sel: MX.selYear(years),
    label: MX.t('ariaMixTrend'),
    value: (d) => d.share,
    endLabel: (s, narrow) => (s.focus ? (narrow ? '' : s.name + '  ') + MX.fmtPct(s.values[s.values.length - 1].share) : null),
    widthOf: (s) => (s.focus ? 2.75 : 1.5),
    tipName: (s) => s.name,
    strong: (s) => s.focus,
    dot: (s) => s.focus,
  });
});

// First year against the selected year, per category.
dash.draw('mix-dumbbell', (el) => {
  const st = MX.get('mix_by_country');
  if (!MX.chartState(el, st)) return;
  const {kind, cats, focus, group} = context(st.data[0]);
  const rows = st.data[0].filter((r) => r.kind === kind && r.country === group);
  const years = MX.yearsOf(rows);
  const sel = MX.selYear(years);
  const first = years[0];
  const items = cats
    .map((c) => {
      const a = rows.find((r) => r.code === c.code && r.year === first);
      const b = rows.find((r) => r.code === c.code && r.year === sel);
      return {
        key: c.code,
        label: c.short,
        name: c.label,
        v0: a ? a.share : null,
        v1: b ? b.share : null,
        strong: c.code === focus,
        color: c.code === focus ? MX.accent() : 'var(--color-fg-muted)',
      };
    })
    .sort((p, q) => (q.v1 ?? -1) - (p.v1 ?? -1));
  MX.dumbbell(el, {
    items,
    max: d3.max(rows, (r) => r.share),
    rowH: 28,
    label: MX.t('ariaMixDumbbell'),
    naText: MX.t('withheld'),
    onClick: (d) => dash.setParams({focus: d.key}),
    tip: (d) => {
      const tipRows = [
        {color: d.color, shape: 'dot', name: MX.t('ofAiFirmsYear', sel), value: d.v1 == null ? MX.t('withheld') : MX.fmtPct(d.v1), strong: true},
        {name: MX.t('ofAiFirmsYear', first), value: d.v0 == null ? MX.t('withheld') : MX.fmtPct(d.v0)},
      ];
      if (d.v0 != null && d.v1 != null && sel !== first) tipRows.push({name: MX.t('ppChange'), value: MX.fmtPP((d.v1 - d.v0) * 100)});
      return {title: d.name, rows: tipRows};
    },
  });
});

// Categories against the picked countries (and the picked group together) for the selected year.
dash.draw('mix-heat', (el) => {
  const st = MX.get('mix_by_country');
  if (!MX.chartState(el, st)) return;
  const {kind, cats, focus, group} = context(st.data[0]);
  const picked = MX.selected();
  const rows = st.data[0].filter((r) => r.kind === kind);
  const sel = MX.selYear(MX.yearsOf(rows));
  const now = rows.filter((r) => r.year === sel);
  const value = (code, c) => {
    const r = now.find((x) => x.code === code && x.country === c);
    return r && r.share != null ? r : null;
  };
  const cols = picked.length > 1 ? [group, ...picked] : picked;
  const order = [...cats].sort((a, b) => ((value(b.code, cols[0]) || {}).share ?? -1) - ((value(a.code, cols[0]) || {}).share ?? -1));
  const cap = d3.max(rows, (r) => r.share) || 1;
  const pal = MX.palette(el);
  const W = Math.max(260, el.clientWidth);
  const svg = MX.svg(el, W, 10, MX.t('ariaMixHeat'));
  svg.selectAll('*').remove();
  const labelW = Math.min(MX.textWidth(svg, order.map((c) => c.short), 'mx-rowlabel mx-strong'), Math.floor(W * 0.4));
  const gridW = W - labelW - 14;
  const colW = Math.min(gridW / cols.length, 150);
  const isGroupCol = (c) => c === group && picked.length > 1;
  const full = cols.map((c) => (isGroupCol(c) ? MX.groupName(true) : MX.cname(c)));
  const brief = cols.map((c) => (isGroupCol(c) ? MX.t(MX.isAll() ? 'allAbbr' : 'selAbbr') : MX.CODE[c]));
  const heads = MX.textWidth(svg, full, 'mx-tick mx-strong') <= colW - 8 ? full : brief;
  const rowH = 28;
  const top = 24;
  const H = top + order.length * rowH + 2;
  MX.svg(el, W, H);
  const g = svg.append('g').attr('transform', `translate(${labelW + 14},${top})`);
  cols.forEach((c, j) => {
    g.append('text')
      .attr('class', j === 0 ? 'mx-tick mx-strong' : 'mx-tick')
      .attr('x', j * colW + colW / 2)
      .attr('y', -9)
      .attr('text-anchor', 'middle')
      .text(heads[j]);
  });
  const showText = colW >= 44;
  const tip = MX.tip(el);
  order.forEach((cat, i) => {
    const row = g
      .append('g')
      .attr('class', cat.code === focus ? 'mx-hrow is-strong' : 'mx-hrow')
      .attr('transform', `translate(0,${i * rowH})`)
      .attr('tabindex', 0)
      .style('cursor', 'pointer')
      .on('click', () => dash.setParams({focus: cat.code}))
      .on('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          dash.setParams({focus: cat.code});
          event.preventDefault();
        }
      });
    row.append('rect').attr('class', 'mx-rowhit').attr('x', -labelW - 14).attr('width', W).attr('height', rowH);
    row
      .append('text')
      .attr('class', 'mx-rowlabel')
      .attr('x', -12)
      .attr('y', rowH / 2)
      .attr('dy', '0.32em')
      .attr('text-anchor', 'end')
      .text(cat.short)
      .each(function () {
        MX.fit(this, labelW);
      });
    cols.forEach((c, j) => {
      const r = value(cat.code, c);
      row
        .append('rect')
        .attr('class', 'mx-cell')
        .attr('x', j * colW)
        .attr('y', 0)
        .attr('width', colW)
        .attr('height', rowH)
        .attr('rx', 4)
        .style('fill', r ? pal.fill(r.share / cap) : 'transparent')
        .on('pointermove', (event) => {
          const [px, py] = MX.rel(event, el);
          tip.show(
            {
              title: cat.label + ' · ' + MX.cname(c),
              rows: [
                {name: MX.t('ofAiFirmsYear', sel), value: r ? MX.fmtPct(r.share) : MX.t('withheld'), strong: true},
                ...(r ? [{name: MX.t('aiFirms'), value: MX.fmtInt(r.n_ai)}] : []),
              ],
            },
            px,
            py,
          );
        })
        .on('pointerleave', () => tip.hide());
      if (showText && r) {
        row
          .append('text')
          .attr('class', 'mx-cellval')
          .attr('x', j * colW + colW / 2)
          .attr('y', rowH / 2)
          .attr('dy', '0.32em')
          .attr('text-anchor', 'middle')
          .style('fill', pal.ink(r.share / cap))
          .text(MX.fmtPct(r.share));
      }
    });
    if (cat.code === focus) {
      row.append('rect').attr('class', 'mx-focusbox').attr('x', 0.75).attr('y', 0.75).attr('width', colW * cols.length - 1.5).attr('height', rowH - 1.5).attr('rx', 4);
    }
  });
});

// The highlighted category across industries, with all industries as a dashed line. One country and all four
// use the tables' rows (all four: Pooled); two or three countries use the industry_mix calculation.
dash.draw('mix-industry', (el) => {
  const kind = MX.param('bd');
  const picked = MX.selected();
  const isGroup = picked.length > 1 && !MX.isAll();
  const ids = [kind === 'type' ? 'industry_types' : 'industry_roles', 'names', 'mix_by_country'];
  if (isGroup) ids.push('industry_mix');
  const st = MX.get(...ids);
  if (!MX.chartState(el, st)) return;
  const [rows, names, mix, pooled] = st.data;
  const {cats, focus, group} = context(mix);
  let mine;
  if (isGroup) {
    mine = pooled
      .filter((r) => r.kind === kind && r.group === group && r.category === focus)
      .map((r) => ({code: r.section, year: r.year, v: r.share, n: r.n_ai}));
  } else {
    const codeCol = kind === 'type' ? 'ai_type' : 'ai_role';
    const shareCol = kind === 'type' ? 'type_share_among_ai_firms' : 'role_share_among_ai_firms';
    const source = group === MX.ALL ? 'Pooled' : group;
    mine = rows
      .filter((r) => r.country === source && Number(r[codeCol]) === focus)
      .map((r) => ({code: String(r.code), year: Number(r.year), v: r[shareCol] == null ? null : Number(r[shareCol]), n: Number(r.n_ai_firms)}));
  }
  const years = MX.yearsOf(mine);
  const sel = MX.selYear(years);
  const named = new Map(names.filter((n) => n.scheme === 'nace' && n.level === 1).map((n) => [n.code, n]));
  const items = mine
    .filter((r) => r.year === sel)
    .map((r) => {
      const n = named.get(r.code);
      return {key: r.code, label: n ? MX.L(n, 'short') : r.code, name: n ? MX.L(n, 'name') : r.code, v: r.v, n: r.n};
    })
    .sort((a, b) => (b.v ?? -1) - (a.v ?? -1) || a.key.localeCompare(b.key));
  const ref = mix.find((r) => r.kind === kind && r.code === focus && r.country === group && r.year === sel);
  const cat = cats.find((c) => c.code === focus);
  MX.bars(el, {
    items,
    max: Math.max(d3.max(mine, (r) => r.v) || 0, ref && ref.share != null ? ref.share : 0) || 0.01,
    ref: ref && ref.share != null ? ref.share : null,
    refLabel: MX.t('allIndustries'),
    color: MX.accent(),
    label: MX.t('ariaBars'),
    naText: MX.t('fewerAiFirms', MX.fmtInt(MX.MIN_FIRMS)),
    tip: (d) => ({
      title: d.name + ' (' + d.key + ')',
      rows: [
        {color: MX.accent(), shape: 'box', name: (cat ? cat.short : '') + ', ' + sel, value: d.v == null ? MX.t('withheld') : MX.fmtPct(d.v), strong: true},
        {name: MX.t('aiFirms'), value: MX.fmtInt(d.n)},
      ],
    }),
  });
});
