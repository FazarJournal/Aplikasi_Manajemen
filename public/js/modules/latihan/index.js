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
      display: f
