import { deepEquals } from "../utils";
import { DependencyList } from "./types";
import { useMemo } from "./useMemo";

/**
 * `deepEquals`를 사용하여 의존성을 깊게 비교하는 `useMemo` 훅입니다.
 */
export const useDeepMemo = <T>(factory: () => T, deps: DependencyList): T => {
  // deepEquals를 사용하여 의존성을 깊은 비교로 판단합니다.
  return useMemo(factory, deps, deepEquals);
};
