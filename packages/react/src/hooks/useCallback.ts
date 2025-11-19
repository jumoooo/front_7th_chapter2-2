import { DependencyList } from "./types";
import { useMemo } from "./useMemo";

/**
 * 함수를 메모이제이션합니다.
 * 의존성 배열(deps)의 값이 변경될 때만 함수를 재생성합니다.
 *
 * @param callback - 메모이제이션할 콜백 함수
 * @param deps - 의존성 배열
 * @returns 메모이제이션된 콜백 함수
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const useCallback = <T extends (...args: any[]) => any>(callback: T, deps: DependencyList): T => {
  // useMemo를 활용하여 콜백 함수를 메모이제이션합니다.
  // deps 배열의 값이 변경되지 않는다면, 동일한 콜백 참조를 재사용합니다.
  return useMemo(() => callback, deps);
};
