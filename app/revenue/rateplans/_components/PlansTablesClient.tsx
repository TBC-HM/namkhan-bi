// Retired in 2026-05-19 refactor — replaced by Chart variant='table' in rateplans/page.tsx.
export interface PlanRow { name: string; type: string; isConfigured: boolean; bookings: number; cancellations: number; nights: number; revenue: number; adr: number; cancelPct: number; avgLead: number; lastBooked: string | null; mixPct: number }
export interface SleepingRow { rate_name: string; rate_type: string; last_booked: string | null; days_since: number }
export interface OrphanRow { rate_plan: string; bookings_lifetime: number; revenue_lifetime: number; last_booked: string | null }
export {};
