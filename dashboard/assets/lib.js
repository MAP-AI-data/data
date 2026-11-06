// MAP-AI Explorer: shared helpers, languages, filters, calculations and chart builders.
const MX = (window.MX = window.MX || {});
const root = document.getElementById('dash-root') || document;

MX.ALL = 'All four countries';
MX.COUNTRIES = ['Belgium', 'France', 'Germany', 'Luxembourg'];
MX.CODE = {Belgium: 'BE', France: 'FR', Germany: 'DE', Luxembourg: 'LU'};
MX.COL = {'All four countries': 'all_four', Belgium: 'belgium', France: 'france', Germany: 'germany', Luxembourg: 'luxembourg'};
MX.MIN_FIRMS = 30; // README: a share is withheld when its denominator has fewer than 30 firms
MX.dur = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 650;
MX.colorOf = (country) => (MX.COUNTRIES.includes(country) ? dash.colors[MX.COUNTRIES.indexOf(country)] : 'var(--color-fg)');
MX.accent = () => dash.colors[4];

// ---------------------------------------------------------------- languages

MX.LANGS = ['en', 'de', 'fr'];
MX.lang = () => (MX.LANGS.includes(dash.params().lang) ? dash.params().lang : 'en');
// Words the scripts write, in English, German and French. {0}, {1} take values.
const STR = {
  failed: ['Failed to load', 'Laden fehlgeschlagen', 'Échec du chargement'],
  vs: ['vs {0}', 'ggü. {0}', 'vs {0}'],
  firstYear: ['first year', 'erstes Jahr', 'première année'],
  allFour: ['All four countries', 'Alle vier Länder', 'Les quatre pays'],
  allFourShort: ['All four', 'Alle vier', 'Les quatre'],
  selectedShort: ['Selected', 'Auswahl', 'Sélection'],
  total: ['total', 'insgesamt', 'total'],
  aiActiveIn: ['AI-active, {0}', 'KI-aktiv, {0}', 'actives en IA, {0}'],
  classified: ['classified firms', 'klassifizierte Unternehmen', 'entreprises classées'],
  aiFirmsEst: ['AI-active firms (estimated)', 'KI-aktive Unternehmen (geschätzt)', 'entreprises actives en IA (estimation)'],
  aiFirms: ['AI-active firms', 'KI-aktive Unternehmen', 'entreprises actives en IA'],
  ppSince: ['pp since {0}', 'Pp. seit {0}', 'pt depuis {0}'],
  ppChange: ['pp change', 'Veränderung in Pp.', 'variation en points'],
  withheld: ['withheld', 'nicht ausgewiesen', 'non communiqué'],
  fewerFirms: ['fewer than {0} firms', 'weniger als {0} Unternehmen', 'moins de {0} entreprises'],
  fewerAiFirms: ['fewer than {0} AI-active firms', 'weniger als {0} KI-aktive Unternehmen', 'moins de {0} entreprises actives en IA'],
  orMore: ['{0} or more', '{0} oder mehr', '{0} ou plus'],
  notInTables: ['not in the tables', 'nicht in den Tabellen', 'absent des tableaux'],
  median: ['median {0} · {1} regions', 'Median {0} · {1} Regionen', 'médiane {0} · {1} régions'],
  allIndustries: ['All industries', 'Alle Branchen', 'Tous les secteurs'],
  ofAiFirmsYear: ['of AI-active firms, {0}', 'der KI-aktiven Unternehmen, {0}', 'des entreprises actives en IA, {0}'],
  allAbbr: ['All', 'Alle', 'Tous'],
  selAbbr: ['Sel.', 'Ausw.', 'Sél.'],
  searchRegions: ['Search regions', 'Regionen suchen', 'Rechercher une région'],
  searchIndustries: ['Search industries', 'Branchen suchen', 'Rechercher un secteur'],
  ariaTrend: ['Line chart of the share of classified firms that are AI-active, by country and year', 'Liniendiagramm: Anteil KI-aktiver Unternehmen nach Land und Jahr', 'Graphique linéaire : part des entreprises actives en IA par pays et par année'],
  ariaCounts: ['Stacked bar chart of AI-active firms by country and year', 'Gestapeltes Balkendiagramm: KI-aktive Unternehmen nach Land und Jahr', 'Histogramme empilé : entreprises actives en IA par pays et par année'],
  ariaSwarm: ['Dot chart of regions by AI-active share, one row per country', 'Punktdiagramm der Regionen nach KI-Anteil, eine Zeile je Land', 'Nuage de points des régions selon leur part active en IA, une ligne par pays'],
  ariaMap: ['Map of the share of firms that are AI-active in each NUTS {0} region, {1}', 'Karte: Anteil KI-aktiver Unternehmen je NUTS-{0}-Region, {1}', 'Carte : part des entreprises actives en IA par région NUTS {0}, {1}'],
  ariaHeat: ['Heat map of where AI-active firms concentrate, {0}', 'Heatmap: Schwerpunkte KI-aktiver Unternehmen, {0}', 'Carte de chaleur : concentration des entreprises actives en IA, {0}'],
  ariaDumbbell: ['Dot plot of the AI-active share of each industry in the first and the selected year', 'Punktdiagramm: KI-Anteil jeder Branche im ersten und im gewählten Jahr', 'Diagramme à points : part active en IA de chaque secteur la première année et l’année choisie'],
  ariaMixTrend: ['Line chart of the share of AI-active firms in each category, by year', 'Liniendiagramm: Anteil der KI-aktiven Unternehmen je Kategorie und Jahr', 'Graphique linéaire : part des entreprises actives en IA par catégorie et par année'],
  ariaMixDumbbell: ['Dot plot of each category’s share of AI-active firms in the first and the selected year', 'Punktdiagramm: Anteil je Kategorie im ersten und im gewählten Jahr', 'Diagramme à points : part de chaque catégorie la première année et l’année choisie'],
  ariaMixHeat: ['Heat map of each category’s share of AI-active firms by country', 'Heatmap: Anteil je Kategorie nach Land', 'Carte de chaleur : part de chaque catégorie par pays'],
  ariaBars: ['Bar chart of the highlighted category’s share of AI-active firms in each industry', 'Balkendiagramm: Anteil der hervorgehobenen Kategorie je Branche', 'Diagramme en barres : part de la catégorie mise en avant par secteur'],
};
MX.t = (key, ...args) => {
  const row = STR[key];
  let s = row ? row[MX.LANGS.indexOf(MX.lang())] || row[0] : key;
  args.forEach((a, i) => {
    s = s.split('{' + i + '}').join(String(a));
  });
  return s;
};
// A field in the reader's language where the data has one (short_de, label_fr, ...), else the English one.
MX.L = (row, field) => (MX.lang() !== 'en' && row[field + '_' + MX.lang()]) || row[field];
const CNAME = {
  Belgium: ['Belgium', 'Belgien', 'Belgique'],
  France: ['France', 'Frankreich', 'France'],
  Germany: ['Germany', 'Deutschland', 'Allemagne'],
  Luxembourg: ['Luxembourg', 'Luxemburg', 'Luxembourg'],
  'All four countries': ['All four countries', 'Alle vier Länder', 'Les quatre pays'],
};
MX.cname = (c) => (CNAME[c] ? CNAME[c][MX.LANGS.indexOf(MX.lang())] : String(c).split(' + ').map((x) => (CNAME[x] ? MX.cname(x) : x)).join(' + '));

