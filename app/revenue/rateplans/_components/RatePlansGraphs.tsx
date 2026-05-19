// Retired in 2026-05-19 refactor — replaced by Chart variants in rateplans/page.tsx.
export interface DailyTrendRow { day: string; bookings: number; revenue: number; adr: number }
export interface TypeMixRow { type: string; bookings: number; revenue: number; nights: number; adr: number; mix: number }
export interface CancelRow { name: string; cancelPct: number; bookings: number; cancellations: number }
export {};
