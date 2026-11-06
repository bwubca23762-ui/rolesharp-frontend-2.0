import type { KeyboardEvent } from "react";

/**
 * Makes a clickable table row reachable without a mouse.
 *
 * Four admin views select a version by putting onClick on the <tr> — offers,
 * notifications, communications, legal. That was the only way to open a
 * version, so a keyboard user could not inspect, schedule, or publish any of
 * them at all.
 *
 * tabIndex + Enter/Space, deliberately without role="button": overriding the
 * row's implicit `row` role would strip the table semantics a screen reader
 * uses to announce column headers with each cell, trading one access problem
 * for another. A focusable row with a key handler keeps the table a table and
 * still activates from the keyboard.
 */
export function rowActivation(onActivate: () => void) {
  return {
    tabIndex: 0,
    onClick: onActivate,
    onKeyDown: (event: KeyboardEvent<HTMLTableRowElement>) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      // Space scrolls the page by default, which is the one thing a user
      // pressing it on a focused row definitely did not intend.
      event.preventDefault();
      onActivate();
    },
    style: { cursor: "pointer" },
  };
}

