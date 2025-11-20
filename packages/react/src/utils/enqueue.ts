import type { AnyFunction } from "../types";

/**
 * 작업을 마이크로태스크 큐에 추가하여 비동기적으로 실행합니다.
 * 브라우저의 `queueMicrotask` 또는 `Promise.resolve().then()`을 사용합니다.
 */
export const enqueue = (callback: () => void) => {
  // 디버깅 모드: enqueue 실행 로깅
  const isDebugMode =
    typeof window !== "undefined" &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((window as any).__REACT_DEBUG_EFFECTS__ || localStorage.getItem("__REACT_DEBUG_EFFECTS__") === "true");

  if (isDebugMode) {
    const callbackName = callback.name || "anonymous";
    console.log("[React] enqueue called", {
      callbackName,
      hasQueueMicrotask: typeof queueMicrotask === "function",
    });
  }

  if (typeof queueMicrotask === "function") {
    queueMicrotask(() => {
      if (isDebugMode) {
        console.log("[React] enqueue: executing callback via queueMicrotask");
      }
      callback();
    });
    return;
  }

  Promise.resolve()
    .then(() => {
      if (isDebugMode) {
        console.log("[React] enqueue: executing callback via Promise.resolve().then()");
      }
      callback();
    })
    .catch((error) => {
      setTimeout(() => {
        throw error;
      }, 0);
    });
};

/**
 * 함수가 여러 번 호출되더라도 실제 실행은 한 번만 스케줄링되도록 보장하는 고차 함수입니다.
 * 렌더링이나 이펙트 실행과 같은 작업의 중복을 방지하는 데 사용됩니다.
 */
export const withEnqueue = (fn: AnyFunction) => {
  let scheduled = false;

  return (...args: Parameters<AnyFunction>) => {
    if (scheduled) return;
    scheduled = true;

    enqueue(() => {
      scheduled = false;
      fn(...args);
    });
  };
};