// ---------------------------------------------------------------- number formats

const LOCALES = {
  en: {decimal: '.', thousands: ',', grouping: [3], currency: ['€', ''], percent: '%', minus: '−'},
  de: {decimal: ',', thousands: '.', grouping: [3], currency: ['', ' €'], percent: ' %', minus: '−'},
  fr: {decimal: ',', thousands: ' ', grouping: [3], currency: ['', ' €'], percent: ' %', minus: '−'},
};
const TAGS = {en: 'en-GB', de: 'de-DE', fr: 'fr-FR'};
const formats = {};
MX.loc = () => {
  const l = MX.lang();
  if (!formats[l]) {
    const locale = d3.formatLocale(LOCALES[l]);
    formats[l] = {
      locale,
      pct: locale.format('.1%'),
      int: locale.format(','),
      pp: locale.format('+.1f'),
      sint: locale.format('+,'),
      rel: locale.format('+.1%'),
      m0: locale.format('.0f'),
      m1: locale.format('.1f'),
      compact: new Intl.NumberFormat(TAGS[l], {notation: 'compact', maximumFractionDigits: 1}),
      list: new Intl.ListFormat(TAGS[l], {type: 'conjunction'}),
    };
  }
  return formats[l];
};
MX.fmtPct = (v) => MX.loc().pct(v);
MX.fmtInt = (v) => MX.loc().int(v);
MX.fmtPP = (v) => MX.loc().pp(v);
MX.fmtSignedInt = (v) => MX.loc().sint(v);
MX.fmtRel = (v) => MX.loc().rel(v);
MX.fmtMult = (v) => (v >= 10 ? MX.loc().m0 : MX.loc().m1)(v);
MX.fmtCompact = (v) => MX.loc().compact.format(v);
// Axis ticks in the reader's language, with as many decimals as the tick step needs.
MX.tickFormat = (scale, count, type) => {
  const [a, b] = scale.domain();
  const spec = d3.formatSpecifier(type || ',');
  if (spec.type === '%') spec.precision = Math.max(0, d3.precisionFixed(d3.tickStep(a, b, count)) - 2);
  return MX.loc().locale.format(String(spec));
};

