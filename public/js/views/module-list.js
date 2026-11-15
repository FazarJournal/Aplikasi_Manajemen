import { el } from '../core/dom.js';
import { icon } from '../core/icons.js';

/**
 * Kartu modul yang dipakai bersama oleh halaman Menu dan hasil pencarian.
 * @param {object} module Entri modul dari registry.
 * @param {{ layout?: 'list' | 'grid' }} options Varian tampilan kartu.
 */
export function createModuleCard(module, { layout = 'list' } = {}) {
  const link = el('a', {
    class: layout === 'grid' ? 'module-card module-card--grid' : 'module-card',
    href: `#/modul/${module.id}`,
  });

  link.append(
    el('span', {
      class: 'module-card__icon',
      html: module.icon,
    }),
    el('span', { class: 'module-card__body' },
      el('span', { class: 'module-card__title-row' },
        el('strong', { class: 'module-card__title', text: module.name }),
        el('span', { class: 'module-card__version', text: `v${module.version}` }),
      ),
      el('span', {
        class: 'module-card__description',
        text: module.description || 'Buka modul ini.',
      }),
    ),
    el('span', {
      class: 'module-card__arrow',
      html: icon('arrowRight', 'h-4 w-4'),
    }),
  );

  return link;
}
