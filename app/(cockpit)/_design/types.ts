// Shared types for the cockpit design primitives.

import type { ReactNode } from 'react';

// ─── Status ───────────────────────────────────────────────────────────────

export type StatusTone = 'green' | 'amber' | 'red' | 'grey';

// ─── KpiTile ──────────────────────────────────────────────────────────────

export type KpiCompareFormat = 'absolute' | 'percent' | 'currency';
export type Currency = 'EUR' | 'USD' | 'LAK';
export type TileSize = 'sm' | 'md' | 'lg';

export interface KpiComparison {
  label: string;
  value: number;
  format?: KpiCompareFormat;
  direction?: 'up' | 'down' | 'flat';
  isGoodWhenUp?: boolean;
  status?: 'pending' | 'live';
}

export interface KpiDelta {
  value: number;
  period: string;
  direction: 'up' | 'down' | 'flat';
  isGoodWhenUp?: boolean;
}

export interface KpiTileProps {
  label: string;
  value: string | number;
  unit?: string;
  currency?: Currency;
  delta?: KpiDelta;
  compare?: KpiComparison[];
  status?: StatusTone;
  footnote?: string;
  size?: TileSize;
  loading?: boolean;
  onClick?: () => void;
  comparisonsExpandable?: boolean;
}

// ─── Chart ────────────────────────────────────────────────────────────────

export type ChartVariant =
  | 'line' | 'bar' | 'stacked_bar' | 'area'
  | 'donut' | 'combo' | 'heatmap'
  | 'table' | 'tile' | 'cards';

export interface ChartSeries {
  key: string;
  label: string;
  color?: string;
  type?: 'bar' | 'line';
}

export interface ChartDimension {
  key: string;
  label: string;
  sourceView?: string;
  xKey?: string;
  isDefault?: boolean;
  status?: 'live' | 'pending' | 'blocked';
}

export interface ChartProps {
  variant: ChartVariant;
  data: Record<string, unknown>[];
  xKey?: string;
  yKey?: string | string[];
  series?: ChartSeries[];
  height?: number;
  loading?: boolean;
  empty?: { title: string; hint?: string };
  formatY?: (v: number) => string;
  formatX?: (v: unknown) => string;
  legend?: 'top' | 'right' | 'bottom' | 'none';
  tooltipFormatter?: (point: Record<string, unknown>, series?: string) => ReactNode;
  dimensions?: ChartDimension[];
  activeDimensionKey?: string;
  onDimensionChange?: (dimension: ChartDimension) => void;
  renderItem?: (row: Record<string, unknown>) => ReactNode;
  onRowClick?: (row: Record<string, unknown>) => void;
}

// ─── Container ────────────────────────────────────────────────────────────

export type Density = 'comfortable' | 'compact';

export interface ContainerProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  density?: Density;
  loading?: boolean;
  status?: StatusTone;
  className?: string;
  /** Show the top-right expand-to-fullscreen toggle. Default true. Set false on tiny tiles where it'd add visual noise. */
  expandable?: boolean;
}

// ─── Drawer ───────────────────────────────────────────────────────────────

export type DrawerSize = 'sm' | 'md' | 'lg';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  width?: DrawerSize;
  footer?: ReactNode;
  children: ReactNode;
}

// ─── ListContainer ────────────────────────────────────────────────────────

export interface ListContainerColumn<T> {
  key: keyof T & string;
  label: string;
  align?: 'left' | 'right' | 'center';
  width?: number | string;
  render?: (row: T) => ReactNode;
  sortable?: boolean;
  searchable?: boolean;
}

export interface ListContainerProps<T> {
  title: string;
  subtitle?: string;
  data: T[];
  preview?: 3 | 5 | 10;
  renderRow: (row: T) => ReactNode;
  rowKey: (row: T) => string;
  drawerColumns: ListContainerColumn<T>[];
  drawerSearchKeys?: (keyof T & string)[];
  drawerDefaultSort?: { key: keyof T & string; direction: 'asc' | 'desc' };
  showAllLabel?: string;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  empty?: { title: string; hint?: string };
  status?: StatusTone;
  action?: ReactNode;
}

// ─── DashboardPage / MetricRow / SplitContainer ───────────────────────────

export interface DashboardTab {
  key: string;
  label: string;
  href?: string;
  active?: boolean;
  onSelect?: () => void;
  count?: number;
}

export interface DashboardPageProps {
  title: string;
  subtitle?: string;
  tabs?: DashboardTab[];
  action?: ReactNode;
  children: ReactNode;
  /** PBS #157 — extra context for the HeaderPills date-hover popover. */
  kpiTiles?: Array<{ k: string; v: string; d: string }>;
  /** PBS #157 — hide the temp + AQ pills (holding scope). Default false. */
  hideWeather?: boolean;
}

export interface MetricRowProps {
  tiles: KpiTileProps[];
  size?: TileSize;
}

export type SplitRatio = '1:2' | '1:3' | '2:1' | '3:1' | '1:1';

export interface SplitContainerProps {
  title?: string;
  subtitle?: string;
  left: ReactNode;
  right: ReactNode;
  ratio?: SplitRatio;
  action?: ReactNode;
}
