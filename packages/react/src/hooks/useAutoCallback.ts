import type { AnyFunction } from "../types";
import { useCallback } from "./useCallback";
import { useRef } from "./useRef";

/**
 * 항상 최신 상태를 참조하면서도, 함수 자체의 참조는 변경되지 않는 콜백을 생성합니다.
 *
 * @param fn - 최신 상태를 참조할 함수
 * @returns 참조가 안정적인 콜백 함수
 */
export const useAutoCallback = <T extends AnyFunction>(fn: T): T => {
  // 최신 fn을 보관할 ref를 생성합니다.
  const latestFnRef = useRef(fn);

  // 매 렌더마다 최신 함수를 ref에 저장합니다.
  latestFnRef.current = fn;

  // deps를 비워서 콜백 참조는 한 번만 생성하고,
  // 실행 시점에 항상 latestFnRef.current를 호출하도록 합니다.
  const stableCallback = useCallback((...args: Parameters<T>): ReturnType<T> => {
    return latestFnRef.current(...args);
  }, []);

  return stableCallback as T;
};
