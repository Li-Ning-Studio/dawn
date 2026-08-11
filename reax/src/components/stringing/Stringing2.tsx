import * as Dialog from '@radix-ui/react-dialog';
import { ComponentChildren } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { fetchCollectionQuery } from '../../lib/gql';
import { consumePendingModalOpen } from '../../lib/service-modal-pending';
import client from '../../lib/shopify-client';
import { ProductNodes, SingleProductNode, TConfig } from '../../types';
import MultiStepForm, { MultiStepFormStep, MultiStepFormStepControls } from '../shared/MultiStepForm';

type Stringing2Props = {
  stringingCollectionId: string | null;
  isKnottingEnabled: string | null;
  knottingCost: string | null;
  stringingCost: string | null;
  maxTension: string | null;
  labels: {
    chooseString: string;
    selectColor: string;
    selectTension: string;
    selectMethod: string;
    summary: string;
    tensionUnit: string;
    lowTension: string;
    highTension: string;
    stringsGuide: string;
    noString: string;
    twoKnots: string;
    fourKnots: string;
    twoKnotsNote: string;
    fourKnotsNote: string;
  };
  descriptions: {
    service: string;
  };
  filters: {
    all: string;
    power: string;
    durable: string;
    balanced: string;
  };
  messages: {
    loading: string;
    empty: string;
    error: string;
  };
  actions: {
    add: string;
    selected: string;
    change: string;
    next: string;
    back: string;
    submit: string;
    close: string;
    remove: string;
  };
  closeConfirm: {
    message: string;
    keepEditing: string;
    discard: string;
  };
};

type FilterKey = 'all' | 'power' | 'durable' | 'balanced';

const FILTER_ORDER: FilterKey[] = ['all', 'power', 'durable', 'balanced'];
const POWER_THRESHOLD = 9.5;
const DURABLE_THRESHOLD = 9.5;

const EMPTY_CONFIG: TConfig = {
  stringProduct: null,
  stringVariant: null,
  tension: null,
  knot: 'two_knot',
};

const HIDDEN_RADIO_INPUT_STYLE = {
  position: 'absolute',
  opacity: 0,
  pointerEvents: 'none',
} as const;
const AUTO_ADVANCE_DELAY_MS = 320;
const MAX_VISIBLE_STRING_OPTIONS = 6;

const getFreeablePrice = (alreadyFormattedPrice: string | null) => {
  try {
    if (!alreadyFormattedPrice) return alreadyFormattedPrice;

    const numericMatch = alreadyFormattedPrice.replace(/[^0-9.-]/g, '');
    const numericValue = Number.parseFloat(numericMatch);

    if (!Number.isNaN(numericValue) && numericValue === 0) {
      return 'FREE';
    }

    return alreadyFormattedPrice;
  } catch (error) {
    return alreadyFormattedPrice;
  }
};

// Keep this formatter local to the stringing entrypoint. Sharing it with another entrypoint moves it into a
// stable-name Rollup chunk, which can break cached storefronts when theme assets are deployed at different times.
const formatCurrency = (amount: string, currencyCode: string) => {
  const numericAmount = Number.parseFloat(amount);

  if (Number.isNaN(numericAmount)) {
    return `${amount} ${currencyCode}`.trim();
  }

  try {
    return new Intl.NumberFormat(
      typeof document !== 'undefined' ? document.documentElement.lang || undefined : undefined,
      {
        style: 'currency',
        currency: currencyCode,
        maximumFractionDigits: Number.isInteger(numericAmount) ? 0 : 2,
      },
    ).format(numericAmount);
  } catch (error) {
    return `${amount} ${currencyCode}`.trim();
  }
};

