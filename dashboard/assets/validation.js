// Validation: MAP-AI against Eurostat's survey of AI use in enterprises, as in Figure A.2 of the paper, by industry
// and over time, for the picked countries.
const MX = window.MX;

dash.calc('validation_industries', {
  title: 'MAP-AI and the Eurostat survey by industry',
  description:
    'For each NACE section the survey reports, the share of firms using AI in Eurostat’s survey (enterprises with 10 or more persons employed) and in MAP-AI, for every country and group of countries, in each survey year and on average over the three. As in the paper, a group’s survey share is the mean of the shares its countries report, and its MAP-AI share pools their firms (all four: the table’s Pooled row); an average needs all three years.',
  inputs: ['eurostat_ai', 'industry_adoption', 'names'],
  fn: (eurostat_ai, industry_adoption, names) => {
    const NAMES = ['Belgium', 'France', 'Germany', 'Luxembourg'];
    const GEO = {BE: 'Belgium', DE: 'Germany', FR: 'France', LU: 'Luxembourg'};
    const YEARS = [2021, 2023, 2024];
    const SECTIONS = ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'L', 'M', 'N'];
    const groups = [];
    for (let mask = 1; mask < 1 << NAMES.length; mask += 1) {
      const members = NAMES.filter((_, i) => mask & (1 << i));
      groups.push({label: members.length === NAMES.length ? 'All four countries' : members.join(' + '), members});
    }
    const survey = {};
    for (const r of eurostat_ai) {
      if (r.OBS_VALUE == null) continue;
      survey[r.nace_r2 + '|' + GEO[r.geo] + '|' + r.TIME_PERIOD] = {share: Number(r.OBS_VALUE) / 100, flag: r.OBS_FLAG || ''};
    }
    const web = {};
    for (const r of industry_adoption) {
      if (r.classification !== 'nace' || Number(r.digit_level) !== 1) continue;
      web[r.code + '|' + r.country + '|' + r.year] = {share: r.ai_adoption_share == null ? null : Number(r.ai_adoption_share), n: Number(r.n_firms)};
    }
    const named = {};
    for (const n of names) if (n.scheme === 'nace' && n.level === 1) named[n.code] = n;
    const mean = (v) => v.reduce((s, x) => s + x, 0) / v.length;
    const surveyOf = (code, members, year) => {
      const got = members.map((c) => survey[code + '|' + c + '|' + year]).filter(Boolean);
      return {
        share: got.length ? mean(got.map((g) => g.share)) : null,
        gaps: got.length < members.length,
        broken: got.some((g) => g.flag.includes('b')),
      };
    };
    const webOf = (code, members, year) => {
      if (members.length === NAMES.length) {
        const p = web[code + '|Pooled|' + year];
        return p ? p.share : null;
      }
      let num = 0;
      let den = 0;
      for (const c of members) {
        const p = web[code + '|' + c + '|' + year];
        if (p && p.share != null) {
          num += p.share * p.n;
          den += p.n;
        }
      }
      return den ? num / den : null;
    };
    const rows = [];
    for (const g of groups) {
      for (const code of SECTIONS) {
        const n = named[code] || {};
        const label = {
          name: n.name ?? code,
          name_de: n.name_de ?? n.name ?? code,
          name_fr: n.name_fr ?? n.name ?? code,
          short: n.short ?? code,
          short_de: n.short_de ?? n.short ?? code,
          short_fr: n.short_fr ?? n.short ?? code,
        };
        const years = YEARS.map((year) => ({wave: String(year), s: surveyOf(code, g.members, year), mapai: webOf(code, g.members, year)}));
        const full = (pick) => years.every((y) => pick(y) != null);
        const avg = {
          wave: 'avg',
          s: {
            share: full((y) => y.s.share) ? mean(years.map((y) => y.s.share)) : null,
            gaps: years.some((y) => y.s.gaps),
            broken: years.some((y) => y.s.broken),
          },
          mapai: full((y) => y.mapai) ? mean(years.map((y) => y.mapai)) : null,
        };
        for (const w of [avg, ...years]) {
          const both = w.s.share != null && w.mapai != null;
          rows.push({
            id: g.label + '|' + w.wave + '|' + code,
            group: g.label,
            wave: w.wave,
            code,
            ...label,
            eurostat: w.s.share,
            mapai: w.mapai,
            diff_pp: both ? (w.mapai - w.s.share) * 100 : null,
            survey_gaps: w.s.share != null && w.s.gaps,
            series_break: w.s.share != null && w.s.broken,
          });
        }
      }
    }
    return rows;
  },
});

