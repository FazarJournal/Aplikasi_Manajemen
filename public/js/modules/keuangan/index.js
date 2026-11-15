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
    .keuangan-item__amount--transfer { color: var(--muted);
