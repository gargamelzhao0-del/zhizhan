export type ChromeScrollState = {
  y: number;
  anchor: number;
  compact: boolean;
};

export const expandedChrome = (y = 0): ChromeScrollState => ({
  y,
  anchor: y,
  compact: false,
});

/** Either scroll direction compacts; only the actual top or an explicit reveal expands. */
export function nextChromeState(
  state: ChromeScrollState,
  rawY: number,
  maxY: number,
  locked = false,
  reading = false,
): ChromeScrollState {
  const y = Math.max(0, Math.min(rawY, Math.max(0, maxY)));
  if (reading) return { y, anchor: y, compact: true };
  if (locked || y <= 1) return expandedChrome(y);
  return {
    y,
    anchor: state.anchor,
    compact: state.compact || Math.abs(y - state.anchor) >= 8,
  };
}
