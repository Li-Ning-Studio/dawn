import { useEffect, useState } from 'preact/hooks';
import { fetchCollectionQuery } from '../../lib/gql';
import client from '../../lib/shopify-client';
import { getFreeablePrice } from '../../lib/utils';
import { ProductNodes, SingleProductNode, TGripConfig } from '../../types';

type GrippingProps = {
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
  };
  messages: {
    loading: string;
    empty: string;
    error: string;
  };
};

const EMPTY_CONFIG: TGripConfig = {
  grippingProduct: null,
  grippingVariant: null,
};

const Gripping = ({
  grippingCollectionId,
  grippingCost,
  factoryGripImage,
  labels,
  descriptions,
  messages,
}: GrippingProps) => {
  const [grippingProducts, setGrippingProducts] = useState<ProductNodes>([]);
  const [config, setConfig] = useState<TGripConfig>({ ...EMPTY_CONFIG });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  //   useEffect(() => {
  //     const toggle = document.getElementById('grip-setting-toggle') as HTMLElement | null;
  //     if (!toggle) return;

  //     if (config.grippingVariant) {
  //       const variantId = config.grippingVariant.id.split('Variant/')[1] || '';
  //       toggle.dataset.currentGripSelection = variantId;
  //       toggle.dataset.currentGripSku = config.grippingVariant.sku || '';
  //     } else {
  //       delete toggle.dataset.currentGripSelection;
  //       delete toggle.dataset.currentGripSku;
  //     }
  //   }, [config.grippingVariant]);

  const availableProducts = grippingProducts?.filter((product) => product.availableForSale) || [];

  const displayedProducts = availableProducts?.slice(0, 5) || [];

  const baseOptionStyles = {
    display: 'block',
    fontSize: typeof window !== 'undefined' && window.innerWidth > 768 ? '1.5rem' : '1.4rem',
    borderRadius: 'var(--variant-pills-radius)',
    padding: '0.2rem 1rem 0.2rem 0.1rem',
    margin: '1.1rem 0',
    textAlign: 'center',
    transition: 'all 0.3s',
  };

  const selectedProductVariants =
    config.grippingProduct?.variants?.nodes
      ?.slice()
      .sort((a, b) => (a.id > b.id ? 1 : -1))
      .sort((variant) => (variant.availableForSale ? -1 : 1))
      .filter((variant) => variant.availableForSale) ?? [];

  const currentVariantPrice = config.grippingVariant
    ? getFreeablePrice(`${config.grippingVariant.price.amount} ${config.grippingVariant.price.currencyCode}`)
    : null;

  if (isLoading) {
    return <p className="frame-description">{messages.loading}</p>;
  }

  const fallbackMessage = errorMessage || (!displayedProducts.length ? messages.empty : null);

  return (
    <form id="grip-form">
      <input
        type="hidden"
        id="selected-grip-variant-id"
        data-current-grip-selection={config.grippingVariant?.id.split('Variant/')[1] || ''}
        data-current-grip-sku={config.grippingVariant?.sku || ''}
      />

      <div id="grip-products-container" style={{ scrollMarginTop: '10rem', marginTop: '2rem' }}>
        <legend className="form__label">
          <span>{labels.chooseGrip}</span>
        </legend>

        <label
          className="sheet"
          htmlFor="grip-product-none"
          style={{
            ...baseOptionStyles,
            outline: config.grippingProduct ? '2px solid transparent' : '2px solid var(--accent-color)',
          }}
        >
          <input
            onChange={() => setConfig({ ...EMPTY_CONFIG })}
            required
            type="radio"
            name="grip-product"
            id="grip-product-none"
            checked={config.grippingProduct == null}
          />
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {factoryGripImage ? (
              <div>
                <img width={70} height={70} src={factoryGripImage} alt={labels.noGrip} />
              </div>
            ) : null}
            <div
              style={{
                marginLeft: factoryGripImage ? '1.3rem' : 0,
                flex: 1,
                textAlign: 'left',
                padding: '0.5rem 0.3rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="grip-variant-name">{labels.noGrip}</span>
                <span style={{ fontSize: '1.3rem' }}>{labels.free}</span>
              </div>
              <span className="grip-variant-description">{descriptions.noGrip}</span>
            </div>
          </div>
        </label>

        {displayedProducts.map((product) => {
          const productId = product.id.split('/').pop();
          const isSelected = config.grippingProduct?.id === product.id;

          return (
            <label
              key={productId}
              className="sheet"
              htmlFor={`grip-product-${productId}`}
              style={{
                ...baseOptionStyles,
                outline: isSelected ? '2px solid var(--accent-color)' : '2px solid transparent',
              }}
            >
              <input
                checked={isSelected}
                onChange={() => {
                  setConfig({ grippingProduct: product as SingleProductNode, grippingVariant: null });
                  scrollTo('grip-variants-container');
                }}
                required
                type="radio"
                name="grip-product"
                id={`grip-product-${productId}`}
              />
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div>
                  <img
                    width={70}
                    height={70}
                    src={product.featuredImage?.url}
                    alt={product.featuredImage?.altText || ''}
                  />
                </div>
                <div style={{ marginLeft: '1.3rem', flex: 1, textAlign: 'left' }}>
                  <span className={'grip-variant-name'}>{product.title}</span>
                  <span className={'grip-variant-description'}>{product.metafield?.value}</span>
                </div>
                <span style={{ fontSize: '1.3rem' }}>
                  {getFreeablePrice(
                    `${product.priceRange.minVariantPrice.amount} ${product.priceRange.minVariantPrice.currencyCode}`,
                  )}
                </span>
              </div>
            </label>
          );
        })}

        {fallbackMessage ? <p className="frame-description">{fallbackMessage}</p> : null}
      </div>

      {config.grippingProduct ? (
        <div
          id="grip-variants-container"
          style={{
            scrollMarginTop: '10rem',
            marginTop: '2rem',
          }}
        >
          <legend className="form__label">
            <span>
              {labels.selectColor} {config.grippingProduct.title ? ` — ${config.grippingProduct.title}` : ''}
            </span>
          </legend>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1rem' }}>
            {selectedProductVariants.map((variant) => {
              const variantId = variant.id.split('/').pop();
              const hex = config.grippingProduct?.options?.[0]?.optionValues?.find(
                (option) => option.name === variant.title,
              )?.swatch?.color;

              return (
                <label
                  className="sheet"
                  key={variantId}
                  htmlFor={`grip-variant-${variantId}`}
                  style={{
                    opacity: variant.availableForSale ? 1 : 0.1,
                    width: '50px',
                    height: '50px',
                    borderRadius: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    marginRight: '0.4rem',
                    justifyContent: 'center',
                    outline:
                      config.grippingVariant?.id === variant.id
                        ? '2px solid var(--accent-color)'
                        : '2px solid transparent',
                  }}
                >
                  <input
                    type="radio"
                    name="grip-variant"
                    id={`grip-variant-${variantId}`}
                    data-sku={variant.sku}
                    disabled={!variant.availableForSale}
                    onChange={() => {
                      setConfig({
                        grippingProduct: config.grippingProduct,
                        grippingVariant: variant,
                      });
                    }}
                    checked={config.grippingVariant?.id === variant.id}
                    required
                  />
                  {hex ? (
                    <span
                      style={{
                        width: '46px',
                        height: '46px',
                        background: hex,
                        borderRadius: '100%',
                        display: 'block',
                      }}
                    ></span>
                  ) : (
                    <span style={{ fontSize: '0.9rem' }}>{variant.title}</span>
                  )}
                </label>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* SUMMARY */}
      {config.grippingVariant ? (
        <div
          style={{
            background: 'rgb(247, 247, 247)',
            padding: '0.2rem 1.7rem',
            borderRadius: '10px',
            color: '#002d03',
            fontSize: '1.4rem',
            lineHeight: '1.6',
            letterSpacing: '0.03rem',
            marginTop: '1.5rem',
          }}
        >
          <p>{labels.summary}</p>
          <p
            style={{
              display: 'flex',
              gap: '1rem',
              alignItems: 'center',
              justifyContent: 'space-between',
              margin: '1.3rem 0',
            }}
          >
            <span>
              {config.grippingProduct?.title} — {config.grippingVariant?.title}
            </span>
            <span
              style={{
                flex: 1,
                height: '0.5px',
                border: '0.5px solid rgba(var(--color-foreground), 0.09)',
              }}
            ></span>
            <span>{currentVariantPrice}</span>
          </p>
          <p
            style={{
              display: 'flex',
              gap: '1rem',
              alignItems: 'center',
              justifyContent: 'space-between',
              margin: '1.3rem 0',
            }}
          >
            <span>{labels.serviceCost}</span>
            <span
              style={{
                flex: 1,
                height: '0.5px',
                border: '0.5px solid rgba(var(--color-foreground), 0.09)',
              }}
            ></span>
            <span>{getFreeablePrice(grippingCost)}</span>
          </p>
        </div>
      ) : null}
      <hr style="margin: 3rem 0" />
    </form>
  );
};

const scrollTo = (where: string) => {
  setTimeout(() => {
    document.getElementById(where)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 200);
};

export default Gripping;
