import { el } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { createModuleCard } from './module-list.js';

function normalize(value) {
  return String(value ?? '')
    .toLocaleLowerCase('id-ID')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Halaman pencarian modul. Pencarian hanya mencocokkan nama dan deskripsi
 * modul, bukan isi catatan pengguna.
 */
export function renderSearch(container, {
  modules = [],
  initialQuery = '',
  onQueryChange = null,
} = {}) {
  const view = el('div', { class: 'view search-view' });

  const input = el('input', {
    class: 'search-field__input',
    type: 'search',
    id: 'module-search',
    placeholder: 'Cari modul…',
    autocomplete: 'off',
    spellcheck: false,
    enterkeyhint: 'search',
    'aria-label': 'Cari nama atau deskripsi modul',
  });
  input.value = initialQuery;

  const clearButton = el('button', {
    class: 'search-field__clear',
    type: 'button',
    'aria-label': 'Hapus pencarian',
    hidden: true,
    html: icon('x', 'h-4 w-4'),
  });

  const field = el('div', { class: 'search-field' });
  field.append(
    el('span', {
      class: 'search-field__icon',
      'aria-hidden': 'true',
      html: icon('search', 'h-[18px] w-[18px]'),
    }),
    input,
    clearButton,
  );

  const summary = el('p', { class: 'search-summary', 'aria-live': 'polite' });
  const results = el('nav', { class: 'search-results', 'aria-label': 'Hasil pencarian modul' });
  view.append(field, summary, results);

  const renderResults = () => {
    const rawQuery = input.value.trim();
    const query = normalize(rawQuery);
    const filtered = query
      ? modules.filter((module) => (
        normalize(module.name).includes(query)
        || normalize(module.description).includes(query)
      ))
      : modules;

    clearButton.hidden = input.value.length === 0;
    results.replaceChildren(...filtered.map(createModuleCard));
    onQueryChange?.(input.value);

    if (filtered.length === 0) {
      results.append(el('div', { class: 'search-empty' },
        el('span', { class: 'search-empty__icon', html: icon('search') }),
        el('h2', { class: 'search-empty__title', text: 'Modul tidak ditemukan' }),
        el('p', {
          class: 'search-empty__text',
          text: `Tidak ada nama atau deskripsi modul yang cocok dengan “${rawQuery}”. Coba kata kunci lain.`,
        }),
      ));
      summary.textContent = `Tidak ada hasil untuk “${rawQuery}”.`;
      return;
    }

    summary.textContent = query
      ? `${filtered.length} hasil untuk “${rawQuery}”.`
      : `${modules.length} modul tersedia. Pencarian mencakup nama dan deskripsi modul.`;
  };

  input.addEventListener('input', renderResults);
  input.addEventListener('search', renderResults);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (input.value) {
        input.value = '';
        renderResults();
      } else {
        input.blur();
      }
      return;
    }
    if (event.key === 'Enter') {
      const first = results.querySelector('a.module-card');
      if (!first) return;
      event.preventDefault();
      first.click();
    }
  });

  clearButton.addEventListener('click', () => {
    input.value = '';
    renderResults();
    input.focus({ preventScroll: true });
  });

  renderResults();
  container.replaceChildren(view);
  requestAnimationFrame(() => input.focus({ preventScroll: true }));
}
