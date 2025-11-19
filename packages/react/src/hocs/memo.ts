import { useRef } from "../hooks";
import { type FunctionComponent } from "../core";
import { shallowEquals } from "../utils";
import { context } from "../core/context";

/**
 * 컴포넌트의 props가 변경되지 않았을 경우, 마지막 렌더링 결과를 재사용하여
 * 리렌더링을 방지하는 고차 컴포넌트(HOC)입니다.
 *
 * @param Component - 메모이제이션할 컴포넌트
 * @param equals - props를 비교할 함수 (기본값: shallowEquals)
 * @returns 메모이제이션이 적용된 새로운 컴포넌트
 */
export function memo<P extends object>(Component: FunctionComponent<P>, equals = shallowEquals) {
  const MemoizedComponent: FunctionComponent<P> = (props) => {
    // useRef를 사용하여 이전 props와 렌더링 결과를 저장합니다.
    // memoRef.current에는 { prevProps, prevResult } 형태로 저장됩니다.
    type MemoState = {
      prevProps: P | null;
      prevResult: ReturnType<FunctionComponent<P>> | null;
    };

    // useRef를 초기값 { prevProps: null, prevResult: null }로 초기화합니다.
    // lazy initialization을 사용하여 첫 렌더링 시에만 객체를 생성합니다.
    const memoRef = useRef<MemoState>({
      prevProps: null,
      prevResult: null,
    });

    // 디버깅: path와 cursor 확인을 위해 context 접근
    const currentPath = context.hooks?.currentPath;
    const currentCursor = context.hooks?.currentCursor;
    const componentStack = [...context.hooks.componentStack];

    console.log("[memo] useRef 호출:", {
      memoRef,
      memoRefCurrent: memoRef.current,
      prevProps: memoRef.current?.prevProps,
      currentPath,
      currentCursor,
      componentStack,
      hooksState: Array.from(context.hooks.state.entries()).map(([p, hooks]) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const firstHook = hooks[0] as any;
        return {
          path: p,
          hooksCount: hooks.length,
          firstHook: firstHook ? { kind: firstHook.kind, value: firstHook.value } : null,
        };
      }),
    });

    // memoRef.current가 undefined인 경우를 방어적으로 처리합니다.
    // useRef는 useState를 사용하여 구현되므로 항상 객체를 반환해야 하지만,
    // 렌더링 타이밍 문제로 인해 undefined일 수 있으므로 초기화를 보장합니다.
    if (!memoRef.current) {
      console.log("[memo] memoRef.current가 undefined - 초기화");
      memoRef.current = {
        prevProps: null,
        prevResult: null,
      };
    }

    // 이전 props가 있고, equals 함수로 비교했을 때 같다면 이전 렌더링 결과를 재사용합니다.
    // 첫 렌더링인 경우 prevProps가 null이므로 이 조건을 통과하지 않습니다.
    if (memoRef.current.prevProps !== null) {
      const isEqual = equals(memoRef.current.prevProps, props);
      console.log("[memo] 비교:", {
        prevProps: memoRef.current.prevProps,
        newProps: props,
        isEqual,
        memoRef: memoRef,
        memoRefCurrent: memoRef.current,
      });
      if (isEqual) {
        console.log("[memo] 재사용");
        return memoRef.current.prevResult;
      }
    } else {
      console.log("[memo] 첫 렌더링");
    }

    // props가 변경되었거나 첫 렌더링인 경우, 컴포넌트를 실행하고 결과를 저장합니다.
    console.log("[memo] 컴포넌트 실행");
    const result = Component(props);
    // useMemo와 동일한 방식으로 새 객체를 할당합니다.
    memoRef.current = {
      prevProps: props,
      prevResult: result,
    };
    console.log("[memo] 저장 완료:", memoRef.current);

    return result;
  };

  MemoizedComponent.displayName = `Memo(${Component.displayName || Component.name})`;

  return MemoizedComponent;
}
