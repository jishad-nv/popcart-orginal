/**
 * Popcarty Shipping Configuration & Calculations
 * 
 * New Weight-Based Shipping Charge System:
 * - 0 KG to 1 KG (0 - 1000g): ₹49
 * - Above 1 KG to 2 KG (1001 - 2000g): ₹99
 * - Above 2 KG to 3 KG (2001 - 3000g): ₹119 (IMPORTANT: ₹119, NOT ₹109)
 * - Above 3 KG to 4 KG (3001 - 4000g): ₹129
 * - Above 4 KG to 5 KG (4001 - 5000g): ₹149
 * - Above 5 KG to 10 KG (5001 - 10000g): ₹249
 * 
 * Maximum Order Weight Limit:
 * - 10 KG (10,000 grams). Any order exceeding this weight is blocked from checkout.
 * 
 * Automatic Shipping Offers:
 * - Free delivery has been completely removed. Free delivery is NOT offered automatically under any circumstances.
 * - ₹50 Shipping Discount: If product subtotal (after discounts) > ₹500, apply ₹50 discount on shipping (never negative).
 * - Orders of ₹500 or less: No shipping discount.
 */

export interface ShippingTier {
  minGrams: number;
  maxGrams: number;
  rate: number;
  label: string;
}

export const MAX_ORDER_WEIGHT_GRAMS = 10000; // 10 KG

export const SHIPPING_TIERS: ShippingTier[] = [
  { minGrams: 0, maxGrams: 1000, rate: 49, label: '0 KG to 1 KG' },
  { minGrams: 1000, maxGrams: 2000, rate: 99, label: 'Above 1 KG to 2 KG' },
  { minGrams: 2000, maxGrams: 3000, rate: 119, label: 'Above 2 KG to 3 KG' }, // Explicitly ₹119, NOT ₹109
  { minGrams: 3000, maxGrams: 4000, rate: 129, label: 'Above 3 KG to 4 KG' },
  { minGrams: 4000, maxGrams: 5000, rate: 149, label: 'Above 4 KG to 5 KG' },
  { minGrams: 5000, maxGrams: 10000, rate: 249, label: 'Above 5 KG to 10 KG' },
];

export const SHIPPING_DISCOUNT_THRESHOLD = 500; // Subtotal > ₹500
export const SHIPPING_DISCOUNT_AMOUNT = 50; // ₹50 off shipping

/**
 * Calculates base weight-based shipping charge.
 * Empty cart or 0g => 0.
 * Above 10kg => throws error or handles limit.
 */
export function calculateBaseShipping(weightGrams: number): number {
  if (weightGrams <= 0) return 0;
  if (weightGrams <= 1000) return 49;
  if (weightGrams <= 2000) return 99;
  if (weightGrams <= 3000) return 119; // ₹119, NOT ₹109
  if (weightGrams <= 4000) return 129;
  if (weightGrams <= 5000) return 149;
  if (weightGrams <= 10000) return 249;
  return 249;
}

/**
 * Calculates automatic ₹50 shipping discount.
 * Applied only if subtotal after product discounts > ₹500.
 * Never allows shipping charge to become negative.
 * Free delivery is completely eliminated.
 */
export function calculateShippingDiscount(baseShipping: number, subtotalAfterDiscounts: number): number {
  if (baseShipping <= 0) return 0;
  if (subtotalAfterDiscounts > SHIPPING_DISCOUNT_THRESHOLD) {
    return Math.min(SHIPPING_DISCOUNT_AMOUNT, baseShipping);
  }
  return 0;
}

/**
 * Checks if total cart weight exceeds the maximum allowed order weight limit of 10 KG.
 */
export function isOrderOverWeightLimit(weightGrams: number): boolean {
  return weightGrams > MAX_ORDER_WEIGHT_GRAMS;
}

/**
 * Formats weight in grams and kilograms for user-facing display.
 */
export function formatWeightDisplay(weightGrams: number): string {
  if (weightGrams >= 1000) {
    const kg = (weightGrams / 1000).toFixed(weightGrams % 1000 === 0 ? 0 : 1);
    return `${kg} kg (${weightGrams.toLocaleString()} g)`;
  }
  return `${weightGrams} g`;
}
