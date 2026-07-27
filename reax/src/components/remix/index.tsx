import { render } from 'preact';
import Remix from './Remix.tsx';

const preactRoot = document.getElementById('remix-modal');

if (preactRoot) {
  const { actionAdd, actionChange, closeConfirmMessage, closeConfirmKeepEditing, closeConfirmDiscard } =
    preactRoot.dataset;

  render(
    <Remix
      actions={{
        add: actionAdd || '',
        change: actionChange || '',
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