dash.calc('validation_fit', {
  title: 'How closely MAP-AI follows the survey',
  description:
    'For each country or group and survey year (or the average), over the industries with both figures: how many there are, the Pearson correlation between the survey’s and MAP-AI’s shares, the least-squares line of MAP-AI on the survey, and in how many MAP-AI is below the survey.',
  inputs: ['validation_industries'],
  fn: (validation_industries) => {
    const cells = {};
    for (const r of validation_industries) {
      if (r.eurostat == null || r.mapai == null) continue;
      (cells[r.group + '|' + r.wave] ??= {group: r.group, wave: r.wave, pts: []}).pts.push([r.eurostat, r.mapai]);
    }
    return Object.values(cells).map(({group, wave, pts}) => {
      const n = pts.length;
      const mx = pts.reduce((s, p) => s + p[0], 0) / n;
      const my = pts.reduce((s, p) => s + p[1], 0) / n;
      let sxy = 0;
      let sxx = 0;
      let syy = 0;
      for (const [x, y] of pts) {
        sxy += (x - mx) * (y - my);
        sxx += (x - mx) ** 2;
        syy += (y - my) ** 2;
      }
      const ok = n >= 3 && sxx > 0 && syy > 0;
      return {
        id: group + '|' + wave,
        group,
        wave,
        n,
        r: ok ? sxy / Math.sqrt(sxx * syy) : null,
        slope: sxx > 0 ? sxy / sxx : null,
        intercept: sxx > 0 ? my - (sxy / sxx) * mx : null,
        below: pts.filter(([x, y]) => y < x).length,
      };
    });
  },
});

dash.calc('validation_levels', {
  title: 'MAP-AI and the survey over time',
  description:
    'For each country and year: MAP-AI’s share of firms using AI in the NACE sections the survey reports (C to N without K), pooling their firms, and in survey years the survey’s share for its whole coverage (all activities except agriculture, mining and finance, enterprises with 10 or more persons employed).',
  inputs: ['eurostat_ai', 'industry_adoption'],
  fn: (eurostat_ai, industry_adoption) => {
    const GEO = {BE: 'Belgium', DE: 'Germany', FR: 'France', LU: 'Luxembourg'};
    const SECTIONS = ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'L', 'M', 'N'];
    const cells = {};
    for (const r of industry_adoption) {
      if (r.classification !== 'nace' || Number(r.digit_level) !== 1 || !SECTIONS.includes(r.code) || r.country === 'Pooled') continue;
      const c = (cells[r.country + '|' + r.year] ??= {country: r.country, year: Number(r.year), num: 0, den: 0});
      if (r.ai_adoption_share != null) {
        c.num += Number(r.ai_adoption_share) * Number(r.n_firms);
        c.den += Number(r.n_firms);
      }
    }
    const survey = {};
    for (const r of eurostat_ai) {
      if (r.nace_r2 === 'C10-S951_X_K' && r.OBS_VALUE != null) {
        survey[GEO[r.geo] + '|' + r.TIME_PERIOD] = {share: Number(r.OBS_VALUE) / 100, flag: r.OBS_FLAG || ''};
      }
    }
    return Object.values(cells)
      .map((c) => {
        const s = survey[c.country + '|' + c.year];
        return {
          id: c.country + '|' + c.year,
          country: c.country,
          year: c.year,
          mapai: c.den ? c.num / c.den : null,
          eurostat: s ? s.share : null,
          series_break: Boolean(s && s.flag.includes('b')),
        };
      })
      .sort((a, b) => a.country.localeCompare(b.country) || a.year - b.year);
  },
});

// ---------------------------------------------------------------- headline figures

