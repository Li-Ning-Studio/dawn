document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('media-gallery[data-desktop-layout="thumbnail"]').forEach(function (gallery) {
    const slides = Array.from(gallery.querySelectorAll('.product__media-item'));
    const thumbs = Array.from(gallery.querySelectorAll('.thumbnail-list__item'));
    const viewer = gallery.querySelector('slider-component');
    if (slides.length < 2 || !viewer) return;

    function reveal(slide) {
      slide.querySelectorAll('img').forEach(function (img) {
        img.loading = 'eager';
        img.style.opacity = '1';
        img.style.transform = 'scale(1)';
        const holder = img.closest('.product-thumbnail-skeleton');
        if (holder) holder.classList.remove('product-thumbnail-skeleton');
      });
    }

    let index = slides.findIndex(function (s) {
      return s.classList.contains('is-active');
    });
    if (index < 0) index = 0;

    function show(i) {
      if (i < 0) i = slides.length - 1;
      if (i >= slides.length) i = 0;
      index = i;

      slides.forEach(function (slide, n) {
        slide.classList.toggle('is-active', n === index);
      });

      reveal(slides[index]);

      thumbs.forEach(function (thumb, n) {
        const btn = thumb.querySelector('button');
        if (!btn) return;
        if (n === index) {
          btn.setAttribute('aria-current', 'true');
        } else {
          btn.removeAttribute('aria-current');
        }
      });

      if (thumbs[index]) {
        thumbs[index].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }

    thumbs.forEach(function (thumb, n) {
      thumb.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        show(n);
      }, true);
    });

    const old = gallery.querySelector('.product__media-slider-buttons');
    if (old) old.remove();

    const nav = document.createElement('div');
    nav.style.cssText = 'position:absolute;right:24px;bottom:24px;z-index:5;display:flex;gap:12px;';

    function makeBtn(dir, rotate) {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', dir);
      b.style.cssText =
        'width:52px;height:52px;display:flex;align-items:center;justify-content:center;' +
        'border:1px solid rgba(0,0,0,0.12);border-radius:50%;background:#fff;cursor:pointer;padding:0;';
      b.innerHTML =
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.5" ' +
        'stroke-linecap="round" stroke-linejoin="round" style="transform:rotate(' + rotate + 'deg)">' +
        '<path d="M5 12h14M13 6l6 6-6 6"/></svg>';
      return b;
    }

    const prev = makeBtn('Previous', 180);
    const next = makeBtn('Next', 0);

    prev.addEventListener('click', function () { show(index - 1); });
    next.addEventListener('click', function () { show(index + 1); });

    nav.appendChild(prev);
    nav.appendChild(next);

    viewer.style.position = 'relative';
    viewer.appendChild(nav);

    show(index);
  });
});