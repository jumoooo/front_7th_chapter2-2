import { context } from "./context";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { getDomNodes, insertInstance } from "./dom";
import { reconcile } from "./reconciler";
import { cleanupUnusedHooks } from "./hooks";
import { withEnqueue } from "../utils";

/**
 * 루트 컴포넌트의 렌더링을 수행하는 함수입니다.
 * `enqueueRender`에 의해 스케줄링되어 호출됩니다.
 */
export const render = (): void => {
  const root = context.root;
  if (!root.container || !root.node) return;

  // 1. 훅 컨텍스트를 초기화합니다.
  context.hooks.clear();

  // 2. reconcile 함수를 호출하여 루트 노드를 재조정합니다.
  // reconcile 함수 내부에서 이미 DOM 삽입/제거가 처리되므로 여기서는 인스턴스만 갱신합니다.
  const newInstance = reconcile(root.container, root.instance, root.node, "root");

  // 루트 instance 갱신
  root.instance = newInstance;

  // 3. 사용되지 않은 훅들을 정리(cleanupUnusedHooks)합니다.
  cleanupUnusedHooks();
};

/**
 * `render` 함수를 마이크로태스크 큐에 추가하여 중복 실행을 방지합니다.
 */
export const enqueueRender = withEnqueue(render);
