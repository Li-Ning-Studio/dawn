(function () {
  const win = window;

  const ensurePendingMap = () => {
    if (!win.s3_service_modal_pending) {
      win.s3_service_modal_pending = {};
    }

    return win.s3_service_modal_pending;
  };

  const ensureScriptStateMap = () => {
    if (!win.s3_service_modal_script_state) {
      win.s3_service_modal_script_state = {};
    }

    return win.s3_service_modal_script_state;
  };

  const getController = (controllerPath) => {
    return controllerPath.split('.').reduce((current, key) => {
      if (!current) return undefined;
      return current[key];
    }, win);
  };

  const isControllerReady = (controller) => {
    return Boolean(controller && controller.ready === true && typeof controller.openModal === 'function');
  };

  const setErrorMessage = (errorTarget, errorMessage) => {
    if (!errorTarget || !errorMessage) return;
    errorTarget.textContent = errorMessage;
  };

  const bindKeyboardOpen = (triggerEl, handleOpen) => {
    triggerEl.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleOpen();
      }
    });
  };

  win.s3_initServiceModalTrigger = function initServiceModalTrigger(options) {
    const {
      serviceKey,
      triggerEl,
      scriptSrc,
      controllerPath,
      errorTarget,
      errorMessage,
      idlePreload = true,
      canOpen,
      enableKeyboard = true,
    } = options || {};

    if (!serviceKey || !triggerEl || !scriptSrc || !controllerPath) return;

    const pendingMap = ensurePendingMap();
    const stateMap = ensureScriptStateMap();

    if (!stateMap[serviceKey]) {
      stateMap[serviceKey] = { loaded: false, loading: false };
    }

      const scriptState = stateMap[serviceKey];

    const attemptOpen = () => {
      if (typeof canOpen === 'function' && !canOpen()) {
        pendingMap[serviceKey] = false;
        return false;
      }

      const controller = getController(controllerPath);
      if (!isControllerReady(controller)) {
        return false;
      }

      pendingMap[serviceKey] = false;
      controller.openModal();
      return true;
    };

    const ensureScript = () => {
      if (scriptState.loaded || scriptState.loading) return;

      const existingScript = document.querySelector(`script[data-service-modal-script="${serviceKey}"]`);
      if (existingScript) {
        scriptState.loading = true;

        existingScript.addEventListener(
          'load',
          () => {
            scriptState.loaded = true;
            scriptState.loading = false;
            existingScript.dataset.serviceModalLoaded = 'true';
            if (pendingMap[serviceKey]) {
              attemptOpen();
            }
          },
          { once: true },
        );

        existingScript.addEventListener(
          'error',
          () => {
            scriptState.loaded = false;
            scriptState.loading = false;
            pendingMap[serviceKey] = false;
            // Failed script elements never emit load/error again; remove it so the next click can retry.
            existingScript.remove();
            setErrorMessage(errorTarget, errorMessage);
          },
          { once: true },
        );

        return;
      }

      scriptState.loading = true;

      const script = document.createElement('script');
      script.src = scriptSrc;
      script.defer = true;
      script.type = 'module';
      script.dataset.serviceModalScript = serviceKey;

      script.onload = () => {
        scriptState.loaded = true;
        scriptState.loading = false;
        script.dataset.serviceModalLoaded = 'true';

        if (pendingMap[serviceKey]) {
          attemptOpen();
        }
      };

      script.onerror = () => {
        scriptState.loaded = false;
        scriptState.loading = false;
        pendingMap[serviceKey] = false;
        // Remove the failed element so a later user action creates a fresh request.
        script.remove();
        setErrorMessage(errorTarget, errorMessage);
      };

      document.body.appendChild(script);
    };

    const requestOpen = () => {
      if (typeof canOpen === 'function' && !canOpen()) return;

      pendingMap[serviceKey] = true;

      if (attemptOpen()) {
        ensureScript();
        return;
      }

      ensureScript();
    };

    if (triggerEl.dataset.serviceModalBound !== 'true') {
      triggerEl.addEventListener('click', requestOpen);

      if (enableKeyboard) {
        bindKeyboardOpen(triggerEl, requestOpen);
      }

      triggerEl.dataset.serviceModalBound = 'true';
    }

    if (idlePreload) {
      if ('requestIdleCallback' in win) {
        requestIdleCallback(() => ensureScript(), { timeout: 4000 });
      } else {
        setTimeout(() => ensureScript(), 2000);
      }
    }
  };
})();
