# Footer 순서 문제 원인 분석 보고서

## 🔍 문제 현상

- `PageWrapper.jsx`에서 `Footer` 태그를 `Toast` 아래로 옮기면
- `Footer`가 맨 위로 올라가는 오류 발생

## 📊 현재 코드 구조

### PageWrapper.jsx 자식 순서

**현재 (정상 작동):**

```jsx
<header>...</header>
<main>...</main>
<Footer />
<CartModal {...cart} isOpen={cartModal.isOpen} />
<Toast {...toast} />
```

**문제 발생 시나리오:**

```jsx
<header>...</header>
<main>...</main>
<CartModal {...cart} isOpen={cartModal.isOpen} />
<Toast {...toast} />
<Footer />  // ← Toast 아래로 옮김
```

## 🔍 재배치 로직 분석

### 현재 재배치 로직 (reconciler.ts 349-394줄)

```typescript
// 역순으로 순회하여 올바른 위치에 DOM 배치
for (let i = newInstances.length - 1; i >= 0; i--) {
  const instance = newInstances[i];
  if (!instance) continue;

  const currentFirstDom = getFirstDomFromChildren([instance]);
  if (!currentFirstDom) continue;

  const nextInstance = i + 1 < newInstances.length ? newInstances[i + 1] : null;
  const nextFirstDom = nextInstance ? getFirstDomFromChildren([nextInstance]) : null;

  if (nextFirstDom) {
    // anchor 앞에 있어야 함
    const isInCorrectPosition = currentFirstDom.nextSibling === nextFirstDom;
    if (!isInCorrectPosition) {
      const domNodes = getDomNodes(instance);
      domNodes.forEach((node) => {
        parentDom.insertBefore(node, nextFirstDom);
      });
    }
  } else {
    // anchor가 없으면 마지막 위치에 있어야 함
    const isLastChild = currentFirstDom.nextSibling === null;
    if (!isLastChild) {
      const domNodes = getDomNodes(instance);
      domNodes.forEach((node) => {
        parentDom.appendChild(node); // ← 문제 지점
      });
    }
  }
}
```

## 🎯 문제 원인 분석

### 1. 역순 순회의 문제

**재배치 순서:**

- `newInstances = [header, main, CartModal, Toast, Footer]` (인덱스 0~4)
- 역순으로 순회: `i=4(Footer)`, `i=3(Toast)`, `i=2(CartModal)`, `i=1(main)`, `i=0(header)`

**문제 시나리오:**

1. **i=4 (Footer, 마지막 인스턴스):**
   - `nextFirstDom = null` (다음 인스턴스 없음)
   - `else` 블록으로 진입
   - `isLastChild = currentFirstDom.nextSibling === null`
   - Footer가 맨 위에 있으면 `nextSibling !== null`이므로 재배치 필요
   - **`appendChild`로 마지막에 추가**

2. **i=3 (Toast):**
   - `nextFirstDom = Footer의 첫 DOM`
   - Toast가 Footer 앞에 있어야 함
   - 하지만 Footer가 이미 마지막에 있으므로, Toast의 위치 확인
   - Toast가 Footer 앞에 있지 않으면 재배치

### 2. 핵심 문제점

**문제 1: `appendChild`의 동작**

- `appendChild`는 이미 DOM에 있는 노드를 다시 삽입하면 **자동으로 이동**시킴
- 하지만 역순으로 순회하면서 재배치할 때, 이미 재배치된 노드들이 영향을 줄 수 있음

**문제 2: 마지막 인스턴스 처리**

- 마지막 인스턴스(Footer)를 먼저 처리하고, 그 다음 인스턴스들을 처리할 때 순서가 꼬일 수 있음
- 특히 `appendChild`를 사용하면, 이미 DOM에 있는 노드를 다시 삽입할 때 예상치 못한 동작이 발생할 수 있음

**문제 3: 위치 확인 로직의 부정확성**

- `isLastChild = currentFirstDom.nextSibling === null`만 확인
- 하지만 역순으로 순회하면서 재배치할 때, 이미 재배치된 노드들이 영향을 줄 수 있음
- 특히 마지막 인스턴스를 먼저 처리하고, 그 다음 인스턴스들을 처리할 때 순서가 꼬일 수 있음

### 3. 구체적인 문제 시나리오

**시나리오: Footer가 Toast 아래로 옮겨진 경우**

1. **마운트 시:**
   - 각 자식이 `reconcile`을 통해 DOM에 삽입됨
   - 이때 순서가 보장되지 않을 수 있음 (예: Footer가 맨 위에 삽입됨)

2. **재배치 과정:**
   - `i=4 (Footer)`: `nextFirstDom = null`, `else` 블록으로 진입
     - Footer가 맨 위에 있으면 `nextSibling !== null`이므로 재배치
     - **`appendChild`로 마지막에 추가**
   - `i=3 (Toast)`: `nextFirstDom = Footer의 첫 DOM`
     - Toast가 Footer 앞에 있어야 함
     - 하지만 Footer가 이미 마지막에 있으므로, Toast의 위치 확인
     - Toast가 Footer 앞에 있지 않으면 재배치

