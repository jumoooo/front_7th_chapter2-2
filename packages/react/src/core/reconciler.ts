// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { context } from "./context";
import { Fragment, NodeTypes, TEXT_ELEMENT } from "./constants";
import { Instance, VNode } from "./types";
import {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getFirstDom,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getFirstDomFromChildren,
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
    if (instance) removeInstance(parentDom, instance);
    return null;
  }

  // 2. 기존 인스턴스가 없으면 새 노드를 마운트합니다. (mount)
  if (!instance) {
    // 텍스트 노드 처리
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

    // Fragment 처리
    if (node.type === Fragment) {
      const rawChildren = Array.isArray(node.props.children)
        ? node.props.children
        : node.props.children
          ? [node.props.children]
          : [];
      const childNodes = rawChildren.filter((child) => !isEmptyValue(child));

      const children = childNodes.map((childVNode, index) =>
        reconcile(parentDom, null, childVNode, createChildPath(path, childVNode.key ?? null, index)),
      );

      const newInstance: Instance = {
        kind: NodeTypes.FRAGMENT,
        dom: null,
        node,
        children,
        key: node.key,
        path,
      };
      return newInstance;
    }

    // 일반 DOM 요소 처리
    if (typeof node.type === "string") {
      const dom = document.createElement(node.type);
      setDomProps(dom, node.props);

      const rawChildren = Array.isArray(node.props.children)
        ? node.props.children
        : node.props.children
          ? [node.props.children]
          : [];
      const childNodes = rawChildren.filter((child) => !isEmptyValue(child));

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

    // 함수형 컴포넌트 처리
    if (typeof node.type === "function") {
      const componentVNode = node.type(node.props);
      const childInstance = reconcile(parentDom, null, componentVNode, path);

      const newInstance: Instance = {
        kind: NodeTypes.COMPONENT,
        dom: null,
        node,
        children: childInstance ? [childInstance] : [],
        key: node.key,
        path,
      };
      return newInstance;
    }

    return null;
  }

  // 3. 타입이나 키가 다르면 기존 인스턴스를 제거하고 새로 마운트합니다.
  if (node.type !== instance.node.type) {
    removeInstance(parentDom, instance);

    // 텍스트 노드 처리
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

    // Fragment 처리
    if (node.type === Fragment) {
      const rawChildren = Array.isArray(node.props.children)
        ? node.props.children
        : node.props.children
          ? [node.props.children]
          : [];
      const childNodes = rawChildren.filter((child) => !isEmptyValue(child));

      const children = childNodes.map((childVNode, index) =>
        reconcile(parentDom, null, childVNode, createChildPath(path, childVNode.key ?? null, index)),
      );

      const newInstance: Instance = {
        kind: NodeTypes.FRAGMENT,
        dom: null,
        node,
        children,
        key: node.key,
        path,
      };
      return newInstance;
    }

    // 일반 DOM 요소 처리
    if (typeof node.type === "string") {
      const dom = document.createElement(node.type);
      setDomProps(dom, node.props);

      const rawChildren = Array.isArray(node.props.children)
        ? node.props.children
        : node.props.children
          ? [node.props.children]
          : [];
      const childNodes = rawChildren.filter((child) => !isEmptyValue(child));

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

    // 함수형 컴포넌트 처리
    if (typeof node.type === "function") {
      const componentVNode = node.type(node.props);
      const childInstance = reconcile(parentDom, null, componentVNode, path);

      const newInstance: Instance = {
        kind: NodeTypes.COMPONENT,
        dom: null,
        node,
        children: childInstance ? [childInstance] : [],
        key: node.key,
        path,
      };
      return newInstance;
    }

    return null;
  }

  // 4. 타입과 키가 같으면 인스턴스를 업데이트합니다. (update)
  //    - DOM 요소: updateDomProps로 속성 업데이트 후 자식 재조정
  if (typeof node.type === "string") {
    // props 갱신
    instance.node.props = node.props;

    // DOM 속성 업데이트 (setDomProps는 아직 미구현이지만 구조는 준비)
    if (instance.dom && instance.dom instanceof HTMLElement) {
      updateDomProps(instance.dom, {}, node.props);
    }

    // 자식 DOM 재조정
    // children이 배열이 아닐 수 있으므로 배열로 정규화하고 빈 값 필터링
    const rawChildren = Array.isArray(node.props.children)
      ? node.props.children
      : node.props.children
        ? [node.props.children]
        : [];
    const childNodes = rawChildren.filter((child) => !isEmptyValue(child));

    // 기존 children과 새 children을 reconcile
    instance.children = childNodes.map((childVNode, index) =>
      reconcile(
        instance.dom as HTMLElement,
        instance.children?.[index] || null,
        childVNode,
        createChildPath(path, childVNode.key ?? null, index),
      ),
    );
    return instance;
  }

  //    - 컴포넌트: 컴포넌트 함수 재실행 후 자식 재조정
  if (typeof node.type === "function") {
    const componentVNode = node.type(node.props);
    const childInstance = reconcile(parentDom, instance.children?.[0] || null, componentVNode, path);
    instance.node = node;
    instance.children = childInstance ? [childInstance] : [];
    return instance;
  }

  return instance;
};
