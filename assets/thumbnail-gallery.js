document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('media-gallery[data-desktop-layout="thumbnail"]').forEach(function (gallery) {
    const slides = Array.from(gallery.querySelectorAll('.product__media-item'));
    const thumbs = Array.from(gallery.querySelectorAll('.thumbnail-list__item'));
    const viewer = gallery.querySelector('slider-component');
    if (slides.length < 2 || !viewer) return;

    slides.forEach(function (slide) {
      slide.querySelectorAll('img').forEach(function (img) {
        img.setAttribute('loading', 'eager');
        img.style.opacity = '1';
        img.style.transform = 'none';
        const holder = img.closest('.product-thumbnail-skeleton');
        if (holder) holder.classList.remove('product-thumbnail-skeleton');
        const src = img.getAttribute('src');
        if (src) img.setAttribute('src', src);
      });
    });

    let index = slides.findIndex(function (s) { return s.classList.contains('is-active'); });
    if (index < 0) index = 0;

    function show(i) {
      if (i < 0) i = slides.length - 1;
      if (i >= slides.length) i = 0;
      index = i;
      slides.forEach(function (s, n) { s.classList.toggle('is-active', n === index); });
      thumbs.forEach(function (t, n) {
        const b = t.querySelector('button');
        if (!b) return;
        if (n === index) b.setAttribute('aria-current', 'true');
        else b.removeAttribute('aria-current');
      });
    }

    thumbs.forEach(function (t, n) {
      t.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        show(n);
      }, true);
    });

    const old = gallery.querySelector('.product__media-slider-buttons');
    if (old) old.remove();

    const nav = document.createElement('div');
    nav.style.cssText = 'position:absolute;right:24px;bottom:24px;z-index:10;display:flex;gap:12px;';

    function makeBtn(rotate, fn) {
      const b = document.createElement('button');
      b.type = 'button';
      b.style.cssText = 'width:52px;height:52px;display:flex;align-items:center;justify-content:center;border:1px solid rgba(0,0,0,.12);border-radius:50%;background:#fff;cursor:pointer;padding:0;';
      b.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="transform:rotate(' + rotate + 'deg)"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
      b.addEventListener('click', fn);
      return b;
    }

    nav.appendChild(makeBtn(180, function () { show(index - 1); }));
    nav.appendChild(makeBtn(0, function () { show(index + 1); }));

    viewer.style.position = 'relative';
    viewer.appendChild(nav);

    show(index);
  });
});