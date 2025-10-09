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
