// MAP-AI dashboard: shared helpers, filters, calculations and chart builders.
const MX = (window.MX = window.MX || {});
const root = document.getElementById('dash-root') || document;

MX.ALL = 'All four countries';
MX.COUNTRIES = ['Belgium', 'France', 'Germany', 'Luxembourg'];
MX.COL = {'All four countries': 'all_four', Belgium: 'belgium', France: 'france', Germany: 'germany', Luxembourg: 'luxembourg'};
MX.MIN_FIRMS = 30; // README: a share is withheld when its denominator has fewer than 30 firms
MX.dur = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 650;
MX.colorOf = (country) => (MX.COUNTRIES.includes(country) ? dash.colors[MX.COUNTRIES.indexOf(country)] : 'var(--color-fg)');
MX.accent = () => dash.colors[4];

MX.fmtPct = d3.format('.1%');
MX.fmtInt = d3.format(',');
MX.fmtPP = d3.format('+.1f');
MX.fmtSignedInt = d3.format('+,');
MX.fmtRel = d3.format('+.1%');
MX.fmtMult = (v) => d3.format(v >= 10 ? '.0f' : '.1f')(v);
MX.fmtCompact = (v) => new Intl.NumberFormat('en', {notation: 'compact', maximumFractionDigits: 1}).format(v);

// ---------------------------------------------------------------- calculations

dash.calc('adoption_by_country', {
  title: 'AI adoption by country',
  description:
    'Each country’s published AI-active share, plus All four countries: AI-active firms summed over the four countries, divided by classified firms summed. Changes compare each year with the year before (percentage points for shares) and with the first year.',
  inputs: ['country_adoption', 'country_roles'],
  fn: (country_adoption, country_roles) => {
    const ALL = 'All four countries';
    const aiFirms = {};
    for (const r of country_roles) aiFirms[r.country + '|' + r.year] = Number(r.n_ai_firms);
    const rows = country_adoption.map((r) => ({
      country: r.country,
      year: Number(r.year),
      share: Number(r.ai_adoption_share),
      n_ai: aiFirms[r.country + '|' + r.year],
      n_firms: Number(r.n_firms),
    }));
    const pooled = {};
    for (const r of rows) {
      const p = (pooled[r.year] ??= {country: ALL, year: r.year, share: 0, n_ai: 0, n_firms: 0});
      p.n_ai += r.n_ai;
      p.n_firms += r.n_firms;
    }
    for (const p of Object.values(pooled)) rows.push({...p, share: p.n_ai / p.n_firms});
    const series = {};
    for (const r of rows) (series[r.country] ??= []).push(r);
    for (const list of Object.values(series)) {
      list.sort((a, b) => a.year - b.year);
      list.forEach((r, i) => {
        const prev = list[i - 1];
        r.change_pp = prev ? (r.share - prev.share) * 100 : null;
        r.multiple = r.share / list[0].share;
        r.n_ai_change = prev ? r.n_ai - prev.n_ai : null;
        r.n_firms_change = prev ? r.n_firms / prev.n_firms - 1 : null;
      });
    }
    return rows;
  },
});

dash.calc('mix_by_country', {
  title: 'Technology types and roles by country',
  description:
    'Share of AI-active firms in each technology type and ecosystem role. Countries use the published shares. All four countries recovers each category’s firm count (share of all firms × classified firms, rounded), sums it over the four countries and divides by AI-active firms summed. Changes are in percentage points on the year before.',
  inputs: ['country_types', 'country_roles', 'names'],
  fn: (country_types, country_roles, names) => {
    const ALL = 'All four countries';
    const short = {};
    for (const n of names) short[n.scheme + '|' + n.code] = n.short;
    const rows = [];
    const pooled = {};
    const add = (list, kind, codeCol, labelCol, aiCol, allCol) => {
      for (const r of list) {
        const code = Number(r[codeCol]);
        const year = Number(r.year);
        const base = {kind, code, label: r[labelCol], short: short['ai_' + kind + '|' + code] ?? r[labelCol], year};
        rows.push({...base, country: r.country, share: r[aiCol] == null ? null : Number(r[aiCol]), n_ai: Number(r.n_ai_firms)});
        const p = (pooled[kind + '|' + code + '|' + year] ??= {...base, country: ALL, share: null, n_ai: 0, n_cat: 0});
        p.n_ai += Number(r.n_ai_firms);
        p.n_cat += Math.round(Number(r[allCol]) * Number(r.n_firms));
      }
    };
    add(country_types, 'type', 'ai_type', 'ai_type_label', 'type_share_among_ai_firms', 'type_share_among_all_firms');
    add(country_roles, 'role', 'ai_role', 'ai_role_label', 'role_share_among_ai_firms', 'role_share_among_all_firms');
    for (const p of Object.values(pooled)) {
      const {n_cat, ...row} = p;
      rows.push({...row, share: n_cat / p.n_ai});
    }
    const series = {};
    for (const r of rows) (series[r.kind + '|' + r.code + '|' + r.country] ??= []).push(r);
    for (const list of Object.values(series)) {
      list.sort((a, b) => a.year - b.year);
      list.forEach((r, i) => {
        const prev = list[i - 1];
        r.change_pp = prev && prev.share != null && r.share != null ? (r.share - prev.share) * 100 : null;
      });
    }
    return rows;
  },
});

