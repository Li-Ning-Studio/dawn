import * as Dialog from '@radix-ui/react-dialog';
import { ComponentChildren } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { fetchCollectionQuery } from '../../lib/gql';
import { consumePendingModalOpen } from '../../lib/service-modal-pending';
import client from '../../lib/shopify-client';
import { ProductNodes, SingleProductNode, TGripConfig } from '../../types';
import MultiStepForm, { MultiStepFormStep, MultiStepFormStepControls } from '../shared/MultiStepForm';

type Gripping2Props = {
  grippingCollectionId: string | null;
  grippingCost: string | null;
  factoryGripImage: string | null;
  labels: {
    chooseGrip: string;
    selectColor: string;
    summary: string;
    serviceCost: string;
    variantPrice: string;
    noGrip: string;
    free: string;
  };
  descriptions: {
    noGrip: string;
    applicationNote: string;
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

const EMPTY_CONFIG: TGripConfig = {
  grippingProduct: null,
  grippingVariant: null,
};

const HIDDEN_RADIO_INPUT_STYLE = {
  position: 'absolute',
  opacity: 0,
  pointerEvents: 'none',
} as const;
const AUTO_ADVANCE_DELAY_MS = 120;
const MAX_VISIBLE_GRIP_OPTIONS = 7;

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
  grippingProduct: TGripConfig['grippingProduct'],
  variant: NonNullable<TGripConfig['grippingVariant']>,
) => {
  const swatchColor = grippingProduct?.options?.[0]?.optionValues?.find((option) => option.name === variant.title)
    ?.swatch?.color;

  return resolveColorValue(swatchColor) || resolveColorValue(variant.title);
};

window.s3_gripping_modal_controller = {
  openModal: () => {},
  closeModal: () => {},
  isOpen: false,
  ready: false,
};

const Gripping2 = ({
  grippingCollectionId,
  grippingCost,
  labels,
  descriptions,
  messages,
  actions,
  closeConfirm,
}: Gripping2Props) => {
  const [grippingProducts, setGrippingProducts] = useState<ProductNodes>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(() => consumePendingModalOpen('gripping'));
  const [isCloseConfirmVisible, setIsCloseConfirmVisible] = useState(false);
  const [draftConfig, setDraftConfig] = useState<TGripConfig>({ ...EMPTY_CONFIG });
  const [appliedConfig, setAppliedConfig] = useState<TGripConfig>({ ...EMPTY_CONFIG });
  const [defaultCardDescription] = useState(() => document.getElementById('gripping-description')?.textContent || '');

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

    if (!grippingCollectionId) {
      setIsLoading(false);
      setErrorMessage(messages.empty);
      return;
    }

    (async () => {
      try {
        setIsLoading(true);
        const { data, errors } = await client.request(fetchCollectionQuery, {
          variables: {
            id: `gid://shopify/Collection/${grippingCollectionId}`,
          },
        });

        if (errors && 'message' in errors) {
          console.error(errors);
        }

        if (!cancelled) {
          const nodes = data?.collection?.products?.nodes;
          if (nodes && Array.isArray(nodes) && nodes.length > 0) {
            setGrippingProducts(nodes as ProductNodes);
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
  }, [grippingCollectionId, messages.empty, messages.error]);

  const cloneGripConfig = (config: TGripConfig): TGripConfig => ({
    grippingProduct: config.grippingProduct,
    grippingVariant: config.grippingVariant,
  });

  useEffect(() => {
    const openModal = () => {
      setDraftConfig(cloneGripConfig(appliedConfig));
      setIsCloseConfirmVisible(false);
      setIsModalOpen(true);
    };

    window.s3_gripping_modal_controller = {
      openModal,
      closeModal: closeModalImmediately,
      isOpen: isModalOpen,
      ready: true,
    };

    if (consumePendingModalOpen('gripping')) {
      openModal();
    }
  }, [appliedConfig, isModalOpen]);

  useEffect(() => {
    const cardDescription = document.getElementById('gripping-description');
    const currentSelection = document.getElementById('gripping-current-selection');
    const ctaText = document.getElementById('gripping-cta-label');
    const submitButton = document.getElementsByClassName('product-form__submit button')[0];
    const grippingProduct = appliedConfig.grippingProduct;
    const grippingVariant = appliedConfig.grippingVariant;
    const hasAppliedGripping = Boolean(grippingProduct && grippingVariant);

    if (cardDescription) {
      if (grippingProduct && grippingVariant) {
        cardDescription.textContent = `${labels.summary} ${grippingVariant.title} ${grippingProduct.title}`;
      } else {
        cardDescription.textContent = defaultCardDescription;
      }
    }

    if (currentSelection) {
      currentSelection.hidden = hasAppliedGripping;
    }

    if (ctaText) {
      ctaText.textContent = appliedConfig.grippingVariant ? actions.change : actions.add;
    }

    if (appliedConfig.grippingVariant) {
      submitButton?.classList?.add('glowing');
    } else {
      submitButton?.classList?.remove('glowing');
    }
  }, [actions.add, actions.change, appliedConfig, defaultCardDescription, labels.summary]);

  const availableProducts = grippingProducts?.filter((product) => product.availableForSale) || [];
  const displayedProducts = availableProducts?.slice(0, MAX_VISIBLE_GRIP_OPTIONS) || [];

  const selectedProductVariants =
    draftConfig.grippingProduct?.variants?.nodes
      ?.slice()
      .sort((a, b) => (a.id > b.id ? 1 : -1))
      .sort((variant) => (variant.availableForSale ? -1 : 1))
      .filter((variant) => variant.availableForSale) ?? [];

  const fallbackMessage = errorMessage || (!displayedProducts.length ? messages.empty : null);

  const isMobileLayout = window.innerWidth < 990;

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
        <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M6 2v8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"></path>
          <path d="M2 6h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"></path>
        </svg>
      ) : (
        <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="m2.3 6.4 2.2 2.2 5.2-5.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"></path>
        </svg>
      )}
    </span>
  );

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
            style={{
              margin: '0',
              fontSize: isMobileLayout ? '2.6rem' : '3.0rem',
              lineHeight: '1.2',
              letterSpacing: '-0.02em',
              fontWeight: 600,
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

  const steps: MultiStepFormStep<TGripConfig>[] = useMemo(
    () => [
      {
        id: 'gripping-product-step',
        canContinue: (state) => Boolean(state.grippingProduct),
        render: (stepControls) =>
          renderStepLayout(
            stepControls,
            labels.chooseGrip,
            <div>
              {isLoading ? <p className="frame-description">{messages.loading}</p> : null}

              {!isLoading
                ? displayedProducts.map((product) => {
                    const productId = product.id.split('/').pop();
                    const isSelected = draftConfig.grippingProduct?.id === product.id;

                    return (
                      <label
                        key={productId}
                        htmlFor={`grip-product-${productId}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '1.2rem',
                          padding: '1.4rem 0.2rem',
                          borderBottom: '1px solid var(--border-color)',
                          cursor: 'pointer',
                          transition: 'background-color 0.18s ease',
                        }}
                      >
                        <input
                          checked={isSelected}
                          onChange={() => {
                            setDraftConfig({
                              grippingProduct: product as SingleProductNode,
                              grippingVariant: null,
                            });

                            if (!stepControls.isLastStep) {
                              window.setTimeout(() => {
                                stepControls.goToNextStep();
                              }, AUTO_ADVANCE_DELAY_MS);
                            }
                          }}
                          type="radio"
                          name="grip-product-step"
                          id={`grip-product-${productId}`}
                          style={HIDDEN_RADIO_INPUT_STYLE}
                        />
                        <img
                          width={70}
                          height={70}
                          src={product.featuredImage?.url}
                          alt={product.featuredImage?.altText || ''}
                          style={{ borderRadius: '4px', flexShrink: 0 }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p
                            style={{
                              margin: 0,
                              fontSize: '1.6rem',
                              color: '#1a1a1a',
                              fontWeight: 500,
                            }}
                          >
                            {product.title}
                          </p>
                          {product.metafield?.value ? (
                            <p
                              style={{
                                margin: 0,
                                fontSize: '1.5rem',
                                color: 'rgba(var(--color-foreground), 0.55)',
                              }}
                            >
                              {product.metafield.value}
                            </p>
                          ) : null}
                        </div>
                        <span
                          style={{
                            fontSize: '1.6rem',
                            fontWeight: 500,
                            color: isSelected ? 'var(--accent-color)' : 'var(--color-foreground)',
                            marginLeft: '1rem',
                          }}
                        >
                          {isSelected
                            ? renderActionLabel(actions.selected || actions.change, 'check', 'var(--accent-color)')
                            : renderActionLabel(actions.add, 'plus', 'var(--color-foreground)')}
                        </span>
                      </label>
                    );
                  })
                : null}

              {!isLoading && fallbackMessage ? <p className="frame-description">{fallbackMessage}</p> : null}
            </div>,
          ),
      },
      {
        id: 'gripping-color-step',
        canContinue: (state) => Boolean(state.grippingVariant),
        render: (stepControls) =>
          renderStepLayout(
            stepControls,
            labels.selectColor,
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
                const hex = getVariantSwatchColor(draftConfig.grippingProduct, variant);

                return (
                  <label
                    key={variantId}
                    htmlFor={`grip-variant-${variantId}`}
                    style={{
                      width: isMobileLayout ? '50px' : '56px',
                      height: isMobileLayout ? '50px' : '56px',
                      borderRadius: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      outline:
                        draftConfig.grippingVariant?.id === variant.id
                          ? '2.5px solid var(--accent-color)'
                          : '1px solid rgba(var(--color-foreground), 0.1)',
                      cursor: variant.availableForSale ? 'pointer' : 'not-allowed',
                      opacity: variant.availableForSale ? 1 : 0.25,
                      position: 'relative',
                    }}
                  >
                    <input
                      type="radio"
                      name="grip-variant-step"
                      id={`grip-variant-${variantId}`}
                      data-sku={variant.sku}
                      disabled={!variant.availableForSale}
                      onChange={() => {
                        setDraftConfig({
                          grippingProduct: draftConfig.grippingProduct,
                          grippingVariant: variant,
                        });

                        if (!stepControls.isLastStep) {
                          window.setTimeout(() => {
                            stepControls.goToNextStep();
                          }, AUTO_ADVANCE_DELAY_MS);
                        }
                      }}
                      checked={draftConfig.grippingVariant?.id === variant.id}
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
                        title={variant.title}
                      ></span>
                    ) : (
                      <span style={{ fontSize: '0.9rem', lineHeight: '1.2', textAlign: 'center', padding: '0 0.2rem' }}>
                        {variant.title}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>,
            <div style={{ marginBottom: '2rem', fontSize: '1.6rem', color: 'rgba(var(--color-foreground), 0.65)' }}>
              {draftConfig.grippingProduct?.title || labels.selectColor}
            </div>,
          ),
      },
    ],
    [
      descriptions.applicationNote,
      displayedProducts,
      draftConfig.grippingProduct,
      draftConfig.grippingVariant,
      fallbackMessage,
      grippingCost,
      isLoading,
      labels.chooseGrip,
      labels.selectColor,
      labels.serviceCost,
      labels.summary,
      messages.loading,
      selectedProductVariants,
      actions.add,
      actions.change,
      actions.selected,
    ],
  );

  const applySelection = () => {
    if (!draftConfig.grippingProduct || !draftConfig.grippingVariant) {
      return;
    }

    setAppliedConfig(cloneGripConfig(draftConfig));
    closeModalImmediately();
  };

  const removeSelection = () => {
    setAppliedConfig({ ...EMPTY_CONFIG });
    setDraftConfig({ ...EMPTY_CONFIG });
    closeModalImmediately();
  };

  const selectedGripVariantId = appliedConfig.grippingVariant?.id.split('Variant/')[1] || '';
  const selectedGripSku = appliedConfig.grippingVariant?.sku || '';

  return (
    <>
      <form id="grip-form" style={{ display: 'none' }}>
        <input
          type="radio"
          name="gripping-option"
          id="grip-service"
          checked={Boolean(appliedConfig.grippingVariant)}
          readOnly
        />
      </form>

      <input
        type="hidden"
        id="selected-grip-variant-id"
        data-current-grip-selection={selectedGripVariantId}
        data-current-grip-sku={selectedGripSku}
      />

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
              className="gripping-modal-restyle"
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
                .gripping-modal-restyle .gripping-actions button.button {
                  min-width: 182px;
                  min-height: 56px;
                  border-radius: 999px;
                  font-size: 1.45rem;
                  letter-spacing: 0.02em;
                  text-transform: uppercase;
                }

                .gripping-modal-restyle .gripping-actions button.button:not(.button--secondary) {
                  background: #000;
                  border-color: #000;
                  color: #fff;
                }

                .gripping-modal-restyle .gripping-actions button.button:not(.button--secondary):disabled {
                  opacity: 0.45;
                }

                .gripping-modal-restyle .gripping-flow {
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
                    className="gripping-flow"
                    showTopBar
                    onRequestClose={requestModalClose}
                    closeLabel={actions.close}
                    hideBackButton
                    actionsAlign="space-between"
                    actionsClassName="gripping-actions"
                    labels={{
                      back: actions.back.toUpperCase(),
                      next: actions.next.toUpperCase(),
                      submit: actions.submit.toUpperCase(),
                    }}
                    onSubmit={applySelection}
                    renderActionsLeft={() =>
                      appliedConfig.grippingVariant ? (
                        <button type="button" className="button button--secondary" onClick={removeSelection}>
                          {actions.remove.toUpperCase()}
                        </button>
                      ) : (
                        <span />
                      )
                    }
                    renderSummary={({ state }) => {
                      const selectedGrip = state.grippingProduct?.title || labels.noGrip;
                      const selectedColor = state.grippingVariant?.title || labels.selectColor;

                      return (
                        <p
                          style={{
                            margin: 0,
                            fontSize: '1.35rem',
                            lineHeight: '1.6',
                          }}
                        >
                          {labels.summary}: {selectedGrip} {state.grippingProduct ? `(${selectedColor})` : ''}
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
    </>
  );
};

export default Gripping2;
