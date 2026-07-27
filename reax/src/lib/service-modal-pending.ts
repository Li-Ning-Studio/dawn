export type ServiceModalKey = 'stringing' | 'gripping' | 'remix' | 'tshirt_printing';

type PendingMap = Partial<Record<ServiceModalKey, boolean>>;

const ensurePendingMap = (): PendingMap => {
  if (!window.s3_service_modal_pending) {
    window.s3_service_modal_pending = {};
  }

  return window.s3_service_modal_pending;
};

export const consumePendingModalOpen = (serviceKey: ServiceModalKey): boolean => {
  const pendingMap = ensurePendingMap();
  const shouldOpen = Boolean(pendingMap[serviceKey]);

  if (shouldOpen) {
    pendingMap[serviceKey] = false;
  }

  return shouldOpen;
};