dash.calc('region_rows', {
  title: 'Regions with names',
  description:
    'NUTS 1–3 regions with their names (a NUTS 3 region is named after its NUTS 2 region) and the change in AI-active share since the first year, in percentage points.',
  inputs: ['region_adoption', 'names'],
  fn: (region_adoption, names) => {
    const name = {};
    for (const n of names) if (n.scheme === 'nuts') name[n.code] = n.short;
    const children = {};
    const small = new Set(region_adoption.filter((r) => Number(r.nuts_level) === 3).map((r) => r.nuts_code));
    for (const code of small) children[code.slice(0, 4)] = (children[code.slice(0, 4)] || 0) + 1;
    const rows = region_adoption.map((r) => {
      const level = Number(r.nuts_level);
      const parent = r.nuts_code.slice(0, 4);
      let label = name[r.nuts_code] ?? r.nuts_code;
      if (level === 3) label = children[parent] === 1 ? (name[parent] ?? parent) : 'Part of ' + (name[parent] ?? parent);
      return {
        nuts_code: r.nuts_code,
        nuts_level: level,
        country: r.country,
        year: Number(r.year),
        label,
        ai_adoption_share: r.ai_adoption_share == null ? null : Number(r.ai_adoption_share),
        n_firms: Number(r.n_firms),
      };
    });
    const first = {};
    for (const r of rows) if (!first[r.nuts_code] || r.year < first[r.nuts_code].year) first[r.nuts_code] = r;
    for (const r of rows) {
      const f = first[r.nuts_code];
      r.since_first_pp = f.ai_adoption_share != null && r.ai_adoption_share != null ? (r.ai_adoption_share - f.ai_adoption_share) * 100 : null;
    }
    return rows;
  },
});

dash.calc('industry_wide', {
  title: 'Industries by country',
  description:
    'One row per industry and year: the AI-active share in each country (All four countries is the published Pooled row), each country’s classified firms, and the industry’s name.',
  inputs: ['industry_adoption', 'names'],
  fn: (industry_adoption, names) => {
    const COL = {Pooled: 'all_four', Belgium: 'belgium', France: 'france', Germany: 'germany', Luxembourg: 'luxembourg'};
    const named = {};
    for (const n of names) named[n.scheme + '|' + n.code] = n;
    const wide = {};
    for (const r of industry_adoption) {
      const id = r.classification + '-' + r.digit_level + '-' + r.code + '-' + r.year;
      const n = named[r.classification + '|' + r.code] || {};
      const row = (wide[id] ??= {
        id,
        classification: r.classification,
        digit_level: Number(r.digit_level),
        code: String(r.code),
        year: Number(r.year),
        name: n.name ?? String(r.code),
        short: n.short ?? String(r.code),
        all_four: null,
        belgium: null,
        france: null,
        germany: null,
        luxembourg: null,
        n_firms: null,
        n_all_four: null,
        n_belgium: null,
        n_france: null,
        n_germany: null,
        n_luxembourg: null,
      });
      const col = COL[r.country];
      if (!col) continue;
      row[col] = r.ai_adoption_share == null ? null : Number(r.ai_adoption_share);
      row['n_' + col] = Number(r.n_firms);
      if (col === 'all_four') row.n_firms = Number(r.n_firms);
    }
    return Object.values(wide);
  },
});

// ---------------------------------------------------------------- filters

const DEFAULTS = {level: '3', ind: 'nace1', country: MX.ALL, bd: 'type'};
MX.param = (name) => {
  const v = dash.params()[name];
  return v === null || v === undefined || v === '' ? DEFAULTS[name] : String(v);
};
MX.yearsOf = (rows) => Array.from(new Set(rows.map((r) => Number(r.year)))).sort((a, b) => a - b);
MX.selYear = (years) => {
  const y = Number(dash.params().year);
  return years.includes(y) ? y : years[years.length - 1];
};
MX.focus = (kind, codes) => {
  const f = Number(dash.params().focus);
  if (codes.includes(f)) return f;
  const preset = kind === 'type' ? 1 : 3; // generative AI; AI adopters and innovative users
  return codes.includes(preset) ? preset : codes[0];
};

// ---------------------------------------------------------------- data and states

MX.get = (...ids) => {
  const res = ids.map((id) => dash.data(id));
  if (res.some((r) => ['error', 'connect', 'declined', 'missing'].includes(r.status))) return {status: 'error'};
  if (res.some((r) => r.status !== 'ok')) return {status: 'loading'};
  return {status: 'ok', data: res.map((r) => (Array.isArray(r.data) ? r.data : []))};
};
MX.chartState = (el, st) => {
  if (st.status === 'ok') {
    el.classList.remove('dash-skeleton');
    for (const n of el.querySelectorAll(':scope > .mx-failed')) n.remove();
    return true;
  }
  el.replaceChildren();
  el.classList.toggle('dash-skeleton', st.status === 'loading');
  if (st.status === 'error') {
    const p = document.createElement('p');
    p.className = 'mx-failed';
    p.textContent = 'Failed to load';
    el.append(p);
  }
  return false;
};
MX.textState = (el, st) => {
  el.classList.toggle('dash-skeleton', st.status === 'loading');
  if (st.status === 'ok') return true;
  el.textContent = '—';
  return false;
};
MX.where = (cond) =>
  Object.entries(cond)
    .map(([k, v]) => k + '=' + String(v).replace(/[%&=]/g, encodeURIComponent))
    .join('&');
