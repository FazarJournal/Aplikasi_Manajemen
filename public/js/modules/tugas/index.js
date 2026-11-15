import { el } from '../../core/dom.js';
import { EVENTS } from '../../core/events.js';
import { notificationPermissionLabel, notifications } from '../../core/notifications.js';

const CHECK_ICON = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7"/></svg>';
const PLUS_ICON = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
const TRASH_ICON = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>';
const CALENDAR_ICON = '<svg class="task-chip__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>';
const BELL_ICON = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>';
const EMPTY_ICON = '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="10" y="8" width="28" height="34" rx="6"/><path d="M18 8V5h12v3M17 20h14M17 27h9"/><path d="m27 34 3 3 6-7" stroke-width="2.4"/></svg>';

const REMINDER_HOUR = 7;
const REMINDER_MINUTE = 30;
const REMINDER_HORIZON_MS = 14 * 86_400_000;
const REMINDER_IMMEDIATE_DELAY_MS = 8_000;

function sortTasks(tasks) {
  return [...tasks].sort((left, right) => {
    if (left.done !== right.done) return left.done ? 1 : -1;

    if (!left.done) {
      const leftDue = left.dueDate || '9999-12-31';
      const rightDue = right.dueDate || '9999-12-31';
      const dueOrder = leftDue.localeCompare(rightDue);
      if (dueOrder !== 0) return dueOrder;
    }

    if (left.done && right.done) {
      const completedOrder = String(right.completedAt ?? right.updatedAt)
        .localeCompare(String(left.completedAt ?? left.updatedAt));
      if (completedOrder !== 0) return completedOrder;
    }

    return String(right.createdAt).localeCompare(String(left.createdAt));
  });
}

