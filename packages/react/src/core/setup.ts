import { context } from "./context";
import { VNode } from "./types";
import { removeInstance } from "./dom";
import { cleanupUnusedHooks } from "./hooks";
import { render } from "./render";
import { setEventRoot } from "./events";

/**
 * Mini-React 애플리케이션의 루트를 설정하고 첫 렌더링을 시작합니다.
 *
 * @param rootNode - 렌더링할 최상위 VNode
 * @param container - VNode가 렌더링될 DOM 컨테이너
 */
export const setup = (rootNode: VNode | null, container: HTMLElement): void => {
  // 여기를 구현하세요.
  // 1. 컨테이너 유효성을 검사합니다.
  if (!container) {
    throw new Error("렌더 타깃 컨테이너가 없습니다.");
  }
  if (rootNode === null) {
    throw new Error("루트 노드가 없습니다.");
  }
  // 2. 이전 렌더링 내용을 정리하고 컨테이너를 비웁니다.
  if (context.root.instance) {
    removeInstance(container, context.root.instance);
  }
  cleanupUnusedHooks(); // 훅 상태 정리
  container.innerHTML = ""; // 실제 DOM 비우기
  // 3. 루트 컨텍스트와 훅 컨텍스트를 리셋합니다.
  context.root.reset({ container, node: rootNode });
  context.hooks.clear();

  // React DOM 스타일: 이벤트 루트 설정
  // createRoot를 통해 호출된 경우 이미 설정되어 있지만,
  // 테스트 등에서 setup을 직접 호출하는 경우를 대비하여 설정
  // 이미 같은 컨테이너가 설정되어 있으면 중복 설정을 방지
  if (!context.eventRoot || context.eventRoot !== container) {
    setEventRoot(container);
    context.eventRoot = container;
  }

  // 4. 첫 렌더링을 실행합니다.
  render();
};