MX.key = (...parts) => parts.map((p) => encodeURIComponent(String(p))).join(',');
MX.sorter = ({key, dir}) => (a, b) => {
  const va = a[key];
  const vb = b[key];
  if (va == null && vb == null) return 0;
  if (va == null) return 1;
  if (vb == null) return -1;
  return (typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb))) * dir;
};

// ---------------------------------------------------------------- drawing helpers

MX.svg = (el, W, H, label) => {
  let svg = d3.select(el).select(':scope > svg.mx-svg');
  if (svg.empty()) svg = d3.select(el).insert('svg', ':first-child').attr('class', 'mx-svg mx-in');
  svg.attr('viewBox', `0 0 ${W} ${H}`).attr('width', '100%');
  if (label) svg.attr('role', 'img').attr('aria-label', label);
  el.style.minHeight = H + 'px';
  return svg;
};
MX.layer = (parent, cls, tag = 'g') => parent.selectAll(`:scope > ${tag}.${cls}`).data([0]).join(tag).attr('class', cls);
MX.textWidths = (svg, strings, cls) => {
  const t = svg.append('text').attr('class', cls || null).attr('x', 0).attr('y', 0).style('visibility', 'hidden');
  const widths = strings.map((s) => {
    t.text(s);
    return t.node().getComputedTextLength();
  });
  t.remove();
  return widths;
};
MX.textWidth = (svg, strings, cls) => Math.ceil(Math.max(0, ...MX.textWidths(svg, strings, cls)));
MX.fit = (node, maxW) => {
  const full = node.textContent;
  let n = full.length;
  while (n > 1 && node.getComputedTextLength() > maxW) {
    n -= 1;
    node.textContent = full.slice(0, n).trimEnd() + '…';
  }
};
MX.spread = (items, gap, lo, hi) => {
  items.sort((a, b) => a.y0 - b.y0);
  items.forEach((it, i) => {
    it.y = Math.max(it.y0, lo, i ? items[i - 1].y + gap : lo);
  });
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const limit = i === items.length - 1 ? hi : items[i + 1].y - gap;
    if (items[i].y > limit) items[i].y = limit;
  }
  return items;
};
MX.rel = (event, el) => {
  const box = el.getBoundingClientRect();
  return [event.clientX - box.left, event.clientY - box.top];
};
MX.roundTop = (x, y, w, h, r) => {
  const k = Math.max(0, Math.min(r, w / 2, h));
  return `M${x},${y + h}V${y + k}Q${x},${y} ${x + k},${y}H${x + w - k}Q${x + w},${y} ${x + w},${y + k}V${y + h}Z`;
};
MX.roundRight = (x, y, w, h, r) => {
  const k = Math.max(0, Math.min(r, h / 2, w));
  return `M${x},${y}H${x + w - k}Q${x + w},${y} ${x + w},${y + k}V${y + h - k}Q${x + w},${y + h} ${x + w - k},${y + h}H${x}Z`;
};
MX.lum = (c) => {
  const f = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
};
// A one-hue ramp from the card's surface to the first series color, with ink that stays readable on it.
MX.palette = (el) => {
  const probe = document.createElement('i');
  probe.style.display = 'none';
  el.append(probe);
  const read = (c) => {
    probe.style.color = c;
    return getComputedStyle(probe).color;
  };
  const panel = read('var(--color-panel)');
  const hue = read(dash.colors[0]);
  probe.remove();
  if (!d3.color(panel) || !d3.color(hue)) {
    const mix = (t) => `color-mix(in oklab, ${dash.colors[0]} ${Math.round(10 + 90 * Math.max(0, Math.min(1, t)))}%, var(--color-panel))`;
    return {fill: mix, ink: () => 'var(--color-fg)'};
  }
  const ramp = d3.interpolateLab(panel, hue);
  const fill = (t) => ramp(0.1 + 0.9 * Math.max(0, Math.min(1, t)));
  return {fill, ink: (t) => (MX.lum(d3.rgb(fill(t))) > 0.19 ? '#161616' : '#f7f7f7')};
};

MX.tip = (el) => {
  let t = el.querySelector(':scope > .mx-tip');
  if (!t) {
    t = document.createElement('div');
    t.className = 'mx-tip';
    t.hidden = true;
    el.append(t);
  }
  return {
    show(spec, x, y) {
      t.replaceChildren();
      const head = document.createElement('div');
      head.className = 'mx-tip-title';
      head.textContent = spec.title;
      t.append(head);
      for (const r of spec.rows) {
        const row = document.createElement('div');
        row.className = 'mx-tip-row' + (r.strong ? ' is-strong' : '');
        if (r.color) {
          const k = document.createElement('i');
          k.className = 'mx-tip-key' + (r.shape ? ' is-' + r.shape : '');
          k.style.background = r.color;
          row.append(k);
        }
        const b = document.createElement('b');
        b.textContent = r.value;
        const s = document.createElement('span');
        s.textContent = r.name;
        row.append(b, s);
        t.append(row);
      }
      t.hidden = false;
      const W = el.clientWidth;
      const H = el.clientHeight;
      const tw = t.offsetWidth;
      const th = t.offsetHeight;
      let left = x + 14;
      if (left + tw > W) left = x - tw - 14;
      if (left < 0) left = Math.max(0, Math.min(W - tw, x - tw / 2));
      const top = Math.max(0, Math.min(H - th, y - th / 2));
      t.style.left = left + 'px';
      t.style.top = top + 'px';
    },
    hide() {
      t.hidden = true;
    },
  };
};

