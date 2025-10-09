import { render } from 'preact';
import Gripping from './Gripping.tsx';

const preactRoot = document.getElementById('gripping-root');

if (preactRoot) {
  const {
    grippingCollectionId,
    grippingCost,
    labelChooseGrip,
    labelSelectColor,
    labelSummary,
    labelServiceCost,
    labelVariantPrice,
    labelNoGrip,
    labelFree,
    descriptionNoGrip,
    messageLoading,
    messageEmpty,
    messageError,
    factoryGripImage,
  } = preactRoot.dataset;

  render(
    <Gripping
      grippingCollectionId={grippingCollectionId || null}
      grippingCost={grippingCost || null}
      factoryGripImage={factoryGripImage || null}
      labels={{
        chooseGrip: labelChooseGrip || '',
        selectColor: labelSelectColor || '',
        summary: labelSummary || '',
        serviceCost: labelServiceCost || '',
        variantPrice: labelVariantPrice || '',
        noGrip: labelNoGrip || '',
        free: labelFree || '',
      }}
      descriptions={{
        noGrip: descriptionNoGrip || '',
      }}
      messages={{
        loading: messageLoading || '',
        empty: messageEmpty || '',
        error: messageError || '',
      }}
    />,
    preactRoot,
  );
}
