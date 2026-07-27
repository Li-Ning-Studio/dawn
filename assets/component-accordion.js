class AccordionAnimator {
  constructor(details) {
    this.details = details;
    this.summary = details.querySelector('summary');
    this.animation = null;
    this.isClosing = false;
    this.isOpening = false;
    this.duration = 280;

    if (!this.summary) return;

    this.onClick = this.onClick.bind(this);
    this.summary.addEventListener('click', this.onClick);
  }

  onClick(event) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    event.preventDefault();

    if (this.isClosing || !this.details.open) {
      this.open();
    } else if (this.isOpening || this.details.open) {
      this.close();
    }
  }

  open() {
    this.details.style.overflow = 'hidden';
    const startHeight = `${this.details.offsetHeight}px`;

    this.details.open = true;
    const endHeight = `${this.details.offsetHeight}px`;
    this.details.style.height = startHeight;
    this.details.classList.add('is-opening');
    this.details.classList.remove('is-closing');

    requestAnimationFrame(() => {
      this.animateHeight(startHeight, endHeight, () => {
        this.isOpening = false;
        this.details.classList.remove('is-opening');
      });
      this.isOpening = true;
    });
  }

  close() {
    this.details.style.overflow = 'hidden';
    const startHeight = `${this.details.offsetHeight}px`;
    const endHeight = `${this.summary.offsetHeight}px`;

    this.details.style.height = startHeight;
    this.details.classList.add('is-closing');
    this.details.classList.remove('is-opening');

    this.animateHeight(startHeight, endHeight, () => {
      this.isClosing = false;
      this.details.open = false;
      this.details.classList.remove('is-closing');
    });

    this.isClosing = true;
  }

  animateHeight(startHeight, endHeight, onFinish) {
    if (this.animation) {
      this.animation.cancel();
    }

    this.animation = this.details.animate(
      {
        height: [startHeight, endHeight],
      },
      {
        duration: this.duration,
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    );

    this.details.style.height = endHeight;

    this.animation.onfinish = () => {
      this.animation = null;
      this.details.style.height = '';
      this.details.style.overflow = '';
      onFinish();
    };

    this.animation.oncancel = () => {
      this.animation = null;
    };
  }
}

function initializeAccordionAnimations(scope = document) {
  scope.querySelectorAll('.accordion details').forEach((details) => {
    if (!details.dataset.accordionAnimated) {
      details.dataset.accordionAnimated = 'true';
      new AccordionAnimator(details);
    }
  });
}

initializeAccordionAnimations();

document.addEventListener('shopify:section:load', (event) => {
  initializeAccordionAnimations(event.target);
});
