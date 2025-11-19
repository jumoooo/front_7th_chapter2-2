import { DependencyList } from "./types";
import { useRef } from "./useRef";
import { shallowEquals } from "../utils";

/**
 * 계산 비용이 큰 함수의 결과를 메모이제이션합니다.
 * 의존성 배열(deps)의 값이 변경될 때만 함수를 다시 실행합니다.
 *
 * @param factory - 메모이제이션할 값을 생성하는 함수
 * @param deps - 의존성 배열
 * @param equals - 의존성을 비교할 함수 (기본값: shallowEquals)
 * @returns 메모이제이션된 값
 */
type MemoRecord<T> = {
  initialized: boolean;
  value: T;
  deps: DependencyList | null;
};

export const useMemo = <T>(factory: () => T, deps: DependencyList, equals = shallowEquals): T => {
  // memoRef.current에는 이전 계산값과 의존성 배열을 저장합니다.
  const memoRef = useRef<MemoRecord<T>>({
    initialized: false,
    // 최초 렌더에서는 아직 값이 없으므로 단순 캐스팅합니다.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value: undefined as any,
    deps: null,
  });

  // 재계산 여부를 판단합니다.
  const shouldRecompute =
    !memoRef.current.initialized || memoRef.current.deps === null || !equals(memoRef.current.deps, deps);

  if (shouldRecompute) {
    // factory를 실행하여 최신 값을 생성합니다.
    const nextValue = factory();

    // 현재 결과와 의존성을 저장해 다음 렌더에서 재사용합니다.
    memoRef.current = {
      initialized: true,
      value: nextValue,
      deps,
    };
  }

  // 항상 마지막으로 저장된 값을 반환합니다.
  return memoRef.current.value;
};
