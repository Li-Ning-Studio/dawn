import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { consumePendingModalOpen } from '../../lib/service-modal-pending';

// Printed country names are a fixed fulfilment contract, independent of the
// translated labels displayed in the selector.
const PRINT_COUNTRIES = [
  { code: 'IN', text: 'INDIA' },
  { code: 'ID', text: 'INDONESIA' },
  { code: 'CN', text: 'CHINA' },
  { code: 'JP', text: 'JAPAN' },
  { code: 'MY', text: 'MALAYSIA' },
  { code: 'DK', text: 'DENMARK' },
] as const;

type CountryCode = (typeof PRINT_COUNTRIES)[number]['code'];
type LogoId = 'lining' | 'hndrd';

const getPrintedCountry = (code: string) => PRINT_COUNTRIES.find((country) => country.code === code)?.text || '';

const resolveLogoId = (brand: string | undefined): LogoId | null => {
  switch (brand?.trim().toLowerCase()) {
    case 'studio':
      return 'lining';
    case 'hundred':
      return 'hndrd';
    default:
      return null;
  }
};

// All measurements are in the shirt's 458.9 × 500 viewBox, not CSS pixels or
// centimetres. The width constraint shrinks the whole print as one composition.
const getPrintLayout = (capHeight: number, nameWidth: number, countryWidth: number) => {
  const nominalScale = 57.6 / capHeight;
  const fit = Math.min(1, 275 / (Math.max(nameWidth, countryWidth) * nominalScale || 1));
  return { scale: nominalScale * fit, height: 57.6 * fit, gap: 16 * fit, logoWidth: 120 * fit, logoHeight: 36 * fit };
};

type PrintingPreviewProps = { name: string; country: string; color: string; logoSrc: string };

function PrintingPreview({ name, country, color, logoSrc }: PrintingPreviewProps) {
  const capRef = useRef<SVGTextElement>(null);
  const nameRef = useRef<SVGTextElement>(null);
  const countryRef = useRef<SVGTextElement>(null);
  const maskId = `tshirt-logo-${useId()}`;
  const [fontRevision, setFontRevision] = useState(0);
  const [metrics, setMetrics] = useState({
    capHeight: 0,
    capY: 0,
    nameWidth: 0,
    countryWidth: 0,
    nameDescent: 0,
    countryAscent: 0,
    countryDescent: 0,
  });

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      if (!cancelled) setFontRevision((value) => value + 1);
    };
    // Measure again after font loading instead of freezing fallback-font widths.
    // If loading fails, the fitted fallback remains usable for name-only orders.
    document.fonts.load('600 100px "Barlow Condensed"').then(refresh, refresh);
    document.fonts.addEventListener('loadingdone', refresh);
    return () => {
      cancelled = true;
      document.fonts.removeEventListener('loadingdone', refresh);
    };
  }, []);

  useLayoutEffect(() => {
    if (!capRef.current || !nameRef.current || !countryRef.current) return;
    const cap = capRef.current.getBBox();
    if (cap.height <= 0) return;
    const context = document.createElement('canvas').getContext('2d');
    if (!context) return;
    const font = getComputedStyle(capRef.current);
    context.font = `${font.fontStyle} ${font.fontWeight} 100px ${font.fontFamily}`;
    // SVG bounding boxes include font-cell whitespace. Canvas ink bounds give
    // the actual letter edges, including rounded capitals and punctuation.
    // Keep the existing size/anchor, but space subsequent rows from those edges.
    const nameInk = context.measureText(name);
    const countryInk = context.measureText(country);
    setMetrics({
      capHeight: cap.height,
      capY: cap.y,
      nameWidth: nameRef.current.getComputedTextLength(),
      countryWidth: countryRef.current.getComputedTextLength(),
      nameDescent: nameInk.actualBoundingBoxDescent,
      countryAscent: countryInk.actualBoundingBoxAscent,
      countryDescent: countryInk.actualBoundingBoxDescent,
    });
  }, [name, country, fontRevision]);

  const layout = getPrintLayout(metrics.capHeight || 1, metrics.nameWidth, metrics.countryWidth);
  const firstBaseline = 55 - metrics.capY * layout.scale;
  const secondBaseline = firstBaseline + (metrics.nameDescent + metrics.countryAscent) * layout.scale + layout.gap;
  const logoTop = secondBaseline + metrics.countryDescent * layout.scale + layout.gap;

  return (
    <svg
      className="tshirt-printing-preview-overlay tshirt-printing-font--plus"
      viewBox="0 0 458.9 500"
      aria-hidden="true"
      focusable="false"
      letterSpacing="0"
      style={{ color }}
    >
      {/* Invisible, unscaled glyphs provide stable font metrics in SVG units. */}
      <g visibility="hidden" fontSize="100">
        <text ref={capRef}>H</text>
        <text ref={nameRef}>{name}</text>
        <text ref={countryRef}>{country}</text>
      </g>
      <g
        fill="currentColor"
        textAnchor="middle"
        fontSize={100 * layout.scale}
        visibility={metrics.capHeight ? 'visible' : 'hidden'}
      >
        <text x="229.45" y={firstBaseline}>
          {name}
        </text>
        {country ? (
          <text x="229.45" y={secondBaseline}>
            {country}
          </text>
        ) : null}
      </g>
      {country && logoSrc && metrics.capHeight ? (
        <g transform={`translate(${229.45 - layout.logoWidth / 2} ${logoTop})`}>
          <defs>
            <mask
              id={maskId}
              maskUnits="userSpaceOnUse"
              x="0"
              y="0"
              width={layout.logoWidth}
              height={layout.logoHeight}
              style={{ maskType: 'alpha' }}
            >
              <image
                href={logoSrc}
                {...{ crossorigin: 'anonymous' }}
                width={layout.logoWidth}
                height={layout.logoHeight}
                preserveAspectRatio="xMidYMin meet"
              />
            </mask>
          </defs>
          <rect width={layout.logoWidth} height={layout.logoHeight} fill="currentColor" mask={`url(#${maskId})`} />
        </g>
      ) : null}
    </svg>
  );
}

