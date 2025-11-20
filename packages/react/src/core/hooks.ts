// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { shallowEquals, withEnqueue } from "../utils";
import { context } from "./context";
import { EffectHook } from "./types";
import { enqueueRender } from "./render";
import { HookTypes } from "./constants";

/**
 * 렌더링 후 큐에 쌓인 이펙트들을 실행합니다.
 * 각 이펙트를 실행하고, 클린업 함수가 반환되면 훅에 저장합니다.
 */
export const flushEffects = (): void => {
  // 디버깅 모드: flushEffects 실행 로깅
  const isDebugMode =
    typeof window !== "undefined" &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((window as any).__REACT_DEBUG_EFFECTS__ || localStorage.getItem("__REACT_DEBUG_EFFECTS__") === "true");

  if (isDebugMode) {
    console.log("[React] flushEffects called", {
      queueLength: context.effects.queue.length,
      queue: context.effects.queue.map(({ path, cursor }) => ({ path, cursor })),
    });
  }

  // 큐에 있는 모든 이펙트를 실행합니다.
  while (context.effects.queue.length > 0) {
    const { path, cursor } = context.effects.queue.shift()!;

    if (isDebugMode) {
      console.log("[React] flushEffects: executing effect", { path, cursor });
    }

    // 해당 경로의 훅 상태 배열에서 이펙트 훅을 찾습니다.
    const hooksForPath = context.hooks.state.get(path);
    if (!hooksForPath) {
      if (isDebugMode) {
        console.warn("[React] flushEffects: hooks not found for path", path);
      }
      continue;
    }

    const hook = hooksForPath[cursor] as EffectHook | undefined;
    if (!hook || hook.kind !== HookTypes.EFFECT) {
      if (isDebugMode) {
        console.warn("[React] flushEffects: effect hook not found", { path, cursor, hook: hook?.kind });
      }
      continue;
    }

    // 이펙트 함수를 실행합니다.
    if (isDebugMode) {
      console.log("[React] flushEffects: calling effect function", { path, cursor });
    }
    const cleanup = hook.effect();

    // 클린업 함수가 반환되면 훅에 저장합니다.
    if (typeof cleanup === "function") {
      hook.cleanup = cleanup;
      if (isDebugMode) {
        console.log("[React] flushEffects: cleanup function stored", { path, cursor });
      }
    } else {
      hook.cleanup = null;
    }
  }

  if (isDebugMode) {
    console.log("[React] flushEffects completed");
  }
};

/**
 * 사용되지 않는 컴포넌트의 훅 상태와 이펙트 클린업 함수를 정리합니다.
 * visited Set에 없는 경로의 훅만 정리합니다.
 */
export const cleanupUnusedHooks = () => {
  if (!context.hooks) return;

  // 디버깅 모드: cleanupUnusedHooks 실행 로깅
  const isDebugMode =
    typeof window !== "undefined" &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((window as any).__REACT_DEBUG_EFFECTS__ || localStorage.getItem("__REACT_DEBUG_EFFECTS__") === "true");

  if (isDebugMode) {
    console.log("[React] cleanupUnusedHooks called", {
      visitedPaths: Array.from(context.hooks.visited),
      allPaths: Array.from(context.hooks.state.keys()),
      pathsToCleanup: Array.from(context.hooks.state.keys()).filter((path) => !context.hooks.visited.has(path)),
    });
  }

  // visited Set에 없는 경로의 훅들을 정리합니다.
  for (const [path, hooks] of context.hooks.state.entries()) {
    if (!context.hooks.visited.has(path)) {
      if (isDebugMode) {
        console.log("[React] cleanupUnusedHooks: cleaning up path", path, {
          hooksCount: hooks.length,
          effectHooks: hooks.filter((h) => h.kind === HookTypes.EFFECT).length,
        });
      }

      // 이펙트 클린업 함수 실행
      hooks.forEach((hook) => {
        if (hook.kind === HookTypes.EFFECT) {
          const effectHook = hook as EffectHook;
          if (effectHook.cleanup && typeof effectHook.cleanup === "function") {
            if (isDebugMode) {
              console.log("[React] cleanupUnusedHooks: executing cleanup for path", path);
            }
            effectHook.cleanup(); // effect cleanup 실행
          }
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
export const useEffect = (effect: () => (() => void) | void, deps?: unknown[]): void => {
  // 1. 현재 실행 중인 컴포넌트의 고유 경로와 훅 커서를 가져옵니다.
  const path = context.hooks.currentPath;
  const cursor = context.hooks.currentCursor;

  // 2. 해당 경로에 대한 훅 상태 배열이 없으면 새로 만듭니다.
  if (!context.hooks.state.has(path)) {
    context.hooks.state.set(path, []);
  }

  const hooksForPath = context.hooks.state.get(path)!;
  const prevHook = hooksForPath[cursor] as EffectHook | undefined;

  // 3. 의존성 배열 비교: 이전 훅이 없거나 의존성이 변경되었는지 확인합니다.
  const shouldRunEffect =
    !prevHook || // 첫 렌더링
    !shallowEquals(prevHook.deps, deps); // 의존성 변경

  // 디버깅 모드: useEffect cleanup 실행 로깅
  const isDebugMode =
    typeof window !== "undefined" &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((window as any).__REACT_DEBUG_EFFECTS__ || localStorage.getItem("__REACT_DEBUG_EFFECTS__") === "true");

  // 4. 이펙트를 실행해야 하는 경우, 이전 클린업 함수가 있으면 먼저 실행합니다.
  // cleanup은 의존성이 변경되었을 때만 실행되어야 합니다.
  if (shouldRunEffect) {
    // 이전 클린업 함수가 있으면 먼저 실행합니다.
    if (prevHook && prevHook.cleanup) {
      if (isDebugMode) {
        console.log("[React] useEffect: executing cleanup due to dependency change", {
          path,
          cursor,
          prevDeps: prevHook.deps,
          nextDeps: deps,
          depsChanged: !shallowEquals(prevHook.deps, deps),
        });
      }
      prevHook.cleanup();
    }
    // 이펙트 함수와 의존성 배열을 훅에 저장합니다.
    const hook: EffectHook = {
      kind: HookTypes.EFFECT,
      deps: deps ?? null,
      cleanup: null, // 실행 후 클린업 함수가 반환되면 여기에 저장됩니다.
      effect,
    };
    hooksForPath[cursor] = hook;

    // 이펙트 실행을 큐에 추가합니다 (렌더링 후 비동기로 실행됨)
    context.effects.queue.push({ path, cursor });

    if (isDebugMode) {
      console.log("[React] useEffect: effect queued", {
        path,
        cursor,
        deps: deps ?? null,
        queueLength: context.effects.queue.length,
      });
    }
  } else {
    // 의존성이 변경되지 않았으면 기존 훅을 유지합니다.
    // 이펙트는 실행하지 않지만, 훅 인덱스는 유지해야 합니다.
    if (!prevHook) {
      // 이전 훅이 없는데 shouldRunEffect가 false인 경우는 없지만, 타입 안전성을 위해 처리합니다.
      const hook: EffectHook = {
        kind: HookTypes.EFFECT,
        deps: deps ?? null,
        cleanup: null,
        effect,
      };
      hooksForPath[cursor] = hook;
    }
  }

  // 6. 다음 훅이 올바른 인덱스를 참조하도록 커서를 갱신합니다.
  context.hooks.cursor.set(path, cursor + 1);
};
