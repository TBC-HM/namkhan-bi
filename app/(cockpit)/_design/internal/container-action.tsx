// Internal: lets Chart portal its dimension dropdown into the parent
// Container's action slot. Container provides a ref; Chart, when rendered
// inside, consumes the context and createPortal's its dropdown there.

'use client';

import { createContext, useContext, type RefObject } from 'react';

export interface ContainerActionCtx {
  ref: RefObject<HTMLDivElement | null> | null;
  hasUserAction: boolean;
}

const Ctx = createContext<ContainerActionCtx>({ ref: null, hasUserAction: false });

export const ContainerActionProvider = Ctx.Provider;
export function useContainerAction(): ContainerActionCtx {
  return useContext(Ctx);
}
