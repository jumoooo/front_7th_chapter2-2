// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { shallowEquals, withEnqueue } from "../utils";
import { context } from "./context";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { EffectHook } from "./types";
import { enqueueRender } from "./render";
import { HookTypes } from "./constants";

/**
 * 사용되지 않는 컴포넌트의 훅 상태와 이펙트 클린업 함수를 정리합니다.
 * visited Set에 없는 경로의 훅만 정리합니다.
 */
export const cleanupUnusedHooks = () => {
  if (!context.hooks) return;

  // visited Set에 없는 경로의 훅들을 정리합니다.
  for (const [path, hooks] of context.hooks.state.entries()) {
    if (!context.hooks.visited.has(path)) {
      // 이펙트 클린업 함수 실행
      hooks.forEach((hook) => {
        if (hook.type === HookTypes.EFFECT && typeof hook.destroy === "function") {
          hook.destroy(); // effect cleanup 실행
        }
      });

      // 사용되지 않는 경로의 훅 상태 삭제
      context.hooks.state.delete(path);
      context.hooks.cursor.delete(path);
    }
  }
};

/**
 * 컴포넌트의 상태를 관리하기 위한 훅입니다.
 * @param initialValue - 초기 상태 값 또는 초기 상태를 반환하는 함수
 * @returns [현재 상태, 상태를 업데이트하는 함수]
 */
export const useState = <T>(initialValue: T | (() => T)): [T, (nextValue: T | ((prev: T) => T)) => void] => {
  // 1. 현재 실행 중인 컴포넌트의 고유 경로와 훅 커서를 가져옵니다.
  const path = context.hooks.currentPath;
  const cursor = context.hooks.currentCursor;

  // 2. 해당 경로에 대한 훅 상태 배열이 없으면 새로 만듭니다.
  if (!context.hooks.state.has(path)) {
    context.hooks.state.set(path, []);
  }

  const hooksForPath = context.hooks.state.get(path)!;
  let hook = hooksForPath[cursor] as { kind: string; type?: string; value: T } | undefined;

  // 3. 최초 실행이라면 초기값(또는 이니셜라이저 함수)을 평가하여 저장합니다.
  if (!hook) {
    const value = typeof initialValue === "function" ? (initialValue as () => T)() : initialValue;
    hook = {
      kind: HookTypes.STATE,
      type: HookTypes.STATE,
      value,
    };
    hooksForPath[cursor] = hook;
  }

  const hookIndex = cursor;
  const setState = (nextValue: T | ((prev: T) => T)) => {
    // 4. setter는 이전 값을 기반으로 새 값을 계산하고, 값이 달라진 경우에만 재렌더를 요청합니다.
    const currentHook = hooksForPath[hookIndex] as { value: T };
    const previous = currentHook.value;
    const next = typeof nextValue === "function" ? (nextValue as (prev: T) => T)(previous) : nextValue;

    if (Object.is(previous, next)) return;

    currentHook.value = next;
    enqueueRender();
  };

  // 5. 다음 훅이 올바른 인덱스를 참조하도록 커서를 갱신합니다.
  context.hooks.cursor.set(path, hookIndex + 1);

  return [(hooksForPath[hookIndex] as { value: T }).value, setState];
};

/**
 * 컴포넌트의 사이드 이펙트를 처리하기 위한 훅입니다.
 * @param effect - 실행할 이펙트 함수. 클린업 함수를 반환할 수 있습니다.
 * @param deps - 의존성 배열. 이 값들이 변경될 때만 이펙트가 다시 실행됩니다.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const useEffect = (effect: () => (() => void) | void, deps?: unknown[]): void => {
  // 여기를 구현하세요.
  // 1. 이전 훅의 의존성 배열과 현재 의존성 배열을 비교(shallowEquals)합니다.
  // 2. 의존성이 변경되었거나 첫 렌더링일 경우, 이펙트 실행을 예약합니다.
  // 3. 이펙트 실행 전, 이전 클린업 함수가 있다면 먼저 실행합니다.
  // 4. 예약된 이펙트는 렌더링이 끝난 후 비동기로 실행됩니다.
};