const fitFigure = (name, field, fmt) => {
  dash.draw(name, (el) => {
    const st = MX.get('validation_fit');
    if (!MX.textState(el, st)) return;
    const where = {group: MX.groupKey(), wave: MX.param('wave')};
    el.setAttribute('data-where', MX.where(where));
    const row = st.data[0].find((r) => r.group === where.group && r.wave === where.wave);
    const v = row ? row[field] : null;
    el.textContent = v == null ? '—' : fmt(v);
  });
};
fitFigure('val-r', 'r', (v) => MX.loc().locale.format('.2f')(v));
fitFigure('val-n', 'n', MX.fmtInt);
fitFigure('val-below', 'below', MX.fmtInt);

// ---------------------------------------------------------------- industry by industry

dash.draw('val-scatter', (el) => {
  const st = MX.get('validation_industries', 'validation_fit');
  if (!MX.chartState(el, st)) return;
  const [rows, fits] = st.data;
  const group = MX.groupKey();
  const wave = MX.param('wave');
  const mine = rows.filter((r) => r.group === group);
  const pts = mine.filter((r) => r.wave === wave && r.eurostat != null && r.mapai != null);
  const fit = fits.find((f) => f.group === group && f.wave === wave);
  const W = Math.max(280, el.clientWidth);
  const narrow = W < 560;
  const H = Math.round(Math.max(300, Math.min(540, W * 0.82)));
  const svg = MX.svg(el, W, H, MX.t('ariaValScatter'));
  svg.selectAll('*').remove();
  // Each axis keeps one range for every survey year of this selection, so switching years moves only the dots.
  const xTop = (d3.max(mine, (r) => r.eurostat) || 0.1) * 1.04;
  const yTop = (d3.max(mine, (r) => r.mapai) || 0.1) * 1.06;
  const count = narrow ? 4 : 5;
  const y = d3.scaleLinear([0, yTop], [1, 0]).nice(count);
  const yTicks = y.ticks(count);
  const fy = MX.tickFormat(y, count, '%');
  const m = {top: 12, right: 16, bottom: 50, left: MX.textWidth(svg, yTicks.map(fy), 'mx-tick') + 36};
  const iw = W - m.left - m.right;
  const ih = H - m.top - m.bottom;
  y.range([ih, 0]);
  const x = d3.scaleLinear([0, xTop], [0, iw]).nice(count);
  const {ticks: xTicks, fmt: fx} = MX.xTicks(svg, x, count);
  const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);
  for (const t of yTicks) {
    g.append('line').attr('class', t === 0 ? 'mx-baseline' : 'mx-gridline').attr('x1', 0).attr('x2', iw).attr('y1', y(t)).attr('y2', y(t));
    g.append('text').attr('class', 'mx-tick').attr('x', -10).attr('y', y(t)).attr('dy', '0.32em').attr('text-anchor', 'end').text(fy(t));
  }
  for (const t of xTicks) {
    if (t !== 0) g.append('line').attr('class', 'mx-gridline').attr('x1', x(t)).attr('x2', x(t)).attr('y1', 0).attr('y2', ih);
    g.append('text').attr('class', 'mx-tick').attr('x', x(t)).attr('y', ih + 18).attr('text-anchor', 'middle').text(fx(t));
  }
  g.append('line').attr('class', 'mx-baseline').attr('x1', 0).attr('x2', 0).attr('y1', 0).attr('y2', ih);
  const xt = g.append('text').attr('class', 'mx-axistitle').attr('x', iw / 2).attr('y', ih + 42).attr('text-anchor', 'middle').text(MX.t('valX'));
  MX.fit(xt.node(), iw);
  const yt = g
    .append('text')
    .attr('class', 'mx-axistitle')
    .attr('transform', `translate(${-m.left + 12},${ih / 2}) rotate(-90)`)
    .attr('text-anchor', 'middle')
    .text(MX.t('valY'));
  MX.fit(yt.node(), ih);

  const end = Math.min(x.domain()[1], y.domain()[1]);
  g.append('line').attr('class', 'mx-diag').attr('x1', x(0)).attr('y1', y(0)).attr('x2', x(end)).attr('y2', y(end));
  if (fit && fit.slope != null && pts.length > 1) {
    const [a, b] = d3.extent(pts, (p) => p.eurostat);
    const at = (v) => Math.max(0, fit.intercept + fit.slope * v);
    g.append('line').attr('class', 'mx-fitline').attr('x1', x(a)).attr('y1', y(at(a))).attr('x2', x(b)).attr('y2', y(at(b)));
  }

  const r0 = narrow ? 5 : 6;
  const color = MX.groupColor();
  g.append('g')
    .selectAll('circle')
    .data(pts, (p) => p.code)
    .join('circle')
    .attr('class', 'mx-vdot')
    .attr('cx', (p) => x(p.eurostat))
    .attr('cy', (p) => y(p.mapai))
    .attr('r', r0)
    .style('fill', color);

  // Section letters beside their dots, each where it touches no dot and no letter placed before; a letter with no
  // such spot is left out (the table and the tooltip name every dot).
  const widths = MX.textWidths(svg, pts.map((p) => p.code), 'mx-vlabel');
  const taken = pts.map((p) => ({x0: x(p.eurostat) - r0, x1: x(p.eurostat) + r0, y0: y(p.mapai) - r0, y1: y(p.mapai) + r0}));
  const labels = g.append('g');
  pts.forEach((p, i) => {
    const cx = x(p.eurostat);
    const cy = y(p.mapai);
    const w = widths[i];
    const spots = [
      {x: cx + r0 + 4, y: cy, a: 'start'},
      {x: cx - r0 - 4, y: cy, a: 'end'},
      {x: cx, y: cy - r0 - 8, a: 'middle'},
      {x: cx, y: cy + r0 + 9, a: 'middle'},
      {x: cx + r0 + 2, y: cy - r0 - 6, a: 'start'},
      {x: cx - r0 - 2, y: cy + r0 + 8, a: 'end'},
    ];
    const box = (s) => {
      const x0 = s.a === 'start' ? s.x : s.a === 'end' ? s.x - w : s.x - w / 2;
      return {x0: x0 - 1, x1: x0 + w + 1, y0: s.y - 8, y1: s.y + 8}; // the letter's box as drawn, halo included
    };
    const inside = (b) => b.x0 >= -m.left + 2 && b.x1 <= iw + m.right - 2 && b.y0 >= -m.top && b.y1 <= ih + 4;
    const clear = (b) => taken.every((o) => b.x1 <= o.x0 || b.x0 >= o.x1 || b.y1 <= o.y0 || b.y0 >= o.y1);
    const spot = spots.find((s) => inside(box(s)) && clear(box(s)));
    if (!spot) return;
    taken.push(box(spot));
    labels.append('text').attr('class', 'mx-vlabel mx-halo').attr('x', spot.x).attr('y', spot.y).attr('dy', '0.32em').attr('text-anchor', spot.a).text(p.code);
  });

  const ring = g.append('circle').attr('class', 'mx-ring').style('display', 'none');
  const tip = MX.tip(el);
  const delaunay = d3.Delaunay.from(pts, (p) => x(p.eurostat), (p) => y(p.mapai));
  const find = (event) => {
    if (!pts.length) return null;
    const [px, py] = d3.pointer(event, g.node());
    const p = pts[delaunay.find(px, py)];
    return p && Math.hypot(x(p.eurostat) - px, y(p.mapai) - py) <= 24 ? p : null;
  };
  const year = wave === 'avg' ? '' : ', ' + wave;
  g.append('rect')
    .attr('class', 'mx-overlay')
    .attr('width', iw)
    .attr('height', ih)
    .style('cursor', 'default')
    .on('pointermove', (event) => {
      const p = find(event);
      if (!p) {
        ring.style('display', 'none');
        tip.hide();
        return;
      }
      ring.style('display', null).attr('cx', x(p.eurostat)).attr('cy', y(p.mapai)).attr('r', r0 + 3);
      const tipRows = [
        {name: MX.t('survey') + year, value: MX.fmtPct(p.eurostat)},
        {color, shape: 'dot', name: 'MAP-AI' + year, value: MX.fmtPct(p.mapai), strong: true},
        {name: MX.t('ppDiff'), value: MX.fmtPP(p.diff_pp)},
      ];
      if (p.survey_gaps) tipRows.push({name: MX.t('surveyGaps'), value: ''});
      const [ex, ey] = MX.rel(event, el);
      tip.show({title: p.code + ' · ' + MX.L(p, 'name'), rows: tipRows}, ex, ey);
    })
    .on('pointerleave', () => {
      ring.style('display', 'none');
      tip.hide();
    });
});

