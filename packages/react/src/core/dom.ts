/* eslint-disable @typescript-eslint/no-explicit-any */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { NodeType, NodeTypes } from "./constants";
import { Instance } from "./types";

/**
 * DOM 요소에 속성(props)을 설정합니다.
 * 이벤트 핸들러, 스타일, className 등 다양한 속성을 처리해야 합니다.
 *
 * @param dom - 속성을 설정할 DOM 요소
 * @param props - 설정할 속성 객체 (children은 제외)
 */
export const setDomProps = (dom: HTMLElement, props: Record<string, any>): void => {
  // children은 별도로 reconcile에서 처리하므로 제외
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { children, ...domProps } = props;

  // 각 속성을 DOM에 설정
  Object.keys(domProps).forEach((key) => {
    const value = domProps[key];

    // className은 DOM의 className 프로퍼티에 직접 설정
    if (key === "className") {
      dom.className = value || "";
      return;
    }
    if (key === "style") {
      Object.assign(dom.style, value);
      return;
    }

    // 이벤트 핸들러는 나중에 구현 (onClick, onChange 등)
    // 현재는 최소 기능만 구현하므로 일반 속성만 처리

    // 일반 HTML 속성은 DOM 프로퍼티에 설정
    // 예: id, type, placeholder, value, maxLength, required 등
    if (key in dom) {
      // DOM에 직접 존재하는 프로퍼티인 경우
      (dom as any)[key] = value;
    } else {
      // DOM 프로퍼티가 아닌 경우 attribute로 설정
      dom.setAttribute(key, value);
    }
  });
};

/**
 * 이전 속성과 새로운 속성을 비교하여 DOM 요소의 속성을 업데이트합니다.
 * 변경된 속성만 효율적으로 DOM에 반영해야 합니다.
 */
export const updateDomProps = (
  dom: HTMLElement,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  prevProps: Record<string, any> = {},
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  nextProps: Record<string, any> = {},
): void => {
  // 여기를 구현하세요.
};

/**
 * 주어진 인스턴스에서 실제 DOM 노드(들)를 재귀적으로 찾아 배열로 반환합니다.
 * Fragment나 컴포넌트 인스턴스는 여러 개의 DOM 노드를 가질 수 있습니다.
 */
export const getDomNodes = (instance: Instance | null): (HTMLElement | Text)[] => {
  if (!instance) return [];

  // DOM 노드가 있으면 반환
  if (instance.dom) return [instance.dom];

  // children이 없으면 빈 배열 반환
  if (!instance.children || instance.children.length === 0) return [];

  // children이 있으면 재귀적으로 DOM 수집
  const nodes: (HTMLElement | Text)[] = [];
  for (const child of instance.children) {
    if (child) {
      nodes.push(...getDomNodes(child));
    }
  }

  return nodes;
};

/**
 * 주어진 인스턴스에서 첫 번째 실제 DOM 노드를 찾습니다.
 */
export const getFirstDom = (
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  instance: Instance | null,
): HTMLElement | Text | null => {
  // 여기를 구현하세요.
  return null;
};

/**
 * 자식 인스턴스들로부터 첫 번째 실제 DOM 노드를 찾습니다.
 */
export const getFirstDomFromChildren = (
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  children: (Instance | null)[],
): HTMLElement | Text | null => {
  // 여기를 구현하세요.
  return null;
};

/**
 * 인스턴스를 부모 DOM에 삽입합니다.
 * anchor 노드가 주어지면 그 앞에 삽입하여 순서를 보장합니다.
 * @param parentDom - 부모 DOM 요소
 * @param instance - 삽입할 인스턴스
 * @param anchor - 삽입할 위치
 */
export const insertInstance = (
  parentDom: HTMLElement,
  instance: Instance | null,
  anchor: HTMLElement | Text | null = null,
): void => {
  if (!instance) return;

  // 실제 DOM 노드들 가져오기
  const domNodes = getDomNodes(instance);

  // 부모에 삽입
  domNodes.forEach((node) => {
    if (anchor) {
      parentDom.insertBefore(node, anchor);
    } else {
      parentDom.appendChild(node);
    }
  });
};

/**
 * 부모 DOM에서 인스턴스에 해당하는 모든 DOM 노드를 제거합니다.
 */
export const removeInstance = (parentDom: HTMLElement, instance: Instance | null): void => {
  if (!instance) return;

  // 자식들을 재귀적으로 제거
  // 주의: 자식 제거 시 올바른 부모 DOM을 전달해야 함
  if (instance.children) {
    // instance.dom이 HTMLElement인 경우에만 자식 제거
    if (instance.dom && instance.dom instanceof HTMLElement) {
      instance.children.forEach((child) => {
        removeInstance(instance.dom as HTMLElement, child);
      });
    } else {
      // instance.dom이 없거나 Text 노드인 경우, parentDom을 사용
      instance.children.forEach((child) => {
        removeInstance(parentDom, child);
      });
    }
  }

  // 실제 DOM 제거
  if (instance.dom && parentDom.contains(instance.dom)) {
    parentDom.removeChild(instance.dom);
  }
};