const defaultCopy = document.getElementById('tshirt-printing-description')?.innerHTML || '';
const width = window.innerWidth;

window.s3_tshirt_printing_controller = {
  openModal: () => {},
  closeModal: () => {},
  isOpen: false,
  ready: false,
};

type TShirtPrintingProps = {
  actions: {
    add: string;
    change: string;
    submit: string;
    close: string;
    remove: string;
    addSecondLine: string;
    clearSecondLine: string;
  };
  labels: {
    heading: string;
    title: string;
    input: string;
    secondInput: string;
    note: string;
    summaryHtml: string;
  };
  messages: {
    invalidInput: string;
    logoUnavailable: string;
    logoLoading: string;
  };
  closeConfirm: {
    message: string;
    keepEditing: string;
    discard: string;
  };
  secondLine: {
    enabled: boolean;
    singleLinePrice: string;
    plusPrice: string;
    clearIconSrc: string;
    logoUrls: Record<LogoId, string>;
    countryLabels: Record<CountryCode, string>;
  };
};

const TShirtPrinting = ({ actions, labels, messages, closeConfirm, secondLine }: TShirtPrintingProps) => {
  const [isModalOpen, setIsModalOpen] = useState(() => consumePendingModalOpen('tshirt_printing'));
  const [isCloseConfirmVisible, setIsCloseConfirmVisible] = useState(false);
  const [isInputInvalid, setIsInputInvalid] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftCountry, setDraftCountry] = useState('');
  const [appliedName, setAppliedName] = useState('');
  const [appliedCountry, setAppliedCountry] = useState('');
  const [appliedLogo, setAppliedLogo] = useState<LogoId | null>(null);
  const [logoLoad, setLogoLoad] = useState({ src: '', ready: false, failed: false });
  const countryRef = useRef<HTMLSelectElement>(null);
  const addCountryRef = useRef<HTMLButtonElement>(null);
  const isSecondLineVisible = secondLine.enabled && Boolean(draftCountry);
  const draftSecondLine = isSecondLineVisible ? getPrintedCountry(draftCountry) : '';
  const appliedSecondLine = getPrintedCountry(appliedCountry);
  const logoId = resolveLogoId(window.s3_brand);
  const logoSrc = logoId ? secondLine.logoUrls[logoId] : '';
  const logoReady = Boolean(logoId && logoSrc && logoLoad.src === logoSrc && logoLoad.ready);
  const logoFailed = !logoId || !logoSrc || (logoLoad.src === logoSrc && logoLoad.failed);

  useEffect(() => {
    if (!isModalOpen || !isSecondLineVisible || !logoSrc) return;
    const logo = new Image();
    setLogoLoad({ src: logoSrc, ready: false, failed: false });
    logo.onload = () => setLogoLoad({ src: logoSrc, ready: true, failed: false });
    logo.onerror = () => setLogoLoad({ src: logoSrc, ready: false, failed: true });
    // CORS matches the SVG mask's image request; an opaque image that loads as
    // an ordinary <img> must not incorrectly qualify a failed mask as ready.
    logo.crossOrigin = 'anonymous';
    logo.src = logoSrc;
    return () => {
      logo.onload = null;
      logo.onerror = null;
    };
  }, [isModalOpen, isSecondLineVisible, logoSrc]);

  const closeModalImmediately = () => {
    setIsCloseConfirmVisible(false);
    setIsModalOpen(false);
  };

  const discardDraftChanges = () => {
    setDraftName(appliedName);
    setDraftCountry(appliedCountry);
    setIsInputInvalid(false);
    closeModalImmediately();
  };

  const applySelection = () => {
    if (!draftName.trim() || (isSecondLineVisible && (!draftSecondLine || !logoReady))) return;

    setAppliedName(draftName);
    setAppliedCountry(isSecondLineVisible ? draftCountry : '');
    setAppliedLogo(isSecondLineVisible ? logoId : null);
    closeModalImmediately();
  };

  const removeSelection = () => {
    setDraftName('');
    setDraftCountry('');
    setAppliedName('');
    setAppliedCountry('');
    setAppliedLogo(null);
    setIsInputInvalid(false);
    closeModalImmediately();
  };

  const showSecondLine = () => {
    setDraftCountry('IN');
    window.requestAnimationFrame(() => countryRef.current?.focus());
  };

  const clearSecondLine = () => {
    setDraftCountry('');
    window.requestAnimationFrame(() => addCountryRef.current?.focus());
  };

  const requestModalClose = () => {
    if (!isModalOpen) return;
    setIsCloseConfirmVisible(true);
  };

  const handleModalOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setIsCloseConfirmVisible(false);
      setIsModalOpen(true);
      return;
    }

    requestModalClose();
  };

  const calculateStyles = (value: string) => {
    const length = value?.length;
    if (width && width < 640) {
      const top = '25%';
      const letterSpacing = '0.01px';
      if (length <= 6) {
        return { fontSize: '37px', letterSpacing, top };
      } else if (length <= 9) {
        return { fontSize: '27px', letterSpacing, top };
      }
      return { fontSize: '20px', letterSpacing, top };
    }

    const top = '23%';
    if (length <= 6) {
      return { fontSize: '37px', top };
    } else if (length <= 9) {
      return { fontSize: '26px', top };
    }
    return { fontSize: '21px', top };
  };

  useEffect(() => {
    const openModal = () => {
      setIsCloseConfirmVisible(false);
      setDraftName(appliedName);
      setDraftCountry(secondLine.enabled ? appliedCountry : '');
      setIsInputInvalid(false);
      setIsModalOpen(true);
    };

    if (window.s3_tshirt_printing_controller) {
      window.s3_tshirt_printing_controller.openModal = openModal;
      window.s3_tshirt_printing_controller.closeModal = closeModalImmediately;
      window.s3_tshirt_printing_controller.isOpen = isModalOpen;
      window.s3_tshirt_printing_controller.ready = true;
    }

    if (consumePendingModalOpen('tshirt_printing')) {
      openModal();
    }
  }, [appliedName, appliedCountry, isModalOpen, secondLine.enabled]);

  useEffect(() => {
    const ctaLabel = document.getElementById('tshirt-printing-cta-label');
    const description = document.getElementById('tshirt-printing-description');
    const price = document.getElementById('tshirt-printing-price');

    if (appliedName) {
      if (description) {
        description.textContent = `${labels.summaryHtml} `;

        const primaryLine = document.createElement('span');
        primaryLine.id = 'the-tshirt-text';
        primaryLine.textContent = appliedName;
        description.append(primaryLine);

        if (secondLine.enabled && appliedSecondLine) {
          description.append(' / ');
          const secondaryLine = document.createElement('span');
          secondaryLine.id = 'the-tshirt-second-line';
          secondaryLine.textContent = appliedSecondLine;
          // Store the applied logo, not the current draft or a fresh brand lookup.
          // Cart submission must reproduce the package the shopper confirmed.
          secondaryLine.dataset.logoId = appliedLogo || '';
          description.append(secondaryLine);
        }
      }

      if (price) {
        price.textContent = secondLine.enabled && appliedSecondLine ? secondLine.plusPrice : secondLine.singleLinePrice;
      }
      document.getElementsByClassName('product-form__submit button')[0]?.classList?.add('glowing');
      if (ctaLabel) ctaLabel.textContent = actions.change;
    } else {
      if (description) description.innerHTML = defaultCopy;
      if (price) price.textContent = secondLine.singleLinePrice;
      document.getElementsByClassName('product-form__submit button')[0]?.classList?.remove('glowing');
      if (ctaLabel) ctaLabel.textContent = actions.add;
    }
  }, [actions.add, actions.change, appliedName, appliedSecondLine, appliedLogo, labels.summaryHtml, secondLine]);

  return (
    <Dialog.Root open={isModalOpen} onOpenChange={handleModalOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content
          onOpenAutoFocus={(event) => event.preventDefault()}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 1000,
            overflow: 'auto',
            background: 'white',
          }}
        >
          <Dialog.Title />
          <section
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              paddingTop: '4rem',
              textAlign: 'center',
            }}
          >
            {isCloseConfirmVisible ? (
              <div style={{ width: '100%', maxWidth: '540px', marginTop: '8rem', padding: '0 1.6rem' }}>
                <p style={{ margin: '0 0 1.6rem', fontSize: '1.7rem', lineHeight: '1.5' }}>{closeConfirm.message}</p>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => setIsCloseConfirmVisible(false)}
                  >
                    {closeConfirm.keepEditing}
                  </button>
                  <button type="button" className="button" onClick={discardDraftChanges}>
                    {closeConfirm.discard}
                  </button>
                </div>
              </div>
            ) : null}

            {!isCloseConfirmVisible ? (
              <>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    width: '100%',
                    padding: width < 640 ? '0rem 1rem' : '0rem 3rem',
                    marginTop: width < 640 ? '0rem' : '1rem',
                  }}
                >
                  <svg
                    onClick={requestModalClose}
                    width={24}
                    height={24}
                    aria-hidden="true"
                    fill="none"
                    strokeWidth={2}
                    stroke="var(--gray-90)"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div>
                    <h2 style={{ margin: '0rem' }}>{labels.heading}</h2>
                    <p style={{ color: 'var(--gray-50)' }}>{labels.title}</p>
                  </div>
                  <svg
                    onClick={requestModalClose}
                    width={26}
                    height={26}
                    aria-hidden="true"
                    fill="none"
                    strokeWidth={2}
                    stroke="var(--gray-90)"
                    viewBox="0 0 26 26"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M6 18 18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>

                <div style={{ width: '100%', padding: '4rem 2rem', background: '#f5f5f5' }}>
                  {secondLine.enabled ? (
                    <div className="tshirt-printing-preview-artwork">
                      <Tshirt tshirtColor={window.s3_tshirt_printing_config?.tshirtColor} responsive />
                      <PrintingPreview
                        name={draftName}
                        country={draftSecondLine}
                        color={window.s3_tshirt_printing_config?.tshirtTextColor || '#fff'}
                        logoSrc={logoReady ? logoSrc : ''}
                      />
                    </div>
                  ) : (
                    <>
                      <h4
                        className="tshirt-printing-font"
                        style={{
                          position: 'relative',
                          bottom: '-85px',
                          height: '24px',
                          color: window.s3_tshirt_printing_config?.tshirtTextColor || '#fff',
                          zIndex: 9999,
                          margin: 0,
                          ...calculateStyles(draftName),
                        }}
                      >
                        {draftName}
                      </h4>
                      <Tshirt tshirtColor={window.s3_tshirt_printing_config?.tshirtColor} />
                    </>
                  )}
                </div>

                <input
                  aria-label={labels.input}
                  maxLength={12}
                  autoComplete="off"
                  spellcheck={false}
                  style={{ marginTop: window.innerWidth > 740 ? '5rem' : '2rem' }}
                  onInput={(event: Event) => {
                    const target = event.target as HTMLInputElement;
                    const newValue = target.value;
                    if (isTextAllowed(newValue)) {
                      setIsInputInvalid(false);
                      setDraftName(newValue.toUpperCase() || '');
                    } else {
                      setIsInputInvalid(true);
                      target.value = draftName;
                    }
                  }}
                  value={draftName}
                  className={`services-input${secondLine.enabled ? ' tshirt-printing-input' : ''}`}
                  type="text"
                  placeholder={labels.input}
                />
                <div>
                  {isInputInvalid ? <p style={{ color: 'red', marginTop: '0.5rem' }}>{messages.invalidInput}</p> : null}
                </div>

                {secondLine.enabled && !isSecondLineVisible ? (
                  <button
                    ref={addCountryRef}
                    type="button"
                    className="tshirt-printing-add-line"
                    aria-controls="tshirt-printing-second-line-input"
                    aria-expanded="false"
                    onClick={showSecondLine}
                  >
                    <span>{actions.addSecondLine}</span>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <path d="M8 2v12M2 8h12" />
                    </svg>
                  </button>
                ) : null}

                {secondLine.enabled && isSecondLineVisible ? (
                  <>
                    <div className="tshirt-printing-country-field">
                      <label className="visually-hidden" htmlFor="tshirt-printing-second-line-input">
                        {labels.secondInput}
                      </label>
                      <div className="tshirt-printing-country-controls">
                        <select
                          ref={countryRef}
                          onChange={(event) => {
                            const code = event.currentTarget.value;
                            if (getPrintedCountry(code)) setDraftCountry(code);
                          }}
                          value={draftCountry}
                          id="tshirt-printing-second-line-input"
                          className="services-input"
                          aria-describedby={!logoReady ? 'tshirt-printing-logo-status' : undefined}
                        >
                          {PRINT_COUNTRIES.map(({ code }) => (
                            <option key={code} value={code}>
                              {secondLine.countryLabels[code]}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="tshirt-printing-second-line-clear"
                          aria-label={actions.clearSecondLine}
                          onClick={clearSecondLine}
                        >
                          <img src={secondLine.clearIconSrc} alt="" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                    {!logoReady ? (
                      <p id="tshirt-printing-logo-status" className="tshirt-printing-logo-status" role="status">
                        {logoFailed ? messages.logoUnavailable : messages.logoLoading}
                      </p>
                    ) : null}
                  </>
                ) : null}

                <div
                  className={secondLine.enabled ? 'tshirt-printing-actions' : undefined}
                  style={{
                    marginTop: window.innerWidth > 740 ? '3rem' : '2rem',
                    display: 'flex',
                    gap: '1rem',
                  }}
                >
                  <button
                    autoFocus
                    className="button button--secondary"
                    onClick={() => {
                      if (
                        draftName.length > 0 ||
                        appliedName.length > 0 ||
                        draftSecondLine.length > 0 ||
                        appliedSecondLine.length > 0
                      ) {
                        removeSelection();
                      } else {
                        requestModalClose();
                      }
                    }}
                  >
                    {draftName.length > 0 ||
                    appliedName.length > 0 ||
                    draftSecondLine.length > 0 ||
                    appliedSecondLine.length > 0
                      ? actions.remove
                      : actions.close}
                  </button>
                  <button
                    style={{ padding: '1.8rem 2.2rem' }}
                    disabled={!draftName.trim() || (isSecondLineVisible && !logoReady)}
                    className="button"
                    onClick={applySelection}
                  >
                    {actions.submit}
                  </button>
                </div>

                <p
                  style={{
                    color: 'var(--gray-20)',
                    maxWidth: '600px',
                    marginTop: '3rem',
                    fontSize: '1.2rem',
                    padding: '0 4px',
                    lineHeight: '1.3',
                  }}
                >
                  {labels.note}
                </p>
              </>
            ) : null}
          </section>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

const Tshirt = ({ tshirtColor = '#000000', responsive = false }) => {
  return (
    <div
      className=""
      style={{ position: 'relative', width: responsive ? 'min(100%, 458.9px)' : 'max-content', margin: '0 auto' }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        xmlnsXlink="http://www.w3.org/1999/xlink"
        viewBox="0 0 458.9 500"
        style={
          {
            width: '100%',
            enableBackground: 'new 0 0 458.9 500',
          } as any
        }
        xmlSpace="preserve"
      >
        <defs>
          <filter id="spotlight">
            <feBlend in="SourceGraphic" mode="lighten" />
          </filter>
        </defs>

        <style>
          {
            '.st3{clip-path:url(#SVGID_8_);fill:#3e3e40}.st4{clip-path:url(#SVGID_10_)}.st4,.st5{fill:#3e3e40}.st5,.st6{clip-path:url(#SVGID_12_)}.st7{opacity:.7}'
          }
        </style>
        <g id="Layer_1">
          <defs>
            <path
              id="SVGID_1_"
              d="M31.7 107.7c3.4-8.7 6.6-17.2 9.3-25.4 4.9-15 6.7-23.2 18.5-31-.2 7.7 1.4 25.7 4.4 36.9 1.1 4.2 2.3 8.3 3.4 12 5 17.4 9.6 29.7 13.5 39.2 9.6 23.2 16 39.9 15.8 47.6-2 3.6-3.4 7.1-4.7 10.8-1.7 4.7-3.1 9.8-5.6 15.7-2.8 8.2-11.6 2.9-16.5 1.5-9.5-2.7-19.3-5.5-29.2-8.3-7.2-2.1-14.4-4.1-21.5-6.1-1.5-.4-3.1-.9-4.6-1.3-1.4-.4-2.7-.8-4-1.2C6.6 197-1 195 1.2 189.2c7.8-27.6 20.3-55.5 30.5-81.5z"
            />
          </defs>
          <defs>
            <path
              id="SVGID_2_"
              d="M427.1 107.7c-3.4-8.7-6.6-17.2-9.3-25.4-4.9-15-6.7-23.2-18.5-31 .2 7.7-1.4 25.7-4.4 36.9-1.1 4.2-2.3 8.3-3.4 12-5 17.4-9.6 29.7-13.5 39.2-9.6 23.2-16 39.9-15.8 47.6 2 3.6 3.4 7.1 4.7 10.8 1.6 4.7 3.1 9.8 5.6 15.7 2.8 8.2 11.6 2.9 16.5 1.5 9.5-2.7 19.3-5.5 29.2-8.3 7.2-2.1 14.4-4.1 21.5-6.1 1.5-.4 3.1-.9 4.6-1.3 1.4-.4 2.7-.8 4-1.2 3.9-1.1 11.5-3.1 9.3-8.9-7.8-27.6-20.2-55.5-30.5-81.5z"
            />
          </defs>
          <defs>
            <path
              id="SVGID_3_"
              d="M360.7 438.6c-4.6-91.5-6.7-61.6-5.7-88.3 1.9-47.8-.4-90.9 2.6-136.2 3.3-48.3 34.8-90.2 40.8-143.4.7-6.3 1.1-12.7 1-19.3-4.9-4.7-20.9-12.6-39.1-20.7-23.6-10.5-51-21.5-62.7-26.7C285-1.6 252 7.9 229.3 7.9c-22.6 0-55.7-9.6-68.3-3.9-9.8 4.4-30.5 12.8-50.9 21.6-22.7 9.8-44.9 20.1-50.9 25.8-.1 6.6.3 13.1 1 19.3 6 53.1 37.5 95 40.8 143.4 3 45.2.7 88.3 2.6 136.2 1.1 26.7-3.2-3.3-5.7 88.3-.2 8.1-3.8 14.7-3.9 21.3.4 6.2 10.2 12.8 23.9 17.8 28.9 10.7 53.5 22.3 111.4 21.3 65.5-1.1 89.4-12.3 117-24.6 9.8-4.3 17.9-9.4 18.3-14.6-.3-6.9-3.6-14.7-3.9-21.2z"
            />
          </defs>
          <use xlinkHref="#SVGID_1_" style={{ overflow: 'visible', fill: tshirtColor }} />
          <use xlinkHref="#SVGID_2_" style={{ overflow: 'visible', fill: tshirtColor }} />
          <use xlinkHref="#SVGID_3_" style={{ overflow: 'visible', fill: tshirtColor }} />
          <clipPath id="SVGID_4_">
            <use xlinkHref="#SVGID_1_" style={{ overflow: 'visible' }} />
          </clipPath>
          <clipPath id="SVGID_5_" style={{ clipPath: 'url(#SVGID_4_)' }}>
            <use xlinkHref="#SVGID_2_" style={{ overflow: 'visible' }} />
          </clipPath>
          <clipPath id="SVGID_6_" style={{ clipPath: 'url(#SVGID_5_)' }}>
            <use xlinkHref="#SVGID_3_" style={{ overflow: 'visible' }} />
          </clipPath>
          <path style={{ clipPath: 'url(#SVGID_6_)', fill: tshirtColor }} d="M-3.4-2h466.6v504.1H-3.4z" />
        </g>
        <text x="50%" y="25%" textAnchor="middle" fontSize="58" letterSpacing={0.01}></text>
        <image
          href={window.s3_tshirt_printing_config?.texturePath || ''}
          width="100%"
          style={{ filter: `url("#spotlight")`, opacity: 0.2 }}
        ></image>
      </svg>
    </div>
  );
};

const isTextAllowed = (text: string): boolean => /^[a-zA-Z. ]*$/.test(text);

export default TShirtPrinting;
