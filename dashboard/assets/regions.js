// Regions: a map (shares, or where AI-active firms concentrate), every region as a dot by country, and a table.
const MX = window.MX;
const root = document.getElementById('dash-root') || document;
const COUNTRY_OF = {BE: 'Belgium', DE: 'Germany', FR: 'France', LU: 'Luxembourg'};

// Show a region in the table below (from a click on the map, a dot or a ranked name).
const findRegion = (code) => {
  MX.regionQuery = code;
  for (const input of root.querySelectorAll('.mx-search[data-for="region-table"]')) input.value = code;
  dash.draw('region-table');
};

const regionYear = (all) => {
  const atLevel = all.filter((r) => r.nuts_level === Number(MX.param('level')));
  const years = MX.yearsOf(atLevel);
  return {atLevel, years, sel: MX.selYear(years)};
};
// One scale for every year and country at a level, so the map darkens as AI spreads. The darkest color goes to
// the 98th percentile, so a single outlier doesn't wash out the rest.
const capOf = (atLevel) => {
  const values = atLevel.map((r) => r.ai_adoption_share).filter((v) => v != null).sort(d3.ascending);
  return d3.quantile(values, 0.98) || d3.max(values) || 1;
};

// ---------------------------------------------------------------- heat map

// Each small region's estimated AI-active firms, spread around Eurostat's point for the region with a Gaussian
// a little wider for larger regions, summed on a 4 km grid: AI-active firms per km².
const HEAT = {cell: 4, spread: 0.25, minSigma: 7, maxSigma: 22, low: 0.12, full: 0.5};
// Light pages run pale yellow to dark red, dark pages deep red to pale yellow: the busiest places stand out most.
const HEAT_RAMPS = {
  light: ['#fed976', '#feb24c', '#fd8d3c', '#f03b20', '#bd0026'],
  dark: ['#7a1f2b', '#c0392b', '#f0642a', '#fba73d', '#ffe48a'],
};
const spotsCache = new WeakMap();
const spotsOf = (geo) => {
  if (!spotsCache.has(geo)) spotsCache.set(geo, new Map(geo.filter((g) => g.layer === 'region' && g.level === 3).map((g) => [g.id, g])));
  return spotsCache.get(geo);
};
const heatGrid = (all, geo, frame, year) => {
  const sel = MX.selected();
  const spots = spotsOf(geo);
  const nx = Math.ceil(frame.w / HEAT.cell);
  const ny = Math.ceil(frame.h / HEAT.cell);
  const grid = new Float32Array(nx * ny);
  for (const r of all) {
    if (r.nuts_level !== 3 || r.year !== year || !(r.n_ai > 0) || !sel.includes(r.country)) continue;
    const p = spots.get(r.nuts_code);
    if (!p) continue;
    const s = Math.max(HEAT.minSigma, Math.min(HEAT.maxSigma, HEAT.spread * Math.sqrt(p.area || 100)));
    const peak = r.n_ai / (2 * Math.PI * s * s);
    const cx = p.x / HEAT.cell;
    const cy = p.y / HEAT.cell;
    const reach = Math.ceil((3 * s) / HEAT.cell);
    const fall = (HEAT.cell * HEAT.cell) / (2 * s * s);
    for (let gy = Math.max(0, Math.floor(cy - reach)); gy <= Math.min(ny - 1, Math.ceil(cy + reach)); gy += 1) {
      const dy = gy + 0.5 - cy;
      for (let gx = Math.max(0, Math.floor(cx - reach)); gx <= Math.min(nx - 1, Math.ceil(cx + reach)); gx += 1) {
        const dx = gx + 0.5 - cx;
        grid[gy * nx + gx] += peak * Math.exp(-(dx * dx + dy * dy) * fall);
      }
    }
  }
  let max = 0;
  for (const v of grid) if (v > max) max = v;
  return {grid, nx, ny, max};
};
// Grids are kept per selection and year (the last few dozen); the scale is the latest year's peak, so it holds
// while Play runs.
const heatCache = new WeakMap();
const HEAT_KEEP = 30;
const heatOf = (all, geo, frame, year) => {
  if (!heatCache.has(all)) heatCache.set(all, new Map());
  const cache = heatCache.get(all);
  const key = MX.groupKey() + '|' + year;
  if (!cache.has(key)) {
    cache.set(key, heatGrid(all, geo, frame, year));
    if (cache.size > HEAT_KEEP) cache.delete(cache.keys().next().value);
  }
  return cache.get(key);
};
const heatScale = (all, geo, frame) => {
  const years = MX.yearsOf(all);
  return heatOf(all, geo, frame, years[years.length - 1]).max || 1;
};
// A cube-root scale, so that smaller hubs still show next to the largest cities; the sparsest places stay clear.
const heatT = (v, max) => Math.cbrt(Math.max(0, Math.min(1, v / max)));
const heatTheme = (el) => (MX.palette(el).dark ? 'dark' : 'light');
const ramps = {};
const heatColor = (t, theme) => {
  ramps[theme] ??= d3.interpolateRgbBasis(HEAT_RAMPS[theme]);
  const c = d3.rgb(ramps[theme](t));
  const a = Math.max(0, Math.min(1, (t - HEAT.low) / (HEAT.full - HEAT.low))) ** 0.8;
  return [c.r, c.g, c.b, Math.round(255 * a)];
};
const heatCss = (t, theme) => {
  const [r, g, b, a] = heatColor(t, theme);
  return `rgba(${r},${g},${b},${(a / 255).toFixed(3)})`;
};
const heatImage = (h, max, theme) => {
  const key = max + '|' + theme;
  if (h.url && h.urlKey === key) return h.url;
  const canvas = document.createElement('canvas');
  canvas.width = h.nx;
  canvas.height = h.ny;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(h.nx, h.ny);
  const lut = Array.from({length: 256}, (_, i) => heatColor(i / 255, theme));
  for (let i = 0; i < h.grid.length; i += 1) {
    const t = heatT(h.grid[i], max);
    if (t <= HEAT.low) continue;
    img.data.set(lut[Math.round(t * 255)], i * 4);
  }
  ctx.putImageData(img, 0, 0);
  h.url = canvas.toDataURL('image/png');
  h.urlKey = key;
  return h.url;
};

