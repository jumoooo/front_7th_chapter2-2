import { setup, type VNode } from "../core";
import { setEventRoot } from "../core/events";
import { context } from "../core/context";

/**
 * React DOM의 createRoot와 동일한 API를 제공합니다.
 * createRoot 시점에 이벤트 루트를 단 한 번만 설정하여 React DOM과 동일한 라이프사이클을 보장합니다.
 */
export const createRoot = (rootElement: HTMLElement) => {
  // React DOM 스타일: createRoot 시점에 이벤트 루트를 단 한 번만 설정
  // 이후 render 호출 시에는 이벤트 루트를 다시 설정하지 않음
  if (!context.eventRoot) {
    setEventRoot(rootElement);
    context.eventRoot = rootElement;
  }

  return {
    render: (root: VNode) => setup(root, rootElement),
  };
};
