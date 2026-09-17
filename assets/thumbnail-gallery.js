document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('media-gallery[data-desktop-layout="thumbnail"]').forEach(function (gallery) {
    const slides = Array.from(gallery.querySelectorAll('.product__media-item'));
    const thumbs = Array.from(gallery.querySelectorAll('.thumbnail-list__item'));
    const prev = gallery.querySelector('.product__media-slider-buttons .slider-button--prev');
    const next = gallery.querySelector('.product__media-slider-buttons .slider-button--next');

    if (slides.length < 2) return;

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

      thumbs.forEach(function (thumb, n) {
        const btn = thumb.querySelector('button');
        if (btn) {
          if (n === index) {
            btn.setAttribute('aria-current', 'true');
          } else {
            btn.removeAttribute('aria-current');
          }
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

    if (prev) {
      prev.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        show(index - 1);
      }, true);
    }

    if (next) {
      next.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        show(index + 1);
      }, true);
    }

    show(index);
  });
});