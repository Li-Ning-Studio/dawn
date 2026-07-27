import { render } from 'preact';
import Stringing2 from './Stringing2.tsx';

const preactRoot = document.getElementById('stringing-root');

if (preactRoot) {
  const {
    stringingCollectionId,
    isKnottingEnabled,
    knottingCost,
    stringingCost,
    maxTension,
    labelChooseString,
    labelSelectColor,
    labelSelectTension,
    labelSelectMethod,
    labelSummary,
    labelTensionUnit,
    labelLowTension,
    labelHighTension,
    labelStringsGuide,
    labelNoString,
    labelTwoKnots,
    labelFourKnots,
    labelTwoKnotsNote,
    labelFourKnotsNote,
    descriptionService,
    filterAll,
    filterPower,
    filterDurable,
    filterBalanced,
    messageLoading,
    messageEmpty,
    messageError,
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
    <Stringing2
      stringingCollectionId={stringingCollectionId || null}
      maxTension={maxTension || null}
      isKnottingEnabled={isKnottingEnabled || null}
      knottingCost={knottingCost || null}
      stringingCost={stringingCost || null}
      labels={{
        chooseString: labelChooseString || '',
        selectColor: labelSelectColor || '',
        selectTension: labelSelectTension || '',
        selectMethod: labelSelectMethod || '',
        summary: labelSummary || '',
        tensionUnit: labelTensionUnit || '',
        lowTension: labelLowTension || '',
        highTension: labelHighTension || '',
        stringsGuide: labelStringsGuide || '',
        noString: labelNoString || '',
        twoKnots: labelTwoKnots || '',
        fourKnots: labelFourKnots || '',
        twoKnotsNote: labelTwoKnotsNote || '',
        fourKnotsNote: labelFourKnotsNote || '',
      }}
      descriptions={{
        service: descriptionService || '',
      }}
      filters={{
        all: filterAll || '',
        power: filterPower || '',
        durable: filterDurable || '',
        balanced: filterBalanced || '',
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