// Table cells.
MX.cell = (text, cls, swatch) => {
  const td = document.createElement('td');
  if (cls) td.className = cls;
  if (swatch) {
    const label = document.createElement('span');
    label.className = 'mx-lab';
    const i = document.createElement('i');
    i.className = 'mx-sw';
    i.style.background = swatch;
    label.append(i, document.createTextNode(text));
    td.append(label);
  } else td.append(document.createTextNode(text));
  return td;
};
MX.barCell = (v, max, color) => {
  const td = document.createElement('td');
  td.className = 'num mx-barcell';
  const wrap = document.createElement('span');
  wrap.className = 'mx-bc';
  const track = document.createElement('span');
  track.className = 'mx-track';
  const fill = document.createElement('span');
  fill.className = 'mx-fill';
  fill.style.width = v == null ? '0%' : Math.max(0, Math.min(100, (v / max) * 100)) + '%';
  fill.style.background = color;
  track.append(fill);
  const b = document.createElement('b');
  b.textContent = v == null ? '' : MX.fmtPct(v);
  wrap.append(track, b);
  td.append(wrap);
  return td;
};
MX.mini = (points, sel) => {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 52 16');
  svg.setAttribute('aria-hidden', 'true');
  const pts = points.filter((p) => p[1] != null).sort((a, b) => a[0] - b[0]);
  if (pts.length > 1) {
    const x = d3.scaleLinear(d3.extent(pts, (p) => p[0]), [2, 50]);
    const y = d3.scaleLinear([0, d3.max(pts, (p) => p[1]) || 1], [14, 2]);
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', d3.line().x((p) => x(p[0])).y((p) => y(p[1]))(pts));
    svg.append(path);
    const s = pts.find((p) => p[0] === sel);
    if (s) {
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', x(s[0]));
      c.setAttribute('cy', y(s[1]));
      c.setAttribute('r', 2.25);
      svg.append(c);
    }
  }
  return svg;
};
MX.changeCell = (pp, points, sel) => {
  const td = document.createElement('td');
  td.className = 'num';
  const wrap = document.createElement('span');
  wrap.className = 'mx-chg';
  const b = document.createElement('span');
  b.textContent = pp == null ? '' : MX.fmtPP(pp);
  wrap.append(MX.mini(points, sel), b);
  td.append(wrap);
  return td;
};

// ---------------------------------------------------------------- chart builders