// The same industries as a table: it also names the letters on the chart.
dash.draw('val-table', (el) => {
  const st = MX.get('validation_industries');
  if (st.status !== 'ok') {
    el.replaceChildren();
    return;
  }
  const group = MX.groupKey();
  const wave = MX.param('wave');
  const mine = st.data[0].filter((r) => r.group === group);
  const rows = mine.filter((r) => r.wave === wave && (r.eurostat != null || r.mapai != null));
  rows.sort((a, b) => (b.eurostat ?? -1) - (a.eurostat ?? -1) || a.code.localeCompare(b.code));
  const share = (v) => (v == null ? MX.cell('', 'num mx-na') : MX.cell(MX.fmtPct(v), 'num'));
  el.replaceChildren(
    ...rows.map((r) => {
      const tr = document.createElement('tr');
      tr.dataset.key = r.id;
      tr.append(
        MX.cell(r.code, 'mx-code'),
        MX.cell(MX.L(r, 'name'), 'mx-name'),
        share(r.eurostat),
        share(r.mapai),
        MX.cell(r.diff_pp == null ? '' : MX.fmtPP(r.diff_pp), 'num mx-hide-narrow'),
      );
      return tr;
    }),
  );
});

// ---------------------------------------------------------------- over time

dash.draw('legend-val', (el) => {
  el.replaceChildren(
    ...MX.selected().map((c) => {
      const li = document.createElement('li');
      const key = document.createElement('i');
      key.className = 'mx-key';
      key.style.background = MX.colorOf(c);
      li.append(key, document.createTextNode(MX.cname(c)));
      return li;
    }),
  );
});

