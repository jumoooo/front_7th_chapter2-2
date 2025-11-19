# DOM 순서 문제 원인 분석 보고서

## 🔍 문제 현상

- `PageWrapper`의 `<div>` 내부에서 `header`, `main`, `Footer` 순서로 작성했지만
- 실제 화면에서는 `Footer`, `header`, `main` 순서로 표시됨

## 📊 코드 흐름 분석

### 1. 마운트 시 자식 삽입 과정

```
PageWrapper 컴포넌트 렌더링
  ↓
<div> 요소 마운트 (mountNode)
  ↓
reconcileChildren(dom, [], [header, main, CartModal, Toast, Footer], path)
  ↓
newChildren.forEach((childVNode, index) => {
  reconcile(parentDom, null, childVNode, ...)  // 각 자식마다 호출
    ↓
  mountNode(parentDom, childVNode, ...)
    ↓
  insertInstance(parentDom, newInstance)  // DOM에 삽입
})
  ↓
재배치 로직 실행 (349-388줄)
```

### 2. 문제 발생 지점

**`reconcileChildren` 함수 (304줄):**
```typescript
const reconciledInstance = reconcile(parentDom, instanceToReconcile, childVNode, childPath);
```

- 마운트 시 `instanceToReconcile = null`이므로 `reconcile` 내부에서 `mountNode`가 호출됨
- `mountNode`에서 `insertInstance(parentDom, newInstance)`가 호출되어 DOM에 삽입
- **각 자식이 순차적으로 DOM에 삽입되지만, 순서가 보장되지 않을 수 있음**

### 3. 재배치 로직의 문제점

**현재 재배치 로직 (349-388줄):**
```typescript
for (let i = newInstances.length - 1; i >= 0; i--) {
  const currentFirstDom = getFirstDomFromChildren([instance]);
  const nextFirstDom = nextInstance ? getFirstDomFromChildren([nextInstance]) : null;
  
  if (nextFirstDom) {
    if (currentFirstDom.nextSibling !== nextFirstDom) {
      // 재배치
      const domNodes = getDomNodes(instance);
      domNodes.forEach((node) => {
        parentDom.insertBefore(node, nextFirstDom);
      });
    }
  }
}
```

**문제점:**
1. **조건 검사 부정확**: `currentFirstDom.nextSibling !== nextFirstDom`만 확인
   - 현재 DOM이 nextFirstDom의 바로 이전 형제가 아니면 재배치
   - 하지만 중간에 다른 노드가 있어도 감지하지 못할 수 있음

2. **이미 DOM에 있는 노드 재삽입**: 
   - `getDomNodes(instance)`로 이미 DOM에 삽입된 노드들을 가져옴
   - `insertBefore`로 다시 삽입하면 자동으로 이동하지만, 순서가 여전히 잘못될 수 있음

3. **역순 순회의 문제**:
   - 역순으로 순회하면서 재배치하는데, 이미 잘못된 순서로 삽입된 상태에서 재배치하면 순서가 더 꼬일 수 있음

## 🎯 가능성 높은 원인들 (우선순위 순)

### 1. ⚠️ **재배치 로직의 조건 검사 부정확** (가장 가능성 높음)

**현재 로직:**
```typescript
if (currentFirstDom.nextSibling !== nextFirstDom) {
  // 재배치
}
```

**문제:**
- `nextSibling`만 확인하므로, 현재 DOM이 nextFirstDom의 바로 이전 형제가 아니면 재배치
- 하지만 이미 올바른 위치에 있지만 중간에 다른 노드가 있어도 재배치를 시도할 수 있음
- 또는 이미 잘못된 위치에 있어도 조건이 맞지 않아 재배치되지 않을 수 있음

**해결책:**
- 현재 DOM이 nextFirstDom의 이전 형제인지 정확히 확인해야 함
- 또는 현재 DOM의 위치를 더 정확하게 검증해야 함

### 2. ⚠️ **마운트 시 자식 삽입 순서 보장 부족**

**현재 흐름:**
- `reconcileChildren`에서 각 자식을 `reconcile`로 처리
- 각 `reconcile` 내부에서 `mountNode`가 호출되어 `insertInstance`로 DOM에 삽입
- 이때 순서가 보장되지 않을 수 있음