3. **문제 발생:**
   - Footer를 먼저 마지막에 배치하고
   - Toast를 Footer 앞에 배치하려고 하면
   - Footer가 이미 마지막에 있으므로 문제가 없어 보이지만
   - 실제로는 순서가 꼬일 수 있음

## 🔧 해결 방안 제안

### 방안 1: 마지막 인스턴스 처리 개선 (권장)

마지막 인스턴스를 처리할 때, `appendChild` 대신 이전 인스턴스의 마지막 DOM 노드 다음에 삽입:

```typescript
} else {
  // anchor가 없으면 마지막 위치에 있어야 함
  // 이전 인스턴스의 마지막 DOM 노드 다음에 삽입
  const prevInstance = i > 0 ? newInstances[i - 1] : null;
  let anchor: HTMLElement | Text | null = null;

  if (prevInstance) {
    const prevDomNodes = getDomNodes(prevInstance);
    if (prevDomNodes.length > 0) {
      anchor = prevDomNodes[prevDomNodes.length - 1].nextSibling as HTMLElement | Text | null;
    }
  } else {
    anchor = parentDom.firstChild as HTMLElement | Text | null;
  }

  const isLastChild = anchor
    ? currentFirstDom.nextSibling === anchor
    : currentFirstDom.previousSibling === null;

  if (!isLastChild) {
    const domNodes = getDomNodes(instance);
    // 먼저 기존 DOM에서 제거
    domNodes.forEach((node) => {
      if (node.parentNode === parentDom) {
        parentDom.removeChild(node);
      }
    });
    // 올바른 위치에 삽입
    domNodes.forEach((node) => {
      if (anchor) {
        parentDom.insertBefore(node, anchor);
      } else {
        parentDom.appendChild(node);
      }
    });
  }
}
```

### 방안 2: 순서대로 순회하도록 변경

역순이 아닌 순서대로 순회하면서 재배치:

```typescript
// 순서대로 순회하여 올바른 위치에 DOM 배치
for (let i = 0; i < newInstances.length; i++) {
  const instance = newInstances[i];
  if (!instance) continue;

  const currentFirstDom = getFirstDomFromChildren([instance]);
  if (!currentFirstDom) continue;

  // 이전 인스턴스의 마지막 DOM 노드를 anchor로 사용
  const prevInstance = i > 0 ? newInstances[i - 1] : null;
  let anchor: HTMLElement | Text | null = null;

  if (prevInstance) {
    const prevDomNodes = getDomNodes(prevInstance);
    if (prevDomNodes.length > 0) {
      anchor = prevDomNodes[prevDomNodes.length - 1].nextSibling as HTMLElement | Text | null;
    }
  } else {
    anchor = parentDom.firstChild as HTMLElement | Text | null;
  }

  const isInCorrectPosition = anchor
    ? currentFirstDom.nextSibling === anchor
    : currentFirstDom.previousSibling === null;

  if (!isInCorrectPosition) {
    const domNodes = getDomNodes(instance);
    // 먼저 기존 DOM에서 제거
    domNodes.forEach((node) => {
      if (node.parentNode === parentDom) {
        parentDom.removeChild(node);
      }
    });
    // 올바른 위치에 삽입
    domNodes.forEach((node) => {
      if (anchor) {
        parentDom.insertBefore(node, anchor);
      } else {
        parentDom.appendChild(node);
      }
    });
  }
}
```

### 방안 3: 재배치 전 모든 노드 제거 후 순서대로 삽입

재배치 전에 모든 노드를 제거하고 순서대로 삽입:

```typescript
// 재배치 전 모든 노드를 임시로 제거
const allDomNodes: (HTMLElement | Text)[] = [];
newInstances.forEach((instance) => {
  if (instance) {
    const domNodes = getDomNodes(instance);
    domNodes.forEach((node) => {
      if (node.parentNode === parentDom) {
        parentDom.removeChild(node);
        allDomNodes.push(node);
      }
    });
  }
});

// 순서대로 삽입
newInstances.forEach((instance) => {
  if (instance) {
    const domNodes = getDomNodes(instance);
    domNodes.forEach((node) => {
      if (allDomNodes.includes(node)) {
        parentDom.appendChild(node);
      }
    });
  }
});
```

## 📝 권장 해결책

**방안 1 (마지막 인스턴스 처리 개선)**을 권장합니다:

- 기존 역순 순회 로직을 유지하면서 마지막 인스턴스 처리만 개선
- 다른 인스턴스들의 재배치 로직에 영향을 주지 않음
- 테스트 실패 위험이 낮음

## 🔍 추가 확인 사항

1. **마운트 시 자식 삽입 순서**: 마운트 시 각 자식이 DOM에 삽입되는 순서가 보장되는지 확인
2. **함수형 컴포넌트 처리**: 함수형 컴포넌트와 일반 DOM 요소가 섞여 있을 때 순서 보장 확인
3. **재배치 로직의 정확성**: 재배치 로직이 모든 경우에 올바르게 작동하는지 확인
