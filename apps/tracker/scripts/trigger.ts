#!/usr/bin/env tsx
/**
 * Manual trigger script for demo / testing.
 *
 * Usage:
 *   tsx scripts/trigger.ts depeg <productId> <observedPrice>
 *   tsx scripts/trigger.ts rug   <productId> <liquidityPctBps>
 *
 * Examples:
 *   tsx scripts/trigger.ts depeg 1 0.90        # USDC at $0.90
 *   tsx scripts/trigger.ts rug   3 2000         # 20% liquidity remaining
 *
 * Set TRACKER_URL to target a remote instance:
 *   TRACKER_URL=https://tracker.up.railway.app tsx scripts/trigger.ts depeg 1 0.90
 */

const BASE_URL = process.env.TRACKER_URL ?? "http://localhost:4000";

const [, , type, productIdArg, valueArg] = process.argv;

if (!type || !productIdArg || !valueArg) {
  console.error("Usage: tsx scripts/trigger.ts <depeg|rug> <productId> <value>");
  console.error("  depeg: value = observed USD price  (e.g. 0.90)");
  console.error("  rug:   value = liquidity bps        (e.g. 2000 = 20%)");
  process.exit(1);
}

const productId = Number(productIdArg);
const value = Number(valueArg);

if (type !== "depeg" && type !== "rug") {
  console.error(`Unknown trigger type "${type}". Use "depeg" or "rug".`);
  process.exit(1);
}

const endpoint = type === "depeg" ? "/admin/trigger-depeg" : "/admin/trigger-rug";
const body = type === "depeg"
  ? { productId, observedPrice: value }
  : { productId, liquidityPctBps: value };

console.log(`Triggering ${type} on ${BASE_URL}${endpoint}`);
console.log("Payload:", JSON.stringify(body));

const res = await fetch(`${BASE_URL}${endpoint}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const json = await res.json();

if (!res.ok) {
  console.error("Error:", json);
  process.exit(1);
}

console.log("OK:", JSON.stringify(json, null, 2));