dash.draw('val-levels', (el) => {
  const st = MX.get('validation_levels');
  if (!MX.chartState(el, st)) return;
  const rows = st.data[0];
  const picked = MX.selected();
  const years = MX.yearsOf(rows);
  const series = picked
    .map((c) => ({key: c, color: MX.colorOf(c), values: rows.filter((r) => r.country === c && r.mapai != null).sort((a, b) => a.year - b.year)}))
    .filter((s) => s.values.length);
  const points = rows.filter((r) => picked.includes(r.country) && r.eurostat != null).map((r) => ({year: r.year, value: r.eurostat, color: MX.colorOf(r.country)}));
  MX.lineChart(el, {
    series,
    years,
    sel: MX.selYear(years),
    label: MX.t('ariaValLevels'),
    value: (d) => d.mapai,
    endLabel: (s, narrow) => (narrow ? '' : MX.cname(s.key) + '  ') + MX.fmtPct(s.values[s.values.length - 1].mapai),
    widthOf: () => 2,
    tipName: (s) => MX.cname(s.key),
    strong: () => false,
    dot: () => true,
    points,
    tipRows: (yr) =>
      picked.flatMap((c) => {
        const r = rows.find((x) => x.country === c && x.year === yr);
        if (!r) return [];
        const out = [{color: MX.colorOf(c), name: MX.cname(c) + ' · MAP-AI', value: r.mapai == null ? '—' : MX.fmtPct(r.mapai)}];
        if (r.eurostat != null) {
          out.push({color: MX.colorOf(c), shape: 'ring', name: MX.cname(c) + ' · ' + MX.t('surveyShort'), value: MX.fmtPct(r.eurostat)});
          // A break in Eurostat's series: the survey changed, so this year compares less well with the others.
          if (r.series_break) out.push({name: MX.t('seriesBreak'), value: ''});
        }
        return out;
      }),
  });
});
