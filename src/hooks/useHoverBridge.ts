/**
 * useHoverBridge — shared hover-bridge pattern.
 *
 * Mirrors the HeaderPills fix: an invisible padding bridge prevents the
 * cursor leaving the trigger hitbox before it reaches the popover body,
 * and a 250 ms close-delay stops premature dismissal on diagonal moves.
 *
 * Usage:
 *   const { bridgeStyle, closeDelay } = useHoverBridge();
 *   // spread bridgeStyle on the popover trigger wrapper
 *   // pass closeDelay to your Popover/Tooltip closeDelay prop
 */
import { CSSProperties } from 'react';

export interface HoverBridgeOptions {
  /** Width of the invisible padding bridge in px (default 280, matching HeaderPills). */
  bridgeWidth?: number;
  /** Close delay in ms (default 250). */
  delay?: number;
  /** Set to true on touch-only contexts to suppress the bridge (default false). */
  touch?: boolean;
}

export interface HoverBridgeResult {
  /** Spread onto the trigger wrapper element. */
  bridgeStyle: CSSProperties;
  /** Pass to Popover / Tooltip closeDelay prop. */
  closeDelay: number;
}

export function useHoverBridge({
  bridgeWidth = 280,
  delay = 250,
  touch = false,
}: HoverBridgeOptions = {}): HoverBridgeResult {
  if (touch) {
    return { bridgeStyle: {}, closeDelay: 0 };
  }

  return {
    bridgeStyle: {
      paddingLeft: bridgeWidth,
      marginLeft: -bridgeWidth,
      // Keep layout intact — the bridge is purely a hitbox extension.
      boxSizing: 'content-box' as const,
    },
    closeDelay: delay,
  };
}