// Lines over the years with a crosshair, end labels and a marker on the selected year.
MX.lineChart = (el, o) => {
  const W = Math.max(280, el.clientWidth);
  const narrow = W < 560;
  const H = narrow ? 290 : 360;
  const svg = MX.svg(el, W, H, o.label);
  svg.selectAll('*').remove();
  const {series, years, sel} = o;
  const top = d3.max(series, (s) => d3.max(s.values, o.value)) || 0.01;
  const nY = narrow ? 4 : 5;
  const y = d3.scaleLinear([0, top * 1.04], [1, 0]).nice(nY);
  const yTicks = y.ticks(nY);
  const fy = y.tickFormat(nY, '%');
  const tickW = MX.textWidth(svg, yTicks.map(fy), 'mx-tick');
  const ends = series.map((s) => ({s, text: o.endLabel(s, narrow)})).filter((e) => e.text);
  const endW = MX.textWidth(svg, ends.map((e) => e.text), 'mx-endlabel');
  const m = {top: 12, right: Math.max(18, endW + 20), bottom: 30, left: tickW + 12};
  const iw = W - m.left - m.right;
  const ih = H - m.top - m.bottom;
  y.range([ih, 0]);
  const x = d3.scaleLinear([years[0], years[years.length - 1]], [0, iw]);
  const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);

  for (const t of yTicks) {
    g.append('line').attr('class', t === 0 ? 'mx-baseline' : 'mx-gridline').attr('x1', 0).attr('x2', iw).attr('y1', y(t)).attr('y2', y(t));
    g.append('text').attr('class', 'mx-tick').attr('x', -10).attr('y', y(t)).attr('dy', '0.32em').attr('text-anchor', 'end').text(fy(t));
  }
  const yearW = MX.textWidth(svg, years.map(String), 'mx-tick mx-strong');
  const step = Math.max(1, Math.ceil((yearW + 12) / (iw / Math.max(1, years.length - 1))));
  years.forEach((yr, i) => {
    if (i % step) return;
    g.append('text').attr('class', yr === sel ? 'mx-tick mx-strong' : 'mx-tick').attr('x', x(yr)).attr('y', ih + 20).attr('text-anchor', 'middle').text(yr);
  });
  g.append('line').attr('class', 'mx-selrule').attr('x1', x(sel)).attr('x2', x(sel)).attr('y1', 0).attr('y2', ih);

  const ordered = [...series].sort((a, b) => Number(o.strong(a)) - Number(o.strong(b)));
  const line = d3.line().x((d) => x(d.year)).y((d) => y(o.value(d)));
  g.append('g')
    .selectAll('path')
    .data(ordered)
    .join('path')
    .attr('class', 'mx-line')
    .attr('d', (s) => line(s.values))
    .style('stroke', (s) => s.color)
    .style('stroke-width', (s) => o.widthOf(s));
  const atSel = ordered.map((s) => ({s, d: s.values.find((d) => d.year === sel)})).filter((p) => p.d && o.dot(p.s));
  g.append('g')
    .selectAll('circle')
    .data(atSel)
    .join('circle')
    .attr('class', 'mx-mark')
    .attr('cx', x(sel))
    .attr('cy', (p) => y(o.value(p.d)))
    .attr('r', 4)
    .style('fill', (p) => p.s.color);

  const xEnd = x(years[years.length - 1]);
  const placed = MX.spread(
    ends.map((e) => ({...e, y0: y(o.value(e.s.values[e.s.values.length - 1]))})),
    15,
    6,
    ih - 2,
  );
  for (const p of placed) {
    if (Math.abs(p.y - p.y0) > 1.5) g.append('path').attr('class', 'mx-leader').attr('d', `M${xEnd + 4},${p.y0}L${xEnd + 10},${p.y}`);
    g.append('text').attr('class', 'mx-endlabel').attr('x', xEnd + 12).attr('y', p.y).attr('dy', '0.32em').text(p.text);
  }

  const hover = g.append('g').style('display', 'none');
  const rule = hover.append('line').attr('class', 'mx-hoverrule').attr('y1', 0).attr('y2', ih);
  const dots = hover
    .selectAll('circle')
    .data(ordered)
    .join('circle')
    .attr('class', 'mx-mark')
    .attr('r', (s) => (o.strong(s) ? 4 : 3))
    .style('fill', (s) => s.color);
  const tip = MX.tip(el);
  const show = (yr, py) => {
    hover.style('display', null);
    rule.attr('x1', x(yr)).attr('x2', x(yr));
    dots.each(function (s) {
      const d = s.values.find((v) => v.year === yr);
      d3.select(this).style('display', d ? null : 'none').attr('cx', x(yr)).attr('cy', d ? y(o.value(d)) : 0);
    });
    const list = series
      .map((s) => ({s, d: s.values.find((v) => v.year === yr)}))
      .filter((p) => p.d)
      .sort((a, b) => o.value(b.d) - o.value(a.d));
    const k = el.clientWidth / W;
    tip.show(
      {title: String(yr), rows: list.map((p) => ({color: p.s.color, name: o.tipName(p.s), value: MX.fmtPct(o.value(p.d)), strong: o.strong(p.s)}))},
      (m.left + x(yr)) * k,
      py ?? (m.top + ih / 3) * k,
    );
  };
  const hide = () => {
    hover.style('display', 'none');
    tip.hide();
  };
  const nearest = (event) => {
    const [px] = d3.pointer(event, g.node());
    return years.reduce((a, b) => (Math.abs(x(b) - px) < Math.abs(x(a) - px) ? b : a));
  };
  g.append('rect')
    .attr('class', 'mx-overlay')
    .attr('x', -8)
    .attr('width', iw + 16)
    .attr('height', ih)
    .on('pointermove', (event) => show(nearest(event), MX.rel(event, el)[1]))
    .on('pointerleave', hide)
    .on('click', (event) => {
      MX.stop();
      dash.setParams({year: nearest(event)});
    });
  let kb = sel;
  svg
    .attr('tabindex', 0)
    .on('focus', () => {
      kb = sel;
      show(kb);
    })
    .on('blur', hide)
    .on('keydown', (event) => {
      const i = years.indexOf(kb);
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        kb = years[Math.max(0, Math.min(years.length - 1, i + (event.key === 'ArrowRight' ? 1 : -1)))];
        show(kb);
        event.preventDefault();
      } else if (event.key === 'Enter' || event.key === ' ') {
        MX.stop();
        dash.setParams({year: kb});
        event.preventDefault();
      }
    });
};

