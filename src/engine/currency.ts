import type { GoldLedger } from "./types";

export function createLedger(): GoldLedger {
  return { balance: 0, lifetimeEarned: 0 };
}

export function addGold(ledger: GoldLedger, amount: number): GoldLedger {
  const clamped = Math.max(0, amount);
  return {
    balance: ledger.balance + clamped,
    lifetimeEarned: ledger.lifetimeEarned + clamped,
  };
}

export function spendGold(
  ledger: GoldLedger,
  amount: number
): GoldLedger | null {
  if (ledger.balance < amount) return null;
  return { ...ledger, balance: ledger.balance - amount };
}

export function formatGold(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K`;
  return amount.toFixed(1);
}
