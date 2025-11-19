# 10. `memo` HOC 버그 및 함수형 컴포넌트 경로 문제 해결

> **목표**: `memo` HOC가 오작동하던 버그의 근본 원인인 함수형 컴포넌트의 경로(path) 문제를 해결하고, 그 과정을 기록합니다.

---

### 1. 문제 요약 (Problem Summary)

`memo`로 감싼 컴포넌트에 동일한 내용의 props가 전달되어도 불필요한 리렌더링이 발생하는 문제가 있었습니다. 이로 인해 `advanced.hoc.test.tsx`의 `toHaveBeenCalledTimes(1)` 테스트가 `2`번 호출되어 실패했습니다.

이는 `memo` HOC가 내부적으로 사용하는 `useRef` 훅이 렌더링 간에 상태를 보존하지 못했기 때문입니다.

### 2. 근본 원인 분석 (Root Cause Analysis)

1.  **1차 가설**: `useRef` 또는 `useState`의 구현 자체에 결함이 있을 것이다.
    -   **분석**: `useRef`와 `useState`의 코드를 분석한 결과, 훅 자체의 로직은 `path`와 `cursor`를 기반으로 상태를 저장하고 조회하는 올바른 구조였습니다.

2.  **2차 가설**: 훅의 `cursor`가 리렌더링 시 초기화되지 않을 것이다.
    -   **분석**: `reconciler.ts`를 분석한 결과, `renderFunctionComponent` 함수 내부에 `context.hooks.cursor.set(path, 0)` 코드가 존재하여, 함수형 컴포넌트가 렌더링되기 직전에 `cursor`를 `0`으로 리셋하고 있음을 확인했습니다. 이 가설은 틀렸습니다.

3.  **최종 결론: 경로(Path) 충돌**:
    -   **결정적 단서**: `reconciler.ts`의 `reconcile` (업데이트 시) 및 `mountNode` (마운트 시) 함수 모두, 함수형 컴포넌트가 반환한 **자식 VNode**를 `reconcile` 할 때, **부모 컴포넌트의 경로를 그대로 전달**하고 있었습니다.

    ```typescript
    // 버그 발생 코드
    const componentVNode = renderFunctionComponent(node.type, node.props, path);
    // 자식(componentVNode)에게 부모의 path를 그대로 전달하고 있음
    const childInstance = reconcile(parentDom, null, componentVNode, path);
    ```

    -   **영향**: 이로 인해 부모 컴포넌트와 자식 컴포넌트가 동일한 `path`를 공유하게 됩니다. 훅 시스템은 `path`와 `cursor`로 상태를 관리하므로, 서로 다른 컴포넌트의 훅 상태가 충돌하고, 의도치 않게 덮어쓰여 상태 보존에 실패하게 된 것입니다. `memo` HOC의 `useRef`가 상태를 잃어버린 것도 바로 이 때문입니다.

---

### 3. 수정 내역 (Changes Made)

함수형 컴포넌트의 자식이 부모와 독립된 고유한 경로를 갖도록 `reconciler.ts`의 두 부분을 수정했습니다.

#### 1. 컴포넌트 업데이트 로직 수정 (`reconcile` 함수)

-   **파일**: `packages/react/src/core/reconciler.ts`
-   **수정 전**:
    ```typescript
    // 중요: 자식 인스턴스가 업데이트될 때도 같은 path를 사용해야 훅 상태가 올바르게 유지됩니다
    const childInstance = reconcile(childParentDom, existingChildInstance || null, componentVNode, componentPath);

    instance.node = nextNode;
    instance.children = childInstance ? [childInstance] : [];
    ```
-   **수정 후**: `createChildPath`를 사용하여 자식의 고유 경로를 생성하도록 변경했습니다.
    ```typescript
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
    ```

#### 2. 컴포넌트 마운트 로직 수정 (`mountNode` 함수)

-   **파일**: `packages/react/src/core/reconciler.ts`
-   **수정 전**:
    ```typescript
    const componentVNode = renderFunctionComponent(node.type, node.props, path);
    const childInstance = reconcile(parentDom, null, componentVNode, path);
    ```
-   **수정 후**: 업데이트 시와 동일하게, `createChildPath`를 사용하여 자식의 고유 경로를 생성하도록 변경했습니다.
    ```typescript
    const componentVNode = renderFunctionComponent(node.type, node.props, path);
    
    let childInstance: Instance | null = null;
    if (componentVNode) {
      const childPath = createChildPath(path, componentVNode.key ?? null, 0);
      childInstance = reconcile(parentDom, null, componentVNode, childPath);
    }
    ```

---

### 4. 기대 효과 (Expected Outcome)

-   이제 모든 컴포넌트는 트리 구조에 따라 고유한 경로를 부여받습니다.
-   부모와 자식 간의 훅 상태 충돌이 사라져, `useRef`와 `useState`가 렌더링 간에 상태를 올바르게 보존합니다.
-   `memo` HOC가 정상적으로 동작하여, 동일한 props에 대한 불필요한 리렌더링을 방지합니다.
-   `advanced.hoc.test.tsx`의 관련 테스트가 성공적으로 통과할 것입니다.
