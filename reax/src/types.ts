import { GetCollectionByIdQuery } from './lib/types/storefront.generated';

type ServiceModalController = {
  openModal: () => void;
  closeModal: () => void;
  isOpen: boolean;
  ready: boolean;
};

type ServiceModalPendingMap = Partial<Record<'stringing' | 'gripping' | 'remix' | 'tshirt_printing', boolean>>;

declare global {
  interface Window {
    shopUrl: string;
    s3_pat: string;
    s3_product_name: string | undefined;
    s3_product_type: TRemixProductType | undefined;
    s3_brand: string | undefined;
    s3_stringing_service_variant_id: string | undefined;
    s3_four_knots_service_variant_id: string | undefined;
    s3_stringing_modal_controller: ServiceModalController | undefined;
    s3_gripping_service_variant_id: string | undefined;
    s3_gripping_modal_controller: ServiceModalController | undefined;
    s3_bxgy: unknown;
    s3_bxgy_variants: unknown;
    s3_product_collections: string[] | undefined;
    s3_remix_service_variant_id: string | undefined;
    s3_remix_modal_controller: ServiceModalController | undefined;
    s3_remix_config:
      | {
          racketFrameColor: string;
          racketGripColor: string;
          logoColor: string;
          stickerTextColor: string;
          modelPath: string;
        }
      | undefined;
    s3_tshirt_printing_controller: ServiceModalController | undefined;
    s3_tshirt_printing_config:
      | { tshirtColor: string; tshirtTextColor: string; texturePath: string | undefined }
      | undefined;
    s3_service_modal_pending: ServiceModalPendingMap | undefined;
    s3_service_modal_script_state: Record<string, { loaded: boolean; loading: boolean }> | undefined;
    s3_initServiceModalTrigger:
      | ((options: {
          serviceKey: string;
          triggerEl: HTMLElement;
          scriptSrc: string;
          controllerPath: string;
          errorTarget?: HTMLElement | null;
          errorMessage?: string;
          idlePreload?: boolean;
          canOpen?: () => boolean;
          enableKeyboard?: boolean;
        }) => void)
      | undefined;
  }
}

export type TRemixProductType = 'Badminton Racket' | 'Pickleball Paddle' | 'Badminton Kitbags';

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
  knot: 'two_knot' | 'four_knot' | null;
};

export type TGripConfig = {
  grippingProduct: SingleProductNode | null;
  grippingVariant: NonNullable<SingleProductNode>['variants']['nodes'][number] | null;
};
