import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useState } from 'preact/hooks';

const defaultCopy = document.getElementById('tshirt-printing-description')?.innerHTML || '';
const width = window.innerWidth;

window.s3_tshirt_printing_controller = {
  openModal: () => {},
  closeModal: () => {},
  isOpen: false,
};

const TShirtPrinting = () => {
  const [isModalOpen, setIsModalOpen] = useState(true);
  const [isInputInvalid, setIsInputInvalid] = useState(false);
  const [name, setName] = useState('');

  const [shouldAddSecondLine, setShouldAddSecondLine] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState('');
  const [includeLogo, setIncludeLogo] = useState(true);

  const closeModal = () => setIsModalOpen(false);

  const getNameStyles = (text: string) => {
    const length = text?.length;
    const isMobile = width && width < 640;

    if (isMobile) {
      const letterSpacing = '0.01px';
      if (length <= 6) {
        return { fontSize: '32px', letterSpacing };
      } else if (length <= 9) {
        return { fontSize: '24px', letterSpacing };
      } else {
        return { fontSize: '18px', letterSpacing };
      }
    } else {
      if (length <= 6) {
        return { fontSize: '38px' };
      } else if (length <= 9) {
        return { fontSize: '28px' };
      } else {
        return { fontSize: '22px' };
      }
    }
  };

  const getCountryStyles = () => {
    const isMobile = width && width < 640;
    return {
      fontSize: isMobile ? '16px' : '18px',
      letterSpacing: '0.01px',
    };
  };

  useEffect(() => {
    if (window.s3_tshirt_printing_controller) {
      window.s3_tshirt_printing_controller.openModal = () => setIsModalOpen(true);
      window.s3_tshirt_printing_controller.closeModal = () => setIsModalOpen(false);
      window.s3_tshirt_printing_controller.isOpen = isModalOpen;
    }
  }, [isModalOpen]);

  useEffect(() => {
    if (name) {
      let description = `Uniquely Yours — You are making this ${window.s3_product_name} truly yours by personalising with <span id="the-tshirt-text">${name}</span>`;
      if (selectedCountry) {
        description += ` from ${selectedCountry}`;
      }
      if (includeLogo) {
        description += ` with logo`;
      }
      document.getElementById('tshirt-printing-description')!.innerHTML = description;
      document.getElementsByClassName('product-form__submit button')[0]?.classList?.add('glowing');
    } else {
      document.getElementById('tshirt-printing-description')!.innerHTML = defaultCopy;
      document.getElementsByClassName('product-form__submit button')[0]?.classList?.remove('glowing');
    }
  }, [name, selectedCountry, includeLogo]);

  return (
    <Dialog.Root open={isModalOpen} onOpenChange={setIsModalOpen}>
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
                onClick={() => {
                  setIsModalOpen(false);
                }}
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
                <h2
                  style={{
                    margin: '0rem',
                  }}
                >
                  Personalise this <br />
                  {window.s3_product_name}
                </h2>
                <p style={{ color: 'var(--gray-50)' }}>
                  Make this T-Shirt truly yours by getting something printed on it.
                </p>
              </div>
              <svg
                onClick={() => {
                  setIsModalOpen(false);
                }}
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

            <div style={{ width: '100%', padding: '4rem 2rem', background: '#f5f5f5', position: 'relative' }}>
              <div style={{ position: 'relative', width: 'max-content', margin: '0 auto' }}>
                <Tshirt tshirtColor={window.s3_tshirt_printing_config?.tshirtColor} />

                {/* Text overlay container */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                  }}
                >
                  {/* Name - Fixed position */}
                  <h4
                    className="tshirt-printing-font"
                    style={{
                      position: 'absolute',
                      top: width < 640 ? '65px' : '75px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      color: window.s3_tshirt_printing_config?.tshirtTextColor || '#fff',
                      margin: 0,
                      textAlign: 'center',
                      opacity: name.length > 0 ? 1 : 0,
                      ...getNameStyles(name),
                    }}
                  >
                    {name}
                  </h4>

                  {/* Country - Fixed position */}
                  <h4
                    className="tshirt-printing-font"
                    style={{
                      position: 'absolute',
                      top: width < 640 ? '105px' : '125px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      color: window.s3_tshirt_printing_config?.tshirtTextColor || '#fff',
                      margin: 0,
                      textAlign: 'center',
                      opacity: selectedCountry && name.length > 0 ? 1 : 0,
                      ...getCountryStyles(),
                    }}
                  >
                    {selectedCountry}
                  </h4>

                  {/* Logo - Fixed position */}
                  <div
                    style={{
                      position: 'absolute',
                      top: width < 640 ? '150px' : '180px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      opacity: includeLogo && name.length > 0 ? 1 : 0,
                    }}
                  >
                    <svg
                      width="40px"
                      version="1.1"
                      id="Layer_1"
                      xmlns="http://www.w3.org/2000/svg"
                      x="0px"
                      y="0px"
                      viewBox="0 0 1500 1500"
                      style="enable-background:new 0 0 1500 1500;"
                      xml:space="preserve"
                    >
                      <path
                        id="Reverse_Lambda_11_"
                        fill={window.s3_tshirt_printing_config?.tshirtTextColor || '#fff'}
                        stroke={window.s3_tshirt_printing_config?.tshirtTextColor || '#fff'}
                        d="M1347.62,587.22c0,0-101.04-3.54-155.38,1.77c-45.26,4.42-92.29,21.78-146.07,48.64
      c-73.03,36.48-174.86,89.55-174.86,89.55l532.88,263.67h-280.81L733.54,799.04L350.9,990.85H61.86c0,0,680.94-339.96,831.87-413.83
      c100.03-48.97,181.76-67.87,291.38-67.87h253.04L1347.62,587.22z"
                        style={{
                          fill: window.s3_tshirt_printing_config?.tshirtTextColor || '#fff',
                        }}
                      ></path>
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            <input
              maxLength={12}
              autoComplete="off"
              spellcheck={false}
              style={{
                marginTop: window.innerWidth > 740 ? '5rem' : '2rem',
              }}
              onInput={(e: Event) => {
                const target = e.target as HTMLInputElement;
                const newValue = target.value;
                if (isTextAlphanumeric(newValue)) {
                  setIsInputInvalid(false);
                  setName(newValue.toUpperCase() || '');
                } else {
                  setIsInputInvalid(true);
                  target.value = name;
                }
              }}
              value={name}
              className="services-input"
              type="text"
              placeholder={'Your Personalisation'}
            />

            {name.length > 0 && (
              <div style={{ margin: '1rem' }}>
                {shouldAddSecondLine ? (
                  <select
                    className="services-input"
                    style={{ width: '100%', marginTop: '1rem' }}
                    value={selectedCountry}
                    onChange={(e: Event) => {
                      const target = e.target as HTMLSelectElement;
                      setSelectedCountry(target.value);
                    }}
                  >
                    <option value="">Select Country</option>
                    <option value="INDIA">India</option>
                    <option value="JAPAN">Japan</option>
                    <option value="INDONESIA">Indonesia</option>
                    <option value="USA">United States</option>
                    <option value="UK">United Kingdom</option>
                    <option value="GERMANY">Germany</option>
                    <option value="FRANCE">France</option>
                    <option value="CANADA">Canada</option>
                    <option value="AUSTRALIA">Australia</option>
                    <option value="BRAZIL">Brazil</option>
                    <option value="CHINA">China</option>
                    <option value="SOUTH KOREA">South Korea</option>
                  </select>
                ) : (
                  <p onClick={() => setShouldAddSecondLine(true)}>Add another line</p>
                )}
              </div>
            )}

            {shouldAddSecondLine && name.length > 0 && (
              <div style={{ margin: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={includeLogo}
                    onChange={(e: Event) => {
                      const target = e.target as HTMLInputElement;
                      setIncludeLogo(target.checked);
                    }}
                  />
                  <span>Include logo</span>
                </label>
              </div>
            )}

            <div>
              {isInputInvalid && (
                <p
                  style={{
                    color: 'red',
                    marginTop: '0.5rem',
                  }}
                >
                  Only letters and numbers are allowed.
                </p>
              )}
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
                  setName('');
                  setSelectedCountry('');
                  setIncludeLogo(false);
                  setShouldAddSecondLine(false);
                  closeModal();
                }}
              >
                {name.length > 0 ? 'Remove' : 'Close'}
              </button>
              <button
                style={{
                  padding: '1.8rem 2.2rem',
                }}
                disabled={name.length === 0 || (shouldAddSecondLine && !selectedCountry)}
                className="button"
                onClick={closeModal}
              >
                Personalise
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
              Note: This is for representation purposes only. The text will be printed on the back of the T-Shirt. Cash
              on Delivery is not applicable for orders containing Personalised T-Shirts.
            </p>
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
          <use
            xlinkHref="#SVGID_1_"
            style={{
              overflow: 'visible',
              fill: tshirtColor,
            }}
          />
          <use
            xlinkHref="#SVGID_2_"
            style={{
              overflow: 'visible',
              fill: tshirtColor,
            }}
          />
          <use
            xlinkHref="#SVGID_3_"
            style={{
              overflow: 'visible',
              fill: tshirtColor,
            }}
          />
          <clipPath id="SVGID_4_">
            <use
              xlinkHref="#SVGID_1_"
              style={{
                overflow: 'visible',
              }}
            />
          </clipPath>
          <clipPath
            id="SVGID_5_"
            style={{
              clipPath: 'url(#SVGID_4_)',
            }}
          >
            <use
              xlinkHref="#SVGID_2_"
              style={{
                overflow: 'visible',
              }}
            />
          </clipPath>
          <clipPath
            id="SVGID_6_"
            style={{
              clipPath: 'url(#SVGID_5_)',
            }}
          >
            <use
              xlinkHref="#SVGID_3_"
              style={{
                overflow: 'visible',
              }}
            />
          </clipPath>
          <path
            style={{
              clipPath: 'url(#SVGID_6_)',
              fill: tshirtColor,
            }}
            d="M-3.4-2h466.6v504.1H-3.4z"
          />
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

const isTextAlphanumeric = (text: string): boolean => {
  const alphanumericRegex = /^[a-zA-Z. ]*$/;
  return alphanumericRegex.test(text);
};

export default TShirtPrinting;