// ---------------------------------------------------------------- countries

// The countries the reader picked (all four unless they chose fewer), in a fixed order.
MX.selected = () => {
  const codes = String(dash.params().countries || '').split(/[\s,]+/);
  const picked = MX.COUNTRIES.filter((c) => codes.includes(MX.CODE[c]));
  return picked.length ? picked : [...MX.COUNTRIES];
};
MX.isAll = () => MX.selected().length === MX.COUNTRIES.length;
// The rows that hold the selection's figures: one country's own, or the group's ("Belgium + France", "All four countries").
MX.groupKey = () => {
  const sel = MX.selected();
  return sel.length === 1 ? sel[0] : sel.length === MX.COUNTRIES.length ? MX.ALL : sel.join(' + ');
};
// The selection's name: "Belgium", "Belgium + France" or "All four countries"; short: "Selected", "All four".
MX.groupName = (short) => {
  const sel = MX.selected();
  if (sel.length === 1) return MX.cname(sel[0]);
  if (MX.isAll()) return MX.t(short ? 'allFourShort' : 'allFour');
  return short ? MX.t('selectedShort') : MX.cname(MX.groupKey());
};
MX.groupColor = () => (MX.selected().length === 1 ? MX.colorOf(MX.selected()[0]) : 'var(--color-fg)');

// ---------------------------------------------------------------- calculations