**문제:**
- 각 자식이 독립적으로 DOM에 삽입되므로 순서가 보장되지 않을 수 있음
- 재배치 로직이 실행되지만, 이미 잘못된 순서로 삽입된 상태

**해결책:**
- 마운트 시 자식들을 DOM에 삽입하기 전에 순서를 보장해야 함
- 또는 재배치 로직을 더 정확하게 수정해야 함

### 3. ⚠️ **insertInstance의 anchor 사용 문제**

**현재 로직:**
```typescript
export const insertInstance = (parentDom, instance, anchor = null) => {
  const domNodes = getDomNodes(instance);
  domNodes.forEach((node) => {
    if (anchor) {
      parentDom.insertBefore(node, anchor);
    } else {
      parentDom.appendChild(node);
    }
  });
};
```

**문제:**
- 마운트 시 `anchor`가 `null`이므로 `appendChild`를 사용
- `appendChild`는 항상 마지막에 추가하므로, 순서가 보장되지 않을 수 있음

**해결책:**
- 마운트 시에도 anchor를 사용하여 순서를 보장해야 함

### 4. ⚠️ **재배치 로직의 역순 순회 문제**

**현재 로직:**
- 역순으로 순회하면서 재배치 (i = newInstances.length - 1부터 0까지)
- 각 인스턴스에 대해 nextFirstDom을 anchor로 사용

**문제:**
- 역순으로 순회하면서 재배치하는데, 이미 잘못된 순서로 삽입된 상태에서 재배치하면 순서가 더 꼬일 수 있음

**해결책:**
- 순서대로 순회하면서 재배치하거나
- 재배치 로직을 더 정확하게 수정해야 함

## 🔧 해결 방안 제안

### 방안 1: 재배치 로직 개선 (권장)

재배치 로직의 조건을 더 정확하게 수정:

```typescript
// 현재 DOM이 nextFirstDom의 이전 형제인지 정확히 확인
let isInCorrectPosition = false;
if (nextFirstDom) {
  let sibling = nextFirstDom.previousSibling;
  while (sibling) {
    if (sibling === currentFirstDom) {
      isInCorrectPosition = true;
      break;
    }
    sibling = sibling.previousSibling;
  }
  
  if (!isInCorrectPosition) {
    // 재배치
  }
}
```

### 방안 2: 마운트 시 순서 보장

마운트 시 자식들을 DOM에 삽입하기 전에 순서를 보장:

```typescript
// 모든 자식을 먼저 reconcile하고, 그 다음 순서대로 DOM에 삽입
const children = childNodes.map((childVNode, index) =>
  reconcile(dom, null, childVNode, createChildPath(path, childVNode.key ?? null, index)),
);

// 순서대로 DOM에 삽입
children.forEach((child, index) => {
  if (child) {
    const prevChild = index > 0 ? children[index - 1] : null;
    const anchor = prevChild ? getFirstDomFromChildren([prevChild]) : null;
    insertInstance(dom, child, anchor);
  }
});
```

### 방안 3: 재배치 로직을 순서대로 순회

역순이 아닌 순서대로 순회하면서 재배치:

```typescript
// 순서대로 순회하면서 재배치
for (let i = 0; i < newInstances.length; i++) {
  const instance = newInstances[i];
  if (!instance) continue;
  
  const currentFirstDom = getFirstDomFromChildren([instance]);
  if (!currentFirstDom) continue;
  
  // 이전 인스턴스의 마지막 DOM 노드를 anchor로 사용
  const prevInstance = i > 0 ? newInstances[i - 1] : null;
  const prevLastDom = prevInstance ? getLastDomFromChildren([prevInstance]) : null;
  
  if (prevLastDom) {
    // prevLastDom 다음에 있어야 함
    if (currentFirstDom.previousSibling !== prevLastDom) {
      // 재배치
    }
  } else {
    // 첫 번째 자식이어야 함
    if (currentFirstDom.previousSibling !== null) {
      // 재배치
    }
  }
}
```

## 📝 다음 단계

1. 재배치 로직의 조건을 더 정확하게 수정
2. 마운트 시 자식 삽입 순서를 보장하는 로직 추가
3. 테스트 실행하여 문제 해결 확인

