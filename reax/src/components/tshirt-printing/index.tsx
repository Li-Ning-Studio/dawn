import { render } from 'preact';
import TShirtPrinting from './TShirtPrinting.tsx';

const preactRoot = document.getElementById('tshirt-printing-modal');

if (preactRoot) {
  const {
    actionAdd,
    actionChange,
    actionSubmit,
    actionClose,
    actionRemove,
    headingPersonalise,
    labelTitle,
    labelInput,
    labelNote,
    labelSummaryHtml,
    messageInvalidInput,
    closeConfirmMessage,
    closeConfirmKeepEditing,
    closeConfirmDiscard,
  } = preactRoot.dataset;

  render(
    <TShirtPrinting
      actions={{
        add: actionAdd || '',
        change: actionChange || '',
        submit: actionSubmit || '',
        close: actionClose || '',
        remove: actionRemove || '',
      }}
      labels={{
        heading: headingPersonalise || '',
        title: labelTitle || '',
        input: labelInput || '',
        note: labelNote || '',
        summaryHtml: labelSummaryHtml || '',
      }}
      messages={{
        invalidInput: messageInvalidInput || '',
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