dash.calc('adoption_by_country', {
  title: 'AI adoption by country',
  description:
    'Each country’s published AI-active share, plus every group of two or more countries (all four together are “All four countries”): AI-active firms summed over the group, divided by classified firms summed. Changes compare each year with the year before (percentage points for shares) and with the first year.',
  inputs: ['country_adoption', 'country_roles'],
  fn: (country_adoption, country_roles) => {
    const NAMES = ['Belgium', 'France', 'Germany', 'Luxembourg'];
    const groups = [];
    for (let mask = 1; mask < 1 << NAMES.length; mask += 1) {
      const members = NAMES.filter((_, i) => mask & (1 << i));
      if (members.length > 1) groups.push({label: members.length === NAMES.length ? 'All four countries' : members.join(' + '), members});
    }
    const aiFirms = {};
    for (const r of country_roles) aiFirms[r.country + '|' + r.year] = Number(r.n_ai_firms);
    const rows = country_adoption.map((r) => ({
      country: r.country,
      year: Number(r.year),
      share: Number(r.ai_adoption_share),
      n_ai: aiFirms[r.country + '|' + r.year],
      n_firms: Number(r.n_firms),
    }));
    const byKey = {};
    for (const r of rows) byKey[r.country + '|' + r.year] = r;
    for (const year of new Set(rows.map((r) => r.year))) {
      for (const g of groups) {
        const parts = g.members.map((c) => byKey[c + '|' + year]).filter(Boolean);
        const n_ai = parts.reduce((s, r) => s + r.n_ai, 0);
        const n_firms = parts.reduce((s, r) => s + r.n_firms, 0);
        rows.push({country: g.label, year, share: n_ai / n_firms, n_ai, n_firms});
      }
    }
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
    'Share of AI-active firms in each technology type and ecosystem role. Countries use the published shares. A group of two or more countries recovers each category’s firm count (share of all firms × classified firms, rounded), sums it over the group and divides by AI-active firms summed. Changes are in percentage points on the year before. Labels in English, German and French.',
  inputs: ['country_types', 'country_roles', 'names'],
  fn: (country_types, country_roles, names) => {
    const NAMES = ['Belgium', 'France', 'Germany', 'Luxembourg'];
    const groups = [];
    for (let mask = 1; mask < 1 << NAMES.length; mask += 1) {
      const members = NAMES.filter((_, i) => mask & (1 << i));
      if (members.length > 1) groups.push({label: members.length === NAMES.length ? 'All four countries' : members.join(' + '), members});
    }
    const named = {};
    for (const n of names) named[n.scheme + '|' + n.code] = n;
    const rows = [];
    const counts = {};
    const add = (list, kind, codeCol, labelCol, aiCol, allCol) => {
      for (const r of list) {
        const code = Number(r[codeCol]);
        const year = Number(r.year);
        const n = named['ai_' + kind + '|' + code] || {};
        const base = {
          kind,
          code,
          label: r[labelCol],
          label_de: n.name_de ?? r[labelCol],
          label_fr: n.name_fr ?? r[labelCol],
          short: n.short ?? r[labelCol],
          short_de: n.short_de ?? n.short ?? r[labelCol],
          short_fr: n.short_fr ?? n.short ?? r[labelCol],
          year,
        };
        rows.push({...base, country: r.country, share: r[aiCol] == null ? null : Number(r[aiCol]), n_ai: Number(r.n_ai_firms)});
        counts[kind + '|' + code + '|' + year + '|' + r.country] = {
          base,
          n_ai: Number(r.n_ai_firms),
          n_cat: Math.round(Number(r[allCol]) * Number(r.n_firms)),
        };
      }
    };
    add(country_types, 'type', 'ai_type', 'ai_type_label', 'type_share_among_ai_firms', 'type_share_among_all_firms');
    add(country_roles, 'role', 'ai_role', 'ai_role_label', 'role_share_among_ai_firms', 'role_share_among_all_firms');
    const cells = {};
    for (const [key, v] of Object.entries(counts)) {
      const cell = key.slice(0, key.lastIndexOf('|'));
      (cells[cell] ??= {base: v.base, by: {}}).by[key.slice(key.lastIndexOf('|') + 1)] = v;
    }
    for (const {base, by} of Object.values(cells)) {
      for (const g of groups) {
        const parts = g.members.map((c) => by[c]).filter(Boolean);
        const n_ai = parts.reduce((s, p) => s + p.n_ai, 0);
        const n_cat = parts.reduce((s, p) => s + p.n_cat, 0);
        rows.push({...base, country: g.label, share: n_ai ? n_cat / n_ai : null, n_ai});
      }
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
    'NUTS 1–3 regions with their names (a region without a name of its own, such as a French outermost region at NUTS 3, takes its NUTS 2 region’s), the change in AI-active share since the first year in percentage points, and an estimate of AI-active firms: the share × classified firms, rounded.',
  inputs: ['region_adoption', 'names'],
  fn: (region_adoption, names) => {
    const named = {};
    for (const n of names) if (n.scheme === 'nuts') named[n.code] = n;
    const children = {};
    const small = new Set(region_adoption.filter((r) => Number(r.nuts_level) === 3).map((r) => r.nuts_code));
    for (const code of small) children[code.slice(0, 4)] = (children[code.slice(0, 4)] || 0) + 1;
    const nameOf = (code, lang) => {
      const n = named[code];
      return n ? (lang ? n['short_' + lang] : null) ?? n.short : null;
    };
    const PART = {en: 'Part of ', de: 'Teil von ', fr: 'Partie de '};
    const labelOf = (code, level, lang) => {
      const own = nameOf(code, lang);
      if (own || level < 3) return own ?? code;
      const parent = code.slice(0, 4);
      return children[parent] === 1 ? nameOf(parent, lang) ?? parent : PART[lang || 'en'] + (nameOf(parent, lang) ?? parent);
    };
    const rows = region_adoption.map((r) => {
      const level = Number(r.nuts_level);
      const share = r.ai_adoption_share == null ? null : Number(r.ai_adoption_share);
      const n_firms = Number(r.n_firms);
      return {
        nuts_code: r.nuts_code,
        nuts_level: level,
        country: r.country,
        year: Number(r.year),
        label: labelOf(r.nuts_code, level),
        label_de: labelOf(r.nuts_code, level, 'de'),
        label_fr: labelOf(r.nuts_code, level, 'fr'),
        ai_adoption_share: share,
        n_firms,
        n_ai: share == null ? null : Math.round(share * n_firms),
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
    'One row per industry and year: the AI-active share in each country (All four countries is the published Pooled row), each country’s classified firms, and the industry’s name in English, German and French.',
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
        name_de: n.name_de ?? n.name ?? String(r.code),
        name_fr: n.name_fr ?? n.name ?? String(r.code),
        short: n.short ?? String(r.code),
        short_de: n.short_de ?? n.short ?? String(r.code),
        short_fr: n.short_fr ?? n.short ?? String(r.code),
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

dash.calc('industry_pooled', {
  title: 'Industries for groups of countries',
  description:
    'AI-active share of each industry for every group of two or three countries: each country’s share weighted by its classified firms, leaving out countries whose share is withheld. All four countries together use the tables’ own Pooled rows instead.',
  inputs: ['industry_adoption'],
  fn: (industry_adoption) => {
    const NAMES = ['Belgium', 'France', 'Germany', 'Luxembourg'];
    const groups = [];
    for (let mask = 1; mask < 1 << NAMES.length; mask += 1) {
      const members = NAMES.filter((_, i) => mask & (1 << i));
      if (members.length > 1 && members.length < NAMES.length) groups.push({label: members.join(' + '), members});
    }
    const cells = {};
    for (const r of industry_adoption) {
      if (r.country === 'Pooled') continue;
      const base = r.classification + '-' + r.digit_level + '-' + r.code + '-' + r.year;
      (cells[base] ??= {r, by: {}}).by[r.country] = r;
    }
    const rows = [];
    for (const [base, cell] of Object.entries(cells)) {
      for (const g of groups) {
        let num = 0;
        let den = 0;
        let n = 0;
        for (const m of g.members) {
          const r = cell.by[m];
          if (!r) continue;
          n += Number(r.n_firms);
          if (r.ai_adoption_share != null) {
            num += Number(r.ai_adoption_share) * Number(r.n_firms);
            den += Number(r.n_firms);
          }
        }
        rows.push({
          id: base + '-' + g.label,
          group: g.label,
          classification: cell.r.classification,
          digit_level: Number(cell.r.digit_level),
          code: String(cell.r.code),
          year: Number(cell.r.year),
          share: den ? num / den : null,
          n_firms: n,
        });
      }
    }
    return rows;
  },
});

dash.calc('industry_mix', {
  title: 'Industry mix for groups of countries',
  description:
    'Share of AI-active firms in each technology type and ecosystem role by NACE section, for every group of two or three countries: category firm counts (share of all firms × classified firms, rounded) summed over the group, divided by its AI-active firms; withheld when fewer than 30. Single countries and all four use the published rows.',
  inputs: ['industry_types', 'industry_roles'],
  fn: (industry_types, industry_roles) => {
    const NAMES = ['Belgium', 'France', 'Germany', 'Luxembourg'];
    const groups = [];
    for (let mask = 1; mask < 1 << NAMES.length; mask += 1) {
      const members = NAMES.filter((_, i) => mask & (1 << i));
      if (members.length > 1 && members.length < NAMES.length) groups.push({label: members.join(' + '), members});
    }
    const rows = [];
    const add = (list, kind, codeCol, allCol) => {
      const cells = {};
      for (const r of list) {
        if (r.country === 'Pooled') continue;
        const key = r.code + '|' + r.year + '|' + r[codeCol];
        (cells[key] ??= {section: String(r.code), year: Number(r.year), category: Number(r[codeCol]), by: {}}).by[r.country] = r;
      }
      for (const cell of Object.values(cells)) {
        for (const g of groups) {
          let cat = 0;
          let ai = 0;
          for (const m of g.members) {
            const r = cell.by[m];
            if (!r || r[allCol] == null) continue;
            cat += Math.round(Number(r[allCol]) * Number(r.n_firms));
            ai += Number(r.n_ai_firms);
          }
          rows.push({kind, group: g.label, section: cell.section, year: cell.year, category: cell.category, share: ai >= 30 ? cat / ai : null, n_ai: ai});
        }
      }
    };
    add(industry_types, 'type', 'ai_type', 'type_share_among_all_firms');
    add(industry_roles, 'role', 'ai_role', 'role_share_among_all_firms');
    return rows;
  },
});

// ---------------------------------------------------------------- filters

const DEFAULTS = {level: '3', ind: 'nace1', bd: 'type', lang: 'en', mapmode: 'share'};
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
  el.setAttribute('lang', MX.lang());
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
    p.textContent = MX.t('failed');
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
// Percent ticks along a horizontal axis, fewer of them when their labels would touch.
MX.xTicks = (svg, x, count) => {
  const [a, b] = x.range();
  let n = count;
  for (;;) {
    const ticks = x.ticks(n);
    const fmt = MX.tickFormat(x, n, '%');
    const room = Math.abs(b - a) / Math.max(1, ticks.length - 1);
    if (n <= 1 || room >= MX.textWidth(svg, ticks.map(fmt), 'mx-tick') + 10) return {ticks, fmt};
    n -= 1;
  }
};
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
    return {fill: mix, ink: () => 'var(--color-fg)', dark: false};
  }
  const ramp = d3.interpolateLab(panel, hue);
  const fill = (t) => ramp(0.1 + 0.9 * Math.max(0, Math.min(1, t)));
  return {fill, ink: (t) => (MX.lum(d3.rgb(fill(t))) > 0.19 ? '#161616' : '#f7f7f7'), dark: MX.lum(d3.rgb(panel)) < 0.2};
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
  const fy = MX.tickFormat(y, nY, '%');
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
  const {ticks: xTicks, fmt: fx} = MX.xTicks(svg, x, nX);
  const g = MX.layer(svg, 'mx-plot').attr('transform', `translate(${m.left},${m.top})`);
  const axis = MX.layer(g, 'mx-axis');
  axis.selectAll('*').remove();
  for (const t of xTicks) {
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
  const {ticks: xTicks, fmt: fx} = MX.xTicks(svg, x, nX);
  const g = MX.layer(svg, 'mx-plot').attr('transform', `translate(${m.left},${m.top})`);
  const axis = MX.layer(g, 'mx-axis');
  axis.selectAll('*').remove();
  for (const t of xTicks) {
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

// Segmented filters. The language and map view leave the address clean at their defaults.
for (const seg of root.querySelectorAll('.mx-seg[data-param]')) {
  seg.addEventListener('click', (event) => {
    const b = event.target.closest('button[data-value]');
    if (!b) return;
    const name = seg.dataset.param;
    const value = (name === 'lang' || name === 'mapmode') && b.dataset.value === DEFAULTS[name] ? null : b.dataset.value;
    dash.setParams(name === 'bd' ? {bd: value, focus: null} : {[name]: value});
  });
}

// Countries: each chip adds or removes a country, and at least one stays picked.
const pickCountries = (picked) =>
  dash.setParams({countries: picked.length === MX.COUNTRIES.length ? null : picked.map((c) => MX.CODE[c]).join(',')});
for (const chip of root.querySelectorAll('.mx-cchip[data-country]')) {
  chip.addEventListener('click', () => {
    const sel = new Set(MX.selected());
    const c = chip.dataset.country;
    if (sel.has(c)) {
      if (sel.size === 1) return;
      sel.delete(c);
    } else sel.add(c);
    pickCountries(MX.COUNTRIES.filter((x) => sel.has(x)));
  });
}
for (const b of root.querySelectorAll('[data-countries-all]')) b.addEventListener('click', () => pickCountries(MX.COUNTRIES));

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
  const p = {level: MX.param('level'), ind: MX.param('ind'), bd: MX.param('bd'), lang: MX.lang(), mapmode: MX.param('mapmode')};
  for (const seg of root.querySelectorAll('.mx-seg[data-param]')) {
    for (const b of seg.querySelectorAll('button[data-value]')) b.setAttribute('aria-pressed', String(b.dataset.value === p[seg.dataset.param]));
  }
  for (const n of root.querySelectorAll('[data-bd]')) n.hidden = n.dataset.bd !== p.bd;
  for (const n of root.querySelectorAll('[data-mapmode]')) n.hidden = n.dataset.mapmode !== p.mapmode;
  for (const n of root.querySelectorAll('.mx-more')) n.hidden = p.ind !== 'nace2';
  // Language: show each text in the reader's language, and label controls in it.
  for (const n of root.querySelectorAll('[data-l]')) n.hidden = n.dataset.l !== p.lang;
  const aria = 'aria' + p.lang[0].toUpperCase() + p.lang.slice(1);
  for (const n of root.querySelectorAll('[data-aria-en]')) n.setAttribute('aria-label', n.dataset[aria] || n.dataset.ariaEn);
  for (const n of root.querySelectorAll('.mx')) {
    n.classList.toggle('mx-lang-de', p.lang === 'de');
    n.classList.toggle('mx-lang-fr', p.lang === 'fr');
  }
  // Countries: the chips, the colors that stand for the selection, and the industry table's columns.
  const sel = MX.selected();
  for (const chip of root.querySelectorAll('.mx-cchip[data-country]')) chip.setAttribute('aria-pressed', String(sel.includes(chip.dataset.country)));
  for (const b of root.querySelectorAll('[data-countries-all]')) b.hidden = MX.isAll();
  for (const k of root.querySelectorAll('.mx-key[data-key]')) k.style.background = MX.colorOf(k.dataset.key);
  for (const k of root.querySelectorAll('.mx-key[data-key-group]')) k.style.background = MX.groupColor();
  for (const k of root.querySelectorAll('.mx-key-accent')) k.style.background = MX.accent();
  for (const th of root.querySelectorAll('table[data-sortable="industry"] th[data-field]')) {
    const country = Object.keys(MX.COL).find((c) => MX.COL[c] === th.dataset.field);
    if (country) th.hidden = country === MX.ALL ? !MX.isAll() : !sel.includes(country);
  }
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
const recolor = () => redraw(['industry-table', 'ind-scale', 'mix-heat', 'map', 'map-scale', 'map-top', 'map-bottom']);
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
    return i > 0 ? MX.t('vs', years[i - 1]) : MX.t('firstYear');
  }),
);
dash.draw('min-firms', (el) => {
  el.textContent = MX.fmtInt(MX.MIN_FIRMS);
});
// Search boxes say what they search in the reader's language.
const placeholder = (name, key) =>
  dash.draw(name, (el) => {
    el.placeholder = MX.t(key);
    el.setAttribute('aria-label', MX.t(key));
  });
placeholder('ph-regions', 'searchRegions');
placeholder('ph-industries', 'searchIndustries');
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
