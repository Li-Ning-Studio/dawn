import { render } from 'preact';
import Gripping2 from './Gripping2.tsx';

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
    descriptionApplicationNote,
    messageLoading,
    messageEmpty,
    messageError,
    factoryGripImage,
    actionAdd,
    actionSelected,
    actionChange,
    actionNext,
    actionBack,
    actionSubmit,
    actionClose,
    actionRemove,
    closeConfirmMessage,
    closeConfirmKeepEditing,
    closeConfirmDiscard,
  } = preactRoot.dataset;

  render(
    <Gripping2
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
        applicationNote: descriptionApplicationNote || '',
      }}
      messages={{
        loading: messageLoading || '',
        empty: messageEmpty || '',
        error: messageError || '',
      }}
      actions={{
        add: actionAdd || '',
        selected: actionSelected || '',
        change: actionChange || '',
        next: actionNext || '',
        back: actionBack || '',
        submit: actionSubmit || '',
        close: actionClose || '',
        remove: actionRemove || '',
      }}
      closeConfirm={{
        message: closeConfirmMessage || '',
        keepEditing: closeConfirmKeepEditing || '',
        discard: closeConfirmDiscard || '',
      }}
    />,
    preactRoot,
  );
}
