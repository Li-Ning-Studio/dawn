import { render } from 'preact';
import TShirtPrinting, { parsePrintingMaterials } from './TShirtPrinting.tsx';

const preactRoot = document.getElementById('tshirt-printing-modal');

if (preactRoot) {
  const {
    actionAdd,
    actionChange,
    actionSubmit,
    actionClose,
    actionRemove,
    actionAddSecondLine,
    actionClearSecondLine,
    headingPersonalise,
    labelTitle,
    labelInput,
    labelSecondInput,
    labelNote,
    labelSummaryHtml,
    messageInvalidInput,
    messageLogoUnavailable,
    messageLogoLoading,
    countryIn,
    countryId,
    countryCn,
    countryJp,
    countryMy,
    countryDk,
    liningLogoSrc,
    hndrdLogoSrc,
    closeConfirmMessage,
    closeConfirmKeepEditing,
    closeConfirmDiscard,
    secondLineEnabled,
    singleLinePrice,
    plusPrice,
    clearIconSrc,
    materialsEnabled,
    materialsSecondLineEnabled,
    materialOptions,
    labelMaterial,
    labelMaterialNote,
    labelMaterialUnavailable,
    messageMaterialUnavailable,
    lightingTitle,
    lightingDaylight,
    lightingOff,
    lightingOn,
    lightingDaylightDescription,
    lightingOffDescription,
    lightingOnDescription,
  } = preactRoot.dataset;

  render(
    <TShirtPrinting
      actions={{
        add: actionAdd || '',
        change: actionChange || '',
        submit: actionSubmit || '',
        close: actionClose || '',
        remove: actionRemove || '',
        addSecondLine: actionAddSecondLine || '',
        clearSecondLine: actionClearSecondLine || '',
      }}
      labels={{
        heading: headingPersonalise || '',
        title: labelTitle || '',
        input: labelInput || '',
        secondInput: labelSecondInput || '',
        note: labelNote || '',
        summaryHtml: labelSummaryHtml || '',
      }}
      messages={{
        invalidInput: messageInvalidInput || '',
        logoUnavailable: messageLogoUnavailable || '',
        logoLoading: messageLogoLoading || '',
      }}
      closeConfirm={{
        message: closeConfirmMessage || '',
        keepEditing: closeConfirmKeepEditing || '',
        discard: closeConfirmDiscard || '',
      }}
      secondLine={{
        enabled: secondLineEnabled === 'true',
        singleLinePrice: singleLinePrice || '',
        plusPrice: plusPrice || '',
        clearIconSrc: clearIconSrc || '',
        logoUrls: { lining: liningLogoSrc || '', hndrd: hndrdLogoSrc || '' },
        countryLabels: {
          IN: countryIn || '',
          ID: countryId || '',
          CN: countryCn || '',
          JP: countryJp || '',
          MY: countryMy || '',
          DK: countryDk || '',
        },
      }}
      materials={{
        enabled: materialsEnabled === 'true',
        secondLineEnabled: materialsSecondLineEnabled === 'true',
        options: parsePrintingMaterials(materialOptions),
        title: labelMaterial || '',
        note: labelMaterialNote || '',
        unavailable: labelMaterialUnavailable || '',
        unavailableMessage: messageMaterialUnavailable || '',
        lighting: {
          title: lightingTitle || '',
          labels: { daylight: lightingDaylight || '', off: lightingOff || '', on: lightingOn || '' },
          descriptions: {
            daylight: lightingDaylightDescription || '',
            off: lightingOffDescription || '',
            on: lightingOnDescription || '',
          },
        },
      }}
    />,
    preactRoot,
  );
}
