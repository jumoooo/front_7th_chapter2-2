/* eslint-disable @typescript-eslint/no-explicit-any */
import { isEmptyValue } from "../utils";
import { VNode } from "./types";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Fragment, TEXT_ELEMENT } from "./constants";

/**
 * 주어진 노드를 VNode 형식으로 정규화합니다.
 * null, undefined, boolean, 배열, 원시 타입 등을 처리하여 일관된 VNode 구조를 보장합니다.
 */
export const normalizeNode = (node: VNode): VNode | null | VNode[] => {
  if (isEmptyValue(node) || typeof node === "boolean") {
    return null;
  }

  // 문자열 또는 숫자인 경우 텍스트 노드 생성
  if (typeof node === "string" || typeof node === "number") {
    return createTextElement(node);
  }

  // 중첨 배열 내리기, 빈 값 제거
  if (Array.isArray(node)) {
    // 배열이면 재귀적으로 normalizeNode 후 평탄화
    return node
      .map((child) => normalizeNode(child))
      .flat()
      .filter(Boolean) as VNode[];
  }

  return node as VNode;
};

/**
 * 텍스트 노드를 위한 VNode를 생성합니다.
 */
const createTextElement = (value: string | number): VNode => {
  return {
    type: TEXT_ELEMENT,
    key: null,
    props: {
      children: [],
      nodeValue: String(value),
    },
  } as VNode;
};

/**
 * JSX로부터 전달된 인자를 VNode 객체로 변환합니다.
 * 이 함수는 JSX 변환기에 의해 호출됩니다. (예: Babel, TypeScript)
 */
export const createElement = (
  type: string | symbol | React.ComponentType<any>,
  originProps?: Record<string, any> | null,
  ...rawChildren: any[]
): VNode => {
  // key 추출
  const key = originProps?.key ?? null;

  // key는 props에서 제거
  const props = { ...originProps };
  if (props && "key" in props) delete props.key;

  // children 초기화 및 정규화
  // 모든 타입(문자열, 심볼, 함수형 컴포넌트)에 대해 children을 처리해야 합니다.
  // 함수형 컴포넌트도 children을 props로 받을 수 있어야 합니다.
  let children: VNode[] = [];

  // 모든 타입에 대해 children을 정규화합니다.
  if (rawChildren.length > 0) {
    children = rawChildren
      .map((child) => normalizeNode(child))
      .flat()
      .filter(Boolean) as VNode[];
  }

  // 최종 VNode 반환
  // children이 있으면 props에 포함하고, 없으면 포함하지 않습니다.
  // (기존 테스트와의 호환성을 위해 빈 배열은 props에 포함하지 않음)
  return {
    type,
    key,
    props: {
      ...props,
      ...(children.length > 0 ? { children } : {}), // children이 있을 때만 props에 포함
    },
  } as VNode;
};

/**
 * 부모 경로와 자식의 key/index를 기반으로 고유한 경로를 생성합니다.
 * 이는 훅의 상태를 유지하고 Reconciliation에서 컴포넌트를 식별하는 데 사용됩니다.
 */
export const createChildPath = (
  parentPath: string,
  key: string | null,
  index: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  nodeType?: string | symbol | React.ComponentType,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  siblings?: VNode[],
): string => {
  const id = key ?? index.toString();
  return parentPath ? `${parentPath}.${id}` : id;
};
