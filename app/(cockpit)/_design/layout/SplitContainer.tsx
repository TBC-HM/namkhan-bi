// SplitContainer — two-column layout: typically KpiTile(s) left, Chart right.
// Wraps a Container so Chart's dimension dropdown can portal into the header.

'use client';

import type { CSSProperties } from 'react';
import Container from './Container';
import type { SplitContainerProps, SplitRatio } from '../types';
import '../internal/tokens.css';

const RATIO_TEMPLATE: Record<SplitRatio, string> = {
  '1:1': '1fr 1fr',
  '1:2': '1fr 2fr',
  '1:3': '1fr 3fr',
  '2:1': '2fr 1fr',
  '3:1': '3fr 1fr',
};

export default function SplitContainer(props: SplitContainerProps) {
  const { title, subtitle, left, right, ratio = '1:2', action } = props;
  const body = (
    <div style={{ display: 'grid', gridTemplateColumns: RATIO_TEMPLATE[ratio], gap: 16, alignItems: 'stretch' }}>
      <div style={S.cell}>{left}</div>
      <div style={S.cell}>{right}</div>
    </div>
  );
  if (!title) {
    return body;
  }
  return (
    <Container title={title} subtitle={subtitle} action={action}>
      {body}
    </Container>
  );
}

const S: Record<string, CSSProperties> = {
  cell: { minWidth: 0, display: 'flex', flexDirection: 'column' },
};
