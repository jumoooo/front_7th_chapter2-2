import { context } from "./context";
import { Fragment, NodeTypes, TEXT_ELEMENT, HookTypes } from "./constants";
import { Instance, VNode, EffectHook } from "./types";
import {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getFirstDom,
  getFirstDomFromChildren,
  getDomNodes,
  insertInstance,
  removeInstance,
  setDomProps,
  updateDomProps,
} from "./dom";
import { createChildPath } from "./elements";
import { isEmptyValue } from "../utils";

/**
 * 이전 인스턴스와 새로운 VNode를 비교하여 DOM을 업데이트하는 재조정 과정을 수행합니다.
 * => reconcile은 기존 Instance와 새 VNode를 비교해서 버릴지(삭제), 고칠지(업데이트), 새로 만들지(마운트) 를 판단한다.
 *
 * @param parentDom - 부모 DOM 요소
 * @param instance - 이전 렌더링의 인스턴스
 * @param node - 새로운 VNode
 * @param path - 현재 노드의 고유 경로
 * @returns 업데이트되거나 새로 생성된 인스턴스
 */
export const reconcile = (
  parentDom: HTMLElement,
  instance: Instance | null,
  node: VNode | null,
  path: string,
): Instance | null => {
  // 1. 새 노드가 null이면 기존 인스턴스를 제거합니다. (unmount)
  if (!node) {
    if (instance) {
      // 컴포넌트가 언마운트될 때 이펙트 클린업 함수를 실행합니다.
      const instancePath = instance.path;
      const hooksForPath = context.hooks.state.get(instancePath);
      if (hooksForPath) {
        hooksForPath.forEach((hook) => {
          if (hook.kind === HookTypes.EFFECT) {
            const effectHook = hook as EffectHook;
            if (effectHook.cleanup && typeof effectHook.cleanup === "function") {
              effectHook.cleanup();
            }
          }
        });
      }
      removeInstance(parentDom, instance);
    }
    return null;
  }

  const nextNode = node;

  // 2. 기존 인스턴스가 없거나 타입이 변경되면 새로 마운트합니다. (mount)
  if (!instance || nextNode.type !== instance.node.type) {
    if (instance) {
      removeInstance(parentDom, instance);
    }
    // 타입이 다를 때는 기존 path의 훅 상태를 정리해야 합니다
    // 이는 타입이 다른 컴포넌트가 같은 path를 사용할 때 훅 상태가 섞이는 것을 방지합니다
    // 하지만 타입이 같고 인스턴스가 없는 경우는 첫 마운트이므로 정리할 필요가 없습니다
    const isTypeChange = instance !== null && nextNode.type !== instance.node.type;
    if (isTypeChange && context.hooks.state.has(path)) {
      // 기존 path의 훅 상태를 정리합니다
      const oldHooks = context.hooks.state.get(path);
      if (oldHooks) {
        // 이펙트 클린업 함수 실행
        oldHooks.forEach((hook) => {
          if (hook.kind === HookTypes.EFFECT) {
            const effectHook = hook as EffectHook;
            if (effectHook.cleanup && typeof effectHook.cleanup === "function") {
              effectHook.cleanup();
            }
          }
        });
      }
      context.hooks.state.delete(path);
      context.hooks.cursor.delete(path);
    }
    return mountNode(parentDom, nextNode, path);
  }

  // 3. 타입과 키가 같으면 인스턴스를 업데이트합니다. (update)
  if (nextNode.type === TEXT_ELEMENT) {
    // 텍스트 노드는 nodeValue만 비교해서 변경 시 DOM에 바로 반영합니다.
    const nextText = nextNode.props.nodeValue ?? "";
    if (instance.dom instanceof Text && instance.dom.nodeValue !== nextText) {
      instance.dom.nodeValue = nextText;
    }
    instance.node = nextNode;
    return instance;
  }

  if (typeof nextNode.type === "string") {
    // 이전 props 저장 (updateDomProps에서 비교하기 위해)
    const prevProps = instance.node.props;

    // props 갱신
    instance.node.props = nextNode.props;

    // DOM 속성 업데이트 (이전 props와 새 props를 비교)
    if (instance.dom && instance.dom instanceof HTMLElement) {
      updateDomProps(instance.dom, prevProps, nextNode.props);
    }

    // 자식 DOM 재조정 (key 기반 reconciliation)
    const childNodes = normalizeChildren(nextNode.props.children);
    instance.children = reconcileChildren(instance.dom as HTMLElement, instance.children || [], childNodes, path);
    return instance;
  }

  // Fragment 업데이트
  if (nextNode.type === Fragment) {
    // Fragment는 자체 DOM이 없으므로, 자식들을 재조정할 때 부모 DOM을 사용해야 합니다
    // 기존 자식 인스턴스가 있으면 그 DOM의 부모를 찾아서 사용하고, 없으면 parentDom을 사용
    const existingChildInstance = instance.children?.[0];
    let childParentDom = parentDom;

    if (existingChildInstance) {
      // 자식 인스턴스의 첫 번째 DOM 노드를 찾음
      const childDom = getFirstDomFromChildren([existingChildInstance]);
      if (childDom) {
        // DOM 노드의 부모 요소를 찾음 (Text 노드인 경우도 처리)
        // parentElement는 HTMLElement만 반환하므로, Text 노드의 경우 parentNode를 사용
        if (childDom.parentElement) {
          childParentDom = childDom.parentElement;
        } else if (childDom.parentNode && childDom.parentNode instanceof HTMLElement) {
          childParentDom = childDom.parentNode;
        }
      }
    }

    // Fragment의 자식들을 재조정합니다
    const childNodes = normalizeChildren(nextNode.props.children);
    instance.children = reconcileChildren(childParentDom, instance.children || [], childNodes, path);
    instance.node = nextNode;
    return instance;
  }

  // 함수형 컴포넌트 업데이트
  if (typeof nextNode.type === "function") {
    // 기존 인스턴스의 path를 사용하여 훅 상태를 올바르게 유지합니다
    // path는 컴포넌트 트리에서의 위치를 나타내므로 변경되면 안 됩니다
    const componentPath = instance.path;
    const componentVNode = renderFunctionComponent(nextNode.type, nextNode.props, componentPath);

    // 함수형 컴포넌트는 dom이 null이므로, 자식 인스턴스의 DOM을 찾아서 부모로 사용해야 함
    // 기존 자식 인스턴스가 있으면 그 DOM의 부모를 찾아서 사용하고, 없으면 parentDom을 사용
    const existingChildInstance = instance.children?.[0];
    let childParentDom = parentDom;

    if (existingChildInstance) {
      // 자식 인스턴스의 첫 번째 DOM 노드를 찾음
      const childDom = getFirstDomFromChildren([existingChildInstance]);
      if (childDom) {
        // DOM 노드의 부모 요소를 찾음 (Text 노드인 경우도 처리)
        // parentElement는 HTMLElement만 반환하므로, Text 노드의 경우 parentNode를 사용
        if (childDom.parentElement) {
          childParentDom = childDom.parentElement;
        } else if (childDom.parentNode && childDom.parentNode instanceof HTMLElement) {
          childParentDom = childDom.parentNode;
        }
      }
    }

    // 기존 인스턴스의 path를 사용하여 자식 인스턴스를 재조정합니다
    // 함수형 컴포넌트의 자식은 항상 컴포넌트의 path를 사용합니다
    // 중요: 자식 인스턴스가 업데이트될 때도 같은 path를 사용해야 훅 상태가 올바르게 유지됩니다
    let childInstance: Instance | null = null;
    if (componentVNode) {
      // The rendered child needs its own path, derived from the component's path.
      // A function component has a single child, so its index is effectively 0.
      const childPath = createChildPath(componentPath, componentVNode.key ?? null, 0);
      childInstance = reconcile(childParentDom, existingChildInstance || null, componentVNode, childPath);
    } else {
      // If the component returns null, unmount the existing child.
      childInstance = reconcile(childParentDom, existingChildInstance || null, null, componentPath); // path doesn't matter much for unmount
    }

    instance.node = nextNode;
    instance.children = childInstance ? [childInstance] : [];
    return instance;
  }

  return instance;
};

