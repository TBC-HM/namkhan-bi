// Single barrel for the cockpit design system v5.
// Every cockpit page that needs visual components MUST import from here.
// Importing from `@/app/(cockpit)/_design/...` deep paths is forbidden.
// PBS 2026-07-25: withCk HOC adds data-ck (display:contents) to 6 primary
// primitives so walkthrough feedback mode can anchor findings to components.

import type { ComponentType } from 'react';
import { createElement } from 'react';

function withCk<P extends object>(Component: ComponentType<P>, ck: string): ComponentType<P> {
  function CkAnnotated(props: P) {
    return createElement(
      'div',
      { 'data-ck': ck, style: { display: 'contents' } },
      createElement(Component, props),
    );
  }
  CkAnnotated.displayName = ck;
  return CkAnnotated as ComponentType<P>;
}

import _KpiTile from './tile/KpiTile';
import _Chart from './chart/Chart';
import _Container from './layout/Container';
import _ListContainer from './layout/ListContainer';
import _Drawer from './overlay/Drawer';
import _MonthCalendar from './calendar/MonthCalendar';

// Annotated with data-ck for walkthrough finding capture (6 primary primitives)
export const KpiTile = withCk(_KpiTile, 'KpiTile');
export const Chart = withCk(_Chart, 'Chart');
export const Container = withCk(_Container, 'Container');
export const ListContainer = withCk(_ListContainer, 'ListContainer');
export const Drawer = withCk(_Drawer, 'Drawer');
export const MonthCalendar = withCk(_MonthCalendar, 'MonthCalendar');
export type { CalendarDay } from './calendar/MonthCalendar';

// Pass-through re-exports (no annotation needed)
export { default as TrendTile, type TrendTileProps } from './tile/TrendTile';
export { default as DashboardPage } from './layout/DashboardPage';
export { default as MetricRow } from './layout/MetricRow';
export { default as SplitContainer } from './layout/SplitContainer';
export { default as BookingActivity } from './BookingActivity';
export { default as PickupTabs } from './PickupTabs';
export { default as FloatingMira } from './FloatingMira';

// Walkthrough feedback engine entry-point
export { BugWidget } from './BugWidget';

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
