/**
 * <product-reviews>: renders Judge.me reviews in our own markup (sections/product-reviews.liquid).
 * Spec and Judge.me markup/endpoint notes: docs/superpowers/specs/2026-11-25-pdp-reviews-design.md
 *
 * Data sources (no token needed):
 * - Page 1: the Judge.me app block server-renders `.jdgm-rev` items into the page; we read them.
 * - Breakdown, sort, star filter, further pages: Judge.me's public widget endpoint (the one its own
 *   pagination uses), which returns `{ html, total_count }`; `html` holds `.jdgm-rev` items.
 *
 * Safety: review text is copied with textContent only; Judge.me HTML is never injected.
 * Fallback: if the widget is missing or no review can be parsed, our list stays empty and the
 * Judge.me widget is left visible (class `product-reviews--fallback`), so reviews never vanish.
 */
if (!customElements.get('product-reviews')) {
  const ENDPOINT = 'https://cdn.judge.me/reviews/reviews_for_widget';

  class ProductReviews extends HTMLElement {
    connectedCallback() {
      this.count = Number(this.dataset.count) || 0;
      this.perPage = Number(this.dataset.perPage) || 5;
      this.page = 1;
      this.query = {}; // current sort / filter params for the endpoint
      this.strings = JSON.parse(this.querySelector('[data-strings]')?.textContent || '{}');
      this.list = this.querySelector('.product-reviews__list');
      this.more = this.querySelector('[data-more]');
      this.status = this.querySelector('.product-reviews__status');
      this.bars = this.querySelector('.product-reviews__bars');

      this.adoptJudgeme();

      this.querySelector('[data-write-review]')?.addEventListener('click', () =>
        this.clickJudgeme('.jdgm-write-rev-link'),
      );
      this.querySelector('[data-ask-question]')?.addEventListener('click', () =>
        this.clickJudgeme('.jdgm-ask-question-btn'),
      );
      this.more?.addEventListener('click', () => {
        // While a sort/filter is loading, `this.page` still belongs to the old list.
        if (this.hasAttribute('aria-busy')) return;
        this.load(this.page + 1, true);
      });
      this.querySelector('[data-sort]')?.addEventListener('change', (event) => {
        const [sortBy, sortDir] = event.target.value.split(':');
        delete this.query.sort_by;
        delete this.query.sort_dir;
        if (sortBy) this.query.sort_by = sortBy;
        if (sortDir) this.query.sort_dir = sortDir;
        this.load(1, false);
      });

      // Breakdown costs 5 small requests, so only fetch it when the section is about to be seen.
      if (this.count > 0 && this.bars) {
        new IntersectionObserver(
          (entries, observer) => {
            if (!entries.some((entry) => entry.isIntersecting)) return;
            observer.disconnect();
            this.loadBreakdown();
          },
          { rootMargin: '400px 0px' },
        ).observe(this);
      }
    }

    /**
     * Move Judge.me's widget into our slot (keeps its question form in place) and render page 1
     * from it. The widget element is moved, not cloned, so Judge.me's own handlers keep working.
     */
    adoptJudgeme() {
      this.widget = document.getElementById('judgeme_product_reviews');
      if (!this.widget) {
        // Nothing to read or trigger: hide our controls that depend on Judge.me.
        this.querySelector('.product-reviews__actions')?.setAttribute('hidden', '');
        if (this.count > 0) this.fail();
        return;
      }
      this.querySelector('[data-judgeme-slot]')?.appendChild(this.widget);
      if (this.count === 0) {
        // The count comes from the synced reviews.rating_count metafield. If it's stale at 0 while
        // Judge.me has reviews (sync off / just reviewed), show Judge.me's widget, not "No reviews".
        if (this.widget.querySelector('.jdgm-rev')) this.fail();
        return;
      }

      // Page size follows the store's Judge.me "reviews per page" setting, which decided how many
      // items it server-rendered; data-per-page is only the fallback. (Fewer than a full page only
      // happens when that's all there is, so "Show more" stays hidden either way.)
      const firstPage = this.widget.querySelectorAll('.jdgm-rev').length;
      if (firstPage) this.perPage = firstPage;

      const reviews = this.parse(this.widget);
      if (!reviews.length) return this.fail();
      this.render(reviews, false);
      this.querySelector('.product-reviews__sort-row')?.removeAttribute('hidden');
      this.updateMore(this.count);
    }

    /** Keep Judge.me's widget visible instead of our list. */
    fail() {
      this.classList.add('product-reviews--fallback');
    }

    clickJudgeme(selector) {
      this.widget?.querySelector(selector)?.click();
    }

    url(params) {
      const search = new URLSearchParams({
        url: location.host,
        shop_domain: this.dataset.shopDomain,
        platform: 'shopify',
        product_id: this.dataset.productId,
        per_page: String(this.perPage),
        page: '1',
        ...params,
      });
      return `${ENDPOINT}?${search}`;
    }

    async fetchPage(params) {
      const response = await fetch(this.url(params));
      if (!response.ok) throw new Error(`Judge.me ${response.status}`);
      const data = await response.json();
      const doc = new DOMParser().parseFromString(data.html || '', 'text/html');
      return { reviews: this.parse(doc), total: Number(data.total_count) || 0 };
    }

    /** Load a page with the current query; `append` keeps the existing items (Show more). */
    async load(page, append) {
      // Only the latest request may render: a slow "Show more" must not append to a newer sort/filter.
      const request = (this.request = (this.request || 0) + 1);
      this.setAttribute('aria-busy', 'true');
      this.status.hidden = true;
      // A new sort/filter starts over: no "Show more" until its first page is in.
      if (!append && this.more) this.more.hidden = true;
      try {
        const { reviews, total } = await this.fetchPage({ ...this.query, page: String(page) });
        if (request !== this.request) return;
        this.page = page;
        this.render(reviews, append);
        this.updateMore(total);
      } catch (error) {
        console.warn('[product-reviews]', error);
        if (request === this.request) this.status.hidden = false;
      } finally {
        if (request === this.request) this.removeAttribute('aria-busy');
      }
    }

    updateMore(total) {
      if (this.more) this.more.hidden = this.page * this.perPage >= total;
    }

    /** Star breakdown: one request per star with per_page=1, reading total_count. */
    async loadBreakdown() {
      // In fallback Judge.me's own widget shows; our bars would filter a hidden list.
      if (this.classList.contains('product-reviews--fallback')) return;
      try {
        const totals = await Promise.all(
          [5, 4, 3, 2, 1].map((star) =>
            this.fetchPage({ filter_rating: String(star), per_page: '1' }).then((result) => [star, result.total]),
          ),
        );
        const max = Math.max(...totals.map(([, total]) => total), 1);
        this.bars.replaceChildren(
          ...totals.map(([star, total]) => {
            const row = document.createElement('button');
            row.type = 'button';
            row.className = 'product-reviews__bar';
            row.dataset.star = star;
            row.setAttribute('aria-pressed', 'false');
            row.setAttribute(
              'aria-label',
              (this.strings.filterLabel || '').replace('[star]', star).replace('[count]', total),
            );
            row.disabled = total === 0;
            row.innerHTML =
              '<span></span><span class="product-reviews__track meter"><span class="meter__fill"></span></span><span></span>';
            row.children[0].textContent = star;
            row.children[1].firstChild.style.width = `${(total / max) * 100}%`;
            row.children[2].textContent = total;
            row.addEventListener('click', () => this.toggleStar(row));
            return row;
          }),
        );
        this.bars.hidden = false;
      } catch (error) {
        // The breakdown is extra; the summary and list still work without it.
        console.warn('[product-reviews]', error);
      }
    }

    /** Breakdown rows act as filters: tap a star to show only those reviews, tap again to clear. */
    toggleStar(row) {
      const active = row.getAttribute('aria-pressed') === 'true';
      this.bars.querySelectorAll('[aria-pressed]').forEach((bar) => bar.setAttribute('aria-pressed', 'false'));
      if (active) {
        delete this.query.filter_rating;
      } else {
        row.setAttribute('aria-pressed', 'true');
        this.query.filter_rating = row.dataset.star;
      }
      this.load(1, false);
    }

    /** Read Judge.me `.jdgm-rev` items into plain objects (text only). */
    parse(root) {
      const text = (el, selector) => el.querySelector(selector)?.textContent.trim() || '';
      return [...root.querySelectorAll('.jdgm-rev')]
        .map((el) => ({
          score: Number(el.querySelector('.jdgm-rev__rating')?.dataset.score) || 0,
          date: el.querySelector('.jdgm-rev__timestamp')?.getAttribute('data-content') || '',
          author: text(el, '.jdgm-rev__author'),
          // Judge.me wraps the location in parentheses on small screens: "(Tumkūr, IN)".
          location: text(el, '.jdgm-rev__location').replace(/^\((.*)\)$/, '$1'),
          title: text(el, '.jdgm-rev__title'),
          // Rating-only reviews come through with bodies like "....": drop text with no letters or digits.
          body: [...el.querySelectorAll('.jdgm-rev__body p')]
            .map((p) => p.textContent.trim())
            .filter((paragraph) => /[\p{L}\p{N}]/u.test(paragraph)),
          bodyText: text(el, '.jdgm-rev__body').replace(/^[^\p{L}\p{N}]+$/u, ''),
          photos: [...el.querySelectorAll('.jdgm-rev__pic-link')]
            .map((a) => ({ href: a.href, src: a.querySelector('img')?.dataset.src || a.querySelector('img')?.src }))
            .filter((photo) => photo.src),
          reply: text(el, '.jdgm-rev__reply-content'),
        }))
        .filter((review) => review.score > 0);
    }

    formatDate(value) {
      // Judge.me format: "2025-11-24 14:46:15 UTC"
      const date = new Date(value.replace(' UTC', 'Z').replace(' ', 'T'));
      if (Number.isNaN(date.getTime())) return '';
      // data-locale is e.g. "en-IN" (language + store country), giving "16 Oct 2026" in India.
      return new Intl.DateTimeFormat(this.dataset.locale || document.documentElement.lang || undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(date);
    }

    render(reviews, append) {
      const items = reviews.map((review) => this.item(review));
      if (append) this.list.append(...items);
      else this.list.replaceChildren(...items);
    }

    item(review) {
      const el = (tag, className, content) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (content) node.textContent = content;
        return node;
      };
      const li = el('li', 'product-reviews__item');

      const head = el('div', 'product-reviews__item-head');
      // Same star markup as the summary (icon-star.svg), from <template data-stars>.
      const stars = el('span', 'product-reviews__stars product-reviews__stars--small');
      stars.append(this.querySelector('template[data-stars]').content.cloneNode(true));
      stars.style.setProperty('--percent', `${review.score * 20}%`);
      stars.setAttribute('role', 'img');
      stars.setAttribute('aria-label', (this.strings.starsLabel || '').replace('[score]', review.score));
      const time = el('time', 'product-reviews__date', this.formatDate(review.date));
      time.dateTime = review.date.replace(' UTC', 'Z').replace(' ', 'T');
      head.append(stars, time);
      li.append(head);

      const who = el('p', 'product-reviews__author');
      who.append(el('span', 'product-reviews__name', review.author));
      if (review.location) who.append(el('span', 'product-reviews__meta', review.location));
      li.append(who);

      if (review.title && review.title !== review.bodyText) li.append(el('p', 'product-reviews__title', review.title));
      const paragraphs = review.body.length ? review.body : [review.bodyText].filter(Boolean);
      if (paragraphs.length) {
        const body = el('div', 'product-reviews__body');
        paragraphs.forEach((paragraph) => body.append(el('p', '', paragraph)));
        li.append(body);
      }

      if (review.photos.length) {
        const photos = el('div', 'product-reviews__photos');
        review.photos.forEach((photo, index) => {
          const link = el('a', 'product-reviews__photo');
          link.href = photo.href || photo.src;
          link.target = '_blank';
          link.rel = 'nofollow noopener';
          const img = el('img');
          img.src = photo.src;
          img.alt = `${this.strings.photo || ''} ${index + 1}`.trim();
          img.loading = 'lazy';
          img.width = 72;
          img.height = 72;
          link.append(img);
          photos.append(link);
        });
        li.append(photos);
      }

      if (review.reply) {
        // Brand-agnostic: a reply icon instead of the store name; the label is for screen readers only.
        const reply = el('div', 'product-reviews__reply');
        reply.append(this.querySelector('template[data-reply-icon]').content.cloneNode(true));
        const replyText = el('p');
        replyText.append(el('span', 'visually-hidden', `${this.strings.reply || ''}: `), review.reply);
        reply.append(replyText);
        li.append(reply);
      }
      return li;
    }
  }

  customElements.define('product-reviews', ProductReviews);
}
