/** Deterministic local price pressure from finite stock, player demand, and route access. */
export function getMarketPriceFactor(stock: number, target: number, demand: number, routeDisruption: number): number {
  const safeTarget = Math.max(1, Number.isFinite(target) ? target : 1);
  const supplyRatio = Math.max(0, Math.min(1, (Number.isFinite(stock) ? stock : 0) / safeTarget));
  const safeDemand = Math.max(0, Number.isFinite(demand) ? demand : 0);
  const disruption = Math.max(0, Math.min(1, Number.isFinite(routeDisruption) ? routeDisruption : 0));
  const pressure = (1 - supplyRatio) * 0.18 + Math.min(0.12, safeDemand * 0.015) + disruption * 0.12;
  return Math.max(0.8, Math.min(1.35, 1 + pressure));
}
