// Single barrel for the cockpit design system v5.
// Every cockpit page that needs visual components MUST import from here.
// Importing from `@/app/(cockpit)/_design/...` deep paths is forbidden.

export { default as KpiTile } from './tile/KpiTile';
export { default as Chart } from './chart/Chart';
export { default as Container } from './layout/Container';
export { default as ListContainer } from './layout/ListContainer';
export { default as Drawer } from './overlay/Drawer';
export { default as DashboardPage } from './layout/DashboardPage';
export { default as MetricRow } from './layout/MetricRow';
export { default as SplitContainer } from './layout/SplitContainer';
export { default as BookingActivity } from './BookingActivity';

export type {
  StatusTone,
  KpiCompareFormat,
  KpiComparison,
  KpiDelta,
  KpiTileProps,
  Currency,
  TileSize,
  ChartVariant,
  ChartSeries,
  ChartDimension,
  ChartProps,
  Density,
  ContainerProps,
  DrawerSize,
  DrawerProps,
  ListContainerColumn,
  ListContainerProps,
  DashboardTab,
  DashboardPageProps,
  MetricRowProps,
  SplitRatio,
  SplitContainerProps,
} from './types';
