if (!customElements.get('product-form')) {
  customElements.define(
    'product-form',
    class ProductForm extends HTMLElement {
      // Read by the lazy modal after custom-element upgrade. An older cached
      // form must never be offered finishes it cannot charge or fulfil.
      get supportsTshirtMaterials() {
        return true;
      }

      constructor() {
        super();

        this.form = this.querySelector('form');
        this.variantIdInput.disabled = false;
        this.form.addEventListener('submit', this.onSubmitHandler.bind(this));
        this.cart = document.querySelector('cart-notification') || document.querySelector('cart-drawer');
        this.submitButton = this.querySelector('[type="submit"]');
        this.submitButtonText = this.submitButton.querySelector('span');

        if (document.querySelector('cart-drawer')) this.submitButton.setAttribute('aria-haspopup', 'dialog');

        this.hideErrors = this.dataset.hideErrors === 'true';
      }

      getCustomisationItemId(item) {
        return String(item.variant_id || item.id);
      }

      getTshirtPrintingSelection() {
        const text = document.getElementById('the-tshirt-text');
        if (!text) return null;

        const root = document.getElementById('tshirt-printing-modal');
        const country = document.getElementById('the-tshirt-second-line');
        const countryText = country?.innerText.trim() || '';
        const logo = country?.dataset.logoId || '';
        const materialId = text.dataset.materialId;
        const materialColors = {
          standard: '',
          gold: 'GOLD',
          hologram: 'HOLOGRAM',
          reflective: 'REFLECTIVE',
          'rose-gold': 'ROSE GOLD',
        };
        const materialError = root?.dataset.messageMaterialUnavailable || window.cartStrings.error;
        // Missing material metadata means a legacy modal, not a new selection.
        // Explicit but invalid metadata must fail closed, including a flag that
        // was disabled after a specialty selection was committed.
        const hasMaterial = materialId !== undefined;
        if (
          hasMaterial &&
          (root?.dataset.materialsEnabled !== 'true' ||
            !Object.prototype.hasOwnProperty.call(materialColors, materialId))
        ) {
          throw new Error(materialError);
        }
        const secondLineEnabled = hasMaterial
          ? root?.dataset.materialsSecondLineEnabled === 'true'
          : window.s3_tshirt_printing_second_line_enabled === true;
        const hasSecondLine = countryText.length > 0;
        if (
          hasSecondLine &&
          (!secondLineEnabled ||
            !['lining', 'hndrd'].includes(logo) ||
            !['INDIA', 'INDONESIA', 'CHINA', 'JAPAN', 'MALAYSIA', 'DENMARK'].includes(countryText))
        ) {
          throw new Error(root?.dataset.messageLogoUnavailable || window.cartStrings.error);
        }

        let variantId = hasSecondLine
          ? window.s3_tshirt_printing_plus_service_variant_id
          : window.s3_tshirt_printing_service_variant_id;
        let textColor = window.s3_tshirt_printing_config?.tshirtTextColor || 'UNKNOWN';
        if (hasMaterial) {
          let options;
          try {
            options = JSON.parse(root.dataset.materialOptions || '[]');
          } catch {
            throw new Error(materialError);
          }
          const matches = Array.isArray(options) ? options.filter((option) => option?.id === materialId) : [];
          const service = hasSecondLine ? matches[0]?.plus : matches[0]?.single;
          if (matches.length !== 1 || service?.available !== true || !/^\d+$/.test(service.variantId || '')) {
            throw new Error(materialError);
          }
          variantId = service.variantId;
          if (materialId !== 'standard') textColor = materialColors[materialId];
        }
        if (!variantId) throw new Error(materialError);

        return {
          id: variantId,
          quantity: 1,
          properties: {
            _tshirtText: text.innerText,
            ...(hasSecondLine ? { _tshirtSecondLine: countryText, _tshirtLogo: logo } : {}),
            ...(hasMaterial ? { _tshirtMaterial: materialId } : {}),
            _textColor: textColor,
            _productSKU: window.s3_current_variant_sku || '',
            _productName: window.s3_product_name || '',
          },
        };
      }

      // Shopify's native parent_relationship is the source of truth. The
      // private customisation property only correlates this submission so an
      // incomplete response can be identified and removed without touching
      // another customised product already in the cart.
      hasValidAddResponse(response, mainVariantId, customisationItems, customisationId) {
        const responseItems = Array.isArray(response.items) ? response.items : [];
        const hasCustomisations = customisationItems.length > 0;
        const addedMainItem = responseItems.find(
          (item) =>
            this.getCustomisationItemId(item) === String(mainVariantId) &&
            (!hasCustomisations || item.properties?._customisationId === customisationId),
        );

        if (!addedMainItem || Number(addedMainItem.quantity) <= 0) return false;
        if (!hasCustomisations) return true;

        const remainingResponseQuantities = responseItems.map((item) => ({
          item,
          quantity: Number(item.quantity),
        }));

        return customisationItems.every((expectedItem) => {
          const matchingItem = remainingResponseQuantities.find(
            ({ item, quantity }) =>
              quantity >= Number(expectedItem.quantity) &&
              this.getCustomisationItemId(item) === String(expectedItem.id) &&
              item.properties?._customisationId === customisationId &&
              item.parent_relationship?.parent_key === addedMainItem.key,
          );

          if (!matchingItem) return false;
          matchingItem.quantity -= Number(expectedItem.quantity);
          return true;
        });
      }

      async rollbackCustomisation(customisationId, sections) {
        const cartResponse = await fetch(`${routes.cart_url}.js`, {
          headers: { Accept: 'application/json' },
        });
        if (!cartResponse.ok) throw new Error('Unable to read the cart before rolling back the customisation.');

        const cart = await cartResponse.json();
        const updates = {};
        // Line keys target the exact lines created by this attempt. Variant IDs
        // are not safe here because a shopper can already have the same
        // product or service variant in their cart.
        // Promotional items share this attempt's ID under _offerInstanceId,
        // but have no native parent relationship to remove them with the parent.
        cart.items
          .filter(
            (item) =>
              item.properties?._customisationId === customisationId ||
              item.properties?._offerInstanceId === customisationId,
          )
          .forEach((item) => {
            updates[item.key] = 0;
          });

        if (Object.keys(updates).length === 0) return null;

        const rollbackResponse = await fetch(routes.cart_update_url, {
          ...fetchConfig(),
          body: JSON.stringify({
            updates,
            sections,
            sections_url: window.location.pathname,
          }),
        });
        const rollbackCart = await rollbackResponse.json();

        if (!rollbackResponse.ok || rollbackCart.errors) {
          throw new Error('Unable to roll back the incomplete customisation.');
        }

        return rollbackCart;
      }

      showAddError(response, mainVariantId) {
        publish(PUB_SUB_EVENTS.cartError, {
          source: 'product-form',
          productVariantId: mainVariantId,
          errors: response?.errors || response?.description || window.cartStrings.error,
          message: response?.message,
        });
        this.handleErrorMessage(response?.description || window.cartStrings.error);

        if (response?.status) {
          const soldOutMessage = this.submitButton.querySelector('.sold-out-message');
          if (soldOutMessage) {
            this.submitButton.setAttribute('aria-disabled', true);
            this.submitButtonText.classList.add('hidden');
            soldOutMessage.classList.remove('hidden');
          }
        }

        this.error = true;
      }

      async handleIncompleteCustomisation(response, mainVariantId, customisationId, sections) {
        this.showAddError(response, mainVariantId);

        try {
          const rollbackCart = await this.rollbackCustomisation(customisationId, sections);
          if (rollbackCart && this.cart) this.cart.renderContents(rollbackCart);
        } catch (rollbackError) {
          console.error(rollbackError);
          window.location = window.routes.cart_url;
        }
      }

      renderCart(response) {
        const renderContents = () => {
          this.cart.renderContents(response);
          // Only leave the empty-cart layout after its markup was replaced.
          // Clearing this in finally exposes a blank drawer when refresh fails.
          this.cart.classList.remove('is-empty');
        };
        const quickAddModal = this.closest('quick-add-modal');
        if (quickAddModal) {
          document.body.addEventListener(
            'modalClosed',
            () => {
              setTimeout(() => {
                CartPerformance.measure('add:paint-updated-sections', renderContents);
              });
            },
            { once: true },
          );
          quickAddModal.hide(true);
        } else {
          CartPerformance.measure('add:paint-updated-sections', renderContents);
        }
      }

      onSubmitHandler(evt) {
        let selectedVariantSku = window?.s3_current_variant_sku || null;

        evt.preventDefault();

        // validate the stringing form too, if the validation fails, highlight it and  return early
        const stringingForm = document.getElementById('stringing-form');
        const stringingRoot = document.getElementById('stringing-root');
        if (stringingForm && document.querySelector('input[name="frame"]:checked')?.id === 'pro-stringing') {
          if (!stringingForm.checkValidity()) {
            const radioButtons = stringingForm.querySelectorAll('input[type="radio"]');
            const invalidRadioName = Array.from(radioButtons).find((radio) => radio.validity.valueMissing)?.name;

            const errorMessage =
              invalidRadioName === 'string-product'
                ? stringingRoot?.dataset?.errorMissingProduct || 'Please select a String'
                : invalidRadioName === 'string-variant'
                  ? stringingRoot?.dataset?.errorMissingVariant || 'Please choose a String Color'
                  : invalidRadioName === 'string-tension'
                    ? stringingRoot?.dataset?.errorMissingTension || 'Please select a tension'
                    : 'Please select all required options';

            this.handleErrorMessage(errorMessage);

            return stringingForm.reportValidity();
          } else {
            this.handleErrorMessage('');
          }
        }
        // validation finsihed

        const grippingForm = document.getElementById('grip-form');
        const selectedGripOption = document.querySelector('input[name="gripping-option"]:checked')?.id;

        if (grippingForm && selectedGripOption === 'grip-service') {
          if (!grippingForm.checkValidity()) {
            const radioButtons = grippingForm.querySelectorAll('input[type="radio"]');
            const invalidRadioName = Array.from(radioButtons).find((radio) => radio.validity.valueMissing)?.name;

            const grippingRoot = document.getElementById('gripping-root');

            const errorMessage =
              invalidRadioName === 'grip-product'
                ? grippingRoot?.dataset?.errorMissingProduct || 'Please select a grip option.'
                : invalidRadioName === 'grip-variant'
                  ? grippingRoot?.dataset?.errorMissingVariant || 'Please select a grip color.'
                  : 'Please select all required options';
            this.handleErrorMessage(errorMessage);

            return grippingForm.reportValidity();
          } else {
            this.handleErrorMessage('');
          }
        }

        if (this.submitButton.getAttribute('aria-disabled') === 'true') return;

        this.handleErrorMessage();

        let tshirtPrintingSelection;
        try {
          tshirtPrintingSelection = this.getTshirtPrintingSelection();
        } catch (error) {
          this.handleErrorMessage(error.message);
          return;
        }

        this.submitButton.setAttribute('aria-disabled', true);
        this.submitButton.classList.add('loading');
        this.querySelector('.loading__spinner').classList.remove('hidden');

        const config = fetchConfig('javascript');
        config.headers['X-Requested-With'] = 'XMLHttpRequest';
        delete config.headers['Content-Type'];

        const formData = new FormData(this.form);

        // Keep each customised product configuration distinct, even when the
        // same product variant is added more than once with different options.
        let customisationId;
        try {
          const __ts = Date.now().toString(36);
          const __base =
            window.crypto && typeof window.crypto.randomUUID === 'function'
              ? window.crypto.randomUUID()
              : Math.random().toString(36).slice(2, 10);
          customisationId = `${__base}-${__ts}`;
        } catch (error) {
          console.error('Customisation ID generation failed:', error);
          customisationId = `fallback-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        }

        const sections = this.cart ? this.cart.getSectionsToRender().map((section) => section.id) : [];
        const mainVariantId = formData.get('id');

        const mainItem = {
          id: mainVariantId,
          quantity: formData.get('quantity') || 1,
        };
        const items = [mainItem];
        const customisationItems = [];

        // check if stringing service is selected
        const frameSelected = document.querySelector('input[name="frame"]:checked')?.id;
        // good trick -  document.querySelector('variant-selects [data-selected-variant]')?.innerHTML)?.sku
        if (frameSelected === 'pro-stringing' && selectedVariantSku) {
          const variantSelected = document.querySelector('input[name="string-variant"]:checked')?.id;
          const stringVariantSku = document.querySelector('input[name="string-variant"]:checked')?.dataset.sku;
          const tensionSelected = document.querySelector('input[name="string-tension"]:checked')?.id;

          const knotValue = document.querySelector('input[name="knot-config"]:checked')?.dataset?.knotValue;

          const selectedKnot = knotValue === 'four_knot' ? '4_knot' : '2_knot';

          const stringingServiceVariantId = window.s3_stringing_service_variant_id;
          const fourKnotsServiceVariantId = window.s3_four_knots_service_variant_id;

          if (variantSelected && stringVariantSku && tensionSelected && stringingServiceVariantId) {
            customisationItems.push(
              {
                id: stringingServiceVariantId,
                quantity: 1,
                properties: {
                  _racket: selectedVariantSku,
                  _racketName: window?.s3_product_name || '',
                  _string: stringVariantSku,
                  _stringName: document.querySelector('input[name="string-variant"]:checked')?.dataset?.string || '',
                  _tension: `${tensionSelected}lbs`,
                  _knot: selectedKnot ?? '2_knot',
                },
              },
              {
                id: variantSelected,
                quantity: 1,
                properties: {},
              },
            );
          }

          if (selectedKnot === '4_knot' && fourKnotsServiceVariantId) {
            customisationItems.push({
              id: fourKnotsServiceVariantId,
              quantity: 1,
              properties: {
                _knot: selectedKnot,
                _racket: selectedVariantSku,
                _string: stringVariantSku,
              },
            });
          }
        }

        // check if gripping is selected
        if (window.s3_gripping_service_variant_id && selectedVariantSku) {
          const selectedGripVariant =
            document.getElementById('selected-grip-variant-id')?.dataset?.currentGripSelection;

          if (selectedGripVariant) {
            customisationItems.push(
              {
                id: window.s3_gripping_service_variant_id,
                quantity: 1,
                properties: {
                  _racket: selectedVariantSku,
                  _grip: document.getElementById('selected-grip-variant-id')?.dataset?.currentGripSku,
                },
              },
              {
                id: selectedGripVariant,
                quantity: 1,
                properties: {
                  _racket: selectedVariantSku,
                },
              },
            );
          }
        }

        // check if remix is selected
        const theSticker = document.getElementById('the-sticker');

        if (theSticker && window.s3_remix_service_variant_id && selectedVariantSku) {
          const stickerText = theSticker.innerText;

          let textToBeStickered = '';

          for (let element of stickerText) {
            const isAlphabet = isCharAlphanumeric(element);
            if (isAlphabet) {
              textToBeStickered += element;
            } else {
              textToBeStickered += `{${convertEmojiToHex(element)}}`;
            }
          }

          customisationItems.push({
            id: window.s3_remix_service_variant_id,
            quantity: 1,
            properties: {
              _stickerText: textToBeStickered,
              _textColor: window.s3_remix_config.stickerTextColor || 'UNKNOWN',
              _productSKU: window?.s3_current_variant_sku || '',
              _productName: window?.s3_product_name || '',
            },
          });
        }

        if (tshirtPrintingSelection && selectedVariantSku) {
          customisationItems.push(tshirtPrintingSelection);
        }

        if (customisationItems.length > 0) {
          mainItem.quantity = 1;
          mainItem.properties = { _customisationId: customisationId };

          customisationItems.forEach((item) => {
            item.parent_id = mainVariantId;
            item.properties = {
              ...item.properties,
              _customisationId: customisationId,
            };
          });
          items.push(...customisationItems);
        }

        // Gifts are independent of native customisation children. Resolve them
        // using the final purchased quantity, but only add them after the paid
        // product and its required customisations have been accepted.
        window.Bxgy.setNotice(null);
        const gifts = window.Bxgy.selectGifts(
          window.s3_bxgy,
          window.s3_product_collections,
          mainItem.quantity,
          customisationId,
        );
        let addAccepted = false;
        let addedMainItem;

        return fetch(`${routes.cart_add_url}`, {
          ...config,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...config.headers,
          },
          body: JSON.stringify({
            items,
            sections: sections,
            sections_url: window.location.pathname,
          }),
        })
          .then(async (response) => ({ ok: response.ok, data: await response.json() }))
          .then(async ({ ok, data: response }) => {
            const hasInvalidAddResponse = !this.hasValidAddResponse(
              response,
              mainVariantId,
              customisationItems,
              customisationId,
            );

            if (!ok || response.status || hasInvalidAddResponse) {
              if (customisationItems.length > 0) {
                await this.handleIncompleteCustomisation(response, mainVariantId, customisationId, sections);
              } else {
                this.showAddError(response, mainVariantId);
              }
              return;
            }

            addAccepted = true;
            addedMainItem = response.items.find((item) => this.getCustomisationItemId(item) === String(mainVariantId));
            if (gifts.unavailable) window.Bxgy.setNotice('unavailable');
            if (gifts.items.length > 0) {
              const giftResponse = await window.Bxgy.addGifts(gifts.items, customisationId, sections);
              response = {
                ...response,
                items: [...response.items, ...giftResponse.items],
                sections: giftResponse.sections,
              };
              window.Bxgy.setNotice(giftResponse.notice || (gifts.unavailable ? 'unavailable' : null));
            }
            if (!this.cart) {
              window.location = window.routes.cart_url;
              return;
            }
            // Cart notifications identify the purchased item, even though the
            // final sections may have come from the later gift request.
            response.key = addedMainItem?.key;
            const startMarker = CartPerformance.createStartingMarker('add:wait-for-subscribers');
            publish(PUB_SUB_EVENTS.cartUpdate, {
              source: 'product-form',
              productVariantId: mainVariantId,
              cartData: response,
            }).then(() => {
              CartPerformance.measureFromMarker('add:wait-for-subscribers', startMarker);
            });
            this.error = false;
            this.renderCart(response);
          })
          .catch(async (e) => {
            console.error(e);
            if (addAccepted) {
              // The purchase succeeded. Quietly refresh and open the drawer;
              // uncertain gifts stay in the cart at Shopify's current prices.
              // Never resend items or ask the shopper to review the gifts.
              this.error = false;
              if (this.cart) {
                try {
                  const refreshedSections = await window.Bxgy.renderSections(sections);
                  this.renderCart({ ...addedMainItem, sections: refreshedSections });
                } catch (refreshError) {
                  // If the read-only refresh also fails, do not replace the
                  // drawer with the stale pre-gift response.
                  console.error(refreshError);
                }
              }
            } else if (customisationItems.length > 0) {
              await this.handleIncompleteCustomisation({}, mainVariantId, customisationId, sections);
            } else {
              this.showAddError({}, mainVariantId);
            }
          })
          .finally(() => {
            this.submitButton.classList.remove('loading');
            if (!this.submitButton.querySelector('.sold-out-message:not(.hidden)')) {
              this.submitButton.removeAttribute('aria-disabled');
            }
            this.querySelector('.loading__spinner').classList.add('hidden');

            CartPerformance.measureFromEvent('add:user-action', evt);
          });
      }

      handleErrorMessage(errorMessage = false) {
        if (this.hideErrors) return;

        this.errorMessageWrapper =
          this.errorMessageWrapper || this.querySelector('.product-form__error-message-wrapper');
        if (!this.errorMessageWrapper) return;
        this.errorMessage = this.errorMessage || this.errorMessageWrapper.querySelector('.product-form__error-message');

        this.errorMessageWrapper.toggleAttribute('hidden', !errorMessage);

        if (errorMessage) {
          this.errorMessage.textContent = errorMessage;
        }
      }

      toggleSubmitButton(disable = true, text) {
        if (disable) {
          this.submitButton.setAttribute('disabled', 'disabled');
          if (text) this.submitButtonText.textContent = text;
        } else {
          this.submitButton.removeAttribute('disabled');
          this.submitButtonText.textContent = window.variantStrings.addToCart;
        }
      }

      get variantIdInput() {
        return this.form.querySelector('[name=id]');
      }
    },
  );
}

const isCharAlphanumeric = (char) => {
  const alphanumericRegex = /^[a-zA-Z0-9. ]*$/;
  return alphanumericRegex.test(char);
};

const convertEmojiToHex = (emoji) => emoji.codePointAt(0)?.toString(16);
