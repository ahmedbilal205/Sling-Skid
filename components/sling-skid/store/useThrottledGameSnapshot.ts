import { useEffect, useRef, useState } from 'react';

import { useGameStore, type GameState } from './gameStore';

function shallowEqual<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true;
  if (
    typeof a !== 'object' ||
    a === null ||
    typeof b !== 'object' ||
    b === null
  ) {
    return false;
  }

  const aRecord = a as Record<string, unknown>;
  const bRecord = b as Record<string, unknown>;
  const aKeys = Object.keys(aRecord);
  const bKeys = Object.keys(bRecord);

  if (aKeys.length !== bKeys.length) return false;

  return aKeys.every((key) => Object.is(aRecord[key], bRecord[key]));
}

export function useThrottledGameSnapshot<T>(
  selector: (state: GameState) => T,
  fps = 10,
): T {
  const selectorRef = useRef(selector);
  const valueRef = useRef(selector(useGameStore.getState()));
  const dirtyRef = useRef(false);
  const [value, setValue] = useState(valueRef.current);

  selectorRef.current = selector;

  useEffect(() => {
    const unsubscribe = useGameStore.subscribe(() => {
      dirtyRef.current = true;
    });
    const interval = setInterval(() => {
      if (!dirtyRef.current) return;
      dirtyRef.current = false;

      const next = selectorRef.current(useGameStore.getState());
      if (shallowEqual(valueRef.current, next)) return;

      valueRef.current = next;
      setValue(next);
    }, 1000 / fps);

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [fps]);

  return value;
}