// One row per item: a hollow dot for the first year, a filled dot for the selected year.
MX.dumbbell = (el, o) => {
  const W = Math.max(260, el.clientWidth);
  const narrow = W < 520;
  const rowH = o.rowH || 26;
  const svg = MX.svg(el, W, 10, o.label);
  const labelW = Math.min(MX.textWidth(svg, o.items.map((d) => d.label), 'mx-rowlabel mx-strong'), Math.floor(W * (narrow ? 0.44 : 0.34)));
  const valW = MX.textWidth(svg, ['00.0%'], 'mx-val');
  const m = {top: 28, right: valW + 16, bottom: 8, left: labelW + 16};
  const iw = Math.max(40, W - m.left - m.right);
  const ih = o.items.length * rowH;
  const H = m.top + ih + m.bottom;
  MX.svg(el, W, H, o.label);
  const nX = narrow ? 3 : 5;
  const x = d3.scaleLinear([0, o.max || 0.01], [0, iw]).nice(nX);
  const fx = x.tickFormat(nX, '%');
  const g = MX.layer(svg, 'mx-plot').attr('transform', `translate(${m.left},${m.top})`);
  const axis = MX.layer(g, 'mx-axis');
  axis.selectAll('*').remove();
  for (const t of x.ticks(nX)) {
    axis.append('line').attr('class', t === 0 ? 'mx-baseline' : 'mx-gridline').attr('x1', x(t)).attr('x2', x(t)).attr('y1', -4).attr('y2', ih);
    axis.append('text').attr('class', 'mx-tick').attr('x', x(t)).attr('y', -12).attr('text-anchor', 'middle').text(fx(t));
  }
  const rows = MX.layer(g, 'mx-rows')
    .selectAll('g.mx-row')
    .data(o.items, (d) => d.key);
  const enter = rows
    .enter()
    .append('g')
    .attr('class', 'mx-row')
    .attr('transform', (d, i) => `translate(0,${i * rowH + rowH / 2})`);
  enter.append('rect').attr('class', 'mx-rowhit');
  enter.append('text').attr('class', 'mx-rowlabel');
  enter.append('line').attr('class', 'mx-conn');
  enter.append('circle').attr('class', 'mx-d0').attr('r', 4.5);
  enter.append('circle').attr('class', 'mx-d1').attr('r', 5.5);
  enter.append('text').attr('class', 'mx-val mx-halo');
  enter.append('text').attr('class', 'mx-na');
  rows.exit().remove();
  const all = enter.merge(rows);
  all.classed('is-strong', (d) => Boolean(d.strong)).order();
  all.transition().duration(MX.dur).attr('transform', (d, i) => `translate(0,${i * rowH + rowH / 2})`);
  all.select('.mx-rowhit').attr('x', -m.left).attr('y', -rowH / 2).attr('width', W).attr('height', rowH);
  all
    .select('.mx-rowlabel')
    .attr('x', -12)
    .attr('dy', '0.32em')
    .attr('text-anchor', 'end')
    .text((d) => d.label)
    .each(function () {
      MX.fit(this, labelW);
    });
  const has0 = (d) => d.v0 != null;
  const has1 = (d) => d.v1 != null;
  all
    .select('.mx-conn')
    .style('display', (d) => (has0(d) && has1(d) ? null : 'none'))
    .transition()
    .duration(MX.dur)
    .attr('x1', (d) => x(d.v0 ?? 0))
    .attr('x2', (d) => x(d.v1 ?? 0));
  all
    .select('.mx-d0')
    .style('display', (d) => (has0(d) ? null : 'none'))
    .transition()
    .duration(MX.dur)
    .attr('cx', (d) => x(d.v0 ?? 0));
  all
    .select('.mx-d1')
    .style('display', (d) => (has1(d) ? null : 'none'))
    .style('fill', (d) => d.color)
    .transition()
    .duration(MX.dur)
    .attr('cx', (d) => x(d.v1 ?? 0));
  all
    .select('.mx-val')
    .style('display', (d) => (has1(d) ? null : 'none'))
    .attr('dy', '0.32em')
    .text((d) => (has1(d) ? MX.fmtPct(d.v1) : ''))
    .transition()
    .duration(MX.dur)
    .attr('x', (d) => x(Math.max(d.v0 ?? 0, d.v1 ?? 0)) + 10);
  all
    .select('.mx-na')
    .style('display', (d) => (has1(d) ? 'none' : null))
    .attr('x', 2)
    .attr('dy', '0.32em')
    .text((d) => (has1(d) ? '' : o.naText))
    .each(function (d) {
      if (!has1(d)) MX.fit(this, iw + m.right - 6);
    });
  const tip = MX.tip(el);
  const showTip = (event, d) => {
    const [px, py] = MX.rel(event, el);
    tip.show(o.tip(d), px, py);
  };
  all
    .style('cursor', o.onClick ? 'pointer' : null)
    .attr('tabindex', o.onClick ? 0 : null)
    .on('pointerenter', function (event, d) {
      d3.select(this).classed('is-hover', true);
      showTip(event, d);
    })
    .on('pointermove', showTip)
    .on('pointerleave', function () {
      d3.select(this).classed('is-hover', false);
      tip.hide();
    })
    .on('click', (event, d) => o.onClick && o.onClick(d))
    .on('keydown', (event, d) => {
      if (o.onClick && (event.key === 'Enter' || event.key === ' ')) {
        o.onClick(d);
        event.preventDefault();
      }
    });
};

