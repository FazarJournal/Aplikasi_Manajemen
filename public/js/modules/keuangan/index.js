import { el } from '../../core/dom.js';
import { barChart, donutChart } from '../../core/chart.js';

const PLUS_ICON = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
const WALLET_ICON = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H19a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 17.5v-10Z"/><path d="M4 8h15"/><path d="M16 13h2"/></svg>';
const TRASH_ICON = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>';
const PENCIL_ICON = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L20 8l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/></svg>';
const ARROW_DOWN_ICON = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v16m-6-6 6 6 6-6"/></svg>';
const ARROW_UP_ICON = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20V4M6 10l6-6 6 6"/></svg>';
const TRANSFER_ICON = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h13m-4-4 4 4-4 4"/><path d="M20 16H7m4-4-4 4 4 4"/></svg>';
const CASH_ICON = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6" width="18" height="13" rx="3"/><path d="M7 6V4h10v2M3 11h18"/><circle cx="12" cy="15" r="2"/></svg>';
const EWALLET_ICON = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M10 18.5h4"/><path d="M9 7h6"/></svg>';
const BANK_ICON = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 9 9-5 9 5"/><path d="M4 9h16M6 9v8M10 9v8M14 9v8M18 9v8M4 20h16"/></svg>';
const EMPTY_ICON = '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="7" y="12" width="34" height="27" rx="6"/><path d="M7 19h34M14 12V8h20v4"/><path d="M15 28h9M15 34h16"/></svg>';

const ACCOUNT_KINDS = Object.freeze({
  cash: { label: 'Tunai', icon: CASH_ICON },
  ewallet: { label: 'E-Wallet', icon: EWALLET_ICON },
  bank: { label: 'Bank', icon: BANK_ICON },
});

const KIND_ORDER = { cash: 0, ewallet: 1, bank: 2 };

const PERIODS = Object.freeze({
  'this-month': 'Bulan ini',
  'last-month': 'Bulan lalu',
  all: 'Semua',
});

const moneyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