// ---------------------------------------------------------------- the map

dash.draw('map', (el) => {
  const st = MX.get('nuts_geo', 'region_rows');
  if (!MX.chartState(el, st)) return;
  const [geo, all] = st.data;
  const level = Number(MX.param('level'));
  const heat = MX.param('mapmode') === 'heat';
  const picked = MX.selected();
  const {atLevel, years, sel} = regionYear(all);
  const frame = geo.find((g) => g.layer === 'frame');
  if (!frame || !years.length) return;
  const first = years[0];
  const now = new Map(atLevel.filter((r) => r.year === sel && r.ai_adoption_share != null).map((r) => [r.nuts_code, r]));
  const cap = capOf(atLevel);
  const pal = MX.palette(el);
  const on = (g) => picked.includes(COUNTRY_OF[g.id.slice(0, 2)]);
  const has = (g) => on(g) && now.has(g.id);
  const fillOf = (g) => pal.fill(now.get(g.id).ai_adoption_share / cap);

  const W = Math.max(240, el.clientWidth);
  const H = Math.min(Math.round((W * frame.h) / frame.w), 700);
  let svg = d3.select(el).select(':scope > svg.mx-map-svg');
  if (svg.empty()) {
    svg = d3.select(el).insert('svg', ':first-child').attr('class', 'mx-map-svg mx-in');
    // Neighbouring countries fade out toward the edges instead of stopping at the frame.
    const defs = svg.append('defs');
    const fade = defs.append('radialGradient').attr('id', 'mx-map-fade-g').attr('cx', 0.5).attr('cy', 0.5).attr('r', 0.62);
    fade.append('stop').attr('offset', 0.6).attr('stop-color', 'white');
    fade.append('stop').attr('offset', 1).attr('stop-color', 'black');
    defs
      .append('mask')
      .attr('id', 'mx-map-fade')
      .attr('maskContentUnits', 'objectBoundingBox')
      .append('rect')
      .attr('width', 1)
      .attr('height', 1)
      .attr('fill', 'url(#mx-map-fade-g)');
    defs.append('clipPath').attr('id', 'mx-map-clip');
  }
  svg
    .attr('viewBox', `0 0 ${frame.w} ${frame.h}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .attr('role', 'img')
    .attr('aria-label', heat ? MX.t('ariaHeat', sel) : MX.t('ariaMap', level, sel))
    .style('height', H + 'px');
  el.style.minHeight = H + 'px';

  const outlines = geo.filter((g) => g.layer === 'region' && g.level === 0);
  svg
    .select('#mx-map-clip')
    .selectAll('path')
    .data(outlines.filter(on), (g) => g.id)
    .join('path')
    .attr('d', (g) => g.d);
  MX.layer(svg, 'mx-map-context')
    .attr('mask', 'url(#mx-map-fade)')
    .selectAll('path')
    .data(geo.filter((g) => g.layer === 'context'), (g) => g.id)
    .join('path')
    .attr('d', (g) => g.d);
  const shapes = MX.layer(svg, 'mx-map-regions')
    .selectAll('path')
    .data(geo.filter((g) => g.layer === 'region' && g.level === level), (g) => g.id)
    .join(
      (enter) =>
        enter
          .append('path')
          .attr('class', 'mx-map-region')
          .attr('d', (g) => g.d)
          .style('fill', (g) => (has(g) && !heat ? fillOf(g) : null)),
      (update) => update,
      (exit) => exit.remove(),
    )
    .classed('is-off', (g) => !on(g))
    .classed('is-empty', (g) => on(g) && !now.has(g.id))
    .classed('is-neutral', (g) => heat && has(g));
  shapes.filter((g) => heat || !has(g)).interrupt().style('fill', null);
  if (!heat) shapes.filter(has).transition().duration(MX.dur).style('fill', fillOf);

  const glow = MX.layer(svg, 'mx-map-heat').attr('clip-path', 'url(#mx-map-clip)').attr('pointer-events', 'none');
  let image = [];
  if (heat) {
    const h = heatOf(all, geo, frame, sel);
    image = [{href: heatImage(h, heatScale(all, geo, frame), heatTheme(el)), w: h.nx * HEAT.cell, h: h.ny * HEAT.cell}];
  }
  glow
    .selectAll('image')
    .data(image)
    .join('image')
    .attr('href', (d) => d.href)
    .attr('x', 0)
    .attr('y', 0)
    .attr('width', (d) => d.w)
    .attr('height', (d) => d.h)
    .attr('preserveAspectRatio', 'none');
  MX.layer(svg, 'mx-map-borders')
    .selectAll('path')
    .data(outlines, (g) => g.id)
    .join('path')
    .attr('d', (g) => g.d);
  const outline = MX.layer(svg, 'mx-map-hover', 'path').style('display', 'none');

  const tip = MX.tip(el);
  shapes
    .on('pointermove', (event, g) => {
      if (!on(g)) {
        outline.style('display', 'none');
        tip.hide();
        return;
      }
      outline.style('display', null).attr('d', g.d);
      const r = now.get(g.id);
      let rows = [{name: MX.t('notInTables'), value: '—'}];
      if (r && heat) {
        rows = [
          {color: heatCss(0.8, heatTheme(el)), shape: 'box', name: MX.t('aiFirmsEst'), value: MX.fmtInt(r.n_ai), strong: true},
          {name: MX.t('aiActiveIn', sel), value: MX.fmtPct(r.ai_adoption_share)},
          {name: MX.t('classified'), value: MX.fmtInt(r.n_firms)},
        ];
      } else if (r) {
        rows = [
          {color: fillOf(g), shape: 'box', name: MX.t('aiActiveIn', sel), value: MX.fmtPct(r.ai_adoption_share), strong: true},
          {name: MX.t('classified'), value: MX.fmtInt(r.n_firms)},
        ];
        if (r.since_first_pp != null && sel !== first) rows.push({name: MX.t('ppSince', first), value: MX.fmtPP(r.since_first_pp)});
      }
      const [x, y] = MX.rel(event, el);
      tip.show({title: (r ? MX.L(r, 'label') : g.name) + ' · ' + g.id, rows}, x, y);
    })
    .on('pointerleave', () => {
      outline.style('display', 'none');
      tip.hide();
    })
    .on('click', (event, g) => {
      if (has(g)) findRegion(g.id);
    });
});

dash.draw('map-scale', (el) => {
  const st = MX.get('region_rows', 'nuts_geo');
  if (st.status !== 'ok') {
    el.replaceChildren();
    return;
  }
  const [all, geo] = st.data;
  const {atLevel} = regionYear(all);
  const text = (s, cls) => {
    const span = document.createElement('span');
    span.textContent = s;
    if (cls) span.className = cls;
    return span;
  };
  const bar = document.createElement('span');
  bar.className = 'mx-scale-bar';
  if (MX.param('mapmode') === 'heat') {
    // The bar runs on the map's cube-root scale; ticks at powers of ten show how it is squeezed.
    const frame = geo.find((g) => g.layer === 'frame');
    const max = frame ? heatScale(all, geo, frame) : 1;
    const theme = heatTheme(el);
    const stops = d3.range(0, 1.0001, 0.05).map((t) => `${heatCss(t, theme)} ${(t * 100).toFixed(0)}%`);
    bar.style.background = `linear-gradient(90deg, ${stops.join(', ')})`;
    const wrap = document.createElement('span');
    wrap.className = 'mx-heat-scale';
    wrap.append(bar);
    const fmt = MX.loc().locale.format(',.2~r');
    const ticks = [];
    for (let k = Math.floor(Math.log10(max * HEAT.low ** 3)) + 1; 10 ** k <= max; k += 1) ticks.push(10 ** k);
    const marks = ticks.map((v) => ({v, at: heatT(v, max)}));
    if (!marks.length || marks[marks.length - 1].at < 0.8) marks.push({v: max, at: 1});
    for (const m of marks) {
      const tick = text(fmt(m.v), 'mx-heat-tick' + (m.at > 0.92 ? ' is-end' : ''));
      tick.style.left = (m.at * 100).toFixed(1) + '%';
      wrap.append(tick);
    }
    el.replaceChildren(wrap);
    return;
  }
  const pal = MX.palette(el);
  bar.style.background = `linear-gradient(90deg, ${[0, 0.25, 0.5, 0.75, 1].map((t) => pal.fill(t)).join(', ')})`;
  const row = document.createElement('span');
  row.className = 'mx-scale-row';
  row.append(text(MX.loc().locale.format('.0%')(0)), bar, text(MX.t('orMore', MX.fmtPct(capOf(atLevel)))));
  el.replaceChildren(row);
});

// The "no figures" key shows on the shares map when a picked country has regions without figures at this level.
dash.draw('map-empty', () => {
  const st = MX.get('region_rows', 'nuts_geo');
  let gaps = false;
  if (st.status === 'ok' && MX.param('mapmode') !== 'heat') {
    const [all, geo] = st.data;
    const level = Number(MX.param('level'));
    const {atLevel, sel} = regionYear(all);
    const shown = new Set(atLevel.filter((r) => r.year === sel && r.ai_adoption_share != null).map((r) => r.nuts_code));
    const picked = MX.selected();
    gaps = geo.some((g) => g.layer === 'region' && g.level === level && picked.includes(COUNTRY_OF[g.id.slice(0, 2)]) && !shown.has(g.id));
  }
  for (const n of root.querySelectorAll('[data-empty-key]')) n.hidden = !gaps;
});

// The five highest and lowest regions, colored as on the map; with the heat map, the regions with most AI-active firms.
const ranked = (name, pick) => {
  dash.draw(name, (el) => {
    const st = MX.get('region_rows');
    if (st.status !== 'ok') {
      el.replaceChildren();
      return;
    }
    const heat = MX.param('mapmode') === 'heat';
    const {atLevel, sel} = regionYear(st.data[0]);
    const cap = capOf(atLevel);
    const pal = MX.palette(el);
    const picked = MX.selected();
    const now = atLevel.filter((r) => r.year === sel && r.ai_adoption_share != null && picked.includes(r.country));
    now.sort(heat ? (a, b) => b.n_ai - a.n_ai : (a, b) => b.ai_adoption_share - a.ai_adoption_share);
    el.replaceChildren(
      ...pick(now, heat).map((r) => {
        const li = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'mx-rank-btn';
        const swatch = document.createElement('i');
        swatch.className = 'mx-rank-sw';
        swatch.style.background = heat ? heatCss(0.8, heatTheme(el)) : pal.fill(r.ai_adoption_share / cap);
        const label = document.createElement('span');
        label.className = 'mx-rank-name';
        label.textContent = MX.L(r, 'label');
        const value = document.createElement('b');
        value.textContent = heat ? MX.fmtInt(r.n_ai) : MX.fmtPct(r.ai_adoption_share);
        button.append(swatch, label, value);
        button.addEventListener('click', () => findRegion(r.nuts_code));
        li.append(button);
        return li;
      }),
    );
  });
};
ranked('map-top', (rows) => rows.slice(0, 5));
ranked('map-bottom', (rows, heat) => (heat ? [] : rows.slice(-5).reverse()));

// ---------------------------------------------------------------- regions as dots

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
  const picked = MX.selected();
  const atLevel = st.data[0].filter((r) => r.nuts_level === level && r.ai_adoption_share != null);
  const svg = MX.svg(el, Math.max(300, el.clientWidth), 10, MX.t('ariaSwarm'));
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
  const fx = MX.tickFormat(x, nX, '%');
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
  const bands = picked
    .map((country) => ({
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
    t.append('tspan').attr('class', 'mx-strong').text(MX.cname(b.country));
    t.append('tspan')
      .attr('dx', 8)
      .text(b.items.length > 1 ? MX.t('median', MX.fmtPct(med), MX.fmtInt(b.items.length)) : MX.fmtPct(med));
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
      .text(MX.L(top.d, 'label').split(/[,/]/)[0].trim() + ' ' + MX.fmtPct(top.d.ai_adoption_share));
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
    if (!flat.length) return null;
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
        {color: MX.colorOf(p.country), shape: 'dot', name: MX.t('aiActiveIn', sel), value: MX.fmtPct(p.d.ai_adoption_share), strong: true},
        {name: MX.t('classified'), value: MX.fmtInt(p.d.n_firms)},
      ];
      if (p.d.since_first_pp != null && sel !== first) rows.push({name: MX.t('ppSince', first), value: MX.fmtPP(p.d.since_first_pp)});
      tip.show({title: MX.L(p.d, 'label') + ' · ' + p.d.nuts_code, rows}, ex, ey);
    })
    .on('pointerleave', () => {
      ring.style('display', 'none');
      tip.hide();
    })
    .on('click', (event) => {
      const p = find(event);
      if (p) findRegion(p.d.nuts_code);
    });
});

// ---------------------------------------------------------------- the table

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
    for (const th of table.querySelectorAll('th')) {
      const b = th.querySelector('button[data-sort]');
      if (b) th.setAttribute('aria-sort', b.dataset.sort === key ? (regionSort.dir > 0 ? 'ascending' : 'descending') : 'none');
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
  const picked = MX.selected();
  const atLevel = all.filter((r) => r.nuts_level === level);
  const sel = MX.selYear(MX.yearsOf(atLevel));
  const series = seriesOf(all);
  const q = MX.regionQuery.trim().toLowerCase();
  const rows = atLevel.filter(
    (r) =>
      r.year === sel &&
      picked.includes(r.country) &&
      (!q || [r.nuts_code, MX.L(r, 'label'), r.label, r.country, MX.cname(r.country)].some((s) => String(s).toLowerCase().includes(q))),
  );
  const sortKey = regionSort.key === 'label' ? (r) => MX.L(r, 'label') : null;
  rows.sort(sortKey ? (a, b) => sortKey(a).localeCompare(sortKey(b)) * regionSort.dir : MX.sorter(regionSort));
  const max = d3.max(atLevel, (r) => r.ai_adoption_share) || 1;
  el.replaceChildren(
    ...rows.map((r) => {
      const tr = document.createElement('tr');
      tr.dataset.key = MX.key(r.nuts_code, r.year);
      tr.append(
        MX.cell(r.nuts_code, 'mx-code'),
        MX.cell(MX.L(r, 'label')),
        MX.cell(MX.cname(r.country), 'mx-hide-narrow', MX.colorOf(r.country)),
        MX.barCell(r.ai_adoption_share, max, MX.colorOf(r.country)),
        MX.changeCell(r.since_first_pp, (series.get(r.nuts_code) || []).map((s) => [s.year, s.ai_adoption_share]), sel),
        MX.cell(MX.fmtInt(r.n_firms), 'num mx-hide-narrow'),
      );
      return tr;
    }),
  );
});
