import { el, focusableElements } from './dom.js';
import { icon } from './icons.js';

const TOAST_ICONS = {
  info: 'info',
  success: 'checkCircle',
  warning: 'alert',
  error: 'xCircle',
};

let dialogSequence = 0;
let fieldSequence = 0;

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/**
 * Layanan antarmuka global.
 * - toast(): notifikasi non-blocking
 * - dialog()/confirm()/form()/prompt(): dialog Promise-based
 *
 * Tidak ada satu pun pemanggilan alert(), confirm(), atau prompt() bawaan
 * browser di seluruh aplikasi.
 */
export class UI {
  #toastRoot;
  #modalRoot;
  #toasts = new Set();
  #dialogs = [];

  constructor({ toastRoot, modalRoot } = {}) {
    this.#toastRoot = toastRoot ?? document.querySelector('#toast-root');
    this.#modalRoot = modalRoot ?? document.querySelector('#modal-root');

    if (!this.#toastRoot) {
      this.#toastRoot = el('div', { class: 'toast-stack', id: 'toast-root' });
      document.body.append(this.#toastRoot);
    }
    if (!this.#modalRoot) {
      this.#modalRoot = el('div', { id: 'modal-root' });
      document.body.append(this.#modalRoot);
    }

    this.#bindKeyboardSupport();
  }

  /**
   * Menjaga field yang sedang difokuskan tetap terlihat saat keyboard layar
   * muncul. Didukung `interactive-widget=resizes-content` di meta viewport,
   * lalu area scroll terdekat digeser bila field tertutup keyboard.
   */
  #bindKeyboardSupport() {
    const isTextField = (node) => (
      node instanceof HTMLElement
      && (node.matches('input, textarea, select') || node.isContentEditable)
    );

    const ensureVisible = () => {
      const active = document.activeElement;
      if (!isTextField(active)) return;

      const viewport = window.visualViewport;
      const topEdge = (viewport?.offsetTop ?? 0) + 14;
      const bottomEdge = (
        viewport ? viewport.offsetTop + viewport.height : window.innerHeight
      ) - 18;
      const rect = active.getBoundingClientRect();

      let delta = 0;
      if (rect.bottom > bottomEdge) delta = rect.bottom - bottomEdge;
      else if (rect.top < topEdge) delta = rect.top - topEdge;
      if (Math.abs(delta) < 1) return;

      let scroller = active.parentElement;
      while (scroller && scroller !== document.body && scroller !== document.documentElement) {
        const style = window.getComputedStyle(scroller);
        if (/(auto|scroll)/.test(style.overflowY) && scroller.scrollHeight > scroller.clientHeight + 1) {
          break;
        }
        scroller = scroller.parentElement;
      }

      if (scroller && scroller !== document.body && scroller !== document.documentElement) {
        scroller.scrollTop += delta;
      } else {
        const root = document.scrollingElement ?? document.documentElement;
        root.scrollTop += delta;
      }
    };

    let timer = 0;
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(ensureVisible, 120);
      window.setTimeout(ensureVisible, 360);
    };

    document.addEventListener('focusin', (event) => {
      if (isTextField(event.target)) schedule();
    });
    window.visualViewport?.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('scroll', schedule);
  }