const compactFormatter = new Intl.NumberFormat('id-ID', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const monthFormatter = new Intl.DateTimeFormat('id-ID', { month: 'short' });
const dayFormatter = new Intl.DateTimeFormat('id-ID', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

function rupiah(value) {
  return moneyFormatter.format(Number(value) || 0);
}

function compactRupiah(value) {
  return `Rp${compactFormatter.format(Number(value) || 0)}`;
}

const amountInputFormatter = new Intl.NumberFormat('id-ID', {
  maximumFractionDigits: 3,
  useGrouping: false,
});

/**
 * Nominal di formulir ditulis dalam ribuan agar nol tidak terlalu banyak.
 * `1` menjadi Rp1.000, `2,5` menjadi Rp2.500.
 */
function parseAmountInput(value) {
  const normalized = String(value ?? '').trim().replace(/\s+/g, '').replace(',', '.');
  if (!normalized) return Number.NaN;
  const number = Number(normalized);
  return Number.isFinite(number) ? Math.round(number * 1000) : Number.NaN;
}

function amountToInput(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return '';
  return amountInputFormatter.format(value / 1000);
}

function amountPreview(value) {
  const amount = parseAmountInput(value);
  if (!Number.isFinite(amount)) {
    return String(value ?? '').trim() ? 'Nominal belum valid.' : '';
  }
  return `Tersimpan sebagai ${rupiah(amount)}`;
}

function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function previousMonthKey(date = new Date()) {
  const previous = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  return monthKey(previous);
}

function inPeriod(transaction, period, now = new Date()) {
  if (period === 'all') return true;
  const wanted = period === 'last-month' ? previousMonthKey(now) : monthKey(now);
  return String(transaction.date ?? '').startsWith(wanted);
}

function periodLabel(period) {
  return PERIODS[period] ?? PERIODS['this-month'];
}

function accountKind(kind) {
  return ACCOUNT_KINDS[kind] ?? ACCOUNT_KINDS.cash;
}

function sortAccounts(accounts) {
  return [...accounts].sort((left, right) => (
    (KIND_ORDER[left.kind] ?? 9) - (KIND_ORDER[right.kind] ?? 9)
    || String(left.name).localeCompare(String(right.name), 'id')
  ));
}

function sortTransactions(transactions) {
  return [...transactions].sort((left, right) => {
    const dateOrder = String(right.date ?? '').localeCompare(String(left.date ?? ''));
    if (dateOrder !== 0) return dateOrder;
    return String(right.createdAt ?? '').localeCompare(String(left.createdAt ?? ''));
  });
}

function calculateBalances(accounts, transactions) {
  const balances = new Map(accounts.map((account) => [
    account.id,
    Number(account.openingBalance) || 0,
  ]));

  for (const transaction of transactions) {
    const amount = Number(transaction.amount) || 0;
    if (transaction.type === 'income') {
      balances.set(transaction.accountId, (balances.get(transaction.accountId) ?? 0) + amount);
    } else if (transaction.type === 'expense') {
      balances.set(transaction.accountId, (balances.get(transaction.accountId) ?? 0) - amount);
    } else if (transaction.type === 'transfer') {
      balances.set(transaction.accountId, (balances.get(transaction.accountId) ?? 0) - amount);
      balances.set(transaction.toAccountId, (balances.get(transaction.toAccountId) ?? 0) + amount);
    }
  }

  return balances;
}

function totalsFor(transactions, period, now = new Date()) {
  let income = 0;
  let expense = 0;

  for (const transaction of transactions) {
    if (!inPeriod(transaction, period, now)) continue;
    if (transaction.type === 'income') income += Number(transaction.amount) || 0;
    else if (transaction.type === 'expense') expense += Number(transaction.amount) || 0;
  }

  return { income, expense, net: income - expense };
}

function walletBreakdown(transactions, period, accounts, now = new Date()) {
  const names = new Map(accounts.map((account) => [account.id, account.name]));
  const amounts = new Map();

  for (const transaction of transactions) {
    if (transaction.type !== 'expense' || !inPeriod(transaction, period, now)) continue;
    const label = names.get(transaction.accountId) ?? 'Dompet terhapus';
    amounts.set(label, (amounts.get(label) ?? 0) + (Number(transaction.amount) || 0));
  }

  const sorted = [...amounts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value);

  if (sorted.length <= 8) return sorted;

  const visible = sorted.slice(0, 7);
  const rest = sorted.slice(7).reduce((sum, item) => sum + item.value, 0);
  if (rest > 0) visible.push({ label: 'Dompet lain', value: rest });
  return visible;
}

function monthlyGroups(transactions, now = new Date(), count = 6) {
  const groups = [];
  for (let index = count - 1; index >= 0; index -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const key = monthKey(date);
    const monthTransactions = transactions.filter((transaction) => (
      String(transaction.date ?? '').startsWith(key)
    ));
    const totals = totalsFor(monthTransactions, 'all', now);
    groups.push({
      label: monthFormatter.format(date),
      values: {
        income: totals.income,
        expense: totals.expense,
      },
    });
  }
  return groups;
}

function dateLabel(value, utils) {
  const difference = utils.daysFromToday(value);
  if (difference === 0) return 'Hari ini';
  if (difference === -1) return 'Kemarin';
  const parsed = utils.parseDateKey(value);
  if (!parsed) return value || 'Tanpa tanggal';
  return dayFormatter.format(parsed);
}

function transactionTypeMeta(type) {
  if (type === 'income') {
    return { label: 'Pemasukan', icon: ARROW_DOWN_ICON, className: 'income' };
  }
  if (type === 'expense') {
    return { label: 'Pengeluaran', icon: ARROW_UP_ICON, className: 'expense' };
  }
  return { label: 'Pindah dana', icon: TRANSFER_ICON, className: 'transfer' };
}

function safeString(value) {
  return typeof value === 'string' ? value : '';
}

export default {
  id: 'keuangan',
  name: 'Keuangan',
  description: 'Catat pemasukan, pengeluaran, dan pindah dana antar dompet.',
  version: '1.0.0',
  order: 30,

  icon: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H19a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 17.5v-10Z"/><path d="M4 8h15"/><circle cx="16.5" cy="13" r="1"/></svg>',

  styles: `
    .keuangan {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .keuangan-hero {
      position: relative;
      isolation: isolate;
      overflow: hidden;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 18px;
      padding: 21px;
      border: 1px solid rgb(var(--brand-rgb) / 0.16);
      border-radius: var(--radius-xl);
      background:
        radial-gradient(ellipse 58% 95% at 100% 0%, rgb(var(--brand-rgb) / 0.13), transparent 66%),
        linear-gradient(145deg, rgb(var(--brand-strong-rgb) / 0.14), rgba(10, 22, 15, 0.76));
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
    }

    .keuangan-hero::after {
      content: "";
      position: absolute;
      z-index: -1;
      right: -70px;
      top: -100px;
      width: 220px;
      height: 220px;
      border-radius: 999px;
      background: rgb(var(--brand-rgb) / 0.11);
      filter: blur(55px);
    }

    .keuangan-hero__eyebrow {
      margin-bottom: 7px;
      color: var(--muted);
      font-size: 10px;
      font-weight: 720;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }

    .keuangan-hero__value {
      color: var(--text);
      font-size: clamp(30px, 7vw, 43px);
      font-weight: 740;
      line-height: 1.06;
      letter-spacing: -0.055em;
      font-variant-numeric: tabular-nums;
    }

    .keuangan-hero__meta {
      margin-top: 7px;
      color: var(--muted);
      font-size: 11.5px;
    }

    .keuangan-hero__actions {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }

    .keuangan-stats {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 9px;
    }

    .keuangan-stat {
      padding: 13px 14px;
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      background: linear-gradient(160deg, rgb(var(--ink-rgb) / 0.042), rgb(var(--ink-rgb) / 0.014));
    }

    .keuangan-stat__label {
      display: flex;
      align-items: center;
      gap: 5px;
      margin-bottom: 7px;
      color: var(--muted);
      font-size: 9.5px;
      font-weight: 720;
      letter-spacing: 0.075em;
      text-transform: uppercase;
    }

    .keuangan-stat__value {
      color: var(--text);
      font-size: clamp(14px, 3.8vw, 20px);
      font-weight: 700;
      letter-spacing: -0.04em;
      line-height: 1.15;
      font-variant-numeric: tabular-nums;
    }

    .keuangan-stat--income .keuangan-stat__value { color: var(--success); }
    .keuangan-stat--expense .keuangan-stat__value { color: var(--danger); }

    .keuangan-controls {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 10px;
    }

    .keuangan-period {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      color: var(--muted);
      font-size: 11.5px;
    }

    .keuangan-periods {
      width: fit-content;
      max-width: 100%;
    }

    .keuangan-tabs {
      display: flex;
      gap: 3px;
      width: fit-content;
      padding: 4px;
      border: 1px solid var(--border);
      border-radius: var(--radius-full);
      background: rgb(var(--ink-rgb) / 0.045);
    }

    .keuangan-tab {
      appearance: none;
      min-height: 44px;
      border: 0;
      padding: 9px 15px;
      border-radius: var(--radius-full);
      background: transparent;
      color: var(--muted);
      font: inherit;
      font-size: 12.5px;
      font-weight: 650;
      cursor: pointer;
      transition: background var(--transition), color var(--transition);
    }

    .keuangan-tab:hover { color: var(--text); }

    .keuangan-tab[aria-selected="true"] {
      background: var(--surface-3);
      color: var(--text);
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.18);
    }

    .keuangan-panel {
      display: grid;
      gap: 14px;
      min-width: 0;
    }

    .keuangan-panel[hidden] { display: none; }

    .keuangan-panel__top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 10px;
    }

    .keuangan-filters {
      display: flex;
      gap: 3px;
      max-width: 100%;
      padding: 4px;
      overflow-x: auto;
      border: 1px solid var(--border);
      border-radius: var(--radius-full);
      background: rgb(var(--ink-rgb) / 0.045);
      scrollbar-width: none;
    }

    .keuangan-filters::-webkit-scrollbar { display: none; }

    .keuangan-filter {
      flex: none;
      appearance: none;
      min-height: 44px;
      border: 0;
      padding: 8px 12px;
      border-radius: var(--radius-full);
      background: transparent;
      color: var(--muted);
      font: inherit;
      font-size: 11.5px;
      font-weight: 650;
      cursor: pointer;
    }

    .keuangan-filter:hover { color: var(--text); }

    .keuangan-filter[aria-pressed="true"] {
      background: var(--surface-3);
      color: var(--text);
    }

    .keuangan-filters__count {
      margin-left: 3px;
      color: var(--muted);
      font-variant-numeric: tabular-nums;
    }

    .keuangan-wallets {
      display: flex;
      gap: 9px;
      padding-bottom: 2px;
      overflow-x: auto;
      scroll-snap-type: x proximity;
      scrollbar-width: thin;
    }

    .keuangan-wallet {
      display: flex;
      flex: 1 0 152px;
      align-items: center;
      gap: 10px;
      max-width: 240px;
      padding: 11px 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      background: linear-gradient(160deg, rgb(var(--ink-rgb) / 0.04), rgb(var(--ink-rgb) / 0.012));
      scroll-snap-align: start;
    }

    .keuangan-wallet__icon {
      display: grid;
      place-items: center;
      flex: none;
      width: 34px;
      height: 34px;
      border-radius: 10px;
      background: var(--primary-soft);
      color: var(--accent);
    }

    .keuangan-wallet--ewallet .keuangan-wallet__icon {
      background: rgb(var(--brand-rgb) / 0.09);
      color: var(--accent);
    }

    .keuangan-wallet--bank .keuangan-wallet__icon {
      background: var(--info-soft);
      color: var(--info);
    }

    .keuangan-wallet__icon .icon { width: 17px; height: 17px; }

    .keuangan-wallet__copy {
      display: grid;
      min-width: 0;
      gap: 2px;
    }

    .keuangan-wallet__name {
      overflow: hidden;
      color: var(--text-secondary);
      font-size: 11.5px;
      font-weight: 650;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .keuangan-wallet__balance {
      color: var(--text);
      font-size: 12.5px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.025em;
    }

    .keuangan-day {
      display: grid;
      gap: 6px;
    }

    .keuangan-day__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 1px 2px;
    }

    .keuangan-day__label {
      color: var(--muted);
      font-size: 10px;
      font-weight: 720;
      letter-spacing: 0.075em;
      text-transform: uppercase;
    }

    .keuangan-day__total {
      color: var(--subtle);
      font-size: 10px;
      font-variant-numeric: tabular-nums;
    }

    .keuangan-list {
      display: grid;
      gap: 7px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .keuangan-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 11px 11px;
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      background: linear-gradient(160deg, rgb(var(--ink-rgb) / 0.04), rgb(var(--ink-rgb) / 0.012));
      transition: border-color var(--transition), background var(--transition);
    }

    .keuangan-item:hover {
      border-color: var(--border-strong);
      background: linear-gradient(160deg, rgb(var(--ink-rgb) / 0.055), rgb(var(--ink-rgb) / 0.018));
    }

    .keuangan-item__type {
      display: grid;
      place-items: center;
      flex: none;
      width: 34px;
      height: 34px;
      border-radius: 11px;
      background: var(--surface-2);
      color: var(--muted);
    }

    .keuangan-item__type .icon { width: 16px; height: 16px; }
    .keuangan-item__type--income { background: var(--success-soft); color: var(--success); }
    .keuangan-item__type--expense { background: var(--danger-soft); color: var(--danger); }
    .keuangan-item__type--transfer { background: var(--primary-soft); color: var(--accent); }

    .keuangan-item__main {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex: 1;
      min-width: 0;
      padding: 0;
      border: 0;
      background: transparent;
      color: inherit;
      text-align: left;
      font: inherit;
      cursor: pointer;
    }

    .keuangan-item__main:focus-visible { outline: none; }

    .keuangan-item__copy {
      display: grid;
      min-width: 0;
      gap: 2px;
    }

    .keuangan-item__title {
      overflow: hidden;
      color: var(--text-secondary);
      font-size: 13px;
      font-weight: 640;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .keuangan-item__meta {
      overflow: hidden;
      color: var(--muted);
      font-size: 10.5px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .keuangan-item__amount {
      flex: none;
      color: var(--text);
      font-size: 12.5px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.025em;
      white-space: nowrap;
    }

    .keuangan-item__amount--income { color: var(--success); }
    .keuangan-item__amount--expense { color: var(--danger); }
    .keuangan-item__amount--transfer { color: var(--muted); font-weight: 620; }

    .keuangan-item__delete {
      display: grid;
      place-items: center;
      flex: none;
      width: 44px;
      height: 44px;
      padding: 0;
      border: 0;
      border-radius: 9px;
      background: transparent;
      color: var(--muted);
      cursor: pointer;
      opacity: 0.65;
    }

    .keuangan-item__delete:hover {
      background: var(--danger-soft);
      color: var(--danger);
      opacity: 1;
    }

    .keuangan-item__delete .icon { width: 15px; height: 15px; }

    .keuangan-empty {
      display: grid;
      justify-items: center;
      gap: 8px;
      padding: clamp(34px, 7vw, 56px) 20px;
      border: 1px dashed var(--border-strong);
      border-radius: var(--radius-xl);
      background: radial-gradient(circle at 50% 0%, rgb(var(--brand-rgb) / 0.07), transparent 58%);
      text-align: center;
    }

    .keuangan-empty__icon {
      display: grid;
      place-items: center;
      width: 54px;
      height: 54px;
      border: 1px solid var(--border);
      border-radius: 17px;
      background: var(--surface-2);
      color: var(--accent);
    }

    .keuangan-empty__icon svg { width: 29px; height: 29px; }

    .keuangan-empty__title {
      margin: 0;
      color: var(--text);
      font-size: 16px;
      font-weight: 680;
      letter-spacing: -0.025em;
    }

    .keuangan-empty__text {
      max-width: 330px;
      margin: 0;
      color: var(--muted);
      font-size: 12.5px;
      line-height: 1.6;
    }

    .keuangan-loading {
      display: grid;
      gap: 8px;
    }

    .keuangan-report {
      display: grid;
      gap: 14px;
    }

    .keuangan-report__summary {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }

    .keuangan-report-card {
      padding: 12px 13px;
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      background: rgb(var(--ink-rgb) / 0.022);
    }

    .keuangan-report-card__label {
      margin-bottom: 4px;
      color: var(--muted);
      font-size: 9px;
      font-weight: 720;
      letter-spacing: 0.07em;
      text-transform: uppercase;
    }

    .keuangan-report-card__value {
      color: var(--text);
      font-size: 14px;
      font-weight: 700;
      letter-spacing: -0.03em;
      font-variant-numeric: tabular-nums;
    }

    .keuangan-report__grid {
      display: grid;
      gap: 12px;
    }

    .keuangan-report-panel {
      min-width: 0;
      padding: 15px;
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      background: linear-gradient(160deg, rgb(var(--ink-rgb) / 0.035), rgb(var(--ink-rgb) / 0.01));
    }

    .keuangan-report-panel__title {
      margin-bottom: 3px;
      color: var(--text);
      font-size: 13px;
      font-weight: 680;
      letter-spacing: -0.015em;
    }

    .keuangan-report-panel__hint {
      margin-bottom: 12px;
      color: var(--muted);
      font-size: 10.5px;
      line-height: 1.5;
    }

    .keuangan-accounts {
      display: grid;
      gap: 8px;
    }

    .keuangan-account-row {
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 9px 10px;
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      background: rgb(var(--ink-rgb) / 0.022);
    }

    .keuangan-account-row__copy {
      display: grid;
      flex: 1;
      min-width: 0;
      gap: 2px;
    }

    .keuangan-account-row__name {
      color: var(--text-secondary);
      font-size: 12.5px;
      font-weight: 650;
    }

    .keuangan-account-row__meta {
      color: var(--muted);
      font-size: 10.5px;
      font-variant-numeric: tabular-nums;
    }

    .keuangan-account-row__actions {
      display: flex;
      gap: 4px;
    }

    .keuangan-icon-button {
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      padding: 0;
      border: 0;
      border-radius: 9px;
      background: transparent;
      color: var(--muted);
      cursor: pointer;
    }

    .keuangan-icon-button:hover { background: var(--surface-3); color: var(--text); }
    .keuangan-icon-button--danger:hover { background: var(--danger-soft); color: var(--danger); }
    .keuangan-icon-button .icon { width: 15px; height: 15px; }

    .keuangan-accounts__actions {
      display: flex;
      justify-content: flex-start;
      margin-top: 2px;
    }

    @media (min-width: 720px) {
      .keuangan-hero { padding: 26px 27px; }
      .keuangan-stats { gap: 10px; }
      .keuangan-stat { padding: 15px 17px; }
      .keuangan-report__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }

    @media (max-width: 480px) {
      .keuangan-hero { padding: 18px; }
      .keuangan-hero__actions { width: 100%; }
      .keuangan-hero__actions .btn { flex: 1; }
      .keuangan-stats { gap: 7px; }
      .keuangan-stat { padding: 11px 10px; }
      .keuangan-stat__label { font-size: 8.5px; }
      .keuangan-report__summary { gap: 6px; }
      .keuangan-report-card { padding: 10px 9px; }
      .keuangan-report-card__value { font-size: 12px; }
      .keuangan-item { padding: 10px 9px; }
      .keuangan-item__type { width: 31px; height: 31px; }
      .keuangan-item__delete { opacity: 0.8; }
    }
  `,

  async getHomeSummary(ctx) {
    const [accounts, transactions] = await Promise.all([
      ctx.data('accounts').list(),
      ctx.data('transactions').list(),
    ]);
    const balances = calculateBalances(accounts, transactions);
    const total = [...balances.values()].reduce((sum, value) => sum + value, 0);

    return [{
      id: 'keuangan-saldo',
      label: 'Total saldo',
      value: rupiah(total),
      hint: accounts.length === 0
        ? 'Tambahkan dompet pertamamu.'
        : `${accounts.length} dompet tercatat`,
      tone: total < 0 ? 'danger' : 'default',
      primary: true,
    }];
  },

  async mount(ctx, container) {
    const accountsRepo = ctx.data('accounts');
    const transactionsRepo = ctx.data('transactions');
    const ui = ctx.ui;
    const utils = ctx.utils;

    let accounts = [];
    let transactions = [];
    let period = 'this-month';
    let typeFilter = 'all';
    let activeTab = 'transactions';
    let loadSequence = 0;
    let loading = true;
    let disposed = false;

    const wrapper = el('div', { class: 'keuangan' });

    const totalValue = el('p', { class: 'keuangan-hero__value', text: rupiah(0) });
    const walletMeta = el('p', { class: 'keuangan-hero__meta', text: 'Belum ada dompet.' });
    const hero = el('section', { class: 'keuangan-hero' });
    const heroCopy = el('div', {},
      el('p', { class: 'keuangan-hero__eyebrow', text: 'Total saldo' }),
      totalValue,
      walletMeta,
    );
    const heroActions = el('div', { class: 'keuangan-hero__actions' });
    const addButton = el('button', {
      class: 'btn btn--primary',
      type: 'button',
      html: `${PLUS_ICON}<span class="btn__label">Catat</span>`,
      'aria-label': 'Catat transaksi keuangan',
    });
    const accountsButton = el('button', {
      class: 'btn btn--secondary',
      type: 'button',
      html: `${WALLET_ICON}<span class="btn__label">Dompet</span>`,
      'aria-label': 'Atur dompet',
    });
    heroActions.append(addButton, accountsButton);
    hero.append(heroCopy, heroActions);

    const incomeValue = el('p', { class: 'keuangan-stat__value', text: rupiah(0) });
    const expenseValue = el('p', { class: 'keuangan-stat__value', text: rupiah(0) });
    const netValue = el('p', { class: 'keuangan-stat__value', text: rupiah(0) });
    const stats = el('section', { class: 'keuangan-stats', 'aria-label': 'Ringkasan keuangan' },
      el('article', { class: 'keuangan-stat keuangan-stat--income' },
        el('p', { class: 'keuangan-stat__label', html: `${ARROW_DOWN_ICON}<span>Masuk</span>` }),
        incomeValue,
      ),
      el('article', { class: 'keuangan-stat keuangan-stat--expense' },
        el('p', { class: 'keuangan-stat__label', html: `${ARROW_UP_ICON}<span>Keluar</span>` }),
        expenseValue,
      ),
      el('article', { class: 'keuangan-stat' },
        el('p', { class: 'keuangan-stat__label', html: `${TRANSFER_ICON}<span>Selisih</span>` }),
        netValue,
      ),
    );

    const walletStrip = el('div', { class: 'keuangan-wallets', 'aria-label': 'Saldo dompet' });

    const periodButtons = new Map();
    const periodGroup = el('div', {
      class: 'keuangan-filters keuangan-periods',
      role: 'group',
      'aria-label': 'Pilih periode keuangan',
    });
    for (const [value, label] of Object.entries(PERIODS)) {
      const button = el('button', {
        class: 'keuangan-filter',
        type: 'button',
        'aria-pressed': String(value === period),
        text: label,
      });
      button.addEventListener('click', () => {
        if (period === value) return;
        period = value;
        for (const [periodValue, periodButton] of periodButtons) {
          periodButton.setAttribute('aria-pressed', String(periodValue === period));
        }
        renderSummary();
        renderTransactions();
        renderReport();
      });
      periodButtons.set(value, button);
      periodGroup.append(button);
    }

    const controls = el('div', { class: 'keuangan-controls' },
      el('div', { class: 'keuangan-period' },
        el('span', { text: 'Periode' }),
        periodGroup,
      ),
    );

    const tabButtons = new Map();
    const tabs = el('div', { class: 'keuangan-tabs', role: 'tablist', 'aria-label': 'Tampilan keuangan' });
    for (const { value, label } of [
      { value: 'transactions', label: 'Transaksi' },
      { value: 'reports', label: 'Laporan' },
    ]) {
      const button = el('button', {
        class: 'keuangan-tab',
        type: 'button',
        role: 'tab',
        'aria-selected': String(value === activeTab),
        'aria-controls': `keuangan-panel-${value}`,
        id: `keuangan-tab-${value}`,
        tabindex: value === activeTab ? '0' : '-1',
        text: label,
      });
      button.addEventListener('click', () => {
        activeTab = value;
        updateTabs();
      });
      tabButtons.set(value, button);
      tabs.append(button);
    }

    tabs.addEventListener('keydown', (event) => {
      const navigationKeys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
      if (!navigationKeys.includes(event.key)) return;
      event.preventDefault();
      const values = [...tabButtons.keys()];
      const currentIndex = values.indexOf(activeTab);
      let nextIndex = currentIndex;
      if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + values.length) % values.length;
      else if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % values.length;
      else if (event.key === 'Home') nextIndex = 0;
      else if (event.key === 'End') nextIndex = values.length - 1;
      activeTab = values[nextIndex];
      updateTabs();
      tabButtons.get(activeTab)?.focus();
    });

    const filterButtons = new Map();
    const filters = el('div', {
      class: 'keuangan-filters',
      role: 'group',
      'aria-label': 'Filter transaksi',
    });
    for (const filter of [
      { value: 'all', label: 'Semua' },
      { value: 'income', label: 'Masuk' },
      { value: 'expense', label: 'Keluar' },
      { value: 'transfer', label: 'Pindah' },
    ]) {
      const count = el('span', { class: 'keuangan-filters__count', text: '0' });
      const button = el('button', {
        class: 'keuangan-filter',
        type: 'button',
        'aria-pressed': String(filter.value === typeFilter),
      }, filter.label, count);
      button.addEventListener('click', () => {
        typeFilter = filter.value;
        updateFilters();
        renderTransactions();
      });
      filterButtons.set(filter.value, { button, count });
      filters.append(button);
    }

    const transactionList = el('div', { 'aria-live': 'polite' });
    const transactionPanel = el('section', {
      class: 'keuangan-panel',
      id: 'keuangan-panel-transactions',
      role: 'tabpanel',
      'aria-labelledby': 'keuangan-tab-transactions',
      tabindex: '0',
      hidden: activeTab !== 'transactions',
    },
      el('div', { class: 'keuangan-panel__top' }, filters),
      transactionList,
    );

    const reportSummary = el('div', { class: 'keuangan-report__summary' });
    const walletChart = el('div', { class: 'keuangan-report-panel' });
    const monthlyChart = el('div', { class: 'keuangan-report-panel' });
    const reportPeriodNote = el('span', { class: 'section-heading__note' });
    const reportPanel = el('section', {
      class: 'keuangan-panel keuangan-report',
      id: 'keuangan-panel-reports',
      role: 'tabpanel',
      'aria-labelledby': 'keuangan-tab-reports',
      tabindex: '0',
      hidden: activeTab !== 'reports',
    },
      el('div', { class: 'keuangan-panel__top' },
        el('div', {},
          el('p', { class: 'section-heading__eyebrow', text: 'Analisis' }),
          el('h2', { class: 'section-heading__title', text: 'Laporan keuangan' }),
        ),
        reportPeriodNote,
      ),
      reportSummary,
      el('div', { class: 'keuangan-report__grid' }, walletChart, monthlyChart),
    );

    const loadingState = el('div', { class: 'keuangan-loading', 'aria-hidden': 'true' },
      el('span', { class: 'skeleton skeleton--task' }),
      el('span', { class: 'skeleton skeleton--task' }),
      el('span', { class: 'skeleton skeleton--task' }),
    );

    wrapper.append(
      hero,
      stats,
      walletStrip,
      controls,
      tabs,
      loadingState,
      transactionPanel,
      reportPanel,
    );
    container.replaceChildren(wrapper);

    function updateTabs() {
      for (const [value, button] of tabButtons) {
        const selected = value === activeTab;
        button.setAttribute('aria-selected', String(selected));
        button.tabIndex = selected ? 0 : -1;
        const panel = document.querySelector(`#keuangan-panel-${value}`);
        if (panel) panel.hidden = !selected;
      }
      if (activeTab === 'reports') renderReport();
    }

    function updateFilters() {
      for (const [value, { button, count }] of filterButtons) {
        button.setAttribute('aria-pressed', String(value === typeFilter));
        const total = value === 'all'
          ? transactions.filter((transaction) => inPeriod(transaction, period)).length
          : transactions.filter((transaction) => (
            transaction.type === value && inPeriod(transaction, period)
          )).length;
        count.textContent = String(total);
      }
    }

    function renderSummary() {
      const balances = calculateBalances(accounts, transactions);
      const total = [...balances.values()].reduce((sum, value) => sum + value, 0);
      totalValue.textContent = rupiah(total);
      walletMeta.textContent = accounts.length === 0
        ? 'Belum ada dompet. Tambahkan dompet pertamamu.'
        : `${accounts.length} dompet aktif · saldo gabungan`;

      const totals = totalsFor(transactions, period);
      incomeValue.textContent = rupiah(totals.income);
      expenseValue.textContent = rupiah(totals.expense);
      netValue.textContent = rupiah(totals.net);
      netValue.style.color = totals.net < 0 ? 'var(--danger)' : 'var(--text)';
      reportPeriodNote.textContent = periodLabel(period);
      updateFilters();
    }

    function renderWallets() {
      const balances = calculateBalances(accounts, transactions);
      walletStrip.replaceChildren();

      if (accounts.length === 0) {
        walletStrip.append(el('p', { class: 'keuangan-empty__text', text: 'Belum ada dompet.' }));
        return;
      }

      for (const account of sortAccounts(accounts)) {
        const kind = accountKind(account.kind);
        walletStrip.append(el('div', {
          class: ['keuangan-wallet', `keuangan-wallet--${account.kind ?? 'cash'}`].join(' '),
        },
          el('span', { class: 'keuangan-wallet__icon', html: kind.icon }),
          el('span', { class: 'keuangan-wallet__copy' },
            el('span', { class: 'keuangan-wallet__name', text: account.name }),
            el('span', {
              class: 'keuangan-wallet__balance',
              text: rupiah(balances.get(account.id) ?? 0),
            }),
          ),
        ));
      }
    }

    function accountName(id) {
      return accounts.find((account) => account.id === id)?.name ?? 'Dompet terhapus';
    }

    function transactionHeading(transaction) {
      if (transaction.type === 'transfer') {
        return `${accountName(transaction.accountId)} → ${accountName(transaction.toAccountId)}`;
      }
      return safeString(transaction.note).trim() || transactionTypeMeta(transaction.type).label;
    }

    function transactionMeta(transaction) {
      if (transaction.type === 'transfer') {
        return safeString(transaction.note).trim() || 'Pindah dana';
      }
      return accountName(transaction.accountId);
    }

    function makeTransactionItem(transaction) {
      const type = transactionTypeMeta(transaction.type);
      const amount = Number(transaction.amount) || 0;
      const sign = transaction.type === 'income' ? '+' : transaction.type === 'expense' ? '−' : '';
      const amountClass = `keuangan-item__amount--${type.className}`;

      const item = el('li', { class: 'keuangan-item', dataset: { id: transaction.id } });
      item.append(el('span', {
        class: ['keuangan-item__type', `keuangan-item__type--${type.className}`].join(' '),
        html: type.icon,
      }));

      const main = el('button', {
        class: 'keuangan-item__main',
        type: 'button',
        'aria-label': `Ubah transaksi ${transactionHeading(transaction)}`,
      });
      main.append(
        el('span', { class: 'keuangan-item__copy' },
          el('span', { class: 'keuangan-item__title', text: transactionHeading(transaction) }),
          el('span', { class: 'keuangan-item__meta', text: transactionMeta(transaction) }),
        ),
        el('span', {
          class: ['keuangan-item__amount', amountClass].join(' '),
          text: `${sign}${rupiah(amount)}`,
        }),
      );
      main.addEventListener('click', () => openTransactionForm(transaction));

      const remove = el('button', {
        class: 'keuangan-item__delete',
        type: 'button',
        'aria-label': `Hapus transaksi ${transactionHeading(transaction)}`,
        title: `Hapus transaksi ${transactionHeading(transaction)}`,
        html: TRASH_ICON,
      });
      remove.addEventListener('click', () => deleteTransaction(transaction));

      item.append(main, remove);
      return item;
    }

    function makeEmptyState() {
      const empty = el('div', { class: 'keuangan-empty' },
        el('span', { class: 'keuangan-empty__icon', html: EMPTY_ICON }),
        el('h3', { class: 'keuangan-empty__title', text: 'Belum ada transaksi' }),
        el('p', {
          class: 'keuangan-empty__text',
          text: typeFilter === 'all' && period === 'all'
            ? 'Catat pemasukan, pengeluaran, atau pindahkan saldo antar dompet untuk mulai melihat laporan.'
            : 'Tidak ada transaksi pada filter ini. Coba periode atau jenis transaksi lain.',
        }),
      );

      if (typeFilter === 'all') {
        empty.append(el('button', {
          class: 'btn btn--secondary',
          type: 'button',
          html: `${PLUS_ICON}<span>Catat transaksi pertama</span>`,
          on: { click: () => openTransactionForm() },
        }));
      }
      return empty;
    }

    function renderTransactions() {
      const filtered = sortTransactions(transactions.filter((transaction) => {
        if (!inPeriod(transaction, period)) return false;
        return typeFilter === 'all' || transaction.type === typeFilter;
      }));

      if (loading) {
        transactionList.replaceChildren(loadingState);
        return;
      }

      if (filtered.length === 0) {
        transactionList.replaceChildren(makeEmptyState());
        return;
      }

      const groups = new Map();
      for (const transaction of filtered) {
        const key = transaction.date || dateKey(new Date(transaction.createdAt));
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(transaction);
      }

      const fragment = document.createDocumentFragment();
      for (const [key, items] of groups) {
        const dayNet = items.reduce((sum, item) => {
          if (item.type === 'income') return sum + (Number(item.amount) || 0);
          if (item.type === 'expense') return sum - (Number(item.amount) || 0);
          return sum;
        }, 0);

        const group = el('section', { class: 'keuangan-day' });
        group.append(el('div', { class: 'keuangan-day__head' },
          el('h3', { class: 'keuangan-day__label', text: dateLabel(key, utils) }),
          el('span', {
            class: 'keuangan-day__total',
            text: `${dayNet >= 0 ? '+' : '−'}${rupiah(Math.abs(dayNet))}`,
          }),
        ));
        const list = el('ul', { class: 'keuangan-list' });
        list.append(...items.map(makeTransactionItem));
        group.append(list);
        fragment.append(group);
      }

      transactionList.replaceChildren(fragment);
    }

    function renderReport() {
      const wallets = walletBreakdown(transactions, period, accounts);
      const totals = totalsFor(transactions, period);
      const expenseTransactions = transactions.filter((transaction) => (
        transaction.type === 'expense' && inPeriod(transaction, period)
      ));

      reportSummary.replaceChildren(
        el('div', { class: 'keuangan-report-card' },
          el('p', { class: 'keuangan-report-card__label', text: 'Pemasukan' }),
          el('p', { class: 'keuangan-report-card__value', text: rupiah(totals.income) }),
        ),
        el('div', { class: 'keuangan-report-card' },
          el('p', { class: 'keuangan-report-card__label', text: 'Pengeluaran' }),
          el('p', { class: 'keuangan-report-card__value', text: rupiah(totals.expense) }),
        ),
        el('div', { class: 'keuangan-report-card' },
          el('p', { class: 'keuangan-report-card__label', text: 'Rata-rata per transaksi' }),
          el('p', {
            class: 'keuangan-report-card__value',
            text: rupiah(expenseTransactions.length ? totals.expense / expenseTransactions.length : 0),
          }),
        ),
      );

      walletChart.replaceChildren(
        el('h3', { class: 'keuangan-report-panel__title', text: 'Pengeluaran per dompet' }),
        el('p', {
          class: 'keuangan-report-panel__hint',
          text: 'Dompet dengan pengeluaran terbesar muncul lebih dulu. Data mengikuti periode terpilih.',
        }),
        donutChart(wallets, {
          centerLabel: periodLabel(period),
          centerValue: compactRupiah(totals.expense),
          formatValue: rupiah,
          emptyMessage: 'Belum ada pengeluaran pada periode ini.',
          emptyHint: 'Catat pengeluaran untuk melihat komposisi per dompet.',
        }),
      );

      monthlyChart.replaceChildren(
        el('h3', { class: 'keuangan-report-panel__title', text: 'Enam bulan terakhir' }),
        el('p', {
          class: 'keuangan-report-panel__hint',
          text: 'Bandingkan arus masuk dan keluar setiap bulan.',
        }),
        barChart(monthlyGroups(transactions), {
          series: [
            { key: 'income', label: 'Masuk', color: '#34d399' },
            { key: 'expense', label: 'Keluar', color: '#fb7185' },
          ],
          formatValue: rupiah,
          formatAxis: (value) => compactFormatter.format(value),
          emptyMessage: 'Belum ada riwayat untuk digambarkan.',
          emptyHint: 'Grafik akan terisi setelah ada transaksi.',
        }),
      );
    }

    function renderAll() {
      loading = false;
      loadingState.hidden = true;
      renderSummary();
      renderWallets();
      renderTransactions();
      if (activeTab === 'reports') renderReport();
    }

    async function ensureAccounts() {
      let stored = await accountsRepo.list();
      if (stored.length > 0) return sortAccounts(stored);

      await Promise.all([
        accountsRepo.create({
          name: 'Tunai',
          kind: 'cash',
          openingBalance: 0,
          schemaVersion: 1,
        }),
        accountsRepo.create({
          name: 'E-Wallet',
          kind: 'ewallet',
          openingBalance: 0,
          schemaVersion: 1,
        }),
      ]);
      stored = await accountsRepo.list();
      return sortAccounts(stored);
    }

    async function refresh() {
      const sequence = ++loadSequence;
      try {
        const [storedAccounts, storedTransactions] = await Promise.all([
          ensureAccounts(),
          transactionsRepo.list(),
        ]);
        if (disposed || ctx.signal.aborted || sequence !== loadSequence) return;

        accounts = storedAccounts;
        transactions = storedTransactions;
        renderAll();
      } catch (error) {
        if (disposed || ctx.signal.aborted) return;
        console.error('[Keuangan] Gagal memuat data.', error);
        loading = false;
        loadingState.hidden = true;
        transactionList.replaceChildren(el('p', {
          class: 'inline-error',
          text: 'Data keuangan tidak dapat dimuat dari penyimpanan lokal.',
        }));
        ui.toast('Keuangan tidak dapat memuat data.', { type: 'error' });
      }
    }

    async function openTransactionForm(transaction = null) {
      if (disposed || ctx.signal.aborted) return;

      if (accounts.length === 0) {
        ui.toast('Tambahkan dompet terlebih dahulu.', { type: 'warning' });
        openAccountsDialog();
        return;
      }

      const editing = Boolean(transaction);

      const values = await ui.form({
        title: editing ? 'Ubah transaksi' : 'Catat transaksi',
        description: editing
          ? 'Perbarui nominal, dompet, catatan, atau tanggal transaksi.'
          : 'Pilih jenis transaksi, lalu isi detailnya. Saldo dompet dihitung otomatis.',
        submitLabel: editing ? 'Simpan perubahan' : 'Simpan transaksi',
        cancelLabel: 'Batal',
        initialValues: {
          type: transaction?.type ?? 'expense',
          amount: transaction ? amountToInput(transaction.amount) : '',
          accountId: transaction?.accountId ?? accounts[0]?.id ?? '',
          toAccountId: transaction?.toAccountId ?? '',
          date: transaction?.date ?? dateKey(),
          note: transaction?.note ?? '',
        },
        fields: [
          {
            name: 'type',
            label: 'Jenis transaksi',
            type: 'choice',
            required: true,
            options: [
              { value: 'expense', label: 'Pengeluaran' },
              { value: 'income', label: 'Pemasukan' },
              { value: 'transfer', label: 'Pindah dana' },
            ],
            helper: 'Pindah dana hanya memindahkan saldo antardompet.',
          },
          {
            name: 'amount',
            label: 'Nominal (ribuan)',
            type: 'text',
            required: true,
            inputmode: 'decimal',
            placeholder: 'Contoh: 25',
            preview: (formValues) => amountPreview(formValues.amount),
            helper: 'Tulis dalam ribuan: 1 → Rp1.000, 2,5 → Rp2.500.',
            autofocus: !editing,
          },
          {
            name: 'accountId',
            label: (formValues) => {
              if (formValues.type === 'income') return 'Dompet penerima';
              if (formValues.type === 'transfer') return 'Dari dompet';
              return 'Dompet';
            },
            type: 'select',
            required: true,
            options: sortAccounts(accounts).map((account) => ({
              value: account.id,
              label: `${account.name} · ${accountKind(account.kind).label}`,
            })),
            helper: (formValues) => {
              if (formValues.type === 'income') return 'Saldo masuk ke dompet ini.';
              if (formValues.type === 'transfer') return 'Saldo dikurangi dari dompet ini.';
              return 'Saldo berkurang dari dompet ini.';
            },
          },
          {
            name: 'toAccountId',
            label: 'Ke dompet',
            type: 'select',
            placeholder: 'Pilih dompet tujuan',
            options: sortAccounts(accounts).map((account) => ({
              value: account.id,
              label: `${account.name} · ${accountKind(account.kind).label}`,
            })),
            visibleWhen: (formValues) => formValues.type === 'transfer',
            helper: 'Saldo ditambahkan ke dompet tujuan.',
          },
          {
            name: 'note',
            label: 'Catatan',
            type: 'textarea',
            placeholder: 'Opsional, misalnya "Uang saku" atau "Beli alat tulis".',
            maxlength: 160,
            rows: 2,
            helper: 'Tulis keterangan singkat agar transaksi mudah dikenali.',
          },
          {
            name: 'date',
            label: 'Tanggal',
            type: 'date',
            required: true,
            helper: 'Otomatis hari ini. Ubah bila mencatat transaksi yang tertinggal.',
          },
        ],
        validate: (formValues) => {
          const errors = {};
          const amount = parseAmountInput(formValues.amount);
          if (!Number.isFinite(amount) || amount < 1000) {
            errors.amount = 'Nominal minimal Rp1.000. Tulis 1 untuk Rp1.000.';
          } else if (amount > 999_999_999) {
            errors.amount = 'Nominal terlalu besar.';
          }
          if (formValues.type === 'transfer') {
            if (!formValues.toAccountId) {
              errors.toAccountId = 'Pilih dompet tujuan.';
            } else if (formValues.toAccountId === formValues.accountId) {
              errors.toAccountId = 'Dompet asal dan tujuan harus berbeda.';
            }
          }
          return Object.keys(errors).length > 0 ? errors : null;
        },
      });

      if (!values || disposed || ctx.signal.aborted) return;

      const payload = {
        type: values.type,
        amount: parseAmountInput(values.amount),
        accountId: values.accountId,
        toAccountId: values.type === 'transfer' ? values.toAccountId : null,
        date: values.date,
        note: values.note.trim(),
        schemaVersion: 1,
      };

      try {
        if (editing) {
          await transactionsRepo.update(transaction.id, payload);
        } else {
          await transactionsRepo.create(payload);
        }
        if (disposed || ctx.signal.aborted) return;
        await refresh();
        ui.toast(editing ? 'Transaksi diperbarui.' : 'Transaksi dicatat.', { type: 'success' });
      } catch (error) {
        ui.toast(`Transaksi gagal disimpan: ${error.message}`, { type: 'error' });
      }
    }

    async function deleteTransaction(transaction) {
      const approved = await ui.confirm({
        title: 'Hapus transaksi?',
        message: `${transactionHeading(transaction)} sebesar ${rupiah(transaction.amount)} akan dihapus. Saldo dompet ikut dihitung ulang.`,
        confirmLabel: 'Hapus transaksi',
        cancelLabel: 'Batal',
        danger: true,
      });
      if (!approved || disposed || ctx.signal.aborted) return;

      try {
        await transactionsRepo.remove(transaction.id);
        if (disposed || ctx.signal.aborted) return;
        await refresh();

        const snapshot = {
          type: transaction.type,
          amount: transaction.amount,
          accountId: transaction.accountId,
          toAccountId: transaction.toAccountId ?? null,
          category: transaction.category ?? '',
          date: transaction.date,
          note: transaction.note ?? '',
          schemaVersion: 1,
        };

        ui.toast('Transaksi dihapus.', {
          type: 'info',
          duration: 6500,
          action: {
            label: 'Urungkan',
            onClick: async () => {
              try {
                await transactionsRepo.create(snapshot);
                if (!ctx.signal.aborted) await refresh();
                ui.toast('Transaksi dipulihkan.', { type: 'success' });
              } catch (error) {
                ui.toast(error.message, { type: 'error' });
              }
            },
          },
        });
      } catch (error) {
        ui.toast(`Transaksi gagal dihapus: ${error.message}`, { type: 'error' });
      }
    }

    async function openAccountForm(account = null) {
      const editing = Boolean(account);
      const values = await ui.form({
        title: editing ? 'Ubah dompet' : 'Tambah dompet',
        description: editing
          ? 'Ubah nama, jenis, atau saldo awal dompet.'
          : 'Pisahkan uang tunai, e-wallet, atau rekening bank agar saldo mudah dilacak.',
        submitLabel: editing ? 'Simpan dompet' : 'Tambahkan dompet',
        cancelLabel: 'Batal',
        initialValues: {
          name: account?.name ?? '',
          kind: account?.kind ?? 'cash',
          openingBalance: account ? amountToInput(account.openingBalance) : '',
        },
        fields: [
          {
            name: 'name',
            label: 'Nama dompet',
            type: 'text',
            required: true,
            maxlength: 30,
            placeholder: 'Contoh: Dompet sekolah',
            autofocus: true,
          },
          {
            name: 'kind',
            label: 'Jenis dompet',
            type: 'choice',
            options: Object.entries(ACCOUNT_KINDS).map(([value, meta]) => ({
              value,
              label: meta.label,
            })),
          },
          {
            name: 'openingBalance',
            label: 'Saldo awal (ribuan)',
            type: 'text',
            inputmode: 'decimal',
            placeholder: 'Contoh: 50',
            preview: (formValues) => amountPreview(formValues.openingBalance),
            helper: 'Saldo sebelum transaksi pertama. Tulis 50 untuk Rp50.000.',
          },
        ],
        validate: (formValues) => {
          const name = formValues.name.trim();
          if (name.length < 2) return { name: 'Nama minimal 2 karakter.' };
          const duplicate = accounts.some((item) => (
            item.id !== account?.id && item.name.toLowerCase() === name.toLowerCase()
          ));
          if (duplicate) return { name: 'Nama dompet sudah dipakai.' };
          const openingBalance = formValues.openingBalance === '' || formValues.openingBalance == null
            ? 0
            : parseAmountInput(formValues.openingBalance);
          if (!Number.isFinite(openingBalance) || openingBalance < 0) {
            return { openingBalance: 'Saldo awal belum valid.' };
          }
          if (openingBalance > 999_999_999) {
            return { openingBalance: 'Saldo awal terlalu besar.' };
          }
          return null;
        },
      });

      if (!values || disposed || ctx.signal.aborted) return false;

      const payload = {
        name: values.name.trim(),
        kind: values.kind,
        openingBalance: Math.round(Number(parseAmountInput(values.openingBalance)) || 0),
        schemaVersion: 1,
      };

      try {
        if (editing) await accountsRepo.update(account.id, payload);
        else await accountsRepo.create(payload);
        if (disposed || ctx.signal.aborted) return false;
        await refresh();
        ui.toast(editing ? 'Dompet diperbarui.' : 'Dompet ditambahkan.', { type: 'success' });
        return true;
      } catch (error) {
        ui.toast(`Dompet gagal disimpan: ${error.message}`, { type: 'error' });
        return false;
      }
    }

    async function deleteAccount(account) {
      if (accounts.length <= 1) {
        ui.toast('Minimal satu dompet harus tersedia.', { type: 'warning' });
        return;
      }

      const used = transactions.some((transaction) => (
        transaction.accountId === account.id || transaction.toAccountId === account.id
      ));
      if (used) {
        ui.toast('Dompet sudah dipakai transaksi. Hapus atau pindahkan transaksinya lebih dulu.', {
          type: 'warning',
          duration: 5500,
        });
        return;
      }

      const approved = await ui.confirm({
        title: 'Hapus dompet?',
        message: `Dompet "${account.name}" akan dihapus. Tindakan ini tidak memengaruhi dompet lain.`,
        confirmLabel: 'Hapus dompet',
        cancelLabel: 'Batal',
        danger: true,
      });
      if (!approved || disposed || ctx.signal.aborted) return;

      try {
        await accountsRepo.remove(account.id);
        if (disposed || ctx.signal.aborted) return;
        await refresh();
        ui.toast('Dompet dihapus.', { type: 'info' });
      } catch (error) {
        ui.toast(`Dompet gagal dihapus: ${error.message}`, { type: 'error' });
      }
    }

    function openAccountsDialog() {
      const content = el('div', { class: 'keuangan-accounts' });
      let dialogDisposed = false;

      const renderDialogContent = () => {
        if (dialogDisposed || disposed) return;
        const balances = calculateBalances(accounts, transactions);
        content.replaceChildren();

        for (const account of sortAccounts(accounts)) {
          const kind = accountKind(account.kind);
          const row = el('div', { class: 'keuangan-account-row' });
          row.append(
            el('span', {
              class: 'keuangan-wallet__icon',
              html: kind.icon,
              'aria-hidden': 'true',
            }),
            el('span', { class: 'keuangan-account-row__copy' },
              el('span', { class: 'keuangan-account-row__name', text: account.name }),
              el('span', {
                class: 'keuangan-account-row__meta',
                text: `${kind.label} · ${rupiah(balances.get(account.id) ?? 0)}`,
              }),
            ),
          );
          const actions = el('span', { class: 'keuangan-account-row__actions' });
          const edit = el('button', {
            class: 'keuangan-icon-button',
            type: 'button',
            'aria-label': `Ubah dompet ${account.name}`,
            title: `Ubah dompet ${account.name}`,
            html: PENCIL_ICON,
          });
          edit.addEventListener('click', async () => {
            const saved = await openAccountForm(account);
            if (saved) renderDialogContent();
          });
          const remove = el('button', {
            class: 'keuangan-icon-button keuangan-icon-button--danger',
            type: 'button',
            'aria-label': `Hapus dompet ${account.name}`,
            title: `Hapus dompet ${account.name}`,
            html: TRASH_ICON,
          });
          remove.addEventListener('click', async () => {
            await deleteAccount(account);
            renderDialogContent();
          });
          actions.append(edit, remove);
          row.append(actions);
          content.append(row);
        }

        const add = el('button', {
          class: 'btn btn--secondary',
          type: 'button',
          html: `${PLUS_ICON}<span>Tambah dompet</span>`,
        });
        add.addEventListener('click', async () => {
          const saved = await openAccountForm();
          if (saved) renderDialogContent();
        });
        content.append(el('div', { class: 'keuangan-accounts__actions' }, add));
      };

      renderDialogContent();
      ui.dialog({
        title: 'Dompet',
        description: 'Kelola sumber saldo. Setiap transaksi selalu terhubung ke dompet.',
        content,
        actions: [{ label: 'Selesai', variant: 'ghost' }],
      }).finally(() => {
        dialogDisposed = true;
      });
    }

    addButton.addEventListener('click', () => openTransactionForm());
    accountsButton.addEventListener('click', openAccountsDialog);

    ctx.onCleanup(() => {
      disposed = true;
      container.replaceChildren();
    });

    await refresh();
    return undefined;
  },
};