// Ranked horizontal bars with a dashed reference line.
MX.bars = (el, o) => {
  const W = Math.max(260, el.clientWidth);
  const narrow = W < 520;
  const rowH = 26;
  const svg = MX.svg(el, W, 10, o.label);
  const labelW = Math.min(MX.textWidth(svg, o.items.map((d) => d.label), 'mx-rowlabel'), Math.floor(W * (narrow ? 0.42 : 0.3)));
  const valW = MX.textWidth(svg, ['00.0%'], 'mx-val');
  const m = {top: 30, right: valW + 14, bottom: 28, left: labelW + 14};
  const iw = Math.max(40, W - m.left - m.right);
  const ih = o.items.length * rowH;
  const H = m.top + ih + m.bottom;
  MX.svg(el, W, H, o.label);
  const nX = narrow ? 3 : 5;
  const x = d3.scaleLinear([0, o.max || 0.01], [0, iw]).nice(nX);
  const fx = x.tickFormat(nX, '%');
  const g = MX.layer(svg, 'mx-plot').attr('transform', `translate(${m.left},${m.top})`);
  const axis = MX.layer(g, 'mx-axis');
  axis.selectAll('*').remove();
  for (const t of x.ticks(nX)) {
    axis.append('line').attr('class', t === 0 ? 'mx-baseline' : 'mx-gridline').attr('x1', x(t)).attr('x2', x(t)).attr('y1', 0).attr('y2', ih);
    axis.append('text').attr('class', 'mx-tick').attr('x', x(t)).attr('y', ih + 18).attr('text-anchor', 'middle').text(fx(t));
  }
  // The reference line sits under the bars and their labels.
  const ref = MX.layer(g, 'mx-ref');
  ref.selectAll('*').remove();
  if (o.ref != null) {
    const rx = x(o.ref);
    ref.append('line').attr('class', 'mx-refline').attr('x1', rx).attr('x2', rx).attr('y1', -8).attr('y2', ih);
    const t = ref.append('text').attr('class', 'mx-strong').attr('y', -14).text(o.refLabel + ' ' + MX.fmtPct(o.ref));
    const w = t.node().getComputedTextLength();
    const fitsRight = rx + w <= iw + m.right - 4;
    t.attr('x', fitsRight ? rx : Math.max(-m.left + 2, rx - w)).attr('text-anchor', 'start');
  }
  const barH = Math.min(16, rowH - 9);
  const rows = MX.layer(g, 'mx-rows')
    .selectAll('g.mx-row')
    .data(o.items, (d) => d.key);
  const enter = rows
    .enter()
    .append('g')
    .attr('class', 'mx-row')
    .attr('transform', (d, i) => `translate(0,${i * rowH + rowH / 2})`);
  enter.append('rect').attr('class', 'mx-rowhit');
  enter.append('text').attr('class', 'mx-rowlabel');
  enter.append('path').attr('class', 'mx-hbar').attr('d', MX.roundRight(0, -barH / 2, 0, barH, 3));
  enter.append('rect').attr('class', 'mx-valbg').attr('y', -8).attr('height', 16).attr('rx', 3);
  enter.append('text').attr('class', 'mx-val');
  enter.append('text').attr('class', 'mx-na');
  rows.exit().remove();
  const all = enter.merge(rows).order();
  all.transition().duration(MX.dur).attr('transform', (d, i) => `translate(0,${i * rowH + rowH / 2})`);
  all.select('.mx-rowhit').attr('x', -m.left).attr('y', -rowH / 2).attr('width', W).attr('height', rowH);
  all
    .select('.mx-rowlabel')
    .attr('x', -12)
    .attr('dy', '0.32em')
    .attr('text-anchor', 'end')
    .text((d) => d.label)
    .each(function () {
      MX.fit(this, labelW);
    });
  all
    .select('.mx-hbar')
    .style('fill', o.color)
    .style('display', (d) => (d.v == null ? 'none' : null))
    .transition()
    .duration(MX.dur)
    .attr('d', (d) => MX.roundRight(0, -barH / 2, Math.max(0, x(d.v ?? 0)), barH, 3));
  // Each value sits on a small box of the card's color, so the reference line passes behind it.
  const valWidths = MX.textWidths(svg, o.items.map((d) => (d.v == null ? '' : MX.fmtPct(d.v))), 'mx-val');
  const widthOf = new Map(o.items.map((d, i) => [d.key, valWidths[i]]));
  all
    .select('.mx-valbg')
    .style('display', (d) => (d.v == null ? 'none' : null))
    .attr('width', (d) => widthOf.get(d.key) + 6)
    .transition()
    .duration(MX.dur)
    .attr('x', (d) => x(d.v ?? 0) + 3);
  all
    .select('.mx-val')
    .style('display', (d) => (d.v == null ? 'none' : null))
    .attr('dy', '0.32em')
    .text((d) => (d.v == null ? '' : MX.fmtPct(d.v)))
    .transition()
    .duration(MX.dur)
    .attr('x', (d) => x(d.v ?? 0) + 6);
  all
    .select('.mx-na')
    .style('display', (d) => (d.v == null ? null : 'none'))
    .attr('x', 2)
    .attr('dy', '0.32em')
    .text((d) => (d.v == null ? o.naText : ''))
    .each(function (d) {
      if (d.v == null) MX.fit(this, iw + m.right - 6);
    });
  const tip = MX.tip(el);
  const showTip = (event, d) => {
    const [px, py] = MX.rel(event, el);
    tip.show(o.tip(d), px, py);
  };
  all
    .on('pointerenter', function (event, d) {
      d3.select(this).classed('is-hover', true);
      showTip(event, d);
    })
    .on('pointermove', showTip)
    .on('pointerleave', function () {
      d3.select(this).classed('is-hover', false);
      tip.hide();
    });
};

// ---------------------------------------------------------------- page controls

// Tabs: one page shows at a time; a link can name a tab or anything inside one.
const showTab = (id) => {
  for (const s of root.querySelectorAll('.mx-page')) s.hidden = s.id !== id;
  for (const b of root.querySelectorAll('.mx-tab[data-tab]')) b.setAttribute('aria-selected', String(b.dataset.tab === id));
};
for (const b of root.querySelectorAll('.mx-tab[data-tab]')) {
  b.addEventListener('click', () => {
    showTab(b.dataset.tab);
    dash.setLink(b.dataset.tab);
  });
}
let linked = null;
try {
  linked = location.hash.length > 1 ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
} catch (err) {
  linked = null;
}
const linkedPage = linked && linked.closest('.mx-page');
if (linkedPage) {
  showTab(linkedPage.id);
  if (linked !== linkedPage) setTimeout(() => linked.scrollIntoView({block: 'start'}), 700);
}

