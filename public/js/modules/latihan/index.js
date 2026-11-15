import { el } from '../../core/dom.js';
import { icon } from '../../core/icons.js';

const FORMAT = 'asisten-latihan-soal';
const FORMAT_VERSION = 1;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_QUESTIONS = 300;
const MAX_OPTIONS = 6;
const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

const SAMPLE_BANK = {
  format: FORMAT,
  formatVersion: FORMAT_VERSION,
  title: 'Contoh: Pecahan Dasar',
  subject: 'Matematika',
  description: 'Empat soal pilihan ganda untuk mencoba format impor.',
  questions: [
    {
      question: 'Hasil dari 1/2 + 1/4 adalah …',
      options: ['1/4', '1/2', '3/4', '1'],
      answer: 2,
      explanation: '1/2 sama dengan 2/4. Jadi 2/4 + 1/4 = 3/4.',
    },
    {
      question: 'Bentuk desimal dari 3/5 adalah …',
      options: ['0,35', '0,53', '0,6', '0,8'],
      answer: 2,
      explanation: '3 dibagi 5 sama dengan 0,6.',
    },
    {
      question: 'Urutan dari terkecil ke terbesar yang benar adalah …',
      options: ['0,5 ; 1/4 ; 0,75', '1/4 ; 0,5 ; 0,75', '0,75 ; 0,5 ; 1/4', '1/4 ; 0,75 ; 0,5'],
      answer: 1,
      explanation: '1/4 = 0,25, lalu 0,5, lalu 0,75.',
    },
    {
      question: 'Hasil dari 2/3 × 3/4 adalah …',
      options: ['1/2', '2/3', '3/4', '5/7'],
      answer: 0,
      explanation: '2/3 × 3/4 = 6/12 = 1/2.',
    },
  ],
};