/**
 * 자식 VNode 배열을 안전하게 정규화합니다.
 */
function normalizeChildren(children?: VNode[]): VNode[] {
  return (children ?? []).filter((child) => !isEmptyValue(child));
}

/**
 * key 기반으로 자식 인스턴스들을 재조정합니다.
 * key가 있으면 key로 매칭하고, 없으면 인덱스로 매칭합니다.
 *
 * @param parentDom - 부모 DOM 요소
 * @param oldChildren - 이전 자식 인스턴스 배열
 * @param newChildren - 새로운 자식 VNode 배열
 * @param parentPath - 부모 경로
 * @returns 재조정된 자식 인스턴스 배열
 */
function reconcileChildren(
  parentDom: HTMLElement,
  oldChildren: (Instance | null)[],
  newChildren: VNode[],
  parentPath: string,
): (Instance | null)[] {
  // 1. 기존 children을 key로 매핑한 Map 생성 (key가 있는 경우)
  const keyedInstances = new Map<string | number, Instance | null>();
  // key가 없는 인스턴스들을 인덱스로 추적 (사용 여부를 Set으로 관리)
  const unkeyedInstances: (Instance | null)[] = [];
  const usedUnkeyedIndices = new Set<number>();

  oldChildren.forEach((child, index) => {
    if (child) {
      const key = child.key;
      if (key !== null) {
        // key가 있으면 Map에 저장
        keyedInstances.set(key, child);
      } else {
        // key가 없으면 인덱스 배열에 저장
        unkeyedInstances[index] = child;
      }
    }
  });

  // 2. 새 children을 순회하면서 매칭된 인스턴스를 찾아 재조정
  const newInstances: (Instance | null)[] = [];

  newChildren.forEach((childVNode, index) => {
    let matchedInstance: Instance | null = null;

    if (childVNode.key !== null) {
      // key가 있는 경우: Map에서 찾기
      matchedInstance = keyedInstances.get(childVNode.key) || null;
      if (matchedInstance) {
        // 사용된 인스턴스는 Map에서 제거 (나중에 사용되지 않은 것들을 정리하기 위해)
        keyedInstances.delete(childVNode.key);
      }
    } else {
      // key가 없는 경우: 인덱스로 매칭하되 타입도 확인
      // 같은 인덱스에 있고 타입이 같은 인스턴스를 찾거나, 아직 사용되지 않은 타입이 같은 인스턴스를 찾음
      if (
        unkeyedInstances[index] !== undefined &&
        !usedUnkeyedIndices.has(index) &&
        unkeyedInstances[index]?.node.type === childVNode.type
      ) {
        matchedInstance = unkeyedInstances[index];
        usedUnkeyedIndices.add(index);
      } else {
        // 인덱스에 없거나 타입이 다르면 다음 사용 가능한 타입이 같은 인스턴스 찾기
        for (let i = 0; i < unkeyedInstances.length; i++) {
          if (
            unkeyedInstances[i] !== undefined &&
            !usedUnkeyedIndices.has(i) &&
            unkeyedInstances[i]?.node.type === childVNode.type
          ) {
            matchedInstance = unkeyedInstances[i];
            usedUnkeyedIndices.add(i);
            break;
          }
        }
      }
    }

    // 3. 매칭된 인스턴스와 새 VNode를 reconcile
    // 매칭된 인스턴스가 있고 타입이 같으면 기존 path를 사용하여 상태를 유지합니다
    // 타입이 다르거나 매칭된 인스턴스가 없으면 새로운 path를 생성합니다
    // 중요: 타입이 다른 인스턴스는 절대 매칭하지 않아야 하므로, matchedInstance가 null이거나 타입이 다르면 새 path를 생성합니다
    const isTypeMatch = matchedInstance !== null && matchedInstance.node.type === childVNode.type;
    let childPath =
      isTypeMatch && matchedInstance
        ? matchedInstance.path
        : createChildPath(parentPath, childVNode.key ?? null, index);

    // 타입이 다를 때 새 path가 모든 기존 인스턴스의 path와 같지 않도록 보장합니다
    // 이는 타입이 다른 컴포넌트가 같은 path를 공유하여 훅 상태가 섞이는 것을 방지합니다
    if (!isTypeMatch) {
      // 모든 oldChildren의 path를 확인하여 충돌 방지
      for (const oldChild of oldChildren) {
        if (oldChild && oldChild.path === childPath) {
          // 타입이 다르고 path가 같다면, 타입 정보를 포함하여 고유한 path를 생성합니다
          const typeIdentifier =
            typeof childVNode.type === "function"
              ? `c${childVNode.type.name || "Component"}`
              : typeof childVNode.type === "string"
                ? `h${childVNode.type}`
                : "unknown";
          childPath = `${childPath}_${typeIdentifier}`;
          break; // 첫 번째 충돌만 처리하면 됨
        }
      }
    }

    // 타입이 다른 인스턴스는 null로 전달하여 새로 마운트되도록 합니다
    // 이는 타입이 다른 컴포넌트가 같은 path를 공유하는 것을 방지합니다
    const instanceToReconcile = isTypeMatch && matchedInstance ? matchedInstance : null;

    const reconciledInstance = reconcile(parentDom, instanceToReconcile, childVNode, childPath);
    newInstances.push(reconciledInstance);
  });

  // 4. 사용되지 않은 기존 인스턴스들 제거 (unmount)
  // key가 있는 경우: Map에 남아있는 것들
  keyedInstances.forEach((unusedInstance) => {
    if (unusedInstance) {
      // 컴포넌트가 언마운트될 때 이펙트 클린업 함수를 실행합니다.
      const instancePath = unusedInstance.path;
      const hooksForPath = context.hooks.state.get(instancePath);
      if (hooksForPath) {
        hooksForPath.forEach((hook) => {
          if (hook.kind === HookTypes.EFFECT) {
            const effectHook = hook as EffectHook;
            if (effectHook.cleanup && typeof effectHook.cleanup === "function") {
              effectHook.cleanup();
            }
          }
        });
      }
      removeInstance(parentDom, unusedInstance);
    }
  });

  // key가 없는 경우: 사용되지 않은 인스턴스들
  unkeyedInstances.forEach((unusedInstance, index) => {
    if (unusedInstance && !usedUnkeyedIndices.has(index)) {
      // 컴포넌트가 언마운트될 때 이펙트 클린업 함수를 실행합니다.
      const instancePath = unusedInstance.path;
      const hooksForPath = context.hooks.state.get(instancePath);
      if (hooksForPath) {
        hooksForPath.forEach((hook) => {
          if (hook.kind === HookTypes.EFFECT) {
            const effectHook = hook as EffectHook;
            if (effectHook.cleanup && typeof effectHook.cleanup === "function") {
              effectHook.cleanup();
            }
          }
        });
      }
      removeInstance(parentDom, unusedInstance);
    }
  });

  // 5. DOM 순서 재배치: 역순으로 순회하여 올바른 위치에 DOM 배치
  // 역순으로 순회하면 다음 인스턴스의 첫 DOM 노드를 anchor로 사용할 수 있어 효율적입니다
  for (let i = newInstances.length - 1; i >= 0; i--) {
    const instance = newInstances[i];
    if (!instance) continue;

    // 현재 인스턴스의 첫 DOM 노드 찾기
    const currentFirstDom = getFirstDomFromChildren([instance]);
    if (!currentFirstDom) continue;

    // 다음 인스턴스의 첫 DOM 노드를 anchor로 사용
    // i + 1이 범위 내에 있고, 해당 인스턴스가 존재하면 그 첫 DOM 노드를 anchor로 사용
    const nextInstance = i + 1 < newInstances.length ? newInstances[i + 1] : null;
    const nextFirstDom = nextInstance ? getFirstDomFromChildren([nextInstance]) : null;

    // 현재 DOM이 올바른 위치에 있는지 확인
    // anchor가 있고, 현재 DOM이 anchor의 이전 형제가 아니면 재배치 필요
    if (nextFirstDom) {
      // anchor 앞에 있어야 하는데 현재 위치가 다르면 재배치
      if (currentFirstDom.nextSibling !== nextFirstDom) {
        // DOM 노드들을 anchor 앞에 삽입
        const domNodes = getDomNodes(instance);
        domNodes.forEach((node) => {
          parentDom.insertBefore(node, nextFirstDom);
        });
      }
    } else {
      // anchor가 없으면 마지막 위치에 있어야 함
      // 현재 DOM이 부모의 마지막 자식이 아니면 재배치
      if (currentFirstDom.nextSibling !== null) {
        // DOM 노드들을 마지막에 삽입
        const domNodes = getDomNodes(instance);
        domNodes.forEach((node) => {
          parentDom.appendChild(node);
        });
      }
    }
  }

  return newInstances;
}