// Segmented filters.
for (const seg of root.querySelectorAll('.mx-seg[data-param]')) {
  seg.addEventListener('click', (event) => {
    const b = event.target.closest('button[data-value]');
    if (!b) return;
    const name = seg.dataset.param;
    dash.setParams(name === 'bd' ? {bd: b.dataset.value, focus: null} : {[name]: b.dataset.value});
  });
}

// Play steps through the years.
let timer = null;
const setPlaying = (on) => {
  for (const b of root.querySelectorAll('.mx-play')) {
    b.setAttribute('aria-pressed', String(on));
    for (const s of b.querySelectorAll('[data-play]')) s.hidden = s.dataset.play !== (on ? 'on' : 'off');
  }
};
MX.stop = () => {
  if (timer) clearInterval(timer);
  timer = null;
  setPlaying(false);
};
const play = () => {
  const st = dash.data('country_adoption');
  if (st.status !== 'ok' || !Array.isArray(st.data)) return;
  const years = MX.yearsOf(st.data);
  let i = years.indexOf(MX.selYear(years));
  if (i >= years.length - 1) i = -1;
  const step = () => {
    i += 1;
    dash.setParams({year: years[i]});
    if (i >= years.length - 1) MX.stop();
  };
  setPlaying(true);
  step();
  if (i < years.length - 1) timer = setInterval(step, 1400);
};
for (const b of root.querySelectorAll('.mx-play')) b.addEventListener('click', () => (timer ? MX.stop() : play()));

dash.onData(() => {
  const p = {level: MX.param('level'), ind: MX.param('ind'), country: MX.param('country'), bd: MX.param('bd')};
  for (const seg of root.querySelectorAll('.mx-seg[data-param]')) {
    for (const b of seg.querySelectorAll('button[data-value]')) b.setAttribute('aria-pressed', String(b.dataset.value === p[seg.dataset.param]));
  }
  for (const n of root.querySelectorAll('[data-bd]')) n.hidden = n.dataset.bd !== p.bd;
  for (const n of root.querySelectorAll('.mx-more')) n.hidden = p.ind !== 'nace2';
  for (const k of root.querySelectorAll('.mx-key[data-key]')) k.style.background = MX.colorOf(k.dataset.key);
  for (const k of root.querySelectorAll('.mx-key[data-key-country]')) k.style.background = MX.colorOf(p.country);
  for (const k of root.querySelectorAll('.mx-key-accent')) k.style.background = MX.accent();
  for (const th of root.querySelectorAll('table[data-sortable="industry"] th[data-field]')) th.classList.toggle('is-sel', th.dataset.field === MX.COL[p.country]);
});

// Redraw what measures text once the fonts are in, and what mixes colors when the theme changes.
const redraw = (names) => {
  for (const n of names) {
    try {
      dash.draw(n);
    } catch (err) {
      // a drawing that is not on the page
    }
  }
};
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() =>
    setTimeout(() => redraw(['trend', 'counts', 'swarm', 'dumbbell-ind', 'mix-trend', 'mix-dumbbell', 'mix-heat', 'mix-industry']), 60),
  );
}
const recolor = () => redraw(['industry-table', 'ind-scale', 'mix-heat']);
new MutationObserver(recolor).observe(document.documentElement, {attributes: true, attributeFilter: ['class', 'data-theme']});
if (document.body) new MutationObserver(recolor).observe(document.body, {attributes: true, attributeFilter: ['class', 'data-theme']});
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', recolor);

// ---------------------------------------------------------------- small drawings

const yearsFrom = (el, fn) => {
  const st = MX.get('country_adoption');
  if (!MX.textState(el, st)) return;
  el.textContent = fn(MX.yearsOf(st.data[0]));
};
dash.draw('sel-year', (el) => yearsFrom(el, (years) => String(MX.selYear(years))));
dash.draw('first-year', (el) => yearsFrom(el, (years) => String(years[0])));
dash.draw('last-year', (el) => yearsFrom(el, (years) => String(years[years.length - 1])));
dash.draw('vs-prev', (el) =>
  yearsFrom(el, (years) => {
    const i = years.indexOf(MX.selYear(years));
    return i > 0 ? 'vs ' + years[i - 1] : 'first year';
  }),
);
dash.draw('min-firms', (el) => {
  el.textContent = MX.fmtInt(MX.MIN_FIRMS);
});
dash.draw('years', (el) => {
  const st = MX.get('country_adoption');
  el.classList.toggle('dash-skeleton', st.status === 'loading');
  if (st.status !== 'ok') {
    el.replaceChildren();
    return;
  }
  for (const n of [...el.childNodes]) if (n.nodeName !== 'BUTTON') n.remove();
  const years = MX.yearsOf(st.data[0]);
  const sel = MX.selYear(years);
  d3.select(el)
    .selectAll('button')
    .data(years, (d) => d)
    .join((enter) => enter.append('button').attr('type', 'button').attr('class', 'mx-chip').attr('role', 'radio').text((d) => d))
    .attr('aria-checked', (d) => String(d === sel))
    .on('click', (event, d) => {
      MX.stop();
      dash.setParams({year: d});
    });
  // When the row scrolls sideways (narrow screens), keep the selected year in view.
  const chip = el.querySelector('[aria-checked="true"]');
  if (chip && el.scrollWidth > el.clientWidth) {
    const at = chip.getBoundingClientRect().left - el.getBoundingClientRect().left + el.scrollLeft;
    el.scrollLeft = Math.max(0, at - (el.clientWidth - chip.offsetWidth) / 2);
  }
});
