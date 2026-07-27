import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useState } from 'preact/hooks';
import { consumePendingModalOpen } from '../../lib/service-modal-pending';

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
  };
  labels: {
    heading: string;
    title: string;
    input: string;
    note: string;
    summaryHtml: string;
  };
  messages: {
    invalidInput: string;
  };
  closeConfirm: {
    message: string;
    keepEditing: string;
    discard: string;
  };
};

const TShirtPrinting = ({ actions, labels, messages, closeConfirm }: TShirtPrintingProps) => {
  const [isModalOpen, setIsModalOpen] = useState(() => consumePendingModalOpen('tshirt_printing'));
  const [isCloseConfirmVisible, setIsCloseConfirmVisible] = useState(false);
  const [isInputInvalid, setIsInputInvalid] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [appliedName, setAppliedName] = useState('');

  const closeModalImmediately = () => {
    setIsCloseConfirmVisible(false);
    setIsModalOpen(false);
  };

  const discardDraftChanges = () => {
    setDraftName(appliedName);
    closeModalImmediately();
  };

  const applySelection = () => {
    if (!draftName.length) return;
    setAppliedName(draftName);
    closeModalImmediately();
  };

  const removeSelection = () => {
    setDraftName('');
    setAppliedName('');
    closeModalImmediately();
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
  }, [isModalOpen]);

  useEffect(() => {
    const ctaLabel = document.getElementById('tshirt-printing-cta-label');
    if (appliedName) {
      document.getElementById('tshirt-printing-description')!.innerHTML =
        `${labels.summaryHtml} <span id="the-tshirt-text">${appliedName}</span>`;
      document.getElementsByClassName('product-form__submit button')[0]?.classList?.add('glowing');
      if (ctaLabel) ctaLabel.textContent = actions.change;
    } else {
      document.getElementById('tshirt-printing-description')!.innerHTML = defaultCopy;
      document.getElementsByClassName('product-form__submit button')[0]?.classList?.remove('glowing');
      if (ctaLabel) ctaLabel.textContent = actions.add;
    }
  }, [actions.add, actions.change, appliedName, labels.summaryHtml]);

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
                </div>

                <input
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
                  className="services-input"
                  type="text"
                  placeholder={labels.input}
                />
                <div>
                  {isInputInvalid ? (
                    <p style={{ color: 'red', marginTop: '0.5rem' }}>{messages.invalidInput}</p>
                  ) : null}
                </div>
                <div
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
                      if (draftName.length > 0 || appliedName.length > 0) {
                        removeSelection();
                      } else {
                        requestModalClose();
                      }
                    }}
                  >
                    {draftName.length > 0 || appliedName.length > 0 ? actions.remove : actions.close}
                  </button>
                  <button
                    style={{ padding: '1.8rem 2.2rem' }}
                    disabled={draftName.length === 0}
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

const Tshirt = ({ tshirtColor = '#000000' }) => {
  return (
    <div className="" style={{ position: 'relative', width: 'max-content', margin: '0 auto' }}>
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
