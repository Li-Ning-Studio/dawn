import { useEffect, useState } from 'preact/hooks';
import { getMetaobjectQuery, getNodesQuery } from '../../lib/gql';
import client from '../../lib/shopify-client';
import ErrorBoundary from './ErrorBoundary';
// import { TBlockSwipeable, TMediaData, TProps, TResponse } from './types';
import { Maybe, Metaobject, MetaobjectField } from '../../lib/types/storefront.types';
import { TBlockSwipeable, TMediaData, TProps } from './types';

type X = Maybe<
  Pick<Metaobject, 'type' | 'handle'> & {
    fields: Array<Pick<MetaobjectField, 'value' | 'key'>>;
  } & {
    actualMediaList?: Maybe<TMediaData[]>;
    actualMedia?: Maybe<TMediaData[]>;
    actualBlockDataList?: Maybe<TBlockSwipeable[]>;
  }
>;

// Define additional types for our optimized data fetching
interface MediaRequest {
  metaobject: X;
  ids: string[];
  type: 'media_list' | 'media' | 'swipeable';
  blockData?: { metaobject: TBlockSwipeable }[];
}

const SPlusContent = ({ referenceIds }: TProps) => {
  const [sPlusData, setSPlusData] = useState<X[] | null>(null);
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // Fetch all top level metaobjects concurrently
        const topLevelMetaobjectsPromises = referenceIds.contents.map((referenceId) =>
          client.request(getMetaobjectQuery, {
            variables: { id: referenceId },
          }),
        );

        const topLevelResponses = await Promise.all(topLevelMetaobjectsPromises);
        const topLevelMetaobjects = topLevelResponses.map((res) => res.data).filter((data) => data && data.metaobject);

        // Prepare secondary requests based on metaobject types
        const mediaRequests: MediaRequest[] = [];
        const swipeableBlockPromises: {
          metaobject: X;
          promise: Promise<any[]>;
        }[] = [];

        // Ensure we have proper type casting here to match X type
        const metaobjectsToProcess: X[] = topLevelMetaobjects
          .map((data) => data?.metaobject as X)
          .filter((mo): mo is X => Boolean(mo));

        // First pass: collect all IDs that need to be fetched
        for (const metaobject of metaobjectsToProcess) {
          if (!metaobject) continue;

          switch (metaobject.type) {
            case 'ui_media': {
              const desktopMedia = metaobject.fields.find((x) => x.key === 'for_desktop')?.value || '';
              const mobileMedia = metaobject.fields.find((x) => x.key === 'for_mobile')?.value || '';

              if (desktopMedia || mobileMedia) {
                mediaRequests.push({
                  metaobject,
                  ids: [desktopMedia, mobileMedia].filter(Boolean),
                  type: 'media_list',
                });
              }
              break;
            }

            case 'ui_fifty_fifty': {
              const media = metaobject.fields.find((x) => x.key === 'media')?.value || '';
              if (media) {
                mediaRequests.push({
                  metaobject,
                  ids: [media],
                  type: 'media',
                });
              }
              break;
            }

            case 'ui_swipeable': {
              const blockIDs = metaobject?.fields[0]?.value;
              if (blockIDs) {
                // Parse block IDs and fetch all blocks concurrently
                const blockRefs: string[] = JSON.parse(blockIDs);
                const blockPromises = blockRefs.map((blockRefId: string) =>
                  client.request(getMetaobjectQuery, {
                    variables: { id: blockRefId },
                  }),
                );

                swipeableBlockPromises.push({ metaobject, promise: Promise.all(blockPromises) });
              }
              break;
            }
          }
        }

        // Process swipeable blocks first to collect media IDs
        await Promise.all(
          swipeableBlockPromises.map(async ({ metaobject, promise }) => {
            const blockResponses = await promise;
            const blockData = blockResponses.map((res) => res.data).filter((data) => data && data.metaobject);

            // Extract media IDs from blocks
            const mediaIds = blockData
              .map((data) => data.metaobject.fields.find((y: any) => y.key === 'media')?.value)
              .filter(Boolean) as string[];

            if (mediaIds.length > 0) {
              mediaRequests.push({
                metaobject,
                ids: mediaIds,
                type: 'swipeable',
                blockData: blockData.map((d) => ({ metaobject: d.metaobject })),
              });
            }
          }),
        );

        // Batch all media requests into a single request per unique ID
        const allMediaIds = new Set<string>();
        mediaRequests.forEach((req) => req.ids.forEach((id) => allMediaIds.add(id)));

        // Fetch all media in a single request if we have any IDs to fetch
        const mediaMap = new Map();
        if (allMediaIds.size > 0) {
          const { data: allMediaData } = await client.request(getNodesQuery, {
            variables: { ids: Array.from(allMediaIds) },
          });

          if (allMediaData?.nodes) {
            allMediaData.nodes.forEach((node) => {
              if (node) mediaMap.set(node.id, node);
            });
          }
        }

        // Update metaobjects with fetched data
        for (const request of mediaRequests) {
          const { metaobject, type } = request;

          if (!metaobject) {
            continue;
          }

          if (type === 'media_list') {
            metaobject.actualMediaList = request.ids.map((id) => mediaMap.get(id)).filter(Boolean);
          } else if (type === 'media') {
            metaobject.actualMedia = request.ids.map((id) => mediaMap.get(id)).filter(Boolean);
          } else if (type === 'swipeable' && request.blockData) {
            metaobject.actualMediaList = request.ids.map((id) => mediaMap.get(id)).filter(Boolean);
            metaobject.actualBlockDataList = request.blockData.map((d) => d.metaobject);
          }
        }

        if (metaobjectsToProcess.length > 0) {
          setSPlusData(metaobjectsToProcess);
          setTimeout(() => {
            setLoading(false);
          }, 500);
        }
      } catch (error) {
        console.log({ error });
      }
    })();
  }, [referenceIds]);

  const renderFiftyFifty = ({
    title,
    description,
    media,
    imageSide,
  }: {
    title?: string | null;
    description?: string | null;
    media?: TMediaData | null;
    imageSide: 'Left' | 'Right';
  }) => {
    if (!media) return null;

    return (
      <section
        style={{
          display: 'flex',
          alignItems: 'center',
          flexDirection: isMobile ? 'column' : imageSide === 'Left' ? 'row' : 'row-reverse',
          margin: isMobile ? '3rem 0' : '1rem 0',
        }}
      >
        <img
          style={{
            width: isMobile ? '100%' : '50%',
          }}
          src={media.image?.url}
          alt={media.image?.altText || ''}
        />
        <div
          className={'page-width'}
          style={{ maxWidth: isMobile ? '100%' : '50%', paddingTop: isMobile ? '2rem' : '3rem' }}
        >
          <h2
            className={'s3_subheading'}
            style={{
              margin: 0,
            }}
          >
            {title}
          </h2>
          <p
            className={'s3_paragraph'}
            style={{
              color: 'var(--gray-80)',
              marginTop: '1rem',
            }}
          >
            {description}
          </p>
        </div>
      </section>
    );
  };

  return (
    <div
      style={{
        opacity: loading ? 0 : 1,
        translateY: loading ? '3rem' : '0',
        filter: loading ? 'blur(5px)' : 'blur(0)',
        transition: 'all 0.5s ease-out',
      }}
    >
      {sPlusData?.map((comp) => {
        switch (comp?.type) {
          case 'ui_media': {
            // TODO: account for desktop nand mobile media and handle video files too
            const index = isMobile ? 1 : 0;
            return comp.actualMediaList ? (
              <img
                style={{
                  width: '100%',
                  overflow: 'hidden',
                }}
                src={comp.actualMediaList[index]?.image?.url}
                alt={comp.actualMediaList[index]?.image?.altText}
              />
            ) : null;
          }

          case 'ui_fifty_fifty': {
            const side = comp.fields.find((x) => x.key === 'image_side')?.value === 'Left' ? 'Left' : 'Right';

            return renderFiftyFifty({
              title: comp.fields.find((x) => x.key === 'title')?.value,
              description: comp.fields.find((x) => x.key === 'description')?.value,
              media: comp.actualMedia?.[0],
              imageSide: side,
            });
          }

          case 'ui_swipeable': {
            return (
              <>
                {comp.actualBlockDataList?.map((block, index) => {
                  const image = comp.actualMediaList?.find(
                    (x) => x.id === block.fields.find((y) => y.key === 'media')?.value,
                  );

                  return renderFiftyFifty({
                    title: block.fields.find((x) => x.key === 'title')?.value,
                    description: block.fields.find((x) => x.key === 'description')?.value,
                    media: image,
                    imageSide: index % 2 === 0 ? 'Left' : 'Right',
                  });
                })}
              </>
            );
          }

          default: {
            return null;
          }
        }
      })}
    </div>
  );
};

const SPlus = (props: TProps) => {
  return (
    <ErrorBoundary>
      <SPlusContent {...props} />
    </ErrorBoundary>
  );
};

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (window.innerWidth < 768) {
      setIsMobile(true);
    } else {
      setIsMobile(false);
    }
  }, []);

  return isMobile;
};

export default SPlus;
