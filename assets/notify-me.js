if (!customElements.get('notify-me')) {
  customElements.define(
    'notify-me',
    class NotifyMe extends HTMLElement {
      connectedCallback() {
        this.dialog = this.querySelector('dialog');
        this.form = this.querySelector('form');
        this.opener = this.querySelector('[data-notify-open]');
        this.purchaseButton = document.getElementById(this.dataset.submitId);
        this.submitButton = this.form.querySelector('[type="submit"]');
        this.failure = this.querySelector('[data-notify-failure]');
        this.success = this.querySelector('[data-notify-success]');
        this.listeners = new AbortController();
        const options = { signal: this.listeners.signal };

        this.opener.addEventListener('click', () => this.open(this.opener), options);
        this.querySelector('[data-notify-close]').addEventListener('click', () => this.dialog.close(), options);
        this.dialog.addEventListener('close', () => this.restoreFocus(), options);
        this.dialog.addEventListener(
          'click',
          (event) => {
            const bounds = this.dialog.getBoundingClientRect();
            if (
              event.target === this.dialog &&
              (event.clientX < bounds.left ||
                event.clientX > bounds.right ||
                event.clientY < bounds.top ||
                event.clientY > bounds.bottom)
            ) {
              this.dialog.close();
            }
          },
          options,
        );
        this.form.addEventListener('submit', (event) => this.submit(event), options);
        this.form.addEventListener(
          'input',
          (event) => {
            if (event.target.name) this.setFieldError(event.target.name, false);
            this.failure.hidden = true;
          },
          options,
        );
        this.setVariant(this);
      }

      disconnectedCallback() {
        this.listeners?.abort();
        this.cancelRequest();
        if (this.dialog?.open) this.dialog.close();
        this.purchaseButton?.classList.remove('hidden');
      }

      get endpoint() {
        if (window.s3_brand === 'Hundred') return 'https://sitemap.hndrd.co/out-of-stock/hndrd';
        if (window.s3_brand === 'Studio') return 'https://sitemap.lining.studio/out-of-stock/studio';
        return null;
      }

      get configured() {
        const token = window.s3_pat?.trim();
        return (
          !!this.endpoint && !!token && token !== 'AMYGDALA_IS_OUTDATED' && typeof this.dialog.showModal === 'function'
        );
      }

      // ProductInfo calls this before fetching the next selection. Invalidate
      // the old request immediately: aborting fetch does not undo a server save,
      // and a late response must never confirm a different variant's signup.
      suspend() {
        this.ready = false;
        this.opener.disabled = true;
        this.cancelRequest();
        if (this.dialog.open) this.dialog.close();
      }

      setVariant(source) {
        const data = source?.dataset;
        const variantId = data?.variantId || '';
        const sku = data?.sku?.trim() || '';
        if (variantId !== this.variantId || sku !== this.sku) {
          this.cancelRequest();
          this.success.hidden = true;
          this.form.hidden = false;
          this.clearErrors();
        }
        this.variantId = variantId;
        this.sku = sku;
        this.ready = this.configured && !!variantId && !!sku && data?.available === 'false';
        this.hidden = !this.ready;
        this.opener.disabled = !this.ready;
        this.purchaseButton?.classList.toggle('hidden', this.ready);
        this.querySelector('[data-notify-product]').textContent = data?.productTitle || '';
        this.querySelector('[data-notify-variant]').textContent = data?.variantTitle || '';
        if (!this.ready && this.dialog.open) this.dialog.close();
      }

      open(opener) {
        if (!this.ready || !this.configured || this.dialog.open) return;
        this.openedBy = opener;
        this.dialog.showModal();
        if (!this.success.hidden) this.success.focus();
        else this.form.elements.name.focus();
      }

      restoreFocus() {
        if (this.openedBy?.isConnected && !this.openedBy.disabled) this.openedBy.focus();
      }

      setFieldError(name, invalid) {
        const input = this.form.elements.namedItem(name);
        const message = this.querySelector(`[data-notify-error="${name}"]`);
        if (!input || !message) return;
        input.setAttribute('aria-invalid', String(invalid));
        message.textContent = invalid ? this.dataset[`error${name[0].toUpperCase()}${name.slice(1)}`] : '';
        message.hidden = !invalid;
      }

      clearErrors() {
        ['name', 'number', 'email'].forEach((name) => this.setFieldError(name, false));
        this.failure.hidden = true;
      }

      setPending(pending) {
        this.pending = pending;
        this.submitButton.disabled = pending;
        this.form.setAttribute('aria-busy', String(pending));
        this.querySelector('[data-notify-submit-label]').hidden = pending;
        this.querySelector('[data-notify-saving]').hidden = !pending;
        // Freeze the submitted contact details until this request completes.
        Array.from(this.form.elements).forEach((input) => {
          if (input.tagName === 'INPUT') input.readOnly = pending;
        });
      }

      cancelRequest() {
        this.request?.abort();
        this.request = null;
        clearTimeout(this.requestTimeout);
        if (this.form) this.setPending(false);
      }

      async submit(event) {
        event.preventDefault();
        if (!this.ready || !this.configured || this.pending || !this.success.hidden) return;
        this.clearErrors();
        const name = this.form.elements.name.value.trim();
        const rawNumber = this.form.elements.number.value.trim();
        let number = rawNumber.replace(/[\s()-]/g, '');
        if (/^(?:\+91|91)\d{10}$/.test(number)) number = number.slice(-10);
        const email = this.form.elements.email.value.trim();
        const invalid = [];
        if (!name || name.length > 200) invalid.push('name');
        if (!/^\d{10}$/.test(number)) invalid.push('number');
        if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200)) invalid.push('email');
        if (invalid.length) {
          invalid.forEach((field) => this.setFieldError(field, true));
          this.form.elements.namedItem(invalid[0]).focus();
          return;
        }

        const url = new URL(this.endpoint);
        url.search = new URLSearchParams({ name, number, sku: this.sku, ...(email ? { email } : {}) }).toString();
        const request = new AbortController();
        this.request = request;
        this.setPending(true);
        this.requestTimeout = setTimeout(() => request.abort(), 15000);
        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: { Authorization: window.s3_pat },
            credentials: 'omit',
            signal: request.signal,
          });
          if (this.request !== request || !this.isConnected) return;
          if (response.ok) {
            this.form.hidden = true;
            this.success.hidden = false;
            if (this.dialog.open) this.success.focus();
          } else {
            const body = await response.json().catch(() => null);
            if (this.request !== request || !this.isConnected) return;
            const fields =
              response.status === 400 && Array.isArray(body?.invalid)
                ? body.invalid.filter((field) => ['name', 'number', 'email'].includes(field))
                : [];
            fields.forEach((field) => this.setFieldError(field, true));
            if (fields.length && this.dialog.open) this.form.elements.namedItem(fields[0]).focus();
            else this.failure.hidden = false;
          }
        } catch {
          if (this.request === request && this.isConnected) this.failure.hidden = false;
        } finally {
          if (this.request === request) {
            clearTimeout(this.requestTimeout);
            this.request = null;
            this.setPending(false);
          }
        }
      }
    },
  );
}
