import { expect, test } from "vitest";
import { expandedChrome, nextChromeState } from "../src/chromeState";

test("moving away from the top compacts in either direction", () => {
  expect(nextChromeState(expandedChrome(), 8, 1000).compact).toBe(true);
  expect(nextChromeState(expandedChrome(300), 292, 1000).compact).toBe(true);
  expect(nextChromeState(expandedChrome(300), 308, 1000).compact).toBe(true);
});
test("reversing and finger jitter never expand the controls", () => {
  let state = nextChromeState(expandedChrome(), 240, 1000);
  for (const y of [238, 242, 230, 150, 20, 2])
    state = nextChromeState(state, y, 1000);
  expect(state.compact).toBe(true);
});
test("only reaching the top automatically restores full navigation", () => {
  const state = nextChromeState(expandedChrome(), 300, 1000);
  expect(nextChromeState(state, 8, 1000).compact).toBe(true);
  expect(nextChromeState(state, 0, 1000)).toEqual(expandedChrome());
  expect(nextChromeState(state, -35, 1000)).toEqual(expandedChrome());
});
test("explicit reveal lasts until another intentional scroll", () => {
  const state = expandedChrome(420);
  expect(nextChromeState(state, 420, 1000).compact).toBe(false);
  expect(nextChromeState(state, 423, 1000).compact).toBe(false);
  expect(nextChromeState(state, 410, 1000).compact).toBe(true);
});
test("search lock keeps ordinary navigation expanded", () => {
  const state = nextChromeState(expandedChrome(), 400, 1000);
  expect(nextChromeState(state, 420, 1000, true)).toEqual(expandedChrome(420));
});
test("course reading stays compact at top, on reverse, and with focus locks", () => {
  for (const y of [-20, 0, 20, 500])
    expect(nextChromeState(expandedChrome(), y, 1000, true, true).compact).toBe(
      true,
    );
});
test("overscroll is clamped and a short ordinary page stays expanded", () => {
  const state = nextChromeState(expandedChrome(), 500, 300);
  expect(state.y).toBe(300);
  expect(nextChromeState(state, 335, 300).compact).toBe(true);
  expect(nextChromeState(expandedChrome(), 120, 0)).toEqual(expandedChrome());
  expect(nextChromeState(expandedChrome(), 0, 0, false, true).compact).toBe(
    true,
  );
});