/**
 * 함수형 컴포넌트를 실행하면서 훅 스택을 적절히 관리합니다.
 */
function renderFunctionComponent(
  component: (props: VNode["props"]) => VNode | null,
  props: VNode["props"],
  path: string,
): VNode | null {
  context.hooks.componentStack.push(path);
  context.hooks.visited.add(path);
  context.hooks.cursor.set(path, 0);
  if (!context.hooks.state.has(path)) {
    context.hooks.state.set(path, []);
  }
  try {
    return component(props);
  } finally {
    context.hooks.componentStack.pop();
  }
}

/**
 * 신규 VNode를 DOM으로 변환하여 Instance를 생성합니다.
 */
function mountNode(parentDom: HTMLElement, node: VNode, path: string): Instance | null {
  // 1) 텍스트 노드 처리
  if (node.type === TEXT_ELEMENT) {
    const textNode = document.createTextNode(node.props.nodeValue || "");
    const newInstance: Instance = {
      kind: NodeTypes.TEXT,
      dom: textNode,
      node,
      children: [],
      key: node.key,
      path,
    };
    insertInstance(parentDom, newInstance);
    return newInstance;
  }

  // 2) Fragment 처리 (자식만 이어 붙임)
  if (node.type === Fragment) {
    const childNodes = normalizeChildren(node.props.children);
    const children = childNodes.map((childVNode, index) =>
      reconcile(parentDom, null, childVNode, createChildPath(path, childVNode.key ?? null, index)),
    );

    return {
      kind: NodeTypes.FRAGMENT,
      dom: null,
      node,
      children,
      key: node.key,
      path,
    };
  }

  // 3) 일반 DOM 요소 처리
  if (typeof node.type === "string") {
    const dom = document.createElement(node.type as string);
    setDomProps(dom, node.props);

    const childNodes = normalizeChildren(node.props.children);
    const children = childNodes.map((childVNode, index) =>
      reconcile(dom, null, childVNode, createChildPath(path, childVNode.key ?? null, index)),
    );

    const newInstance: Instance = {
      kind: NodeTypes.HOST,
      dom,
      node,
      children,
      key: node.key,
      path,
    };

    insertInstance(parentDom, newInstance);
    return newInstance;
  }

  // 4) 함수형 컴포넌트 처리
  if (typeof node.type === "function") {
    const componentVNode = renderFunctionComponent(node.type, node.props, path);

    let childInstance: Instance | null = null;
    if (componentVNode) {
      const childPath = createChildPath(path, componentVNode.key ?? null, 0);
      childInstance = reconcile(parentDom, null, componentVNode, childPath);
    }

    return {
      kind: NodeTypes.COMPONENT,
      dom: null,
      node,
      children: childInstance ? [childInstance] : [],
      key: node.key,
      path,
    };
  }

  return null;
}