  toast(message, {
    type = 'info',
    duration = 4200,
    action = null,
    dismissible = true,
  } = {}) {
    const safeType = Object.hasOwn(TOAST_ICONS, type) ? type : 'info';

    while (this.#toasts.size >= 3) {
      this.#toasts.values().next().value?.dismiss();
    }

    const toast = el('div', {
      class: `toast toast--${safeType}`,
      role: safeType === 'error' ? 'alert' : 'status',
    });

    const iconSlot = el('span', {
      class: 'toast__icon',
      html: icon(TOAST_ICONS[safeType], 'icon toast__glyph'),
    });

    const body = el('div', { class: 'toast__body' });
    body.append(el('p', { class: 'toast__message', text: String(message) }));

    let actionButton = null;
    if (action?.label) {
      actionButton = el('button', {
        class: 'toast__action',
        type: 'button',
        text: action.label,
      });
      body.append(actionButton);
    }

    const closeButton = dismissible
      ? el('button', {
        class: 'toast__close',
        type: 'button',
        'aria-label': 'Tutup notifikasi',
        html: icon('x', 'icon'),
      })
      : null;

    toast.append(iconSlot, body);
    if (closeButton) toast.append(closeButton);
    this.#toastRoot.append(toast);

    let timer = null;
    let closed = false;

    const dismiss = () => {
      if (closed) return;
      closed = true;
      if (timer) clearTimeout(timer);
      this.#toasts.delete(handle);
      toast.classList.remove('is-visible');
      toast.classList.add('is-leaving');
      window.setTimeout(() => toast.remove(), 240);
    };

    const schedule = () => {
      if (duration > 0) {
        if (timer) clearTimeout(timer);
        timer = window.setTimeout(dismiss, duration);
      }
    };

    const handle = { dismiss, element: toast };
    this.#toasts.add(handle);

    closeButton?.addEventListener('click', dismiss);

    if (actionButton && action) {
      actionButton.addEventListener('click', async () => {
        actionButton.disabled = true;
        try {
          await action.onClick?.();
        } catch (error) {
          console.error('[UI] Aksi toast gagal.', error);
        } finally {
          dismiss();
        }
      });
    }

    toast.addEventListener('pointerenter', () => {
      if (timer) clearTimeout(timer);
    });
    toast.addEventListener('pointerleave', schedule);

    window.requestAnimationFrame(() => toast.classList.add('is-visible'));
    schedule();

    return handle;
  }