export default {
  id: 'tugas',
  name: 'Tugas',
  description: 'Catat pekerjaan sekolah, atur tenggat, dan rayakan setiap centang.',
  version: '1.0.0',
  order: 20,

  icon: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4.5" y="3.5" width="15" height="17.5" rx="3"/><path d="M9 3.5V2.5h6v1M8.5 11.5l2.2 2.2 4.8-5"/><path d="M8.5 17.5h7"/></svg>',

  styles: `
    .tugas {
      display: flex;
      flex-direction: column;
      gap: 22px;
    }

    .tugas__stats {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }

    .tugas-stat {
      position: relative;
      overflow: hidden;
      padding: 16px;
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      background: linear-gradient(160deg, rgb(var(--ink-rgb) / 0.045), rgb(var(--ink-rgb) / 0.012));
    }

    .tugas-stat::after {
      content: "";
      position: absolute;
      width: 70px;
      height: 70px;
      right: -28px;
      top: -32px;
      border-radius: 999px;
      background: var(--stat-glow, rgb(var(--brand-strong-rgb) / 0.18));
      filter: blur(8px);
    }

    .tugas-stat--warning { --stat-glow: rgb(var(--warning-rgb) / 0.16); }
    .tugas-stat--success { --stat-glow: rgb(var(--success-rgb) / 0.15); }

    .tugas-stat__label {
      margin: 0 0 8px;
      color: var(--muted);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .tugas-stat__value {
      margin: 0;
      font-size: clamp(24px, 5vw, 31px);
      font-weight: 720;
      letter-spacing: -0.045em;
      line-height: 1;
    }

    .tugas-stat--warning .tugas-stat__value { color: var(--warning); }
    .tugas-stat--success .tugas-stat__value { color: var(--success); }

    .tugas__toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
    }

    .tugas__actions {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }

    .tugas__reminder {
      position: relative;
    }

    .tugas__reminder-state {
      flex: none;
      width: 7px;
      height: 7px;
      border-radius: 999px;
      background: var(--muted);
      box-shadow: 0 0 0 3px rgba(148, 163, 184, 0.1);
    }

    .tugas__reminder[data-state="on"] .tugas__reminder-state {
      background: var(--success);
      box-shadow: 0 0 0 3px rgb(var(--success-rgb) / 0.12);
    }

    .tugas__reminder[data-state="blocked"] .tugas__reminder-state {
      background: var(--danger);
      box-shadow: 0 0 0 3px rgb(var(--danger-rgb) / 0.12);
    }

    .tugas-reminder-dialog {
      display: grid;
      gap: 14px;
    }

    .tugas-reminder-status {
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 11px 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      background: rgb(var(--ink-rgb) / 0.026);
    }

    .tugas-reminder-status__dot {
      flex: none;
      width: 9px;
      height: 9px;
      border-radius: 999px;
      background: var(--muted);
    }

    .tugas-reminder-status[data-state="on"] {
      border-color: rgb(var(--success-rgb) / 0.22);
      background: var(--success-soft);
    }

    .tugas-reminder-status[data-state="on"] .tugas-reminder-status__dot {
      background: var(--success);
    }

    .tugas-reminder-status[data-state="blocked"] {
      border-color: rgb(var(--danger-rgb) / 0.22);
      background: var(--danger-soft);
    }

    .tugas-reminder-status[data-state="blocked"] .tugas-reminder-status__dot {
      background: var(--danger);
    }

    .tugas-reminder-status__copy {
      display: grid;
      gap: 1px;
    }

    .tugas-reminder-status__title {
      color: var(--text-secondary);
      font-size: 12px;
      font-weight: 660;
    }

    .tugas-reminder-status__text {
      color: var(--muted);
      font-size: 10.5px;
      line-height: 1.5;
    }

    .tugas-reminder-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .tugas-reminder-actions .btn {
      min-height: 44px;
    }

    .tugas-reminder-note {
      color: var(--muted);
      font-size: 10.5px;
      line-height: 1.6;
    }

    .tugas-filters {
      display: flex;
      gap: 3px;
      width: fit-content;
      padding: 4px;
      border: 1px solid var(--border);
      border-radius: var(--radius-full);
      background: rgb(var(--ink-rgb) / 0.045);
      overflow-x: auto;
      scrollbar-width: none;
    }

    .tugas-filters::-webkit-scrollbar { display: none; }

    .tugas-filter {
      flex: none;
      appearance: none;
      border: 0;
      padding: 8px 12px;
      border-radius: var(--radius-full);
      background: transparent;
      color: var(--muted);
      font: inherit;
      font-size: 13px;
      font-weight: 650;
      cursor: pointer;
      transition: background var(--transition), color var(--transition);
    }

    .tugas-filter:hover { color: var(--text); }

    .tugas-filter[aria-pressed="true"] {
      background: var(--surface-3, rgb(var(--ink-rgb) / 0.08));
      color: var(--text);
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.16);
    }

    .tugas-filter__count {
      margin-left: 3px;
      color: var(--muted);
      font-variant-numeric: tabular-nums;
    }

    .tugas-list {
      display: grid;
      gap: 10px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .tugas-item {
      position: relative;
      display: flex;
      align-items: flex-start;
      gap: 11px;
      padding: 14px 13px;
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      background: linear-gradient(160deg, rgb(var(--ink-rgb) / 0.045), rgb(var(--ink-rgb) / 0.018));
      transition: border-color var(--transition), transform var(--transition), background var(--transition);
    }

    .tugas-item:hover {
      border-color: var(--border-strong);
      background: linear-gradient(160deg, rgb(var(--ink-rgb) / 0.06), rgb(var(--ink-rgb) / 0.022));
    }

    .tugas-item:has(.tugas-item__main:focus-visible) {
      border-color: var(--primary);
    }


    .tugas-item.is-done {
      opacity: 0.72;
      border-left-width: 1px;
    }

    .tugas-item__check {
      display: grid;
      place-items: center;
      flex: none;
      width: 28px;
      height: 28px;
      margin-top: 1px;
      padding: 0;
      border: 1.5px solid var(--border-strong);
      border-radius: 9px;
      background: rgb(var(--ink-rgb) / 0.025);
      color: transparent;
      cursor: pointer;
      transition: background var(--transition), border-color var(--transition), color var(--transition), transform var(--transition);
    }

    .tugas-item__check:hover {
      border-color: var(--success);
      color: rgb(var(--success-rgb) / 0.45);
      transform: scale(1.04);
    }

    .tugas-item__check[aria-checked="true"] {
      border-color: var(--success);
      background: var(--success-soft);
      color: var(--success);
    }

    .tugas-item__check .icon { width: 17px; height: 17px; }

    .tugas-item__main {
      display: grid;
      flex: 1;
      min-width: 0;
      gap: 6px;
      padding: 0;
      border: 0;
      background: transparent;
      color: inherit;
      text-align: left;
      font: inherit;
      cursor: pointer;
    }

    .tugas-item__main:focus-visible { outline: none; }

    .tugas-item__title {
      overflow-wrap: anywhere;
      font-size: 14.5px;
      font-weight: 620;
      line-height: 1.42;
      letter-spacing: -0.012em;
    }

    .tugas-item.is-done .tugas-item__title {
      color: var(--muted);
      text-decoration: line-through;
      text-decoration-thickness: 1px;
    }

    .tugas-item__meta {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
      color: var(--muted);
      font-size: 11.5px;
      line-height: 1.4;
    }

    .task-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 7px;
      border: 1px solid var(--border);
      border-radius: var(--radius-full);
      background: rgb(var(--ink-rgb) / 0.03);
      white-space: nowrap;
    }

    .task-chip__icon { width: 12px; height: 12px; }

    .task-chip--subject {
      max-width: 170px;
      overflow: hidden;
      text-overflow: ellipsis;
      color: var(--text-secondary);
    }

    .task-chip--overdue {
      border-color: rgb(var(--danger-rgb) / 0.25);
      background: var(--danger-soft);
      color: var(--danger);
    }

    .task-chip--today {
      border-color: rgb(var(--warning-rgb) / 0.25);
      background: var(--warning-soft);
      color: var(--warning);
    }

    .task-chip--soon { color: var(--text-secondary); }

    .tugas-item__delete {
      display: grid;
      place-items: center;
      flex: none;
      width: 30px;
      height: 30px;
      padding: 0;
      border: 0;
      border-radius: 9px;
      background: transparent;
      color: var(--muted);
      cursor: pointer;
      opacity: 0.65;
      transition: background var(--transition), color var(--transition), opacity var(--transition);
    }

    .tugas-item__delete:hover {
      background: var(--danger-soft);
      color: var(--danger);
      opacity: 1;
    }

    .tugas-item__delete .icon { width: 16px; height: 16px; }

    .tugas-empty {
      display: grid;
      justify-items: center;
      gap: 9px;
      padding: clamp(38px, 8vw, 62px) 22px;
      border: 1px dashed var(--border-strong);
      border-radius: var(--radius-xl);
      background: radial-gradient(circle at 50% 0%, rgb(var(--brand-strong-rgb) / 0.09), transparent 58%);
      text-align: center;
    }

    .tugas-empty__icon {
      display: grid;
      place-items: center;
      width: 58px;
      height: 58px;
      margin-bottom: 4px;
      border: 1px solid var(--border);
      border-radius: 18px;
      background: var(--surface-2);
      color: var(--primary);
    }

    .tugas-empty__icon svg { width: 31px; height: 31px; }

    .tugas-empty__title {
      margin: 0;
      font-size: 17px;
      font-weight: 680;
      letter-spacing: -0.025em;
    }

    .tugas-empty__text {
      max-width: 320px;
      margin: 0;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.65;
    }

    .tugas-empty .btn { margin-top: 8px; }

    @media (min-width: 720px) {
      .tugas-item { padding: 16px; }
      .tugas-item__title { font-size: 15px; }
    }

    @media (max-width: 420px) {
      .tugas-stat { padding: 13px; }
      .tugas-stat__label { font-size: 10px; letter-spacing: 0.05em; }
      .tugas__toolbar .btn__label { display: none; }
      .tugas__toolbar .btn { width: 44px; height: 44px; padding: 0; }
      .tugas-item__delete { opacity: 0.8; }
    }
  `,

  async quickAdd(ctx) {
    const data = ctx.data('tasks');
    const values = await ctx.ui.form({
      title: 'Catat tugas cepat',
      description: 'Cukup tulis satu baris. Detail bisa diubah nanti di modul Tugas.',
      submitLabel: 'Simpan',
      cancelLabel: 'Batal',
      layout: 'sheet',
      className: 'quick-capture-dialog',
      fields: [
        {
          name: 'title',
          label: 'Apa yang perlu diingat?',
          type: 'text',
          placeholder: 'Contoh: baca halaman 42',
          required: true,
          maxlength: 120,
          autofocus: true,
        },
        {
          name: 'dueDate',
          label: 'Tenggat (opsional)',
          type: 'date',
          helper: 'Pengingat bisa diatur nanti di modul Tugas.',
        },
      ],
      validate: (formValues) => (
        formValues.title.trim().length < 2
          ? { title: 'Tulis minimal 2 karakter.' }
          : null
      ),
    });

    if (!values) return;

    try {
      await data.create({
        title: values.title.trim(),
        subject: '',
        dueDate: values.dueDate || null,
        remind: false,
        notes: '',
        schemaVersion: 1,
        done: false,
        completedAt: null,
      });
      ctx.ui.toast('Tugas cepat disimpan.', {
        type: 'success',
        action: {
          label: 'Buka Tugas',
          onClick: () => ctx.navigate('/modul/tugas'),
        },
      });
    } catch (error) {
      ctx.ui.toast(error.message, { type: 'error' });
    }
  },

  async getHomeSummary(ctx) {
    const tasks = await ctx.data('tasks').list();
    const active = tasks.filter((task) => !task.done);
    const overdue = active.filter((task) => (
      ctx.utils.describeDueDate(task.dueDate).state === 'overdue'
    ));

    return [{
      id: 'tugas-aktif',
      label: 'Tugas aktif',
      value: active.length,
      hint: active.length === 0
        ? 'Tidak ada tugas yang menunggu.'
        : overdue.length > 0
          ? `${overdue.length} tugas sudah lewat tenggat.`
          : 'Lihat tenggat di modul Tugas.',
      tone: overdue.length > 0 ? 'warning' : 'default',
      primary: true,
    }];
  },

  async getNotifications(ctx) {
    const tasks = await ctx.data('tasks').list();
    const active = tasks.filter((task) => !task.done);
    const overdue = active.filter((task) => (
      ctx.utils.describeDueDate(task.dueDate).state === 'overdue'
    ));
    const dueToday = active.filter((task) => (
      ctx.utils.describeDueDate(task.dueDate).state === 'today'
    ));
    const notifications = [];

    if (overdue.length > 0) {
      notifications.push({
        id: 'tugas-overdue',
        icon: 'alert',
        title: overdue.length === 1
          ? '1 tugas lewat tenggat'
          : `${overdue.length} tugas lewat tenggat`,
        text: overdue.length === 1
          ? `“${overdue[0].title}” perlu segera diselesaikan.`
          : 'Buka modul Tugas untuk melihat daftar yang perlu diselesaikan.',
        tone: 'danger',
        path: '/modul/tugas',
      });
    }

    if (dueToday.length > 0) {
      notifications.push({
        id: 'tugas-today',
        icon: 'calendar',
        title: dueToday.length === 1
          ? '1 tugas jatuh tempo hari ini'
          : `${dueToday.length} tugas jatuh tempo hari ini`,
        text: dueToday.length === 1
          ? `“${dueToday[0].title}” harus selesai hari ini.`
          : 'Selesaikan atau perbarui tenggatnya hari ini.',
        tone: 'warning',
        path: '/modul/tugas',
      });
    }

    return notifications;
  },

  async mount(ctx, container) {
    const data = ctx.data('tasks');
    const reminderLog = ctx.data('reminder_log');
    const ui = ctx.ui;
    const utils = ctx.utils;

    let tasks = [];
    let currentFilter = 'active';
    let loading = true;
    let reminderSyncSequence = 0;

    const wrapper = el('div', { class: 'tugas' });

    const stats = el('div', { class: 'tugas__stats', 'aria-label': 'Statistik tugas' });
    const activeValue = el('p', { class: 'tugas-stat__value', text: '0' });
    const overdueValue = el('p', { class: 'tugas-stat__value', text: '0' });
    const completedValue = el('p', { class: 'tugas-stat__value', text: '0' });

    stats.append(
      el('article', { class: 'tugas-stat' },
        el('p', { class: 'tugas-stat__label', text: 'Aktif' }),
        activeValue,
      ),
      el('article', { class: 'tugas-stat tugas-stat--warning' },
        el('p', { class: 'tugas-stat__label', text: 'Terlambat' }),
        overdueValue,
      ),
      el('article', { class: 'tugas-stat tugas-stat--success' },
        el('p', { class: 'tugas-stat__label', text: 'Selesai' }),
        completedValue,
      ),
    );

    const filters = el('div', {
      class: 'tugas-filters',
      role: 'group',
      'aria-label': 'Filter daftar tugas',
    });
    const filterButtons = new Map();

    for (const filter of [
      { value: 'active', label: 'Aktif' },
      { value: 'done', label: 'Selesai' },
      { value: 'all', label: 'Semua' },
    ]) {
      const count = el('span', { class: 'tugas-filter__count', text: '0' });
      const button = el('button', {
        class: 'tugas-filter',
        type: 'button',
        'aria-pressed': String(filter.value === currentFilter),
        on: {
          click: () => {
            currentFilter = filter.value;
            refreshFilterButtons();
            renderList();
          },
        },
      }, filter.label, count);
      filterButtons.set(filter.value, { button, count });
      filters.append(button);
    }

    const addButton = el('button', {
      class: 'btn btn--primary',
      type: 'button',
      html: `${PLUS_ICON}<span class="btn__label">Tugas baru</span>`,
      'aria-label': 'Tambah tugas baru',
      on: { click: () => openTaskForm() },
    });

    const reminderButton = el('button', {
      class: 'btn btn--secondary tugas__reminder',
      type: 'button',
      html: `${BELL_ICON}<span class="btn__label">Pengingat</span><span class="tugas__reminder-state" aria-hidden="true"></span>`,
      'aria-label': 'Atur pengingat tenggat',
    });
    reminderButton.addEventListener('click', openReminderDialog);
    const toolbarActions = el('div', { class: 'tugas__actions' }, reminderButton, addButton);

    const loadingState = el('div', { class: 'tugas-loading', 'aria-hidden': 'true' },
      el('span', { class: 'skeleton skeleton--task' }),
      el('span', { class: 'skeleton skeleton--task' }),
      el('span', { class: 'skeleton skeleton--task' }),
    );

    const list = el('ul', { class: 'tugas-list', 'aria-label': 'Daftar tugas' });
    const listRegion = el('div', { 'aria-live': 'polite' });

    wrapper.append(
      stats,
      el('div', { class: 'tugas__toolbar' }, filters, toolbarActions),
      loadingState,
      listRegion,
    );
    container.replaceChildren(wrapper);

    function refreshStats() {
      const active = tasks.filter((task) => !task.done);
      const overdue = active.filter((task) => (
        utils.describeDueDate(task.dueDate).state === 'overdue'
      ));
      activeValue.textContent = String(active.length);
      overdueValue.textContent = String(overdue.length);
      completedValue.textContent = String(tasks.length - active.length);
    }

    function refreshFilterButtons() {
      for (const [value, { button, count }] of filterButtons) {
        button.setAttribute('aria-pressed', String(value === currentFilter));
        let total = 0;
        if (value === 'active') total = tasks.filter((task) => !task.done).length;
        else if (value === 'done') total = tasks.filter((task) => task.done).length;
        else total = tasks.length;
        count.textContent = String(total);
      }
    }

    function scheduledTaskCount() {
      return notifications.scheduledIds.filter((id) => id.startsWith('tugas:')).length;
    }

    function updateReminderButton() {
      const permission = notifications.permission;
      const count = permission === 'granted' ? scheduledTaskCount() : 0;
      reminderButton.dataset.state = permission === 'granted'
        ? 'on'
        : permission === 'denied'
          ? 'blocked'
          : 'off';

      const label = permission === 'granted'
        ? count > 0
          ? `Pengingat aktif, ${count} jadwal`
          : 'Pengingat aktif'
        : permission === 'denied'
          ? 'Notifikasi diblokir'
          : 'Atur pengingat tenggat';
      reminderButton.setAttribute('aria-label', label);
      reminderButton.title = label;
    }

    function reminderBody(task) {
      const difference = utils.daysFromToday(task.dueDate);
      if (difference === 0) return `"${task.title}" jatuh tempo hari ini.`;
      if (difference === 1) return `"${task.title}" jatuh tempo besok.`;
      return `"${task.title}" ${utils.describeDueDate(task.dueDate).label.toLowerCase()}.`;
    }

    function reminderUrl() {
      return new URL('./#/modul/tugas', document.baseURI).href;
    }

    async function syncReminders() {
      const sequence = ++reminderSyncSequence;
      notifications.cancelAll('tugas:');
      updateReminderButton();

      if (!notifications.canNotify || ctx.signal.aborted) return;

      let logs = [];
      try {
        logs = await reminderLog.list();
      } catch (error) {
        console.warn('[Tugas] Riwayat pengingat tidak dapat dibaca.', error);
      }
      if (ctx.signal.aborted || sequence !== reminderSyncSequence) return;

      const notifiedKeys = new Set(
        logs.map((row) => row?.key).filter((key) => typeof key === 'string'),
      );
      const now = new Date();
      const todayKey = utils.toDateKey(now);
      const horizon = new Date(now.getTime() + REMINDER_HORIZON_MS);

      for (const task of tasks) {
        if (task.done || task.remind === false || !task.dueDate) continue;
        const due = utils.parseDateKey(task.dueDate);
        if (!due || notifiedKeys.has(`${task.id}:${task.dueDate}`)) continue;

        due.setHours(REMINDER_HOUR, REMINDER_MINUTE, 0, 0);
        let at = due;
        if (at.getTime() <= now.getTime()) {
          // Tugas yang jatuh tempo hari ini tetap diingatkan sekali setelah
          // aplikasi dibuka, tanpa menunggu pukul 07.30 besok.
          if (task.dueDate !== todayKey) continue;
          at = new Date(now.getTime() + REMINDER_IMMEDIATE_DELAY_MS);
        }
        if (at > horizon) continue;

        const key = `${task.id}:${task.dueDate}`;
        notifications.schedule({
          id: `tugas:${key}`,
          at,
          title: task.subject ? `Tenggat ${task.subject}` : 'Tenggat tugas',
          body: reminderBody(task),
          tag: `tugas:${key}`,
          data: { url: reminderUrl(), taskId: task.id },
          onShown: async () => {
            try {
              await reminderLog.create({
                key,
                taskId: task.id,
                dueDate: task.dueDate,
                shownAt: new Date().toISOString(),
              });
            } catch (error) {
              console.warn('[Tugas] Status pengingat gagal disimpan.', error);
            }

            if (!ctx.signal.aborted) {
              ui.toast(`Pengingat: ${task.title}`, {
                type: 'info',
                duration: 5500,
              });
            }
          },
        });
      }

      updateReminderButton();
    }

    function openReminderDialog() {
      const content = el('div', { class: 'tugas-reminder-dialog' });
      let closed = false;

      const renderDialog = () => {
        if (closed) return;
        const permission = notifications.permission;
        const count = permission === 'granted' ? scheduledTaskCount() : 0;
        const state = permission === 'granted'
          ? 'on'
          : permission === 'denied'
            ? 'blocked'
            : 'off';
        const statusText = !notifications.supported
          ? 'Browser ini belum mendukung notifikasi web pada konteks saat ini.'
          : permission === 'denied'
            ? 'Izin notifikasi diblokir. Buka setelan situs di browser untuk mengizinkannya kembali.'
            : permission === 'granted'
              ? count > 0
                ? `${count} pengingat terjadwal untuk 14 hari ke depan.`
                : 'Izin aktif. Tambahkan tanggal tenggat agar pengingat dijadwalkan.'
              : 'Izinkan notifikasi agar pengingat tenggat bisa muncul.';

        const actions = el('div', { class: 'tugas-reminder-actions' });

        if (notifications.supported && permission === 'default') {
          const enableButton = el('button', {
            class: 'btn btn--primary',
            type: 'button',
            text: 'Aktifkan izin',
          });
          enableButton.addEventListener('click', async () => {
            enableButton.disabled = true;
            enableButton.textContent = 'Meminta…';
            const result = await notifications.requestPermission();
            await syncReminders();
            if (closed) return;
            renderDialog();
            ui.toast(
              result === 'granted'
                ? 'Notifikasi diizinkan. Pengingat akan dijadwalkan.'
                : 'Notifikasi belum diizinkan. Kamu bisa mencoba lagi lewat pengaturan situs.',
              { type: result === 'granted' ? 'success' : 'warning', duration: 5500 },
            );
          });
          actions.append(enableButton);
        }

        if (permission === 'granted') {
          const testButton = el('button', {
            class: 'btn btn--secondary',
            type: 'button',
            text: 'Kirim tes',
          });
          testButton.addEventListener('click', async () => {
            const result = await notifications.show({
              title: 'Pengingat tugas',
              body: 'Notifikasi uji berhasil. Pengingat tenggat akan muncul seperti ini.',
              tag: 'tugas:test',
              data: { url: reminderUrl() },
            });
            ui.toast(
              result.shown
                ? 'Notifikasi uji dikirim.'
                : 'Notifikasi tidak dapat ditampilkan. Periksa izin browser.',
              { type: result.shown ? 'success' : 'warning' },
            );
          });

          const refreshButton = el('button', {
            class: 'btn btn--ghost',
            type: 'button',
            text: 'Perbarui jadwal',
          });
          refreshButton.addEventListener('click', async () => {
            await syncReminders();
            if (!closed) renderDialog();
            ui.toast('Jadwal pengingat diperbarui.', { type: 'info' });
          });
          actions.append(testButton, refreshButton);
        }

        content.replaceChildren(
          el('div', { class: 'tugas-reminder-status', dataset: { state } },
            el('span', { class: 'tugas-reminder-status__dot', 'aria-hidden': 'true' }),
            el('div', { class: 'tugas-reminder-status__copy' },
              el('p', {
                class: 'tugas-reminder-status__title',
                text: `Notifikasi: ${notificationPermissionLabel(permission)}`,
              }),
              el('p', { class: 'tugas-reminder-status__text', text: statusText }),
            ),
          ),
          ...(actions.childElementCount > 0 ? [actions] : []),
          el('p', {
            class: 'tugas-reminder-note',
            text: 'Pengingat dijadwalkan pukul 07.30 pada tanggal tenggat. Timer berjalan selama aplikasi terbuka; browser tidak menjamin timer saat PWA ditutup.',
          }),
        );
      };

      renderDialog();
      void ui.dialog({
        title: 'Pengingat tenggat',
        description: 'Notifikasi lokal untuk tugas yang mendekati tenggat.',
        content,
        actions: [{ label: 'Tutup', variant: 'ghost' }],
      }).finally(() => {
        closed = true;
      });
    }

    function makeTaskItem(task) {
      const due = utils.describeDueDate(task.dueDate);
      const item = el('li', {
        class: ['tugas-item', task.done ? 'is-done' : ''].filter(Boolean).join(' '),
        dataset: { id: task.id },
      });

      const check = el('button', {
        class: 'tugas-item__check',
        type: 'button',
        role: 'checkbox',
        'aria-checked': String(Boolean(task.done)),
        'aria-label': task.done
          ? `Tandai "${task.title}" belum selesai`
          : `Tandai "${task.title}" selesai`,
        html: CHECK_ICON,
      });
      check.addEventListener('click', () => toggleTask(task));

      const main = el('button', {
        class: 'tugas-item__main',
        type: 'button',
        'aria-label': `Ubah tugas "${task.title}"`,
      });
      main.append(el('span', { class: 'tugas-item__title', text: task.title }));

      const meta = el('span', { class: 'tugas-item__meta' });
      if (task.subject) {
        meta.append(el('span', { class: 'task-chip task-chip--subject', text: task.subject }));
      }
      if (task.dueDate && !task.done) {
        const dueClass = due.state === 'overdue'
          ? 'task-chip--overdue'
          : due.state === 'today'
            ? 'task-chip--today'
            : due.state === 'soon'
              ? 'task-chip--soon'
              : '';
        meta.append(el('span', {
          class: ['task-chip', 'task-chip--due', dueClass].filter(Boolean).join(' '),
        }, el('span', { html: CALENDAR_ICON }), due.label));
      } else if (task.done) {
        meta.append(el('span', { class: 'task-chip', text: 'Selesai' }));
      }

      if (meta.childElementCount > 0) main.append(meta);
      main.addEventListener('click', () => openTaskForm(task));

      const removeButton = el('button', {
        class: 'tugas-item__delete',
        type: 'button',
        'aria-label': `Hapus tugas "${task.title}"`,
        html: TRASH_ICON,
      });
      removeButton.addEventListener('click', () => deleteTask(task));

      item.append(check, main, removeButton);
      return item;
    }

    function makeEmptyState() {
      const copy = currentFilter === 'active'
        ? {
          title: 'Tidak ada tugas aktif',
          text: 'Waktu yang lega. Kalau ada pekerjaan baru, tuliskan di sini sebelum lupa.',
        }
        : currentFilter === 'done'
          ? {
            title: 'Belum ada yang selesai',
            text: 'Tugas yang sudah dicentang akan muncul di sini sebagai pengingat progresmu.',
          }
          : {
            title: 'Daftar tugas masih kosong',
            text: 'Mulai dari satu tugas kecil. Kamu tidak perlu menyelesaikan semuanya sekaligus.',
          };

      const empty = el('div', { class: 'tugas-empty' },
        el('span', { class: 'tugas-empty__icon', html: EMPTY_ICON }),
        el('h3', { class: 'tugas-empty__title', text: copy.title }),
        el('p', { class: 'tugas-empty__text', text: copy.text }),
      );

      if (currentFilter !== 'done') {
        empty.append(el('button', {
          class: 'btn btn--secondary',
          type: 'button',
          html: `${PLUS_ICON}<span>Tambah tugas pertama</span>`,
          on: { click: () => openTaskForm() },
        }));
      }

      return empty;
    }

    function renderList() {
      const filtered = tasks.filter((task) => {
        if (currentFilter === 'active') return !task.done;
        if (currentFilter === 'done') return task.done;
        return true;
      });

      list.replaceChildren(...sortTasks(filtered).map(makeTaskItem));
      listRegion.replaceChildren();

      if (!loading && filtered.length === 0) {
        listRegion.append(makeEmptyState());
      } else {
        listRegion.append(list);
      }
    }

    async function refresh({ announce = false } = {}) {
      try {
        tasks = await data.list();
        if (ctx.signal.aborted) return;
        loading = false;
        loadingState.hidden = true;
        refreshStats();
        refreshFilterButtons();
        renderList();
        if (announce) {
          listRegion.setAttribute('aria-busy', 'false');
        }
        syncReminders().catch((error) => {
          console.warn('[Tugas] Sinkronisasi pengingat gagal.', error);
        });
      } catch (error) {
        console.error('[Tugas] Gagal memuat data.', error);
        if (!ctx.signal.aborted) {
          ui.toast('Tugas tidak dapat dimuat dari penyimpanan lokal.', { type: 'error' });
        }
      }
    }

    async function toggleTask(task) {
      try {
        const nextDone = !task.done;
        await data.update(task.id, {
          done: nextDone,
          completedAt: nextDone ? new Date().toISOString() : null,
        });

        if (ctx.signal.aborted) return;
        await refresh();

        if (nextDone) {
          ui.toast('Tugas ditandai selesai.', {
            type: 'success',
            duration: 5000,
            action: {
              label: 'Urungkan',
              onClick: async () => {
                try {
                  await data.update(task.id, { done: false, completedAt: null });
                  if (!ctx.signal.aborted) await refresh();
                } catch (error) {
                  ui.toast(error.message, { type: 'error' });
                }
              },
            },
          });
        }
      } catch (error) {
        ui.toast(error.message, { type: 'error' });
      }
    }

    async function deleteTask(task) {
      const approved = await ui.confirm({
        title: 'Hapus tugas?',
        message: `"${task.title}" akan dihapus dari perangkat ini. Kamu masih bisa mengurungkannya lewat notifikasi.`,
        confirmLabel: 'Hapus tugas',
        cancelLabel: 'Batal',
        danger: true,
      });
      if (!approved || ctx.signal.aborted) return;

      try {
        await data.remove(task.id);
        if (ctx.signal.aborted) return;
        await refresh();

        const snapshot = {
          title: task.title,
          subject: task.subject ?? '',
          dueDate: task.dueDate ?? null,
          remind: task.remind !== false,
          notes: task.notes ?? '',
          done: Boolean(task.done),
          completedAt: task.completedAt ?? null,
          schemaVersion: 1,
        };

        ui.toast('Tugas dihapus.', {
          type: 'info',
          duration: 6500,
          action: {
            label: 'Urungkan',
            onClick: async () => {
              try {
                await data.create(snapshot);
                if (!ctx.signal.aborted) await refresh();
                ui.toast('Tugas dipulihkan.', { type: 'success' });
              } catch (error) {
                ui.toast(error.message, { type: 'error' });
              }
            },
          },
        });
      } catch (error) {
        ui.toast(error.message, { type: 'error' });
      }
    }

    async function openTaskForm(task = null) {
      if (ctx.signal.aborted) return;
      const editing = Boolean(task);

      const values = await ui.form({
        title: editing ? 'Ubah tugas' : 'Tugas baru',
        description: editing
          ? 'Perbarui detail tugas atau tenggatnya.'
          : 'Tulis sekonkret mungkin agar kamu tahu langkah pertamanya.',
        submitLabel: editing ? 'Simpan perubahan' : 'Tambahkan tugas',
        cancelLabel: 'Batal',
        initialValues: {
          title: task?.title ?? '',
          subject: task?.subject ?? '',
          dueDate: task?.dueDate ?? '',
          remind: task?.remind !== false,
          notes: task?.notes ?? '',
        },
        fields: [
          {
            name: 'title',
            label: 'Judul tugas',
            type: 'text',
            placeholder: 'Contoh: Latihan soal larik',
            required: true,
            maxlength: 120,
            autofocus: true,
          },
          {
            name: 'subject',
            label: 'Mata pelajaran',
            type: 'text',
            placeholder: 'Contoh: PPLG',
            maxlength: 50,
            half: true,
          },
          {
            name: 'dueDate',
            label: 'Tenggat',
            type: 'date',
            half: true,
            helper: 'Boleh dikosongkan.',
          },
          {
            name: 'remind',
            label: 'Ingatkan saya pada pagi hari tenggat',
            type: 'checkbox',
            helper: 'Membutuhkan izin notifikasi. Pengingat berjalan selama aplikasi terbuka.',
          },
          {
            name: 'notes',
            label: 'Catatan',
            type: 'textarea',
            placeholder: 'Langkah kecil, sumber belajar, atau detail lain…',
            maxlength: 500,
            rows: 3,
            helper: 'Tersimpan lokal, tidak dikirim ke mana pun.',
          },
        ],
        validate: (formValues) => {
          if (formValues.title.trim().length < 2) {
            return { title: 'Judul minimal 2 karakter.' };
          }
          return null;
        },
      });

      if (!values || ctx.signal.aborted) return;

      const payload = {
        title: values.title.trim(),
        subject: values.subject.trim(),
        dueDate: values.dueDate || null,
        remind: Boolean(values.remind),
        notes: values.notes.trim(),
        schemaVersion: 1,
      };

      try {
        if (editing) {
          await data.update(task.id, payload);
        } else {
          await data.create({
            ...payload,
            done: false,
            completedAt: null,
          });
        }

        if (ctx.signal.aborted) return;
        await refresh();
        ui.toast(editing ? 'Perubahan tugas disimpan.' : 'Tugas baru ditambahkan.', {
          type: 'success',
        });
      } catch (error) {
        ui.toast(error.message, { type: 'error' });
      }
    }

    ctx.on(EVENTS.DATA_CHANGED, (event) => {
      if (event?.moduleId !== 'tugas' || event.collection !== 'tasks') return;
      refresh().catch((error) => {
        console.warn('[Tugas] Gagal menyegarkan daftar setelah data berubah.', error);
      });
    });

    ctx.onCleanup(() => {
      container.replaceChildren();
    });

    await refresh();
    return undefined;
  },
};
