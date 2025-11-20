import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useState } from 'preact/hooks';
import { fetchCollectionQuery } from '../../lib/gql';
import client from '../../lib/shopify-client';
import { getFreeablePrice } from '../../lib/utils';
import { ProductNodes, TConfig } from '../../types';
import StringGuide from './StringGuide';

function Stringing({
  stringingCollectionId,
  maxTension,
  isKnottingEnabled,
  knottingCost,
  stringingCost,
}: {
  stringingCollectionId: string | null;
  maxTension: string | null;
  isKnottingEnabled: string | null;
  knottingCost: string | null;
  stringingCost: string | null;
}) {
  const shouldShowKnotting = isKnottingEnabled === 'true';
  const POWER_THRESHOLD = 9.5;
  const DURABLE_THRESHOLD = 9.5;
  const maxTensionPounds = parseInt(maxTension?.match(/\d+/g)?.pop() || '69');
  const [stringingProducts, setStringingProducts] = useState<ProductNodes>([]);
  const [config, setConfig] = useState<TConfig>({
    stringProduct: null,
    stringVariant: null,
    tension: null,
    knot: 'two_knot',
  });
  const [isStringGuideOpen, setIsStringGuideOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'All' | 'Power' | 'Durable' | 'Balanced'>('All');

  useEffect(() => {
    (async () => {
      try {
        const { data: dataCol, errors: errorsCol } = await client.request(fetchCollectionQuery, {
          variables: {
            id: `gid://shopify/Collection/${stringingCollectionId}`,
          },
        });

        if (errorsCol?.message) {
          console.error({ errorsCol });
        }

        if (dataCol?.collection?.products?.nodes && dataCol?.collection?.products?.nodes.length > 0) {
          setStringingProducts(dataCol?.collection.products.nodes || []);
        }
      } catch (error) {
        console.error(error);
        (document.getElementsByClassName('frame') as HTMLCollectionOf<HTMLElement>)[0].style.display = 'none';
      }
    })();
  }, [stringingCollectionId]);

  const availableProducts = stringingProducts.filter((y) => y.availableForSale);

  const counts = {
    All: availableProducts.length,
    Power: availableProducts.filter((p) => getMetricMap(p).repulsion >= POWER_THRESHOLD).length,
    Durable: availableProducts.filter((p) => getMetricMap(p).durability >= DURABLE_THRESHOLD).length,
    Balanced: availableProducts.filter((p) => {
      const metrics = getMetricMap(p);
      return metrics.repulsion < POWER_THRESHOLD && metrics.durability < DURABLE_THRESHOLD;
    }).length,
  } as const;

  const getFilteredProducts = () => {
    const available = availableProducts;
    switch (activeFilter) {
      case 'Power':
        return available.filter((p) => getMetricMap(p).repulsion >= POWER_THRESHOLD);
      case 'Durable':
        return available.filter((p) => getMetricMap(p).durability >= DURABLE_THRESHOLD);
      case 'Balanced':
        return available.filter((p) => {
          const metrics = getMetricMap(p);
          return metrics.repulsion < POWER_THRESHOLD && metrics.durability < DURABLE_THRESHOLD;
        });
      case 'All':
      default:
        return available;
    }
  };

  if (stringingProducts.length == 0) {
    return <p>Loading</p>;
  }

  return (
    <>
      <form id="stringing-form" style={{ marginTop: '2rem' }}>
        <div id="strings-container">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <legend className="form__label">
              <span>Choose String</span>
            </legend>
            <button
              type="button"
              onClick={() => setIsStringGuideOpen(true)}
              style={{
                fontFamily: 'inherit',
                border: 'none',
                background: 'transparent',
                padding: 0,
                marginBottom: '0.6rem',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                outline: 'none',
                textDecoration: 'underline',
                fontSize: '1.3rem',
                textTransform: 'capitalize',
              }}
            >
              Strings Guide
            </button>
          </div>
          <div
            style={{
              marginTop: '1.5rem',
            }}
          >
            <style>{`
              .stringing-pills [data-count="0"]:not([data-key="All"]) { display: none; }
            `}</style>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '1rem',
                fontSize: '1.4rem',
              }}
              className="stringing-pills"
            >
              {(['All', 'Power', 'Durable', 'Balanced'] as const).map((x) => {
                const isActive = activeFilter === x;
                return (
                  <div
                    key={x}
                    data-key={x}
                    data-count={(counts as any)[x] ?? 0}
                    onClick={() => setActiveFilter(x)}
                    style={{
                      cursor: 'pointer',
                      borderRadius: '20px',
                      padding: '0.2rem 1.5rem',
                      background: isActive ? 'var(--accent-color, #000)' : '#efefef',
                      color: isActive ? '#fff' : 'inherit',
                      border: 'none',
                    }}
                  >
                    {x}
                  </div>
                );
              })}
            </div>
          </div>
          {getFilteredProducts().map((string) => {
            const id = string?.id.split('/').pop();
            return (
              <label
                className="sheet"
                key={id}
                htmlFor={id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  alignItems: 'center',
                  margin: '1.5rem 0',
                  justifyContent: 'space-between',
                  paddingRight: '1rem',
                  overflow: 'hidden',
                  transition: 'all 0.3s',
                  outline:
                    config.stringProduct?.id === string.id ? '2px solid var(--accent-color)' : '2px solid transparent',
                }}
              >
                <input
                  disabled={string?.availableForSale === false}
                  onChange={(_) => {
                    setConfig({
                      stringProduct: string!,
                      stringVariant: null,
                      tension: null,
                      knot: config.knot,
                    });
                    scrollTo('string-variants-container');
                  }}
                  required
                  type="radio"
                  name="string-product"
                  id={id}
                />
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gridColumn: '1/12',
                    padding: '2px 0',
                    fontSize: '1.4rem',
                  }}
                >
                  <img
                    width={80}
                    height={80}
                    src={string.featuredImage?.url}
                    alt={string.featuredImage?.altText || ''}
                  />
                  <div
                    style={{
                      width: '100%',
                      letterSpacing: '0px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <p style={{ color: 'var(--gray-90)', margin: '0' }}>{string?.title}</p>
                        {(string as any)?.productTagMetafield?.value && (
                          <span
                            style={{
                              fontSize: '12px',
                              color: '#333',
                              padding: '0 8px',
                              borderRadius: '99px',
                              border: '1px solid #999',
                            }}
                          >
                            {(string as any).productTagMetafield.value}
                          </span>
                        )}
                      </div>
                      <span style={{ color: 'var(--gray-60)', fontSize: '1.25rem' }}>
                        {parseInt(string.priceRange.minVariantPrice.amount)}{' '}
                        {string.priceRange.minVariantPrice.currencyCode}
                      </span>
                    </div>
                    {string?.metafield?.value ? (
                      <span className={'string-variant-description'}>{string?.metafield?.value}</span>
                    ) : null}
                  </div>
                </div>
              </label>
            );
          })}
        </div>

        <div
          style={{
            scrollMarginTop: '10rem',
          }}
          id="string-variants-container"
        >
          {config.stringProduct ? (
            <div>
              <legend className="form__label">
                <span>Select Color for {config.stringProduct.title} String</span>
              </legend>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                {config.stringProduct.variants.nodes
                  .sort((a, b) => (a.id > b.id ? 1 : -1))
                  .sort((x, _) => (x.availableForSale ? -1 : 1))
                  .filter((x) => x.availableForSale)
                  .map((variant) => {
                    const id = variant.id.split('/').pop();
                    const hex = config.stringProduct?.options[0].optionValues.find((x) => x.name == variant.title)
                      ?.swatch?.color;

                    const isOutOfStock = variant.availableForSale === false;

                    return (
                      <label
                        className={`sheet`}
                        key={id}
                        htmlFor={id}
                        style={{
                          opacity: isOutOfStock ? 0.1 : 1,
                          width: '50px',
                          height: '50px',
                          borderRadius: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          marginRight: '0.4rem',
                          justifyContent: 'center',
                          outline:
                            config.stringVariant?.id === variant.id
                              ? '2px solid var(--accent-color)'
                              : '2px solid transparent',
                        }}
                      >
                        <input
                          data-sku={variant.sku}
                          data-string={(config?.stringProduct?.title || '') + ' - ' + variant.title}
                          disabled={variant.availableForSale === false}
                          onChange={(_) => {
                            setConfig({
                              stringProduct: config.stringProduct,
                              stringVariant: variant,
                              tension: config.tension,
                              knot: config.knot,
                            });
                            scrollTo('string-tensions-container');
                          }}
                          required
                          type="radio"
                          name="string-variant"
                          id={id}
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
                          <span>{variant.title}</span>
                        )}
                      </label>
                    );
                  })}
              </div>
            </div>
          ) : null}
        </div>

        <div
          style={{
            scrollMarginTop: '10rem',
          }}
          id="string-tensions-container"
        >
          {config.stringVariant ? (
            <div>
              <legend className="form__label">
                <span>adjust Tension</span>
              </legend>
              <div
                style={{
                  display: 'grid',
                  gap: '1.5rem',
                  justifyContent: 'start',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  marginTop: '1rem',
                }}
              >
                {Array.from({ length: 20 }, (_, i) => i + 21).map((tension) => {
                  return (
                    <label
                      className="sheet"
                      key={tension}
                      htmlFor={String(tension)}
                      style={{
                        fontSize: window.innerWidth > 768 ? '1.6rem' : '1.4rem',
                        display: maxTensionPounds < tension ? 'none' : 'block',
                        padding: '0.8rem 0',
                        textAlign: 'center',
                        outline: config.tension === tension ? '2px solid var(--accent-color)' : '2px solid transparent',
                        color: config.tension === tension ? 'black' : 'var(--gray-70)',
                        transition: 'all 0.3s',
                      }}
                    >
                      <input
                        onChange={(_) => {
                          setConfig({
                            stringProduct: config.stringProduct,
                            stringVariant: config.stringVariant,
                            tension: tension,
                            knot: config.knot,
                          });
                          scrollTo('knot-container');
                        }}
                        required
                        type="radio"
                        name="string-tension"
                        id={String(tension)}
                      />
                      <span>{tension}LBS</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        {config.stringVariant && config.tension && shouldShowKnotting ? (
          <div id="knot-container" style={{ marginTop: '2rem', scrollMarginTop: '10rem' }}>
            <legend className="form__label">
              <span>Stringing Method</span>
            </legend>
            <div style={{ display: 'flex', gap: '1rem', textAlign: 'center', marginTop: '1rem' }}>
              <label
                className="sheet"
                htmlFor={'two-knots'}
                style={{
                  width: '50%',
                  display: 'block',
                  fontSize: window.innerWidth > 768 ? '1.5rem' : '1.4rem',
                  borderRadius: 'var(--variant-pills-radius)',
                  padding: '1rem',

                  outline: config.knot === 'two_knot' ? '2px solid var(--accent-color)' : '2px solid transparent',
                  color: config.knot === 'two_knot' ? 'black' : 'var(--gray-70)',
                  transition: 'all 0.3s',
                }}
              >
                <input
                  onChange={(_) => {
                    setConfig({
                      stringProduct: config.stringProduct,
                      stringVariant: config.stringVariant,
                      tension: config.tension,
                      knot: 'two_knot',
                    });
                  }}
                  required
                  data-knot-value="two_knot"
                  checked={config.knot === 'two_knot'}
                  type="radio"
                  name="knot-config"
                  id={'two-knots'}
                />
                <div>
                  <p style={{ margin: 0 }}>Two Knots</p>
                  <p style={{ margin: '-3px', fontSize: '1.3rem', opacity: 0.6 }}>FREE</p>
                </div>
              </label>

              <label
                className="sheet"
                htmlFor={'four-knots'}
                style={{
                  width: '50%',
                  display: 'block',
                  fontSize: window.innerWidth > 768 ? '1.5rem' : '1.4rem',
                  borderRadius: 'var(--variant-pills-radius)',
                  padding: '1rem',

                  outline: config.knot === 'four_knot' ? '2px solid var(--accent-color)' : '2px solid transparent',
                  color: config.knot === 'four_knot' ? 'black' : 'var(--gray-70)',
                  transition: 'all 0.3s',
                }}
              >
                <input
                  checked={config.knot === 'four_knot'}
                  onChange={(_) => {
                    setConfig({
                      stringProduct: config.stringProduct,
                      stringVariant: config.stringVariant,
                      tension: config.tension,
                      knot: 'four_knot',
                    });
                  }}
                  required
                  data-knot-value="four_knot"
                  type="radio"
                  name="knot-config"
                  id={'four-knots'}
                />
                <div>
                  <p style={{ margin: 0 }}>Four Knots</p>
                  <p style={{ margin: '-3px', fontSize: '1.3rem', opacity: 0.6 }}>{getFreeablePrice(knottingCost)}</p>
                </div>
              </label>
            </div>
            {config.knot === 'four_knot' ? (
              <p style={{ fontSize: '1.4rem', opacity: 0.8 }}>
                Four Knots method uses two separate pieces of string, one for the mains and one for the crosses,
                resulting in four tie-off knots. Great for high-tension strings.
              </p>
            ) : (
              <p style={{ fontSize: '1.4rem', opacity: 0.8 }}>
                Two Knots method is our default method. This utilizes a single continuous length of string for both the
                mains and crosses. Suitable for moderate tensions.
              </p>
            )}
          </div>
        ) : null}

        {config.stringVariant && config.tension ? (
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
            <p>All set now! Your custom stringing configuration for {window.s3_product_name} is complete.</p>
            {[
              {
                leftSide: `${config.stringVariant?.selectedOptions[0].value} ${config.stringProduct?.title} String - ${config.tension} LBS`,
                rightSide: `${parseInt(config.stringVariant?.price.amount)} ${config.stringVariant?.price.currencyCode}`,
                shouldShow: config.tension !== null,
              },
              {
                leftSide: 'Stringing Service',
                rightSide: getFreeablePrice(stringingCost),
                shouldShow: true,
              },
              {
                leftSide: '4 Knots Stringing',
                rightSide: getFreeablePrice(knottingCost),
                shouldShow: config.knot === 'four_knot',
              },
            ].map(({ leftSide, rightSide, shouldShow }) =>
              shouldShow ? (
                <p
                  style={{
                    display: 'flex',
                    gap: '1rem',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    margin: '1.3rem 0',
                  }}
                >
                  <span>{leftSide}</span>
                  <span
                    style={{
                      flex: 1,
                      height: '0.5px',
                      border: '0.5px solid rgba(var(--color-foreground), 0.09)',
                    }}
                  ></span>
                  <span>{rightSide}</span>
                </p>
              ) : null,
            )}
          </div>
        ) : null}

        <hr style={{ margin: '3rem 0' }} />
      </form>

      <Dialog.Root open={isStringGuideOpen} onOpenChange={setIsStringGuideOpen}>
        <Dialog.Portal>
          <Dialog.Overlay
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 999,
            }}
          />
          <Dialog.Content
            style={{
              position: 'fixed',
              top: '0',
              left: 0,
              width: '100vw',
              height: '100vh',
              zIndex: 1000,
              overflow: 'auto',
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              pointerEvents: 'none',
            }}
          >
            <Dialog.DialogTitle />
            <StringGuide closeStringsGuide={() => setIsStringGuideOpen(false)} stringingProducts={stringingProducts} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

const scrollTo = (where: string) => {
  setTimeout(() => {
    const element = document.getElementById(where);
    if (element) {
      window.document.getElementById(where)?.scrollIntoView({
        behavior: 'smooth',
      });
    }
  }, 500);
};

const getMetricMap = (p: ProductNodes[number]) => {
  const map = new Map<string, number>();
  const entries = (p as any)?.metafields as Array<{ key: string; value: string }> | undefined;
  if (entries && Array.isArray(entries)) {
    for (const m of entries) {
      if (!m) continue;
      const raw = (m.value as any) ?? '';
      const match = typeof raw === 'string' ? raw.match(/\d+(?:\.\d+)?/) : null;
      const val = match ? parseFloat(match[0]) : NaN;
      if (!Number.isNaN(val)) map.set(m.key, val);
    }
  }
  return {
    durability: map.get('durability') ?? 0,
    control: map.get('control') ?? 0,
    repulsion: map.get('repulsion_power') ?? 0,
    sound: map.get('hitting_sound') ?? 0,
    shock: map.get('shock_absorption') ?? 0,
  };
};

export default Stringing;
