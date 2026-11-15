import { el } from './dom.js';

/**
 * Utilitas grafik SVG tanpa dependensi.
 *
 * Semua label dirender sebagai text node, bukan innerHTML. Grafik memakai
 * `viewBox` agar responsif, menyediakan judul/tooltip aksesibel, dan
 * menyertakan tabel tersembunyi untuk pembaca layar pada grafik batang.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

export const CHART_PALETTE = Object.freeze([
  '#4ade80',
  '#5eead4',
  '#fbbf24',
  '#fb7185',
  '#60a5fa',
  '#a3e635',
  '#34d399',
  '#f472b6',
  '#facc15',
  '#38bdf8',
]);

const defaultFormat = new Intl.NumberFormat('id-ID', {
  maximumFractionDigits: 0,
});

const compactFormat = new Intl.NumberFormat('id-ID', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

function svgEl(tagName, attributes = {}, ...children) {
  const node = document.createElementNS(SVG_NS, tagName);
  for (const [name, value] of Object.entries(attributes)) {
    if (value === null || value === undefined || value === false) continue;
    node.setAttribute(name, String(value));
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

function normaliseItems(items, palette) {
  return (Array.isArray(items) ? items : [])
    .map((item, index) => ({
      label: String(item?.label ?? ''),
      value: Number(item?.value) || 0,
      color: item?.color ?? palette[index % palette.length],
    }))
    .filter((item) => item.value > 0);
}

function safeFormatter(formatter, fallback = defaultFormat) {
  return typeof formatter === 'function'
    ? formatter
    : (value) => (formatter === 'compact' ? compactFormat : fallback).format(value);
}

function percentOf(value, total) {
  if (total <= 0) return '0%';
  return `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format((value / total) * 100)}%`;
}

function chartHeader(title) {
  if (!title) return null;
  return el('div', { class: 'chart__head' },
    el('p', { class: 'chart__title', text: title }),
  );
}

function emptyChart(message, hint = '') {
  return el('div', { class: 'chart-empty' },
    el('p', { class: 'chart-empty__title', text: message }),
    hint ? el('p', { class: 'chart-empty__hint', text: hint }) : null,
  );
}

/**
 * Donut chart untuk komposisi bagian dari keseluruhan.
 *
 * @param {Array<{label: string, value: number, color?: string}>} items
 * @param {object} options
 * @param {string} [options.title]
 * @param {string} [options.centerLabel]
 * @param {string} [options.centerValue]
 * @param {(value: number) => string} [options.formatValue]
 * @param {number} [options.size]
 * @param {number} [options.thickness]
 */
export function donutChart(items, {
  title = '',
  centerLabel = 'Total',
  centerValue = null,
  formatValue = defaultFormat,
  size = 190,
  thickness = 24,
  palette = CHART_PALETTE,
  emptyMessage = 'Belum ada data untuk ditampilkan.',
  emptyHint = '',
} = {}) {
  const format = safeFormatter(formatValue);
  const data = normaliseItems(items, palette);
  const wrapper = el('div', { class: 'chart chart--donut' });
  const header = chartHeader(title);
  if (header) wrapper.append(header);

  if (data.length === 0) {
    wrapper.append(emptyChart(emptyMessage, emptyHint));
    return wrapper;
  }

  const total = data.reduce((sum, item) => sum + item.value, 0);
  const center = Math.round(size / 2);
  const radius = (size - thickness) / 2;
  const label = data
    .map((item) => `${item.label}: ${format(item.value)} (${percentOf(item.value, total)})`)
    .join(', ');

  const svg = svgEl('svg', {
    class: 'chart__svg chart__svg--donut',
    viewBox: `0 0 ${size} ${size}`,
    role: 'img',
    'aria-label': `${title || 'Diagram donut'}. ${label}`,
    focusable: 'false',
  });

  const segmentGroup = svgEl('g', {
    transform: `rotate(-90 ${center} ${center})`,
  });
  let offset = 0;
  for (const item of data) {
    const percentage = (item.value / total) * 100;
    const segment = svgEl('circle', {
      cx: center,
      cy: center,
      r: radius,
      fill: 'none',
      stroke: item.color,
      'stroke-width': thickness,
      pathLength: '100',
      'stroke-dasharray': `${percentage} ${100 - percentage}`,
      'stroke-dashoffset': -offset,
      class: 'chart-donut__segment',
    });
    segment.append(svgEl('title', {},
      `${item.label}: ${format(item.value)} (${percentOf(item.value, total)})`));
    segmentGroup.append(segment);
    offset += percentage;
  }
  svg.append(segmentGroup);

  svg.append(svgEl('text', {
    x: center,
    y: center - 2,
    'text-anchor': 'middle',
    class: 'chart-donut__value',
  }, centerValue ?? format(total)));
  svg.append(svgEl('text', {
    x: center,
    y: center + 19,
    'text-anchor': 'middle',
    class: 'chart-donut__label',
  }, centerLabel));

  const legend = el('ul', { class: 'chart-legend' });
  for (const item of data) {
    legend.append(el('li', { class: 'chart-legend__item' },
      el('span', {
        class: 'chart-legend__swatch',
        'aria-hidden': 'true',
        style: { background: item.color },
      }),
      el('span', { class: 'chart-legend__copy' },
        el('span', { class: 'chart-legend__label', text: item.label }),
        el('span', { class: 'chart-legend__value', text: format(item.value) }),
      ),
      el('span', { class: 'chart-legend__percent', text: percentOf(item.value, total) }),
    ));
  }

  wrapper.append(el('div', { class: 'chart__body chart__body--donut' }, svg, legend));
  return wrapper;
}