const resolveColorValue = (candidate: string | null | undefined): string | null => {
  if (!candidate) return null;

  const value = candidate.trim();
  if (!value) return null;

  const hexMatch = value.match(/#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/);
  if (hexMatch?.[0]) {
    return hexMatch[0].startsWith('#') ? hexMatch[0] : `#${hexMatch[0]}`;
  }

  const candidateValues = [value, value.toLowerCase(), value.split('/')[0]?.trim().toLowerCase()].filter(Boolean);
  for (const colorCandidate of candidateValues) {
    if (typeof CSS !== 'undefined' && CSS.supports('color', colorCandidate)) {
      return colorCandidate;
    }
  }

  const knownColors: Record<string, string> = {
    navyblue: '#000080',
    skyblue: '#87ceeb',
    lightblue: '#add8e6',
    darkblue: '#00008b',
    darkgreen: '#006400',
    lightgreen: '#90ee90',
    darkred: '#8b0000',
    lightred: '#ff7f7f',
    darkgrey: '#4f4f4f',
    darkgray: '#4f4f4f',
    lightgrey: '#d3d3d3',
    lightgray: '#d3d3d3',
  };

  const normalized = value.toLowerCase().replace(/\s+/g, '');
  return knownColors[normalized] || null;
};

const getVariantSwatchColor = (
  stringProduct: TConfig['stringProduct'],
  variant: NonNullable<TConfig['stringVariant']>,
) => {
  const swatchColor = stringProduct?.options?.[0]?.optionValues?.find((option) => option.name === variant.title)?.swatch
    ?.color;
  return resolveColorValue(swatchColor) || resolveColorValue(variant.title);
};

const cloneStringingConfig = (config: TConfig): TConfig => ({
  stringProduct: config.stringProduct,
  stringVariant: config.stringVariant,
  tension: config.tension,
  knot: config.knot || 'two_knot',
});

const getMetricMap = (product: ProductNodes[number]) => {
  const map = new Map<string, number>();
  const entries = (product as any)?.metafields as Array<{ key: string; value: string }> | undefined;

  if (entries && Array.isArray(entries)) {
    for (const metafield of entries) {
      if (!metafield) continue;

      const rawValue = (metafield.value as any) ?? '';
      const numericMatch = typeof rawValue === 'string' ? rawValue.match(/\d+(?:\.\d+)?/) : null;
      const numericValue = numericMatch ? Number.parseFloat(numericMatch[0]) : NaN;

      if (!Number.isNaN(numericValue)) {
        map.set(metafield.key, numericValue);
      }
    }
  }

  return {
    durability: map.get('durability') ?? 0,
    repulsion: map.get('repulsion_power') ?? 0,
  };
};

window.s3_stringing_modal_controller = {
  openModal: () => {},
  closeModal: () => {},
  isOpen: false,
  ready: false,
};

const Stringing2 = ({
  stringingCollectionId,
  isKnottingEnabled,
  knottingCost,
  stringingCost: _stringingCost,
  maxTension,
  labels,
  descriptions,
  filters,
  messages,
  actions,
  closeConfirm,
}: Stringing2Props) => {
  const shouldShowKnotting = isKnottingEnabled === 'true';
  const maxTensionPounds = Number.parseInt(maxTension?.match(/\d+/g)?.pop() || '69', 10);

  const [stringingProducts, setStringingProducts] = useState<ProductNodes>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(() => consumePendingModalOpen('stringing'));
  const [isCloseConfirmVisible, setIsCloseConfirmVisible] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');

  const [draftConfig, setDraftConfig] = useState<TConfig>({ ...EMPTY_CONFIG });
  const [appliedConfig, setAppliedConfig] = useState<TConfig>({ ...EMPTY_CONFIG });

  const [defaultCardDescription] = useState(() => {
    return document.getElementById('stringing-description')?.textContent || descriptions.service || '';
  });

  const closeModalImmediately = () => {
    setIsCloseConfirmVisible(false);
    setIsModalOpen(false);
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

  useEffect(() => {
    let cancelled = false;

    if (!stringingCollectionId) {
      setIsLoading(false);
      setErrorMessage(messages.empty);
      return;
    }

    (async () => {
      try {
        setIsLoading(true);
        const { data, errors } = await client.request(fetchCollectionQuery, {
          variables: {
            id: `gid://shopify/Collection/${stringingCollectionId}`,
          },
        });

        if (errors && 'message' in errors) {
          console.error(errors);
        }

        if (!cancelled) {
          const nodes = data?.collection?.products?.nodes;

          if (nodes && Array.isArray(nodes) && nodes.length > 0) {
            setStringingProducts(nodes as ProductNodes);
            setErrorMessage(null);
          } else {
            setErrorMessage(messages.empty);
          }
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setErrorMessage(messages.error);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [messages.empty, messages.error, stringingCollectionId]);

  useEffect(() => {
    const openModal = () => {
      setDraftConfig(cloneStringingConfig(appliedConfig));
      setActiveFilter('all');
      setIsCloseConfirmVisible(false);
      setIsModalOpen(true);
    };

    window.s3_stringing_modal_controller = {
      openModal,
      closeModal: closeModalImmediately,
      isOpen: isModalOpen,
      ready: true,
    };

    if (consumePendingModalOpen('stringing')) {
      openModal();
    }
  }, [appliedConfig, isModalOpen]);

  useEffect(() => {
    const cardDescription = document.getElementById('stringing-description');
    const currentSelection = document.getElementById('stringing-current-selection');
    const ctaText = document.getElementById('stringing-cta-label');
    const submitButton = document.getElementsByClassName('product-form__submit button')[0];
    const stringProduct = appliedConfig.stringProduct;
    const stringVariant = appliedConfig.stringVariant;
    const tension = appliedConfig.tension;
    const hasAppliedStringing = stringProduct && stringVariant && tension;

    if (cardDescription) {
      if (hasAppliedStringing) {
        const methodLabel =
          shouldShowKnotting && appliedConfig.knot === 'four_knot'
            ? labels.fourKnots
            : shouldShowKnotting
              ? labels.twoKnots
              : '';

        cardDescription.textContent = `Stringing ${stringProduct.title} — ${stringVariant.title}, ${tension} ${labels.tensionUnit}${methodLabel ? `, ${methodLabel}` : ''}`;
      } else {
        cardDescription.textContent = defaultCardDescription;
      }
    }

    if (currentSelection) {
      currentSelection.hidden = Boolean(hasAppliedStringing);
    }

    if (ctaText) {
      ctaText.textContent = appliedConfig.stringVariant ? actions.change : actions.add;
    }

    if (hasAppliedStringing) {
      submitButton?.classList?.add('glowing');
    } else {
      submitButton?.classList?.remove('glowing');
    }
  }, [
    actions.add,
    actions.change,
    appliedConfig,
    defaultCardDescription,
    labels.fourKnots,
    labels.summary,
    labels.tensionUnit,
    labels.twoKnots,
    shouldShowKnotting,
  ]);

  const availableProducts = stringingProducts?.filter((product) => product.availableForSale) || [];
  const fallbackMessage = errorMessage || (!availableProducts.length ? messages.empty : null);

  const counts = useMemo(
    () => ({
      all: availableProducts.length,
      power: availableProducts.filter((product) => getMetricMap(product).repulsion >= POWER_THRESHOLD).length,
      durable: availableProducts.filter((product) => getMetricMap(product).durability >= DURABLE_THRESHOLD).length,
      balanced: availableProducts.filter((product) => {
        const metrics = getMetricMap(product);
        return metrics.repulsion < POWER_THRESHOLD && metrics.durability < DURABLE_THRESHOLD;
      }).length,
    }),
    [availableProducts],
  );

  const filteredProducts = useMemo(() => {
    switch (activeFilter) {
      case 'power':
        return availableProducts.filter((product) => getMetricMap(product).repulsion >= POWER_THRESHOLD);
      case 'durable':
        return availableProducts.filter((product) => getMetricMap(product).durability >= DURABLE_THRESHOLD);
      case 'balanced':
        return availableProducts.filter((product) => {
          const metrics = getMetricMap(product);
          return metrics.repulsion < POWER_THRESHOLD && metrics.durability < DURABLE_THRESHOLD;
        });
      case 'all':
      default:
        return availableProducts;
    }
  }, [activeFilter, availableProducts]);

  const selectedProductVariants =
    draftConfig.stringProduct?.variants?.nodes
      ?.slice()
      .sort((a, b) => (a.id > b.id ? 1 : -1))
      .sort((variant) => (variant.availableForSale ? -1 : 1))
      .filter((variant) => variant.availableForSale) ?? [];

  const isMobileLayout = window.innerWidth < 990;
  const bodyFontSize = isMobileLayout ? '1.45rem' : '1.55rem';

  const renderStepLayout = (
    stepControls: MultiStepFormStepControls,
    title: string,
    rightContent: ComponentChildren,
    rightHeader: ComponentChildren = null,
  ) => (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobileLayout ? '1fr' : 'repeat(12, minmax(0, 1fr))',
          gap: isMobileLayout ? '1.5rem' : '3.5rem',
        }}
      >
        <aside style={{ minWidth: 0, gridColumn: isMobileLayout ? '1' : '1 / span 3' }}>
          <h3
            className="s3_title"
            style={{
              margin: '0',
              //   fontSize: isMobileLayout ? '2.6rem' : '3.0rem',
              //   lineHeight: '1.2',
              //   letterSpacing: '-0.02em',
              //   fontWeight: 600,
              padding: isMobileLayout ? '0 0rem 2rem 0' : '0 6rem 4rem 0',
              borderBottom: '0.1rem solid var(--border-color)',
            }}
          >
            {title.split(/<br\s*\/?>|\n/gi).map((line, index, lines) => (
              <span key={`title-line-${index}`}>
                {line.trim()}
                {index < lines.length - 1 ? <br /> : null}
              </span>
            ))}
          </h3>
          <p
            style={{
              margin: '1rem 0',
              fontSize: '1.15rem',
              letterSpacing: '0.06em',
              color: 'rgba(var(--color-foreground), 0.55)',
            }}
          >
            STEP {stepControls.currentStepIndex + 1}/{stepControls.totalSteps}
          </p>
          <div
            style={{
              width: '100%',
              height: '1px',
              background: 'var(--border-color)',
            }}
          ></div>
        </aside>
        <div style={{ minWidth: 0, gridColumn: isMobileLayout ? '1' : '5 / -1' }}>
          {rightHeader}
          {rightContent}
        </div>
      </div>
    </div>
  );

  const getTensionBorderColor = (tension: number) => {
    if (tension <= 23) return '#7c83ff';
    if (tension <= 27) return '#61d39c';
    return '#ff7575';
  };

  const renderActionLabel = (label: string, icon: 'plus' | 'check', color: string) => (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        color,
        whiteSpace: 'nowrap',
      }}
    >
      <span>{label}</span>
      {icon === 'plus' ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" fill="currentColor" viewBox="0 0 256 256">
          <path d="M228,128a12,12,0,0,1-12,12H140v76a12,12,0,0,1-24,0V140H40a12,12,0,0,1,0-24h76V40a12,12,0,0,1,24,0v76h76A12,12,0,0,1,228,128Z"></path>
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" fill="currentColor" viewBox="0 0 256 256">
          <path d="M232.49,80.49l-128,128a12,12,0,0,1-17,0l-56-56a12,12,0,1,1,17-17L96,183,215.51,63.51a12,12,0,0,1,17,17Z"></path>
        </svg>
      )}
    </span>
  );

  const steps: MultiStepFormStep<TConfig>[] = useMemo(() => {
    const stepList: MultiStepFormStep<TConfig>[] = [
      {
        id: 'stringing-product-step',
        canContinue: (state) => Boolean(state.stringProduct),
        render: (stepControls) =>
          renderStepLayout(
            stepControls,
            `${labels.chooseString} for<br/> ${window?.s3_product_name || ''}`,
            <div>
              {isLoading ? <p className="frame-description">{messages.loading}</p> : null}

              {!isLoading
                ? filteredProducts.slice(0, MAX_VISIBLE_STRING_OPTIONS).map((stringProduct) => {
                    const productId = stringProduct.id.split('/').pop();
                    const isSelected = draftConfig.stringProduct?.id === stringProduct.id;

                    return (
                      <label
                        key={productId}
                        htmlFor={`string-product-${productId}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '1.2rem',
                          padding: '1.4rem 0rem',
                          borderBottom: '1px solid var(--border-color)',
                          cursor: 'pointer',
                          transition: 'background-color 0.18s ease',
                        }}
                      >
                        <input
                          type="radio"
                          name="string-product-step"
                          id={`string-product-${productId}`}
                          checked={isSelected}
                          onChange={() => {
                            setDraftConfig({
                              stringProduct: stringProduct as SingleProductNode,
                              stringVariant: null,
                              tension: null,
                              knot: 'two_knot',
                            });

                            if (!stepControls.isLastStep) {
                              window.setTimeout(() => {
                                stepControls.goToNextStep();
                              }, AUTO_ADVANCE_DELAY_MS);
                            }
                          }}
                          style={HIDDEN_RADIO_INPUT_STYLE}
                        />

                        <img
                          width={isMobileLayout ? 45 : 70}
                          height={isMobileLayout ? 45 : 70}
                          src={stringProduct.featuredImage?.url}
                          alt={stringProduct.featuredImage?.altText || ''}
                          style={{ borderRadius: '4px', flexShrink: 0 }}
                        />

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <p
                              style={{
                                margin: 0,
                                fontSize: bodyFontSize,
                                color: 'var(--color-foreground)',
                                fontWeight: 600,
                              }}
                            >
                              <span>{stringProduct.title}</span>
                              <span
                                style={{
                                  marginLeft: '0.6rem',
                                  color: 'rgba(var(--color-foreground), 0.55)',
                                  fontWeight: 400,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {`+${formatCurrency(
                                  stringProduct.priceRange.minVariantPrice.amount,
                                  stringProduct.priceRange.minVariantPrice.currencyCode,
                                )}`}
                              </span>
                            </p>
                            <span
                              style={{
                                fontSize: bodyFontSize,
                                fontWeight: 600,
                                color: isSelected ? 'var(--accent-color)' : 'var(--color-foreground)',
                                marginLeft: '1rem',
                              }}
                            >
                              {isSelected
                                ? renderActionLabel(actions.selected || actions.change, 'check', 'var(--accent-color)')
                                : renderActionLabel(actions.add, 'plus', 'var(--color-foreground)')}
                            </span>
                          </div>
                          {stringProduct.metafield?.value ? (
                            <p
                              style={{
                                margin: '0',
                                fontSize: bodyFontSize,
                                lineHeight: 1.5,
                                color: 'rgba(var(--color-foreground), 0.55)',
                              }}
                            >
                              {stringProduct.metafield.value}
                            </p>
                          ) : null}
                        </div>
                      </label>
                    );
                  })
                : null}

              {!isLoading && fallbackMessage ? <p className="frame-description">{fallbackMessage}</p> : null}
            </div>,
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                marginBottom: isMobileLayout ? '3rem' : '3rem',
              }}
            >
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                {FILTER_ORDER.map((filterKey) => {
                  const isActive = activeFilter === filterKey;
                  const labelMap = {
                    all: filters.all,
                    power: filters.power,
                    durable: filters.durable,
                    balanced: filters.balanced,
                  };

                  if (filterKey !== 'all' && counts[filterKey] === 0) {
                    return null;
                  }

                  return (
                    <div
                      key={filterKey}
                      onClick={() => setActiveFilter(filterKey)}
                      style={{
                        borderRadius: '999px',
                        padding: '0.6rem 1.2rem',
                        border: isActive
                          ? '1px solid var(--accent-color)'
                          : '1px solid rgba(var(--color-foreground), 0.4)',
                        background: isActive ? 'var(--accent-color)' : 'white',
                        color: isActive ? 'white' : 'var(--color-foreground)',
                        cursor: 'pointer',
                        fontSize: '1.4rem',
                        fontWeight: 500,
                        lineHeight: 1.2,
                      }}
                    >
                      {labelMap[filterKey]}
                    </div>
                  );
                })}
              </div>

              {/* <button
                type="button"
                onClick={() => setIsStringGuideOpen(true)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  fontSize: '1.25rem',
                  color: 'var(rgba(var(--color-foreground), 0.7))',
                  whiteSpace: 'nowrap',
                  padding: 0,
                }}
              >
                {labels.stringsGuide}
              </button> */}
            </div>,
          ),
      },
      {
        id: 'stringing-color-step',
        canContinue: (state) => Boolean(state.stringVariant),
        render: (stepControls) =>
          renderStepLayout(
            stepControls,
            `${labels.selectColor} for <br/> ${draftConfig?.stringProduct?.title || ''} string`,
            <div
              style={{
                display: 'flex',
                gap: '1.5rem',
                flexWrap: 'wrap',
                marginTop: '0.8rem',
                borderBottom: '0.1rem solid var(--border-color)',
                paddingBottom: '4rem',
              }}
            >
              {selectedProductVariants.map((variant) => {
                const variantId = variant.id.split('/').pop();
                const hex = getVariantSwatchColor(draftConfig.stringProduct, variant);
                const isSelected = draftConfig.stringVariant?.id === variant.id;

                return (
                  <label
                    // className="sheet"
                    key={variantId}
                    htmlFor={`string-variant-${variantId}`}
                    style={{
                      width: isMobileLayout ? '50px' : '56px',
                      height: isMobileLayout ? '50px' : '56px',
                      borderRadius: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      outline: isSelected
                        ? '2.5px solid var(--accent-color)'
                        : '1px solid rgba(var(--color-foreground), 0.1)',
                    }}
                  >
                    <input
                      type="radio"
                      name="string-variant-step"
                      id={`string-variant-${variantId}`}
                      checked={isSelected}
                      onChange={() => {
                        setDraftConfig({
                          stringProduct: draftConfig.stringProduct,
                          stringVariant: variant,
                          tension: draftConfig.tension,
                          knot: draftConfig.knot || 'two_knot',
                        });

                        if (!stepControls.isLastStep) {
                          window.setTimeout(() => {
                            stepControls.goToNextStep();
                          }, AUTO_ADVANCE_DELAY_MS);
                        }
                      }}
                      style={HIDDEN_RADIO_INPUT_STYLE}
                    />

                    {hex ? (
                      <span
                        style={{
                          width: isMobileLayout ? '48px' : '54px',
                          height: isMobileLayout ? '48px' : '54px',
                          background: hex,
                          borderRadius: '100%',
                          display: 'block',
                        }}
                      ></span>
                    ) : (
                      <span style={{ fontSize: '1rem' }}>{variant.title}</span>
                    )}
                  </label>
                );
              })}
            </div>,
            <p style={{ margin: '0.2rem 0 0', fontSize: bodyFontSize, opacity: 0.8 }}>
              {draftConfig.stringProduct?.title || labels.selectColor}
            </p>,
          ),
      },
      {
        id: 'stringing-tension-step',
        canContinue: (state) => Boolean(state.tension),
        render: (stepControls) =>
          renderStepLayout(
            stepControls,
            labels.selectTension,
            <div style={{ borderBottom: '0.1rem solid var(--border-color)', paddingBottom: '6rem' }}>
              <p style={{ margin: '0 0 1rem', fontSize: '1.4rem', letterSpacing: '0.03em', fontWeight: 500 }}>
                {labels.lowTension.toUpperCase()}
              </p>
              <div
                style={{
                  display: 'grid',
                  gap: '1rem',
                  gridTemplateColumns: isMobileLayout
                    ? 'repeat(2, minmax(120px, 1fr))'
                    : 'repeat(4, minmax(120px, 1fr))',
                }}
              >
                {Array.from({ length: 3 }, (_, index) => index + 21).map((tension) => {
                  if (maxTensionPounds < tension) {
                    return null;
                  }

                  const isSelected = draftConfig.tension === tension;
                  const borderColor = getTensionBorderColor(tension);

                  return (
                    <label
                      key={tension}
                      htmlFor={`string-tension-${tension}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: '46px',
                        padding: '1rem 1.4rem',
                        borderRadius: '999px',
                        border: `1px solid ${isSelected ? 'var(--accent-color)' : borderColor}`,
                        background: isSelected ? 'var(--accent-color)' : 'white',
                        color: isSelected ? 'white' : 'var(--color-foreground)',
                        cursor: 'pointer',
                        fontSize: bodyFontSize,
                        fontWeight: 600,
                        letterSpacing: '-0.01em',
                      }}
                    >
                      <input
                        type="radio"
                        name="string-tension-step"
                        id={`string-tension-${tension}`}
                        checked={isSelected}
                        onChange={() => {
                          setDraftConfig({
                            stringProduct: draftConfig.stringProduct,
                            stringVariant: draftConfig.stringVariant,
                            tension,
                            knot: draftConfig.knot || 'two_knot',
                          });

                          if (!stepControls.isLastStep) {
                            window.setTimeout(() => {
                              stepControls.goToNextStep();
                            }, AUTO_ADVANCE_DELAY_MS);
                          }
                        }}
                        style={HIDDEN_RADIO_INPUT_STYLE}
                      />
                      <span>
                        {tension} {labels.tensionUnit}
                      </span>
                    </label>
                  );
                })}
              </div>

              <p style={{ margin: '2rem 0 1rem', fontSize: '1.4rem', letterSpacing: '0.03em', fontWeight: 500 }}>
                {filters.balanced.toUpperCase()}
              </p>
              <div
                style={{
                  display: 'grid',
                  gap: '1rem',
                  gridTemplateColumns: isMobileLayout
                    ? 'repeat(2, minmax(120px, 1fr))'
                    : 'repeat(4, minmax(120px, 1fr))',
                }}
              >
                {Array.from({ length: 4 }, (_, index) => index + 24).map((tension) => {
                  if (maxTensionPounds < tension) {
                    return null;
                  }

                  const isSelected = draftConfig.tension === tension;
                  const borderColor = getTensionBorderColor(tension);

                  return (
                    <label
                      key={tension}
                      htmlFor={`string-tension-${tension}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: '46px',
                        padding: '1rem 1.4rem',
                        borderRadius: '999px',
                        border: `1px solid ${isSelected ? 'var(--accent-color)' : borderColor}`,
                        background: isSelected ? 'var(--accent-color)' : 'white',
                        color: isSelected ? 'white' : 'var(--color-foreground)',
                        cursor: 'pointer',
                        fontSize: bodyFontSize,
                        fontWeight: 600,
                        letterSpacing: '-0.01em',
                      }}
                    >
                      <input
                        type="radio"
                        name="string-tension-step"
                        id={`string-tension-${tension}`}
                        checked={isSelected}
                        onChange={() => {
                          setDraftConfig({
                            stringProduct: draftConfig.stringProduct,
                            stringVariant: draftConfig.stringVariant,
                            tension,
                            knot: draftConfig.knot || 'two_knot',
                          });

                          if (!stepControls.isLastStep) {
                            window.setTimeout(() => {
                              stepControls.goToNextStep();
                            }, AUTO_ADVANCE_DELAY_MS);
                          }
                        }}
                        style={HIDDEN_RADIO_INPUT_STYLE}
                      />
                      <span>
                        {tension} {labels.tensionUnit}
                      </span>
                    </label>
                  );
                })}
              </div>

              <p style={{ margin: '2rem 0 1rem', fontSize: '1.4rem', letterSpacing: '0.03em', fontWeight: 500 }}>
                {labels.highTension.toUpperCase()}
              </p>
              <div
                style={{
                  display: 'grid',
                  gap: '1rem',
                  gridTemplateColumns: isMobileLayout
                    ? 'repeat(2, minmax(120px, 1fr))'
                    : 'repeat(4, minmax(120px, 1fr))',
                }}
              >
                {Array.from({ length: 13 }, (_, index) => index + 28).map((tension) => {
                  if (maxTensionPounds < tension) {
                    return null;
                  }

                  const isSelected = draftConfig.tension === tension;
                  const borderColor = getTensionBorderColor(tension);

                  return (
                    <label
                      key={tension}
                      htmlFor={`string-tension-${tension}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: '46px',
                        padding: '1rem 1.4rem',
                        borderRadius: '999px',
                        border: `1px solid ${isSelected ? 'var(--accent-color)' : borderColor}`,
                        background: isSelected ? 'var(--accent-color)' : 'white',
                        color: isSelected ? 'white' : 'var(--color-foreground)',
                        cursor: 'pointer',
                        fontSize: bodyFontSize,
                        fontWeight: 600,
                        letterSpacing: '-0.01em',
                      }}
                    >
                      <input
                        type="radio"
                        name="string-tension-step"
                        id={`string-tension-${tension}`}
                        checked={isSelected}
                        onChange={() => {
                          setDraftConfig({
                            stringProduct: draftConfig.stringProduct,
                            stringVariant: draftConfig.stringVariant,
                            tension,
                            knot: draftConfig.knot || 'two_knot',
                          });

                          if (!stepControls.isLastStep) {
                            window.setTimeout(() => {
                              stepControls.goToNextStep();
                            }, AUTO_ADVANCE_DELAY_MS);
                          }
                        }}
                        style={HIDDEN_RADIO_INPUT_STYLE}
                      />
                      <span>
                        {tension} {labels.tensionUnit}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>,
          ),
      },
    ];

    if (shouldShowKnotting) {
      stepList.push({
        id: 'stringing-knot-step',
        canContinue: (state) => Boolean(state.knot),
        render: (stepControls) =>
          renderStepLayout(
            stepControls,
            labels.selectMethod,
            <div>
              <div>
                {[
                  {
                    id: 'stringing-two-knots',
                    value: 'two_knot' as const,
                    title: `${labels.twoKnots} (${getFreeablePrice('0')})`,
                    note: labels.twoKnotsNote,
                  },
                  {
                    id: 'stringing-four-knots',
                    value: 'four_knot' as const,
                    title: `${labels.fourKnots} (${getFreeablePrice(knottingCost)})`,
                    note: labels.fourKnotsNote,
                  },
                ].map((option) => {
                  const isSelected = draftConfig.knot === option.value;

                  return (
                    <label
                      key={option.id}
                      htmlFor={option.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '1.2rem',
                        padding: isMobileLayout ? '2rem 0' : '4rem 0',
                        borderBottom: '1px solid var(--border-color)',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="radio"
                        name="string-knot-step"
                        id={option.id}
                        checked={isSelected}
                        onChange={() => {
                          setDraftConfig({
                            stringProduct: draftConfig.stringProduct,
                            stringVariant: draftConfig.stringVariant,
                            tension: draftConfig.tension,
                            knot: option.value,
                          });

                          if (!stepControls.isLastStep) {
                            window.setTimeout(() => {
                              stepControls.goToNextStep();
                            }, AUTO_ADVANCE_DELAY_MS);
                          }
                        }}
                        style={HIDDEN_RADIO_INPUT_STYLE}
                      />

                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <p
                            style={{
                              margin: 0,
                              fontSize: bodyFontSize,
                              lineHeight: '1.35',
                              fontWeight: 600,
                              color: 'var(--color-foreground)',
                            }}
                          >
                            {option.title}
                          </p>
                          <div
                            style={{
                              fontSize: bodyFontSize,
                              fontWeight: 500,
                              color: 'var(--color-foreground)',
                            }}
                          >
                            {!isSelected ? (
                              <span>{renderActionLabel(actions.add, 'plus', 'var(--color-foreground)')}</span>
                            ) : (
                              <span>
                                {renderActionLabel(actions.selected || actions.change, 'check', 'var(--accent-color)')}
                              </span>
                            )}
                          </div>
                        </div>
                        {option.note ? (
                          <p
                            style={{
                              margin: '0.5rem 0 0',
                              fontSize: bodyFontSize,
                              maxWidth: '600px',
                              lineHeight: '1.5',
                              color: 'rgba(var(--color-foreground), 0.58)',
                            }}
                          >
                            {option.note}
                          </p>
                        ) : null}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>,
          ),
      });
    }

    return stepList;
  }, [
    activeFilter,
    counts,
    draftConfig.knot,
    draftConfig.stringProduct,
    draftConfig.stringVariant,
    draftConfig.tension,
    fallbackMessage,
    filteredProducts,
    filters.all,
    filters.balanced,
    filters.durable,
    filters.power,
    isLoading,
    knottingCost,
    labels.chooseString,
    labels.fourKnots,
    labels.fourKnotsNote,
    labels.highTension,
    labels.lowTension,
    labels.selectColor,
    labels.selectMethod,
    labels.selectTension,
    labels.stringsGuide,
    labels.tensionUnit,
    labels.twoKnots,
    labels.twoKnotsNote,
    maxTensionPounds,
    messages.loading,
    actions.add,
    actions.change,
    actions.selected,
    selectedProductVariants,
    shouldShowKnotting,
  ]);

  const applySelection = () => {
    if (!draftConfig.stringProduct || !draftConfig.stringVariant || !draftConfig.tension) {
      return;
    }

    setAppliedConfig(cloneStringingConfig(draftConfig));
    closeModalImmediately();
  };

  const removeSelection = () => {
    setAppliedConfig({ ...EMPTY_CONFIG });
    setDraftConfig({ ...EMPTY_CONFIG });
    closeModalImmediately();
  };

  const selectedStringProductId = appliedConfig.stringProduct?.id.split('/').pop() || 'string-product-unset';
  const selectedStringVariantId = appliedConfig.stringVariant?.id.split('Variant/')[1] || 'string-variant-unset';
  const selectedTensionValue = appliedConfig.tension ? `${appliedConfig.tension}` : 'string-tension-unset';
  const selectedKnot = appliedConfig.knot === 'four_knot' ? 'four_knot' : 'two_knot';
  const selectedStringLabel =
    appliedConfig.stringProduct && appliedConfig.stringVariant
      ? `${appliedConfig.stringProduct.title} - ${appliedConfig.stringVariant.title}`
      : '';

  return (
    <>
      <form id="stringing-form" style={{ display: 'none' }}>
        <input type="radio" name="frame" id="unstrung" checked={!Boolean(appliedConfig.stringVariant)} readOnly />
        <input type="radio" name="frame" id="pro-stringing" checked={Boolean(appliedConfig.stringVariant)} readOnly />

        <input
          type="radio"
          name="string-product"
          id={selectedStringProductId}
          required
          checked={Boolean(appliedConfig.stringProduct)}
          readOnly
        />
        <input
          type="radio"
          name="string-variant"
          id={selectedStringVariantId}
          required
          checked={Boolean(appliedConfig.stringVariant)}
          data-sku={appliedConfig.stringVariant?.sku || ''}
          data-string={selectedStringLabel}
          readOnly
        />
        <input
          type="radio"
          name="string-tension"
          id={selectedTensionValue}
          required
          checked={Boolean(appliedConfig.tension)}
          readOnly
        />
        <input
          type="radio"
          name="knot-config"
          id={selectedKnot === 'four_knot' ? 'four-knots' : 'two-knots'}
          required
          checked={Boolean(appliedConfig.stringVariant && appliedConfig.tension)}
          data-knot-value={selectedKnot}
          readOnly
        />
      </form>

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
              className="stringing-modal-restyle"
              style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100vh',
                minHeight: '100vh',
                boxSizing: 'border-box',
                padding: window.innerWidth < 741 ? '4rem 2rem 2rem' : '6rem 4rem',
                maxWidth: 'var(--page-width)',
                margin: '0 auto',
              }}
            >
              <style>{`
                .stringing-modal-restyle .stringing-actions button.button {
                  font-size: 1.45rem;
                  padding: 2rem 3rem;
                }

                .stringing-modal-restyle .stringing-actions button.button:not(.button--secondary) {
                  background: #000;
                  border-color: #000;
                  color: #fff;
                }

                .stringing-modal-restyle .stringing-actions button.button:not(.button--secondary):disabled {
                  opacity: 0.45;
                }

                .stringing-modal-restyle .stringing-flow {
                  flex: 1;
                  height: 100%;
                  min-height: 0;
                }
              `}</style>

              {isCloseConfirmVisible ? (
                <div style={{ padding: '2.4rem 0' }}>
                  <p style={{ margin: '0 0 1.6rem', fontSize: '1.6rem', lineHeight: '1.5' }}>{closeConfirm.message}</p>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                      type="button"
                      className="button button--secondary"
                      onClick={() => setIsCloseConfirmVisible(false)}
                    >
                      {closeConfirm.keepEditing}
                    </button>
                    <button type="button" className="button" onClick={closeModalImmediately}>
                      {closeConfirm.discard}
                    </button>
                  </div>
                </div>
              ) : null}

              {!isCloseConfirmVisible ? (
                <>
                  <MultiStepForm
                    steps={steps}
                    state={draftConfig}
                    className="stringing-flow"
                    showTopBar
                    onRequestClose={requestModalClose}
                    closeLabel={actions.close}
                    hideBackButton
                    actionsAlign="space-between"
                    actionsClassName="stringing-actions"
                    labels={{
                      back: actions.back.toUpperCase(),
                      next: actions.next.toUpperCase(),
                      submit: actions.submit.toUpperCase(),
                    }}
                    onSubmit={applySelection}
                    renderActionsLeft={() =>
                      appliedConfig.stringVariant ? (
                        <button type="button" className="button button--secondary" onClick={removeSelection}>
                          {actions.remove.toUpperCase()}
                        </button>
                      ) : (
                        <span />
                      )
                    }
                    renderSummary={({ state }) => {
                      const summaryParts: string[] = [`Stringing ${window?.s3_product_name}`];

                      if (state.stringProduct) {
                        summaryParts.push(`with ${state.stringProduct.title}`);
                      } else {
                        summaryParts.push('');
                      }

                      if (state.stringVariant) {
                        summaryParts.push(` - ${state.stringVariant.title}`);
                      }

                      if (state.tension) {
                        summaryParts.push(`at ${state.tension} ${labels.tensionUnit}`);
                      }

                      if (shouldShowKnotting && state.knot && state.stringVariant) {
                        summaryParts.push(
                          state.knot === 'four_knot'
                            ? `using ${labels.fourKnots} method`
                            : `using ${labels.twoKnots} method`,
                        );
                      }

                      return (
                        <p
                          style={{
                            margin: 0,
                            fontSize: bodyFontSize,
                            lineHeight: '1.6',
                          }}
                        >
                          {summaryParts.join(' ')}
                        </p>
                      );
                    }}
                  />
                </>
              ) : null}
            </section>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* <Dialog.Root open={isStringGuideOpen} onOpenChange={setIsStringGuideOpen}>
        <Dialog.Portal>
          <Dialog.Overlay
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 1001,
            }}
          />
          <Dialog.Content
            style={{
              position: 'fixed',
              top: '0',
              left: 0,
              width: '100vw',
              height: '100vh',
              zIndex: 1002,
              overflow: 'auto',
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              pointerEvents: 'none',
            }}
          >
            <Dialog.Title />
            <StringGuide closeStringsGuide={() => setIsStringGuideOpen(false)} stringingProducts={stringingProducts} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root> */}
    </>
  );
};

export default Stringing2;
