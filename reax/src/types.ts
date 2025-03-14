import { GetCollectionByIdQuery } from './lib/types/storefront.generated';

declare global {
  interface Window {
    shopUrl: string;
    s3_pat: string;
    s3_stringing_service_variant_id: string | undefined;
  }
}

// First, get the type from your GetCollectionByIdQuery
export type CollectionType = GetCollectionByIdQuery['collection'];

// Then extract the nodes type from the products property
export type ProductNodes = NonNullable<CollectionType>['products']['nodes'];

// If you want to get a single node type:
export type SingleProductNode = ProductNodes[number];

export type TConfig = {
  stringProduct: SingleProductNode | null;
  stringVariant: NonNullable<SingleProductNode>['variants']['nodes'][number] | null;
  tension: number | null;
};
