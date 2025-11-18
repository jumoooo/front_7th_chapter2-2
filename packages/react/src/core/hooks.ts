// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { shallowEquals, withEnqueue } from "../utils";
import { context } from "./context";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { EffectHook } from "./types";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { enqueueRender } from "./render";
import { HookTypes } from "./constants";

/**
 * 사용되지 않는 컴포넌트의 훅 상태와 이펙트 클린업 함수를 정리합니다.
 */
export const cleanupUnusedHooks = () => {
  if (!context.hooks) return;

  // 각 컴포넌트 경로(path)의 훅 배열을 순회
  for (const hooks of context.hooks.state.values()) {
    hooks.forEach((hook) => {
      if (hook.type === HookTypes.EFFECT && typeof hook.destroy === "function") {
        hook.destroy(); // effect cleanup 실행
      }
    });
  }

  // 훅 상태 초기화
  context.hooks.clear();
};

/**
 * 컴포넌트의 상태를 관리하기 위한 훅입니다.
 * @param initialValue - 초기 상태 값 또는 초기 상태를 반환하는 함수
 * @returns [현재 상태, 상태를 업데이트하는 함수]
 */
export const useState = <T>(initialValue: T | (() => T)): [T, (nextValue: T | ((prev: T) => T)) => void] => {
  // 여기를 구현하세요.
  // 1. 현재 컴포넌트의 훅 커서와 상태 배열을 가져옵니다.
  // 2. 첫 렌더링이라면 초기값으로 상태를 설정합니다.
  // 3. 상태 변경 함수(setter)를 생성합니다.
  //    - 새 값이 이전 값과 같으면(Object.is) 재렌더링을 건너뜁니다.
  //    - 값이 다르면 상태를 업데이트하고 재렌더링을 예약(enqueueRender)합니다.
  // 4. 훅 커서를 증가시키고 [상태, setter]를 반환합니다.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const setState = (nextValue: T | ((prev: T) => T)) => {};
  return [initialValue as T, setState];
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
