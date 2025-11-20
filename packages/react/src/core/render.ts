import { context } from "./context";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { getDomNodes, insertInstance } from "./dom";
import { reconcile } from "./reconciler";
import { cleanupUnusedHooks, flushEffects } from "./hooks";
import { withEnqueue, enqueue } from "../utils";
// React DOM 스타일: 이벤트 루트는 createRoot에서 설정되므로 render에서는 제거

/**
 * 루트 컴포넌트의 렌더링을 수행하는 함수입니다.
 * `enqueueRender`에 의해 스케줄링되어 호출됩니다.
 */
export const render = (): void => {
  // 디버깅 모드: render 실행 로깅
  const isDebugMode =
    typeof window !== "undefined" &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((window as any).__REACT_DEBUG_EFFECTS__ || localStorage.getItem("__REACT_DEBUG_EFFECTS__") === "true");

  if (isDebugMode) {
    console.log("[React] render called");
  }

  const root = context.root;
  if (!root.container || !root.node) {
    if (isDebugMode) {
      console.warn("[React] render: root.container or root.node is null", {
        container: root.container,
        node: root.node,
      });
    }
    return;
  }

  // React DOM 스타일: 이벤트 루트는 createRoot에서 이미 설정되었으므로
  // render에서는 이벤트 루트를 다시 설정하지 않음
  // 만약 eventRoot가 설정되지 않았다면 경고만 출력 (개발 환경)
  if (!context.eventRoot && process.env.NODE_ENV !== "production") {
    console.warn("[render] 이벤트 루트가 설정되지 않았습니다. createRoot에서 setEventRoot를 호출해야 합니다.");
  }

  // 1. visited Set만 초기화합니다. (상태는 유지해야 함)
  // 각 컴포넌트 렌더링 시 reconcile에서 cursor는 이미 0으로 리셋됩니다.
  context.hooks.visited.clear();

  if (isDebugMode) {
    console.log("[React] render: before reconcile", {
      effectsQueueLength: context.effects.queue.length,
    });
  }

  // 2. reconcile 함수를 호출하여 루트 노드를 재조정합니다.
  // reconcile 함수 내부에서 이미 DOM 삽입/제거가 처리되므로 여기서는 인스턴스만 갱신합니다.
  const newInstance = reconcile(root.container, root.instance, root.node, "root");

  // 루트 instance 갱신
  root.instance = newInstance;

  if (isDebugMode) {
    console.log("[React] render: after reconcile", {
      effectsQueueLength: context.effects.queue.length,
    });
  }

  // 3. 사용되지 않은 훅들을 정리(cleanupUnusedHooks)합니다.
  cleanupUnusedHooks();

  // 4. 렌더링 후 큐에 쌓인 이펙트들을 비동기로 실행합니다.
  // flushEffects는 마이크로태스크 큐에 추가하여 렌더링 완료 후 실행되도록 합니다.
  // 이렇게 하면 렌더링이 완료된 후 다음 마이크로태스크에서 이펙트가 실행됩니다.
  if (isDebugMode) {
    console.log("[React] render: enqueue flushEffects", {
      effectsQueueLength: context.effects.queue.length,
    });
  }
  enqueue(flushEffects);
};

/**
 * `render` 함수를 마이크로태스크 큐에 추가하여 중복 실행을 방지합니다.
 */
export const enqueueRender = withEnqueue(render);