function niceMaximum(value) {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const exponent = 10 ** Math.floor(Math.log10(value));
  const fraction = value / exponent;
  const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return niceFraction * exponent;
}

/**
 * Grafik batang vertikal dengan satu atau beberapa seri.
 *
 * @param {Array<{label: string, values: Record<string, number>}>} groups
 * @param {object} options
 * @param {Array<{key: string, label: string, color?: string}>} options.series
 * @param {string} [options.title]
 * @param {(value: number) => string} [options.formatValue]
 * @param {(value: number) => string} [options.formatAxis]
 */
export function barChart(groups, {
  series = [],
  title = '',
  formatValue = defaultFormat,
  formatAxis = (value) => compactFormat.format(value),
  width = 640,
  height = 270,
  palette = CHART_PALETTE,
  emptyMessage = 'Belum ada data untuk ditampilkan.',
  emptyHint = '',
} = {}) {
  const format = safeFormatter(formatValue);
  const safeGroups = (Array.isArray(groups) ? groups : []).map((group) => ({
    label: String(group?.label ?? ''),
    values: group?.values && typeof group.values === 'object' ? group.values : {},
  }));
  const safeSeries = (Array.isArray(series) ? series : []).map((item, index) => ({
    key: String(item?.key ?? ''),
    label: String(item?.label ?? item?.key ?? `Seri ${index + 1}`),
    color: item?.color ?? palette[index % palette.length],
  }));

  const wrapper = el('div', { class: 'chart chart--bar' });
  const header = chartHeader(title);
  if (header) wrapper.append(header);

  if (safeGroups.length === 0 || safeSeries.length === 0) {
    wrapper.append(emptyChart(emptyMessage, emptyHint));
    return wrapper;
  }

  const maximum = Math.max(
    0,
    ...safeGroups.flatMap((group) => safeSeries.map((item) => Number(group.values[item.key]) || 0)),
  );
  if (maximum <= 0) {
    wrapper.append(emptyChart(emptyMessage, emptyHint));
    return wrapper;
  }

  const padding = { top: 24, right: 14, bottom: 39, left: 49 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const top = padding.top;
  const axisMax = niceMaximum(maximum);

  const svg = svgEl('svg', {
    class: 'chart__svg chart__svg--bar',
    viewBox: `0 0 ${width} ${height}`,
    role: 'img',
    'aria-label': `${title || 'Diagram batang'}. ${safeGroups.length} kelompok data.`,
    focusable: 'false',
  });

  const grid = svgEl('g', { class: 'chart-grid' });
  const tickCount = 4;
  for (let index = 0; index <= tickCount; index += 1) {
    const y = top + plotHeight - (index / tickCount) * plotHeight;
    grid.append(svgEl('line', {
      x1: padding.left,
      x2: width - padding.right,
      y1: y,
      y2: y,
    }));
    grid.append(svgEl('text', {
      x: padding.left - 9,
      y: y + 4,
      'text-anchor': 'end',
      class: 'chart-axis__value',
    }, formatAxis((axisMax * index) / tickCount)));
  }
  svg.append(grid);

  const groupWidth = plotWidth / safeGroups.length;
  const barArea = Math.min(groupWidth * 0.66, 64);
  const gap = safeSeries.length > 1 ? 4 : 0;
  const barWidth = Math.max(
    3,
    Math.min(28, (barArea - gap * (safeSeries.length - 1)) / safeSeries.length),
  );

  safeGroups.forEach((group, groupIndex) => {
    const centerX = padding.left + groupIndex * groupWidth + groupWidth / 2;
    safeSeries.forEach((item, seriesIndex) => {
      const value = Number(group.values[item.key]) || 0;
      const barHeight = Math.max(0, (value / axisMax) * plotHeight);
      const x = centerX - barArea / 2
        + seriesIndex * (barWidth + gap)
        + Math.max(0, (barArea - (barWidth * safeSeries.length + gap * (safeSeries.length - 1))) / 2);
      const y = top + plotHeight - barHeight;
      const bar = svgEl('rect', {
        x,
        y,
        width: barWidth,
        height: barHeight,
        rx: Math.min(5, barWidth / 2),
        fill: item.color,
        class: 'chart-bar__rect',
      });
      bar.append(svgEl('title', {},
        `${group.label} · ${item.label}: ${format(value)}`));
      svg.append(bar);
    });

    svg.append(svgEl('text', {
      x: centerX,
      y: height - 12,
      'text-anchor': 'middle',
      class: 'chart-axis__label',
    }, group.label));
  });

  const legend = el('ul', { class: 'chart-legend chart-legend--inline' });
  for (const item of safeSeries) {
    legend.append(el('li', { class: 'chart-legend__item' },
      el('span', {
        class: 'chart-legend__swatch',
        'aria-hidden': 'true',
        style: { background: item.color },
      }),
      el('span', { class: 'chart-legend__copy' },
        el('span', { class: 'chart-legend__label', text: item.label }),
      ),
    ));
  }

  const table = el('table', { class: 'sr-only' });
  const caption = el('caption', { text: title || 'Data grafik batang' });
  const head = el('thead');
  const headRow = el('tr');
  headRow.append(el('th', { scope: 'col', text: 'Kelompok' }));
  for (const item of safeSeries) headRow.append(el('th', { scope: 'col', text: item.label }));
  head.append(headRow);

  const body = el('tbody');
  for (const group of safeGroups) {
    const row = el('tr');
    row.append(el('th', { scope: 'row', text: group.label }));
    for (const item of safeSeries) {
      row.append(el('td', { text: format(Number(group.values[item.key]) || 0) }));
    }
    body.append(row);
  }
  table.append(caption, head, body);

  wrapper.append(el('div', { class: 'chart__body' }, svg, legend, table));
  return wrapper;
}
