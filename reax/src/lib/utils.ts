export const getFreeablePrice = (alreadyFormattedPrice: string | null) => {
  try {
    if (!alreadyFormattedPrice) return alreadyFormattedPrice;

    const numericMatch = alreadyFormattedPrice.replace(/[^0-9.-]/g, '');
    const numericValue = Number.parseFloat(numericMatch);

    if (!Number.isNaN(numericValue) && numericValue === 0) {
      return 'FREE';
    }

    return alreadyFormattedPrice;
  } catch (error) {
    return alreadyFormattedPrice;
  }
};

export const formatCurrency = (amount: string, currencyCode: string) => {
  const numericAmount = Number.parseFloat(amount);

  if (Number.isNaN(numericAmount)) {
    return `${amount} ${currencyCode}`.trim();
  }

  try {
    return new Intl.NumberFormat(
      typeof document !== 'undefined' ? document.documentElement.lang || undefined : undefined,
      {
        style: 'currency',
        currency: currencyCode,
        maximumFractionDigits: Number.isInteger(numericAmount) ? 0 : 2,
      },
    ).format(numericAmount);
  } catch (error) {
    return `${amount} ${currencyCode}`.trim();
  }
};
