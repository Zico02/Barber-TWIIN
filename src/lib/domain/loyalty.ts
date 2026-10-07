/**
 * Promotions & loyalty — prepared for a future phase.
 * Disabled through `shop.settings.features`. The database tables
 * (`promotions`, `customer_loyalty`) already exist so enabling a feature
 * only requires implementing the rule below and turning the flag on.
 */
import type { ShopSettings } from "./types";

export type PromotionKind = "code" | "first_visit" | "birthday" | "package" | "referral";

export interface Promotion {
  id: string;
  code: string | null;
  kind: PromotionKind;
  percentOff: number | null;
  amountOff: number | null;
  serviceIds: string[];
  startsAt: string | null;
  endsAt: string | null;
  maxUses: number | null;
  active: boolean;
}

export interface LoyaltyAccount {
  customerId: string;
  points: number;
  visits: number;
  tier: "bronze" | "silver" | "gold" | "black";
  referralCode: string | null;
}

export const LOYALTY_RULES = {
  pointsPerDirham: 1,
  freeVisitEvery: 10, // "Ten visits, one free"
  tiers: { silver: 5, gold: 15, black: 30 },
};

export function tierFor(visits: number): LoyaltyAccount["tier"] {
  const t = LOYALTY_RULES.tiers;
  return visits >= t.black ? "black" : visits >= t.gold ? "gold" : visits >= t.silver ? "silver" : "bronze";
}

export function isNextVisitFree(visits: number) {
  return (visits + 1) % LOYALTY_RULES.freeVisitEvery === 0;
}

export function applyPromotion(total: number, promo: Promotion | null, features: ShopSettings["features"]) {
  if (!promo || !features.promotions || !promo.active) return { total, discount: 0 };
  const discount = promo.percentOff ? Math.round((total * promo.percentOff) / 100) : (promo.amountOff ?? 0);
  return { total: Math.max(0, total - discount), discount };
}