function cleanText(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function sortBanks(banks) {
  return [...banks].sort((left, right) => (
    String(right.importedAt ?? right.updatedAt ?? '')
      .localeCompare(String(left.importedAt ?? left.updatedAt ?? ''))
  ));
}

function sortAttempts(attempts) {
  return [...attempts].sort((left, right) => (
    String(right.completedAt ?? right.updatedAt ?? '')
      .localeCompare(String(left.completedAt ?? left.updatedAt ?? ''))
  ));
}

function percentOf(attempt) {
  const value = Number(attempt?.percent);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function shuffled(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

/**
 * Snapshot soal per percobaan: urutan soal dan pilihan diacak, tetapi
 * jawaban tetap menunjuk indeks pada snapshot agar penilaian dan tinjauan
 * konsisten meski pengguna mengulang latihan.
 */
function createSessionQuestions(bank) {
  return shuffled(bank.questions).map((question) => {
    const choices = shuffled(question.options.map((text, index) => ({ text, index })));
    const answer = choices.findIndex((choice) => choice.index === question.answer);
    return {
      ...question,
      options: choices.map((choice) => choice.text),
      answer: answer >= 0 ? answer : 0,
    };
  });
}

function formatDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatDuration(milliseconds) {
  const totalSeconds = Math.max(0, Math.round(Number(milliseconds) / 1000) || 0);
  if (totalSeconds < 60) return `${totalSeconds} dtk`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds === 0 ? `${minutes} mnt` : `${minutes} mnt ${seconds} dtk`;
}

function parseBankPayload(payload, fileName = 'latihan.json') {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Isi file harus berupa objek JSON.');
  }
  if (payload.format !== undefined && payload.format !== FORMAT) {
    throw new Error(`Format file harus "${FORMAT}".`);
  }
  if (payload.formatVersion !== undefined
    && (!Number.isInteger(payload.formatVersion) || payload.formatVersion < 1)) {
    throw new Error('formatVersion tidak valid.');
  }
  if (payload.formatVersion > FORMAT_VERSION) {
    throw new Error('File dibuat oleh versi format yang lebih baru.');
  }
  if (!Array.isArray(payload.questions)) {
    throw new Error('Properti "questions" harus berupa array.');
  }
  if (payload.questions.length === 0) {
    throw new Error('Paket soal belum memiliki pertanyaan.');
  }
  if (payload.questions.length > MAX_QUESTIONS) {
    throw new Error(`Maksimal ${MAX_QUESTIONS} soal per paket.`);
  }

  const questions = payload.questions.map((raw, index) => {
    const number = index + 1;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error(`Soal ${number} tidak valid.`);
    }

    const question = cleanText(raw.question ?? raw.text, 1000);
    if (!question) throw new Error(`Soal ${number} belum memiliki pertanyaan.`);

    if (!Array.isArray(raw.options) || raw.options.length < 2 || raw.options.length > MAX_OPTIONS) {
      throw new Error(`Soal ${number} harus memiliki 2–${MAX_OPTIONS} pilihan.`);
    }
    const options = raw.options.map((option) => cleanText(option, 300));
    if (options.some((option) => !option)) {
      throw new Error(`Ada pilihan kosong pada soal ${number}.`);
    }

    let answer = raw.answer;
    if (typeof answer === 'string') {
      const wanted = answer.trim();
      const found = options.findIndex((option, optionIndex) => (
        option.toLocaleLowerCase('id-ID') === wanted.toLocaleLowerCase('id-ID')
        || OPTION_LABELS[optionIndex] === wanted.toUpperCase()
      ));
      if (found === -1) {
        throw new Error(`Jawaban soal ${number} tidak cocok dengan pilihan.`);
      }
      answer = found;
    }
    if (!Number.isInteger(answer) || answer < 0 || answer >= options.length) {
      throw new Error(`"answer" soal ${number} harus berupa indeks 0–${options.length - 1}.`);
    }

    return {
      question,
      options,
      answer,
      explanation: cleanText(raw.explanation, 1500),
    };
  });

  const fallbackTitle = String(fileName)
    .replace(/\.json$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim();

  return {
    title: cleanText(payload.title, 120) || fallbackTitle || 'Paket soal',
    subject: cleanText(payload.subject ?? payload.mapel, 60),
    description: cleanText(payload.description ?? payload.deskripsi, 280),
    questions,
    sourceName: String(fileName ?? ''),
    importedAt: new Date().toISOString(),
  };
}

function makeButton({ label, iconName = null, variant = 'secondary', onClick, className = '' }) {
  const button = el('button', {
    class: ['btn', `btn--${variant}`, className].filter(Boolean).join(' '),
    type: 'button',
  });
  if (iconName) {
    button.append(
      el('span', { html: icon(iconName, 'icon'), 'aria-hidden': 'true' }),
      el('span', { text: label }),
    );
  } else {
    button.append(el('span', { text: label }));
  }
  button.addEventListener('click', onClick);
  return button;
}

export default {
  id: 'latihan',
  name: 'Latihan Soal',
  description: 'Impor paket soal pilihan ganda, kerjakan, lalu simpan skor dan riwayat latihan.',
  version: '1.0.0',
  order: 40,

  icon: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 0 4 22.5v-17Z"/><path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H20"/><path d="m9 10 1.8 1.8L15 7.5"/></svg>',

  styles: `
    .latihan {
      display: flex;
      flex-direction: column;
      gap: 22px;
    }

    .latihan-hero {
      position: relative;
      overflow: hidden;
      padding: 22px;
      border: 1px solid rgb(var(--brand-rgb) / 0.16);
      border-radius: var(--radius-xl);
      background:
        radial-gradient(circle at 100% 0%, rgb(var(--brand-rgb) / 0.17), transparent 44%),
        linear-gradient(150deg, rgb(var(--ink-rgb) / 0.045), transparent 68%);
    }

    .latihan-hero::after {
      content: "";
      position: absolute;
      right: -42px;
      top: -58px;
      width: 150px;
      height: 150px;
      border-radius: 999px;
      background: rgb(var(--brand-rgb) / 0.12);
      filter: blur(20px);
      pointer-events: none;
    }

    .latihan-hero > * {
      position: relative;
      z-index: 1;
    }

    .latihan-hero__eyebrow {
      margin: 0 0 8px;
      color: var(--accent);
      font-size: 10px;
      font-weight: 750;
      letter-spacing: 0.18em;
      text-transform: uppercase;
    }

    .latihan-hero__title {
      margin: 0;
      font-size: clamp(27px, 7vw, 34px);
      font-weight: 720;
      letter-spacing: -0.05em;
      line-height: 1.03;
    }

    .latihan-hero__text {
      max-width: 34ch;
      margin: 10px 0 0;
      color: var(--muted);
      font-size: 12.5px;
      line-height: 1.65;
    }

    .latihan-hero__actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 17px;
    }

    .latihan-file-input {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    .latihan-stats {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 9px;
    }

    .latihan-stat {
      padding: 14px;
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      background: rgb(var(--ink-rgb) / 0.028);
    }

    .latihan-stat__label {
      margin: 0 0 7px;
      color: var(--muted);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .latihan-stat__value {
      margin: 0;
      font-size: clamp(22px, 5vw, 28px);
      font-weight: 730;
      letter-spacing: -0.045em;
      line-height: 1;
    }

    .latihan-section {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .latihan-section__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .latihan-section__title {
      margin: 0;
      font-size: 15px;
      font-weight: 700;
      letter-spacing: -0.025em;
    }

    .latihan-count {
      padding: 3px 8px;
      border: 1px solid var(--border);
      border-radius: var(--radius-full);
      color: var(--muted);
      font-size: 10.5px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }

    .latihan-bank {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px;
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      background: var(--surface-1);
    }

    .latihan-bank__head {
      display: flex;
      align-items: flex-start;
      gap: 11px;
    }

    .latihan-bank__icon {
      display: grid;
      place-items: center;
      flex: none;
      width: 38px;
      height: 38px;
      border-radius: 13px;
      background: var(--primary-soft);
      color: var(--accent);
    }

    .latihan-bank__icon .icon {
      width: 19px;
      height: 19px;
    }

    .latihan-bank__body {
      min-width: 0;
      flex: 1;
    }

    .latihan-bank__title {
      margin: 0;
      overflow-wrap: anywhere;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: -0.02em;
      line-height: 1.35;
    }

    .latihan-bank__meta {
      margin: 4px 0 0;
      color: var(--muted);
      font-size: 11.5px;
      line-height: 1.5;
    }

    .latihan-bank__delete {
      flex: none;
      width: 36px;
      height: 36px;
      color: var(--muted);
    }

    .latihan-bank__delete:hover {
      color: var(--danger);
    }

    .latihan-bank__delete .icon {
      width: 16px;
      height: 16px;
    }

    .latihan-bank__description {
      margin: 0;
      color: var(--text-secondary);
      font-size: 12px;
      line-height: 1.6;
    }

    .latihan-bank__footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 10px;
      padding-top: 11px;
      border-top: 1px solid var(--border);
    }

    .latihan-bank__last {
      margin: 0;
      color: var(--muted);
      font-size: 11.5px;
    }

    .latihan-bank__last strong {
      color: var(--text-secondary);
      font-weight: 700;
    }

    .latihan-empty {
      margin: 0;
    }

    .latihan-history {
      display: flex;
      flex-direction: column;
      gap: 7px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .latihan-history__row {
      display: flex;
      align-items: center;
      gap: 11px;
      padding: 11px 13px;
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      background: rgb(var(--ink-rgb) / 0.022);
    }

    .latihan-history__score {
      display: grid;
      place-items: center;
      flex: none;
      width: 43px;
      height: 43px;
      border-radius: 14px;
      background: var(--surface-3);
      color: var(--text-secondary);
      font-size: 13px;
      font-weight: 750;
      font-variant-numeric: tabular-nums;
    }

    .latihan-history__score--success {
      background: var(--success-soft);
      color: var(--success);
    }

    .latihan-history__score--warning {
      background: var(--warning-soft);
      color: var(--warning);
    }

    .latihan-history__score--danger {
      background: var(--danger-soft);
      color: var(--danger);
    }

    .latihan-history__body {
      min-width: 0;
      flex: 1;
    }

    .latihan-history__title {
      margin: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 12.5px;
      font-weight: 680;
    }

    .latihan-history__meta {
      margin: 3px 0 0;
      color: var(--muted);
      font-size: 10.5px;
      font-variant-numeric: tabular-nums;
    }

    .latihan-history__empty {
      margin: 0;
      padding: 16px;
      border: 1px dashed var(--border);
      border-radius: var(--radius-md);
      color: var(--muted);
      font-size: 12px;
      line-height: 1.6;
      text-align: center;
    }

    .latihan-practice {
      display: flex;
      flex-direction: column;
      gap: 15px;
    }

    .latihan-practice__top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .latihan-practice__counter {
      margin: 0;
      color: var(--muted);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.04em;
      font-variant-numeric: tabular-nums;
    }

    .latihan-progress {
      overflow: hidden;
      height: 6px;
      border-radius: var(--radius-full);
      background: var(--surface-3);
    }

    .latihan-progress__fill {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, var(--primary), var(--accent));
      transition: width var(--transition);
    }

    .latihan-question {
      padding: 18px;
      border: 1px solid var(--border);
      border-radius: var(--radius-xl);
      background: linear-gradient(155deg, rgb(var(--ink-rgb) / 0.042), transparent 66%);
    }

    .latihan-question__title {
      margin: 0 0 16px;
      overflow-wrap: anywhere;
      font-size: clamp(17px, 4.5vw, 20px);
      font-weight: 680;
      letter-spacing: -0.03em;
      line-height: 1.45;
    }

    .latihan-options {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .latihan-option {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      width: 100%;
      padding: 12px 13px;
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      background: rgb(var(--ink-rgb) / 0.025);
      color: var(--text);
      font-family: inherit;
      font-size: 12.5px;
      line-height: 1.55;
      text-align: left;
      cursor: pointer;
      transition:
        border-color var(--transition),
        background var(--transition),
        transform var(--transition);
    }

    .latihan-option:hover:not(:disabled) {
      border-color: var(--border-strong);
      background: rgb(var(--ink-rgb) / 0.055);
      transform: translateY(-1px);
    }

    .latihan-option:disabled {
      cursor: default;
    }

    .latihan-option__letter {
      display: grid;
      place-items: center;
      flex: none;
      width: 24px;
      height: 24px;
      border-radius: 8px;
      background: var(--surface-3);
      color: var(--muted);
      font-size: 10.5px;
      font-weight: 750;
    }

    .latihan-option__text {
      min-width: 0;
      flex: 1;
      overflow-wrap: anywhere;
    }

    .latihan-option__icon {
      display: flex;
      align-items: center;
      align-self: center;
      flex: none;
      color: var(--muted);
    }

    .latihan-option__icon .icon {
      width: 16px;
      height: 16px;
    }

    .latihan-option.is-correct {
      border-color: rgb(var(--success-rgb) / 0.42);
      background: var(--success-soft);
    }

    .latihan-option.is-correct .latihan-option__letter {
      background: rgb(var(--success-rgb) / 0.16);
      color: var(--success);
    }

    .latihan-option.is-correct .latihan-option__icon {
      color: var(--success);
    }

    .latihan-option.is-wrong {
      border-color: rgb(var(--danger-rgb) / 0.42);
      background: var(--danger-soft);
    }

    .latihan-option.is-wrong .latihan-option__letter {
      background: rgb(var(--danger-rgb) / 0.16);
      color: var(--danger);
    }

    .latihan-option.is-wrong .latihan-option__icon {
      color: var(--danger);
    }

    .latihan-feedback {
      padding: 14px;
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      background: rgb(var(--ink-rgb) / 0.028);
    }

    .latihan-feedback--success {
      border-color: rgb(var(--success-rgb) / 0.24);
      background: var(--success-soft);
    }

    .latihan-feedback--danger {
      border-color: rgb(var(--danger-rgb) / 0.24);
      background: var(--danger-soft);
    }

    .latihan-feedback__title {
      margin: 0;
      color: var(--text);
      font-size: 13px;
      font-weight: 720;
    }

    .latihan-feedback--success .latihan-feedback__title {
      color: var(--success);
    }

    .latihan-feedback--danger .latihan-feedback__title {
      color: var(--danger);
    }

    .latihan-feedback__text,
    .latihan-feedback__explanation {
      margin: 6px 0 0;
      color: var(--text-secondary);
      font-size: 12px;
      line-height: 1.6;
    }

    .latihan-feedback__explanation {
      color: var(--muted);
    }

    .latihan-practice__next {
      align-self: flex-end;
    }

    .latihan-result {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      padding: 24px 20px;
      border: 1px solid rgb(var(--brand-rgb) / 0.18);
      border-radius: var(--radius-xl);
      text-align: center;
      background:
        radial-gradient(circle at 50% 0%, rgb(var(--brand-rgb) / 0.17), transparent 58%),
        linear-gradient(160deg, rgb(var(--ink-rgb) / 0.04), transparent 70%);
    }

    .latihan-result__eyebrow {
      margin: 0;
      color: var(--accent);
      font-size: 10px;
      font-weight: 750;
      letter-spacing: 0.16em;
      text-transform: uppercase;
    }

    .latihan-result__percent {
      margin: 2px 0 0;
      font-size: clamp(46px, 14vw, 64px);
      font-weight: 760;
      letter-spacing: -0.065em;
      line-height: 1;
    }

    .latihan-result__percent--success { color: var(--success); }
    .latihan-result__percent--warning { color: var(--warning); }
    .latihan-result__percent--danger { color: var(--danger); }

    .latihan-result__detail {
      margin: 0;
      color: var(--text-secondary);
      font-size: 12.5px;
      font-weight: 650;
    }

    .latihan-result__message {
      max-width: 30ch;
      margin: 0;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.6;
    }

    .latihan-result__actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 8px;
      margin-top: 6px;
    }

    .latihan-review {
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      background: var(--surface-1);
    }

    .latihan-review > summary {
      padding: 14px 16px;
      color: var(--text-secondary);
      font-size: 12px;
      font-weight: 680;
      cursor: pointer;
      list-style: none;
    }

    .latihan-review > summary::-webkit-details-marker {
      display: none;
    }

    .latihan-review > summary::after {
      content: "+";
      float: right;
      color: var(--muted);
      font-size: 16px;
      line-height: 1;
    }

    .latihan-review[open] > summary::after {
      content: "−";
    }

    .latihan-review__list {
      display: flex;
      flex-direction: column;
      gap: 9px;
      margin: 0;
      padding: 0 14px 14px;
      list-style: none;
    }

    .latihan-review__item {
      padding: 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      background: rgb(var(--ink-rgb) / 0.022);
    }

    .latihan-review__question {
      margin: 0;
      color: var(--text);
      font-size: 12px;
      font-weight: 650;
      line-height: 1.5;
    }

    .latihan-review__answer {
      margin: 6px 0 0;
      color: var(--muted);
      font-size: 11px;
      line-height: 1.55;
    }

    .latihan-review__answer strong {
      color: var(--text-secondary);
      font-weight: 700;
    }

    .latihan-review__explanation {
      margin: 5px 0 0;
      color: var(--muted);
      font-size: 11px;
      line-height: 1.55;
    }
  `,

  async getHomeSummary(ctx) {
    const [banks, attempts] = await Promise.all([
      ctx.data('banks').list(),
      ctx.data('attempts').list(),
    ]);
    const questionCount = banks.reduce((sum, bank) => sum + (bank.questions?.length ?? 0), 0);
    const lastAttempt = sortAttempts(attempts)[0];

    if (banks.length === 0) {
      return [{
        id: 'latihan-ringkasan',
        label: 'Latihan soal',
        value: 'Belum ada',
        hint: 'Impor paket soal JSON untuk mulai berlatih.',
        tone: 'default',
        primary: true,
      }];
    }

    return [{
      id: 'latihan-ringkasan',
      label: 'Latihan soal',
      value: `${banks.length} paket`,
      hint: lastAttempt
        ? `Skor terakhir ${percentOf(lastAttempt)}% · ${lastAttempt.correct}/${lastAttempt.total} benar`
        : `${questionCount} soal siap dilatih.`,
      tone: lastAttempt && percentOf(lastAttempt) >= 80 ? 'success' : 'default',
      primary: true,
    }];
  },

  async mount(ctx, container) {
    const banksRepo = ctx.data('banks');
    const attemptsRepo = ctx.data('attempts');
    const ui = ctx.ui;
    const utils = ctx.utils;
    const root = el('div', { class: 'latihan' });

    let banks = [];
    let attempts = [];
    let session = null;

    container.replaceChildren(root);
    ctx.onCleanup(() => {
      session = null;
      root.replaceChildren();
    });

    const lastAttemptFor = (bankId) => attempts.find((attempt) => attempt.bankId === bankId);

    const startPractice = (bank) => {
      if (!Array.isArray(bank.questions) || bank.questions.length === 0) {
        ui.toast('Paket ini belum memiliki soal.', { type: 'error' });
        return;
      }
      session = {
        bank,
        questions: createSessionQuestions(bank),
        index: 0,
        answers: [],
        startedAt: Date.now(),
      };
      renderQuestion();
    };

    const leavePractice = async () => {
      if (!session) {
        renderHome();
        return;
      }
      const answered = session.answers.filter((answer) => Number.isInteger(answer)).length;
      if (answered > 0) {
        const confirmed = await ui.confirm({
          title: 'Keluar dari latihan?',
          message: 'Jawaban yang sudah dipilih tidak akan disimpan sebagai riwayat.',
          confirmLabel: 'Keluar',
          cancelLabel: 'Lanjut mengerjakan',
          danger: true,
        });
        if (!confirmed || ctx.signal.aborted) return;
      }
      session = null;
      renderHome();
    };

    const answerQuestion = (optionIndex) => {
      if (!session) return;
      const current = session.answers[session.index];
      if (Number.isInteger(current)) return;
      session.answers[session.index] = optionIndex;
      renderQuestion();
    };

    const goNext = async () => {
      if (!session) return;
      if (session.index >= session.questions.length - 1) {
        await finishPractice();
        return;
      }
      session.index += 1;
      renderQuestion();
    };

    const finishPractice = async () => {
      if (!session) return;
      const currentSession = session;
      const total = currentSession.questions.length;
      const answers = currentSession.answers;
      const correct = currentSession.questions.reduce((sum, question, index) => (
        sum + (answers[index] === question.answer ? 1 : 0)
      ), 0);
      const attempt = {
        bankId: currentSession.bank.id,
        bankTitle: currentSession.bank.title,
        subject: currentSession.bank.subject || '',
        correct,
        total,
        percent: total > 0 ? Math.round((correct / total) * 100) : 0,
        durationMs: Date.now() - currentSession.startedAt,
        completedAt: new Date().toISOString(),
      };
      session = null;

      try {
        const saved = await attemptsRepo.create(attempt);
        if (ctx.signal.aborted) return;
        attempts = sortAttempts([saved, ...attempts]);
      } catch (error) {
        console.error('[Latihan] Riwayat latihan gagal disimpan.', error);
        if (ctx.signal.aborted) return;
        ui.toast('Skor selesai, tetapi riwayat gagal disimpan.', { type: 'error' });
      }
      renderResult(attempt, currentSession.questions, answers, currentSession.bank);
    };

    const handleImport = async (file, input) => {
      if (!file) return;
      if (file.size > MAX_FILE_BYTES) {
        ui.toast('Ukuran file terlalu besar. Maksimal 2 MB.', { type: 'error' });
        input.value = '';
        return;
      }

      try {
        const text = await file.text();
        if (ctx.signal.aborted) return;
        let payload;
        try {
          payload = JSON.parse(text);
        } catch {
          throw new Error('File bukan JSON yang valid.');
        }
        const bank = parseBankPayload(payload, file.name);
        const created = await banksRepo.create(bank);
        if (ctx.signal.aborted) return;
        banks = sortBanks([created, ...banks]);
        renderHome();
        ui.toast(
          `“${created.title}” diimpor: ${created.questions.length} soal.`,
          { type: 'success' },
        );
      } catch (error) {
        if (ctx.signal.aborted) return;
        ui.toast(error.message || 'Paket soal gagal diimpor.', { type: 'error', duration: 6000 });
      } finally {
        input.value = '';
      }
    };

    const deleteBank = async (bank) => {
      const confirmed = await ui.confirm({
        title: 'Hapus paket soal?',
        message: `“${bank.title}” akan dihapus. Riwayat skor tetap disimpan.`,
        confirmLabel: 'Hapus',
        danger: true,
      });
      if (!confirmed || ctx.signal.aborted) return;

      try {
        await banksRepo.remove(bank.id);
        if (ctx.signal.aborted) return;
        banks = banks.filter((item) => item.id !== bank.id);
        renderHome();
        ui.toast('Paket soal dihapus.', { type: 'success' });
      } catch (error) {
        console.error('[Latihan] Paket soal gagal dihapus.', error);
        if (!ctx.signal.aborted) ui.toast('Paket soal gagal dihapus.', { type: 'error' });
      }
    };

    const clearHistory = async () => {
      const confirmed = await ui.confirm({
        title: 'Hapus riwayat latihan?',
        message: 'Semua skor dan riwayat latihan akan dihapus. Paket soal tetap tersimpan.',
        confirmLabel: 'Hapus riwayat',
        danger: true,
      });
      if (!confirmed || ctx.signal.aborted) return;

      try {
        await attemptsRepo.clear();
        if (ctx.signal.aborted) return;
        attempts = [];
        renderHome();
        ui.toast('Riwayat latihan dihapus.', { type: 'success' });
      } catch (error) {
        console.error('[Latihan] Riwayat gagal dihapus.', error);
        if (!ctx.signal.aborted) ui.toast('Riwayat gagal dihapus.', { type: 'error' });
      }
    };

    const createFileInput = () => {
      const input = el('input', {
        class: 'latihan-file-input',
        type: 'file',
        accept: '.json,application/json',
        tabindex: -1,
        'aria-hidden': 'true',
      });
      input.addEventListener('change', () => {
        const [file] = input.files ?? [];
        handleImport(file, input);
      });
      return input;
    };

    const renderHome = () => {
      session = null;
      root.replaceChildren();

      const fileInput = createFileInput();
      const totalQuestions = banks.reduce(
        (sum, bank) => sum + (bank.questions?.length ?? 0),
        0,
      );
      const bestPercent = attempts.reduce(
        (best, attempt) => Math.max(best, percentOf(attempt)),
        0,
      );

      const hero = el('section', { class: 'latihan-hero' });
      const importButton = makeButton({
        label: 'Impor soal JSON',
        iconName: 'upload',
        variant: 'primary',
        onClick: () => fileInput.click(),
      });
      const sampleButton = makeButton({
        label: 'Unduh contoh',
        iconName: 'download',
        variant: 'secondary',
        onClick: () => utils.downloadJSON('contoh-latihan-soal.json', SAMPLE_BANK),
      });
      hero.append(
        el('p', { class: 'latihan-hero__eyebrow', text: 'Ruang latihan' }),
        el('h2', { class: 'latihan-hero__title', text: 'Uji pemahamanmu.' }),
        el('p', {
          class: 'latihan-hero__text',
          text: 'Impor paket soal pilihan ganda dari file JSON. Setiap jawaban diberi umpan balik, lalu skor masuk ke riwayat.',
        }),
        el('div', { class: 'latihan-hero__actions' }, importButton, sampleButton),
      );

      const stats = el('section', { class: 'latihan-stats', 'aria-label': 'Statistik latihan' });
      stats.append(
        el('div', { class: 'latihan-stat' },
          el('p', { class: 'latihan-stat__label', text: 'Paket' }),
          el('p', { class: 'latihan-stat__value', text: String(banks.length) }),
        ),
        el('div', { class: 'latihan-stat' },
          el('p', { class: 'latihan-stat__label', text: 'Soal' }),
          el('p', { class: 'latihan-stat__value', text: String(totalQuestions) }),
        ),
        el('div', { class: 'latihan-stat' },
          el('p', { class: 'latihan-stat__label', text: 'Terbaik' }),
          el('p', {
            class: 'latihan-stat__value',
            text: attempts.length > 0 ? `${bestPercent}%` : '—',
          }),
        ),
      );

      const bankSection = el('section', { class: 'latihan-section' });
      bankSection.append(
        el('div', { class: 'latihan-section__head' },
          el('h3', { class: 'latihan-section__title', text: 'Paket soal' }),
          el('span', { class: 'latihan-count', text: String(banks.length) }),
        ),
      );

      if (banks.length === 0) {
        bankSection.append(
          el('div', { class: 'empty-card empty-card--wide latihan-empty' },
            el('span', { class: 'empty-card__icon', html: icon('upload') }),
            el('h2', { class: 'empty-card__title', text: 'Belum ada paket soal' }),
            el('p', {
              class: 'empty-card__text',
              text: 'Impor file JSON berisi daftar pertanyaan pilihan ganda. Unduh contoh di atas untuk melihat formatnya.',
            }),
            el('div', { class: 'empty-actions' },
              makeButton({
                label: 'Impor paket soal',
                iconName: 'upload',
                variant: 'primary',
                onClick: () => fileInput.click(),
              }),
            ),
          ),
        );
      } else {
        for (const bank of banks) {
          const last = lastAttemptFor(bank.id);
          const card = el('article', { class: 'latihan-bank' });
          const head = el('div', { class: 'latihan-bank__head' });
          const body = el('div', { class: 'latihan-bank__body' });
          const meta = [
            bank.subject,
            `${bank.questions?.length ?? 0} soal`,
          ].filter(Boolean).join(' · ');
          body.append(
            el('h4', { class: 'latihan-bank__title', text: bank.title }),
            el('p', { class: 'latihan-bank__meta', text: meta }),
          );

          const removeButton = el('button', {
            class: 'icon-button latihan-bank__delete',
            type: 'button',
            'aria-label': `Hapus paket "${bank.title}"`,
            html: icon('trash', 'icon'),
          });
          removeButton.addEventListener('click', () => deleteBank(bank));

          head.append(
            el('span', { class: 'latihan-bank__icon', html: icon('book', 'icon') }),
            body,
            removeButton,
          );

          if (bank.description) {
            card.append(head, el('p', { class: 'latihan-bank__description', text: bank.description }));
          } else {
            card.append(head);
          }

          const footer = el('div', { class: 'latihan-bank__footer' });
          const lastText = last
            ? `Skor terakhir ${percentOf(last)}% · ${last.correct}/${last.total} benar`
            : 'Belum pernah dikerjakan';
          footer.append(
            el('p', { class: 'latihan-bank__last' }, el('strong', { text: lastText })),
            makeButton({
              label: last ? 'Latihan lagi' : 'Mulai latihan',
              iconName: 'arrowRight',
              variant: 'primary',
              onClick: () => startPractice(bank),
            }),
          );
          card.append(footer);
          bankSection.append(card);
        }
      }

      const historySection = el('section', { class: 'latihan-section' });
      const historyHead = el('div', { class: 'latihan-section__head' },
        el('h3', { class: 'latihan-section__title', text: 'Riwayat skor' }),
      );
      if (attempts.length > 0) {
        historyHead.append(
          makeButton({
            label: 'Hapus riwayat',
            variant: 'ghost',
            iconName: 'trash',
            onClick: clearHistory,
          }),
        );
      }
      historySection.append(historyHead);

      if (attempts.length === 0) {
        historySection.append(
          el('p', {
            class: 'latihan-history__empty',
            text: 'Skor akan muncul di sini setelah kamu menyelesaikan satu paket latihan.',
          }),
        );
      } else {
        const list = el('ol', { class: 'latihan-history' });
        for (const attempt of attempts.slice(0, 8)) {
          const percent = percentOf(attempt);
          const tone = percent >= 80 ? 'success' : percent >= 50 ? 'warning' : 'danger';
          list.append(
            el('li', { class: 'latihan-history__row' },
              el('span', {
                class: `latihan-history__score latihan-history__score--${tone}`,
                text: `${percent}%`,
              }),
              el('div', { class: 'latihan-history__body' },
                el('p', { class: 'latihan-history__title', text: attempt.bankTitle || 'Latihan' }),
                el('p', {
                  class: 'latihan-history__meta',
                  text: [
                    attempt.correct != null && attempt.total != null
                      ? `${attempt.correct}/${attempt.total} benar`
                      : null,
                    formatDate(attempt.completedAt),
                    formatDuration(attempt.durationMs),
                  ].filter(Boolean).join(' · '),
                }),
              ),
            ),
          );
        }
        historySection.append(list);
        if (attempts.length > 8) {
          historySection.append(
            el('p', {
              class: 'latihan-history__meta',
              text: `Menampilkan 8 dari ${attempts.length} riwayat terbaru.`,
            }),
          );
        }
      }

      root.append(hero, stats, bankSection, historySection, fileInput);
    };

    const renderQuestion = () => {
      if (!session) return;
      const total = session.questions.length;
      const question = session.questions[session.index];
      if (!question) {
        finishPractice();
        return;
      }
      const selected = session.answers[session.index];
      const answered = Number.isInteger(selected);
      const isCorrect = selected === question.answer;
      const progress = Math.round(((session.index + (answered ? 1 : 0)) / total) * 100);

      root.replaceChildren();
      const top = el('div', { class: 'latihan-practice__top' });
      top.append(
        makeButton({
          label: 'Keluar',
          iconName: 'arrowLeft',
          variant: 'ghost',
          onClick: leavePractice,
        }),
        el('p', {
          class: 'latihan-practice__counter',
          text: `Soal ${session.index + 1} dari ${total}`,
        }),
      );

      const progressBar = el('div', {
        class: 'latihan-progress',
        role: 'progressbar',
        'aria-label': 'Kemajuan latihan',
        'aria-valuemin': '0',
        'aria-valuemax': '100',
        'aria-valuenow': String(progress),
      });
      progressBar.append(el('span', {
        class: 'latihan-progress__fill',
        style: { width: `${progress}%` },
      }));

      const card = el('article', { class: 'latihan-question' });
      card.append(el('h2', { class: 'latihan-question__title', text: question.question }));

      const options = el('div', {
        class: 'latihan-options',
        role: 'group',
        'aria-label': 'Pilihan jawaban',
      });
      question.options.forEach((option, optionIndex) => {
        const isAnswer = optionIndex === question.answer;
        const isSelected = optionIndex === selected;
        const classes = ['latihan-option'];
        if (answered && isAnswer) classes.push('is-correct');
        else if (answered && isSelected) classes.push('is-wrong');

        const button = el('button', {
          class: classes.join(' '),
          type: 'button',
          disabled: answered,
          'aria-pressed': String(isSelected),
        });
        button.append(
          el('span', { class: 'latihan-option__letter', text: OPTION_LABELS[optionIndex] }),
          el('span', { class: 'latihan-option__text', text: option }),
        );
        if (answered && (isAnswer || isSelected)) {
          button.append(el('span', {
            class: 'latihan-option__icon',
            html: icon(isAnswer ? 'checkCircle' : 'xCircle', 'icon'),
          }));
        }
        button.addEventListener('click', () => answerQuestion(optionIndex));
        options.append(button);
      });
      card.append(options);

      const wrapper = el('div', { class: 'latihan-practice' });
      wrapper.append(top, progressBar, card);

      if (answered) {
        const feedback = el('div', {
          class: `latihan-feedback latihan-feedback--${isCorrect ? 'success' : 'danger'}`,
          role: 'status',
        });
        feedback.append(
          el('p', {
            class: 'latihan-feedback__title',
            text: isCorrect ? 'Jawaban benar' : 'Belum tepat',
          }),
        );
        if (!isCorrect) {
          feedback.append(el('p', {
            class: 'latihan-feedback__text',
            text: `Jawaban yang benar: ${OPTION_LABELS[question.answer]}. ${question.options[question.answer]}`,
          }));
        }
        if (question.explanation) {
          feedback.append(el('p', {
            class: 'latihan-feedback__explanation',
            text: question.explanation,
          }));
        }
        wrapper.append(feedback);
        wrapper.append(
          makeButton({
            label: session.index >= total - 1 ? 'Lihat hasil' : 'Soal berikutnya',
            iconName: 'arrowRight',
            variant: 'primary',
            className: 'latihan-practice__next',
            onClick: goNext,
          }),
        );
      }

      root.append(wrapper);
      if (answered) {
        requestAnimationFrame(() => {
          wrapper.querySelector('.latihan-practice__next')?.focus({ preventScroll: true });
        });
      }
    };

    const renderResult = (attempt, questions, answers, bank) => {
      root.replaceChildren();
      const percent = percentOf(attempt);
      const tone = percent >= 80 ? 'success' : percent >= 50 ? 'warning' : 'danger';
      const message = percent >= 90
        ? 'Luar biasa. Pemahamanmu sudah kuat.'
        : percent >= 75
          ? 'Bagus. Sedikit lagi menuju sempurna.'
          : percent >= 60
            ? 'Sudah di jalur yang benar. Tinjau jawaban yang belum tepat.'
            : 'Jangan menyerah. Baca ulang penjelasan lalu coba lagi.';

      const result = el('section', { class: 'latihan-result' });
      result.append(
        el('p', { class: 'latihan-result__eyebrow', text: 'Latihan selesai' }),
        el('p', {
          class: `latihan-result__percent latihan-result__percent--${tone}`,
          text: `${percent}%`,
        }),
        el('p', {
          class: 'latihan-result__detail',
          text: `${attempt.correct} dari ${attempt.total} soal benar`,
        }),
        el('p', { class: 'latihan-result__message', text: message }),
      );

      const actions = el('div', { class: 'latihan-result__actions' });
      actions.append(
        makeButton({
          label: 'Ulangi latihan',
          iconName: 'refresh',
          variant: 'primary',
          onClick: () => startPractice(bank),
        }),
        makeButton({
          label: 'Kembali ke daftar',
          iconName: 'arrowLeft',
          variant: 'secondary',
          onClick: () => renderHome(),
        }),
      );
      result.append(actions);

      const review = el('details', { class: 'latihan-review' });
      review.append(el('summary', {
        text: `Tinjau jawaban (${questions.length} soal)`,
      }));
      const reviewList = el('ol', { class: 'latihan-review__list' });
      questions.forEach((question, index) => {
        const selected = answers[index];
        const isCorrect = selected === question.answer;
        const selectedText = Number.isInteger(selected)
          ? `${OPTION_LABELS[selected]}. ${question.options[selected]}`
          : 'Tidak dijawab';
        const item = el('li', { class: 'latihan-review__item' });
        item.append(
          el('p', {
            class: 'latihan-review__question',
            text: `${index + 1}. ${question.question}`,
          }),
          el('p', { class: 'latihan-review__answer' },
            el('strong', { text: isCorrect ? 'Jawabanmu benar: ' : 'Jawabanmu: ' }),
            document.createTextNode(selectedText),
          ),
          el('p', { class: 'latihan-review__answer' },
            el('strong', { text: 'Kunci: ' }),
            document.createTextNode(`${OPTION_LABELS[question.answer]}. ${question.options[question.answer]}`),
          ),
        );
        if (question.explanation) {
          item.append(el('p', {
            class: 'latihan-review__explanation',
            text: question.explanation,
          }));
        }
        reviewList.append(item);
      });
      review.append(reviewList);

      root.append(result, review);
    };

    const load = async () => {
      root.replaceChildren(el('div', {
        class: 'latihan-history__empty',
        text: 'Memuat paket soal…',
      }));
      try {
        const [storedBanks, storedAttempts] = await Promise.all([
          banksRepo.list(),
          attemptsRepo.list(),
        ]);
        if (ctx.signal.aborted) return;
        banks = sortBanks(storedBanks);
        attempts = sortAttempts(storedAttempts);
        renderHome();
      } catch (error) {
        console.error('[Latihan] Data latihan gagal dimuat.', error);
        if (ctx.signal.aborted) return;
        root.replaceChildren(
          el('div', { class: 'empty-card empty-card--wide' },
            el('span', { class: 'empty-card__icon empty-card__icon--danger', html: icon('alert') }),
            el('h2', { class: 'empty-card__title', text: 'Data latihan gagal dimuat' }),
            el('p', {
              class: 'empty-card__text',
              text: 'Coba buka ulang modul ini. Data yang sudah tersimpan tidak dihapus.',
            }),
          ),
        );
      }
    };

    await load();
  },
};