  /**
   * Dialog generik. Resolve ke `action.value` saat tombol ditekan,
   * atau null saat ditutup/Escape/klik backdrop.
   */
  dialog({
    title = '',
    description = '',
    content = null,
    actions = [],
    dismissible = true,
    layout = 'sheet',
    className = '',
    closeLabel = 'Tutup',
    initialFocus = null,
    onOpen = null,
  } = {}) {
    const id = ++dialogSequence;
    const previousFocus = document.activeElement;
    const overlay = el('div', {
      class: ['ui-overlay', layout === 'sheet' ? 'ui-overlay--sheet' : ''].filter(Boolean).join(' '),
    });
    const panel = el('section', {
      class: [
        'ui-dialog',
        layout === 'sheet' ? 'ui-dialog--sheet' : '',
        className,
      ].filter(Boolean).join(' '),
      role: 'dialog',
      'aria-modal': 'true',
      tabindex: '-1',
    });

    const headingId = `ui-dialog-title-${id}`;
    const descriptionId = `ui-dialog-description-${id}`;

    if (title) {
      panel.setAttribute('aria-labelledby', headingId);
    } else {
      panel.setAttribute('aria-label', 'Dialog');
    }
    if (description) panel.setAttribute('aria-describedby', descriptionId);

    let closed = false;
    let removeKeydown = () => {};

    const close = (value = null) => {
      if (closed) return;
      closed = true;
      removeKeydown();

      this.#dialogs = this.#dialogs.filter((entry) => entry.id !== id);
      this.#syncShellState();

      overlay.classList.remove('is-open');
      overlay.classList.add('is-closing');
      overlay.style.pointerEvents = 'none';

      const finish = () => {
        overlay.remove();
        if (this.#dialogs.length === 0 && previousFocus?.isConnected) {
          try {
            previousFocus.focus({ preventScroll: true });
          } catch {
            // Elemen lama mungkin sudah tidak bisa difokuskan.
          }
        }
        resolve(value);
      };

      if (prefersReducedMotion()) finish();
      else window.setTimeout(finish, 180);
    };

    const api = { id, overlay, panel, close };
    let resolve;
    const result = new Promise((resolver) => {
      resolve = resolver;
    });

    if (title) {
      const header = el('header', { class: 'ui-dialog__header' });
      const headingCopy = el('div', { class: 'ui-dialog__heading' });
      headingCopy.append(el('h2', { class: 'ui-dialog__title', id: headingId, text: title }));
      if (description) {
        headingCopy.append(el('p', {
          class: 'ui-dialog__description',
          id: descriptionId,
          text: description,
        }));
      }
      header.append(headingCopy);

      if (dismissible) {
        header.append(el('button', {
          class: 'ui-dialog__close',
          type: 'button',
          'aria-label': closeLabel,
          html: icon('x', 'icon'),
          on: { click: () => close(null) },
        }));
      }
      panel.append(header);
    }

    if (content !== null && content !== undefined) {
      const body = el('div', { class: 'ui-dialog__body' });
      if (content instanceof Node) body.append(content);
      else body.append(el('p', { class: 'ui-dialog__text', text: String(content) }));
      panel.append(body);
    }

    if (actions.length > 0) {
      const footer = el('footer', { class: 'ui-dialog__footer' });
      for (const action of actions) {
        const button = el('button', {
          class: `ui-btn ui-btn--${action.variant ?? 'ghost'}`,
          type: 'button',
          text: action.label ?? 'Lanjutkan',
        });
        if (action.autofocus) button.dataset.autofocus = '';
        if (action.title) button.title = action.title;

        button.addEventListener('click', async () => {
          if (action.onClick) {
            try {
              const shouldClose = await action.onClick({ close, dialog: api, button });
              if (shouldClose === false) return;
            } catch (error) {
              console.error('[UI] Aksi dialog gagal.', error);
              return;
            }
          }
          close(action.value !== undefined ? action.value : (action.label ?? null));
        });

        footer.append(button);
      }
      panel.append(footer);
    }

    if (!title && dismissible) {
      panel.prepend(el('button', {
        class: 'ui-dialog__close ui-dialog__close--floating',
        type: 'button',
        'aria-label': closeLabel,
        html: icon('x', 'icon'),
        on: { click: () => close(null) },
      }));
    }

    overlay.append(panel);

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay && dismissible) close(null);
    });

    const onKeydown = (event) => {
      const topDialog = this.#dialogs.at(-1);
      if (!topDialog || topDialog.id !== id) return;

      if (event.key === 'Escape' && dismissible) {
        event.preventDefault();
        close(null);
        return;
      }

      if (event.key !== 'Tab') return;
      const focusables = focusableElements(panel);
      if (focusables.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables.at(-1);
      if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeydown);
    removeKeydown = () => document.removeEventListener('keydown', onKeydown);

    this.#dialogs.push(api);
    this.#syncShellState();
    this.#modalRoot.append(overlay);

    try {
      onOpen?.({ close, panel, dialog: api });
    } catch (error) {
      console.error('[UI] onOpen dialog gagal.', error);
    }

    window.requestAnimationFrame(() => {
      overlay.classList.add('is-open');

      let focusTarget = null;
      if (initialFocus instanceof Element) focusTarget = initialFocus;
      else if (typeof initialFocus === 'string') focusTarget = panel.querySelector(initialFocus);

      focusTarget ??= panel.querySelector('[data-autofocus]');
      focusTarget ??= panel.querySelector('.ui-dialog__body input, .ui-dialog__body textarea, .ui-dialog__body select');
      focusTarget ??= panel.querySelector('.ui-dialog__footer .ui-btn--primary, .ui-dialog__footer .ui-btn--danger');
      focusTarget ??= panel.querySelector('.ui-dialog__close');
      focusTarget ??= panel;

      try {
        focusTarget.focus({ preventScroll: true });
      } catch {
        panel.focus();
      }
    });

    return result;
  }

  async confirm({
    title = 'Konfirmasi',
    message = '',
    confirmLabel = 'Lanjutkan',
    cancelLabel = 'Batal',
    danger = false,
    dismissible = true,
  } = {}) {
    const result = await this.dialog({
      title,
      description: message,
      actions: [
        {
          label: cancelLabel,
          value: false,
          variant: 'ghost',
          autofocus: danger,
        },
        {
          label: confirmLabel,
          value: true,
          variant: danger ? 'danger' : 'primary',
          autofocus: !danger,
        },
      ],
      dismissible,
    });
    return result === true;
  }

  async prompt({
    title = 'Masukkan data',
    message = '',
    label = 'Nilai',
    placeholder = '',
    value = '',
    required = true,
    multiline = false,
    maxlength = 200,
    submitLabel = 'Simpan',
    cancelLabel = 'Batal',
    validate = null,
  } = {}) {
    const result = await this.form({
      title,
      description: message,
      fields: [{
        name: 'value',
        label,
        type: multiline ? 'textarea' : 'text',
        placeholder,
        value,
        required,
        maxlength,
        rows: 3,
        autofocus: true,
      }],
      submitLabel,
      cancelLabel,
      validate: validate
        ? (values) => {
          const problem = validate(values.value);
          return problem ? { value: problem } : null;
        }
        : null,
    });

    return result ? result.value : null;
  }

  /**
   * Form modal generik. Return object nilai, atau null jika dibatalkan.
   * `validate(values)` boleh mengembalikan string (error umum) atau
   * object { namaField: pesanError }.
   */
  async form({
    title = 'Formulir',
    description = '',
    fields = [],
    initialValues = {},
    submitLabel = 'Simpan',
    cancelLabel = 'Batal',
    submitVariant = 'primary',
    validate = null,
    layout = 'center',
    className = '',
  } = {}) {
    if (!Array.isArray(fields) || fields.length === 0) {
      throw new Error('Formulir membutuhkan minimal satu field.');
    }

    const form = el('form', {
      class: 'ui-form',
      novalidate: true,
      autocomplete: 'off',
    });
    const grid = el('div', { class: 'ui-form__grid' });
    const formAlert = el('p', {
      class: 'ui-form__alert',
      role: 'alert',
      hidden: true,
    });
    const refs = new Map();

    const firstFocusCandidate = fields.findIndex((field) => field.autofocus);
    const fallbackFocusIndex = firstFocusCandidate >= 0 ? firstFocusCandidate : 0;

    fields.forEach((field, index) => {
      const fieldId = `ui-field-${++fieldSequence}`;
      const fieldName = field.name;
      if (!fieldName || refs.has(fieldName)) {
        throw new Error('Setiap field formulir harus punya nama unik.');
      }

      const type = field.type ?? 'text';
      const wrapper = el('div', {
        class: ['ui-field', field.half ? 'ui-field--half' : ''].filter(Boolean).join(' '),
      });

      const initialValue = Object.hasOwn(initialValues, fieldName)
        ? initialValues[fieldName]
        : (field.value ?? '');
      const helpId = field.helper ? `${fieldId}-help` : null;
      const errorId = `${fieldId}-error`;
      const labelId = `${fieldId}-label`;
      const requiredMark = field.required
        ? el('span', { class: 'ui-field__required', 'aria-hidden': 'true', text: '*' })
        : null;

      const labelEl = type === 'checkbox'
        ? el('span', { class: 'ui-checkbox__label' })
        : type === 'choice'
          ? el('span', { class: 'ui-field__label', id: labelId })
          : el('label', { class: 'ui-field__label', for: fieldId });
      labelEl.append(document.createTextNode(String(field.label ?? fieldName)));
      if (requiredMark) labelEl.append(requiredMark);

      let control;
      let readValue;
      let focusControl;
      let choiceButtons = null;

      if (type === 'choice') {
        const optionList = (field.options ?? []).map((option) => (
          typeof option === 'object'
            ? { value: String(option.value), label: String(option.label ?? option.value) }
            : { value: String(option), label: String(option) }
        ));
        let selectedValue = initialValue == null ? '' : String(initialValue);
        if (!selectedValue && optionList.length > 0) selectedValue = optionList[0].value;

        const group = el('div', {
          class: 'ui-choice',
          id: fieldId,
          role: 'radiogroup',
          'aria-labelledby': labelId,
        });

        const selectChoice = (nextValue, keepFocus = false) => {
          selectedValue = String(nextValue);
          for (const button of choiceButtons) {
            const isSelected = button.dataset.value === selectedValue;
            button.setAttribute('aria-checked', String(isSelected));
            button.tabIndex = isSelected ? 0 : -1;
            if (keepFocus && isSelected) button.focus();
          }
          clearFieldError(fieldName);
          refreshDynamicFields();
        };

        choiceButtons = optionList.map((option) => {
          const button = el('button', {
            class: 'ui-choice__option',
            type: 'button',
            role: 'radio',
            'aria-checked': String(option.value === selectedValue),
            tabindex: option.value === selectedValue ? '0' : '-1',
            text: option.label,
          });
          button.dataset.value = option.value;
          button.addEventListener('click', () => selectChoice(option.value));
          button.addEventListener('keydown', (event) => {
            const navigationKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
            if (!navigationKeys.includes(event.key)) return;
            event.preventDefault();
            if (choiceButtons.length === 0) return;
            const current = choiceButtons.findIndex((item) => item.dataset.value === selectedValue);
            let next = current;
            if (event.key === 'Home') next = 0;
            else if (event.key === 'End') next = choiceButtons.length - 1;
            else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
              next = (current - 1 + choiceButtons.length) % choiceButtons.length;
            } else {
              next = (current + 1) % choiceButtons.length;
            }
            selectChoice(choiceButtons[next].dataset.value);
            choiceButtons[next].focus();
          });
          group.append(button);
          return button;
        });

        control = group;
        readValue = () => selectedValue;
        focusControl = () => {
          const target = choiceButtons.find((button) => button.dataset.value === selectedValue)
            ?? choiceButtons[0];
          target?.focus();
        };
      } else if (type === 'textarea') {
        control = el('textarea', {
          class: 'ui-input ui-textarea',
          id: fieldId,
          name: fieldName,
          rows: field.rows ?? 3,
          placeholder: field.placeholder ?? '',
          maxlength: field.maxlength ?? null,
        });
        control.value = initialValue == null ? '' : String(initialValue);
      } else if (type === 'select') {
        control = el('select', {
          class: 'ui-input ui-select',
          id: fieldId,
          name: fieldName,
        });

        if (field.placeholder) {
          control.append(el('option', {
            value: '',
            text: field.placeholder,
          }));
        }

        for (const option of field.options ?? []) {
          const optionValue = typeof option === 'object' ? option.value : option;
          const optionLabel = typeof option === 'object' ? option.label : option;
          control.append(el('option', {
            value: String(optionValue),
            text: String(optionLabel),
          }));
        }
        control.value = initialValue == null ? '' : String(initialValue);
      } else if (type === 'checkbox') {
        control = el('input', {
          class: 'ui-checkbox__input',
          type: 'checkbox',
          id: fieldId,
          name: fieldName,
        });
        control.checked = Boolean(initialValue);
      } else {
        const inputType = ['text', 'date', 'number', 'tel', 'url', 'email', 'search'].includes(type)
          ? type
          : 'text';
        control = el('input', {
          class: 'ui-input',
          type: inputType,
          id: fieldId,
          name: fieldName,
          placeholder: field.placeholder ?? '',
          autocomplete: field.autocomplete ?? 'off',
          maxlength: field.maxlength ?? null,
          min: field.min ?? null,
          max: field.max ?? null,
          step: field.step ?? null,
          inputmode: field.inputmode ?? null,
        });
        control.value = initialValue == null ? '' : String(initialValue);
      }

      if (field.attrs && typeof field.attrs === 'object') {
        for (const [attribute, attributeValue] of Object.entries(field.attrs)) {
          if (attributeValue !== null && attributeValue !== undefined && attributeValue !== false) {
            control.setAttribute(attribute, attributeValue === true ? '' : attributeValue);
          }
        }
      }

      control.setAttribute('aria-describedby', [helpId, errorId].filter(Boolean).join(' '));
      if (field.required) {
        if (type !== 'choice') control.setAttribute('required', '');
        control.setAttribute('aria-required', 'true');
      }
      if (index === fallbackFocusIndex) {
        if (type === 'choice') {
          const selectedButton = control.querySelector('[aria-checked="true"]') ?? control.querySelector('[role="radio"]');
          if (selectedButton) selectedButton.dataset.autofocus = '';
        } else {
          control.dataset.autofocus = '';
        }
      }

      if (!readValue) {
        readValue = () => {
          if (type === 'checkbox') return control.checked;
          if (type === 'number') return control.value === '' ? '' : control.valueAsNumber;
          return control.value;
        };
      }
      if (!focusControl) focusControl = () => control.focus();

      if (type === 'checkbox') {
        const label = el('label', { class: 'ui-checkbox', for: fieldId });
        label.append(control, labelEl);
        wrapper.append(label);
      } else {
        wrapper.append(labelEl, control);
      }

      const helperEl = el('p', {
        class: 'ui-field__helper',
        id: helpId,
        hidden: !field.helper,
      });
      const previewEl = el('p', {
        class: 'ui-field__preview',
        hidden: true,
      });
      const error = el('p', {
        class: 'ui-field__error',
        id: errorId,
        hidden: true,
      });
      wrapper.append(previewEl, helperEl, error);

      refs.set(fieldName, {
        field,
        control,
        error,
        wrapper,
        labelEl,
        helperEl,
        previewEl,
        requiredMark,
        readValue,
        focus: focusControl,
      });
      grid.append(wrapper);

      if (type !== 'choice') {
        const handleChange = () => {
          clearFieldError(fieldName);
          refreshDynamicFields();
        };
        control.addEventListener('input', handleChange);
        control.addEventListener('change', handleChange);
      }
    });

    form.append(grid, formAlert);
    refreshDynamicFields();

    let closeDialog = null;
    let submitting = false;

    function collectValues() {
      const values = {};
      for (const [name, ref] of refs) {
        values[name] = ref.readValue();
      }
      return values;
    }

    function isFieldVisible(field, values) {
      return typeof field.visibleWhen === 'function'
        ? Boolean(field.visibleWhen(values))
        : true;
    }

    function refreshDynamicFields() {
      const values = collectValues();
      for (const ref of refs.values()) {
        const { field } = ref;
        const visible = isFieldVisible(field, values);
        ref.wrapper.hidden = !visible;

        const label = typeof field.label === 'function'
          ? field.label(values)
          : (field.label ?? field.name);
        ref.labelEl.textContent = '';
        ref.labelEl.append(document.createTextNode(String(label ?? '')));
        if (field.required && ref.requiredMark) ref.labelEl.append(ref.requiredMark);

        const helper = typeof field.helper === 'function'
          ? field.helper(values)
          : field.helper;
        const helperText = helper == null ? '' : String(helper);
        ref.helperEl.textContent = helperText;
        ref.helperEl.hidden = !helperText;

        const preview = typeof field.preview === 'function'
          ? field.preview(values)
          : field.preview;
        const previewText = preview == null ? '' : String(preview);
        ref.previewEl.textContent = previewText;
        ref.previewEl.hidden = !visible || !previewText;
      }
    }

    const showError = (name, message) => {
      const ref = refs.get(name);
      if (!ref) return;
      ref.error.textContent = message;
      ref.error.hidden = false;
      ref.control.setAttribute('aria-invalid', 'true');
    };

    function clearFieldError(name) {
      const ref = refs.get(name);
      if (!ref) return;
      ref.error.hidden = true;
      ref.error.textContent = '';
      ref.control.removeAttribute('aria-invalid');
      formAlert.hidden = true;
      formAlert.textContent = '';
    }

    const runValidation = (values) => {
      const errors = {};
      formAlert.hidden = true;
      formAlert.textContent = '';

      for (const [name, { field, control, error }] of refs) {
        error.hidden = true;
        error.textContent = '';
        control.removeAttribute('aria-invalid');

        if (!isFieldVisible(field, values)) continue;

        const value = values[name];
        const empty = field.type === 'checkbox'
          ? !value
          : String(value ?? '').trim() === '';

        if (field.required && empty) {
          errors[name] = field.type === 'checkbox'
            ? 'Centang untuk melanjutkan.'
            : (field.type === 'select' || field.type === 'choice'
              ? 'Pilih salah satu opsi.'
              : 'Bagian ini wajib diisi.');
          continue;
        }

        if (empty) continue;

        if (field.maxlength && String(value).length > Number(field.maxlength)) {
          errors[name] = `Maksimal ${field.maxlength} karakter.`;
          continue;
        }

        if (field.type === 'number') {
          if (Number.isNaN(value)) {
            errors[name] = 'Masukkan angka yang valid.';
            continue;
          }
          if (field.min !== undefined && value < Number(field.min)) {
            errors[name] = `Nilai minimal ${field.min}.`;
            continue;
          }
          if (field.max !== undefined && value > Number(field.max)) {
            errors[name] = `Nilai maksimal ${field.max}.`;
            continue;
          }
        }

        if (field.type === 'date') {
          if (field.min && String(value) < String(field.min)) {
            errors[name] = `Tanggal tidak boleh sebelum ${field.min}.`;
            continue;
          }
          if (field.max && String(value) > String(field.max)) {
            errors[name] = `Tanggal tidak boleh setelah ${field.max}.`;
            continue;
          }
        }

        if (typeof field.validate === 'function') {
          const message = field.validate(value, values);
          if (message) {
            errors[name] = String(message);
          }
        }
      }

      if (typeof validate === 'function') {
        const custom = validate(values);
        if (typeof custom === 'string' && custom.trim()) {
          formAlert.textContent = custom;
          formAlert.hidden = false;
        } else if (custom && typeof custom === 'object') {
          Object.assign(errors, custom);
        }
      }

      return errors;
    };

    const submit = () => {
      if (submitting) return;
      const values = collectValues();
      const errors = runValidation(values);
      const errorEntries = Object.entries(errors);

      if (errorEntries.length > 0) {
        for (const [name, message] of errorEntries) showError(name, message);
        const firstInvalid = errorEntries[0][0];
        refs.get(firstInvalid)?.focus?.();
        return;
      }

      submitting = true;
      closeDialog?.(values);
    };

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submit();
    });

    const result = await this.dialog({
      title,
      description,
      content: form,
      layout,
      className: ['ui-dialog--form', className].filter(Boolean).join(' '),
      actions: [
        {
          label: cancelLabel,
          value: null,
          variant: 'ghost',
        },
        {
          label: submitLabel,
          variant: submitVariant,
          onClick: () => {
            submit();
            return false;
          },
        },
      ],
      onOpen: ({ close }) => {
        closeDialog = close;
      },
    });

    return result && typeof result === 'object' ? result : null;
  }

  dismissTop(value = null) {
    this.#dialogs.at(-1)?.close(value);
  }

  closeAll(value = null) {
    for (const dialog of [...this.#dialogs].reverse()) {
      dialog.close(value);
    }
  }

  get hasOpenDialog() {
    return this.#dialogs.length > 0;
  }

  #syncShellState() {
    const hasDialogs = this.#dialogs.length > 0;
    document.body.classList.toggle('has-dialog', hasDialogs);
    const shell = document.querySelector('#app-shell');
    if (shell) shell.inert = hasDialogs;
  }
}
