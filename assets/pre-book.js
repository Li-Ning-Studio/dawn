if (!customElements.get('pre-book-form')) {
  customElements.define(
    'pre-book-form',
    class extends HTMLElement {
      connectedCallback() {
        if (this.form) return;
        this.form = this.querySelector('form[data-prebook]');
        this.messages = JSON.parse(this.querySelector('[data-prebook-messages]').textContent);
        this.button = this.form.querySelector('[type="submit"]');
        this.buttonLabel = this.button.querySelector('[data-prebook-button-label]');
        this.error = this.form.querySelector('[data-prebook-error]');
        this.submit = this.onSubmit.bind(this);
        this.restore = (event) => {
          if (event.persisted) this.resetRequest();
        };
        this.form.noValidate = true;
        this.form.addEventListener('submit', this.submit);
        window.addEventListener('pageshow', this.restore);
        this.resetRequest();
        if (this.dataset.enabled === 'true' && !this.endpoint()) this.showError(this.messages.unavailable);
        this.showResult();
      }

      disconnectedCallback() {
        this.resetRequest();
        this.form.removeEventListener('submit', this.submit);
        window.removeEventListener('pageshow', this.restore);
        this.form = null;
      }

      endpoint() {
        try {
          const url = new URL(this.dataset.serverUrl);
          if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null;
          return url.href.replace(/\/$/, '') + '/pre-book/initiate';
        } catch {
          return null;
        }
      }

      setBusy(busy) {
        this.form.toggleAttribute('data-prebook-busy', busy);
        this.form.setAttribute('aria-busy', String(busy));
        this.button.disabled = busy || this.dataset.enabled !== 'true' || !this.endpoint();
        this.buttonLabel.textContent = busy ? this.messages.busy : this.messages.submit;
      }

      resetRequest() {
        // Abort and invalidate the old request before restoring a page from the back/forward cache.
        // A late response must never redirect a shopper who has already returned or changed pages.
        this.request?.abort();
        this.request = null;
        if (this.form) this.setBusy(false);
      }

      fields(name) {
        return Array.from(this.form.elements).filter((field) => field.name === name);
      }

      showError(message = '', names = []) {
        this.form.querySelectorAll('[aria-invalid]').forEach((field) => field.removeAttribute('aria-invalid'));
        names.forEach((name) => this.fields(name).forEach((field) => field.setAttribute('aria-invalid', 'true')));
        this.error.textContent = message;
        if (message) (this.fields(names[0])[0] || this.error).focus();
        this.form.dispatchEvent(new CustomEvent('prebook:error', { detail: { message, fields: names } }));
      }

      collect() {
        // FormData excludes unchecked radios, including a group with just one colourway.
        const fields = new FormData(this.form);
        const read = (name) =>
          String(fields.get(name) || '')
            .trim()
            .replace(/\s+/g, ' ');
        const phone = read('phone').replace(/[\s()-]/g, '');
        return {
          product: this.form.dataset.prebook,
          name: read('name'),
          email: read('email').toLowerCase(),
          phone: phone.replace(/^\+91(?=[6-9]\d{9}$)/, ''),
          options: { colour: read('option[colour]'), size: read('option[size]') },
          return_url: location.origin + location.pathname,
        };
      }

      validate(data) {
        if (!data.options.colour) return ['option[colour]', this.messages.colour];
        if (!data.options.size) return ['option[size]', this.messages.size];
        if (data.name.length < 2) return ['name', this.messages.name];
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email)) return ['email', this.messages.email];
        if (!/^[6-9]\d{9}$/.test(data.phone)) return ['phone', this.messages.phone];
        return null;
      }

      paymentUrl(value) {
        try {
          const url = new URL(value);
          if (
            url.protocol === 'https:' &&
            ['pay.easebuzz.in', 'testpay.easebuzz.in'].includes(url.hostname) &&
            !url.username &&
            !url.password &&
            !url.port &&
            url.pathname.startsWith('/pay/')
          ) {
            return url.href;
          }
        } catch {
          // A malformed checkout URL is handled as a failed initiation, without navigating away.
        }
        return null;
      }

      async onSubmit(event) {
        event.preventDefault();
        if (this.request || this.dataset.enabled !== 'true') return;
        const endpoint = this.endpoint();
        if (!endpoint) return this.showError(this.messages.unavailable);
        const data = this.collect();
        const invalid = this.validate(data);
        if (invalid) return this.showError(invalid[1], [invalid[0]]);
        this.showError();
        const request = new AbortController();
        this.request = request;
        this.setBusy(true);
        const timeout = setTimeout(() => request.abort(), 20000);
        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            signal: request.signal,
            credentials: 'omit',
          });
          const result = await response.json().catch(() => ({}));
          if (this.request !== request) return;
          if (!response.ok) {
            const names = (Array.isArray(result?.invalid) ? result.invalid : [])
              .filter((name) => ['name', 'email', 'phone', 'colour', 'size'].includes(name))
              .map((name) => (['colour', 'size'].includes(name) ? `option[${name}]` : name));
            const message =
              response.status === 400
                ? this.messages.details
                : [404, 503].includes(response.status)
                  ? this.messages.unavailable
                  : this.messages.generic;
            this.showError(message, names);
            return;
          }
          const paymentUrl = this.paymentUrl(result?.payment_url);
          if (!paymentUrl) return this.showError(this.messages.generic);
          this.form.dispatchEvent(
            new CustomEvent('prebook:redirect', { detail: { ...result, payment_url: paymentUrl } }),
          );
          // Keep the button locked during navigation. pageshow unlocks it on a browser Back action.
          location.assign(paymentUrl);
        } catch (error) {
          if (this.request === request) {
            this.showError(error.name === 'AbortError' ? this.messages.timeout : this.messages.network);
          }
        } finally {
          clearTimeout(timeout);
          if (this.request === request && this.error.textContent) {
            this.request = null;
            this.setBusy(false);
          }
        }
      }

      showResult() {
        const result = new URLSearchParams(location.search).get('prebook');
        if (!['success', 'failed'].includes(result)) return;
        // This query parameter is display-only. Only the verified backend webhook records payment.
        const status = this.querySelector(`[data-prebook-${result}]`);
        if (status) {
          status.hidden = false;
          status.focus();
        }
        document.dispatchEvent(new CustomEvent('prebook:result', { detail: { result } }));
      }
    },
  );
}
