# useState 구현 상세 문서

## 📋 목차

1. [전체 구조 개요](#전체-구조-개요)
2. [핵심 데이터 구조](#핵심-데이터-구조)
3. [useState 구현 상세](#usestate-구현-상세)
4. [Path 기반 상태 격리 시스템](#path-기반-상태-격리-시스템)
5. [컴포넌트 라이프사이클과 useState](#컴포넌트-라이프사이클과-usestate)
6. [Reconciliation과 useState 연동](#reconciliation과-usestate-연동)
7. [상태 업데이트 플로우](#상태-업데이트-플로우)
8. [주요 문제 해결 사항](#주요-문제-해결-사항)

---

## 전체 구조 개요

### 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────────────┐
│                    Mini-React 시스템                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐      ┌──────────────┐                   │
│  │   Context    │      │   useState    │                   │
│  │  (전역 상태)  │◄─────┤   (훅)        │                   │
│  └──────────────┘      └──────────────┘                   │
│         │                      │                            │
│         │                      │                            │
│         ▼                      ▼                            │
│  ┌──────────────────────────────────────┐                 │
│  │      HooksContext                     │                 │
│  │  - state: Map<path, Hook[]>          │                 │
│  │  - cursor: Map<path, number>         │                 │
│  │  - visited: Set<path>                │                 │
│  │  - componentStack: string[]          │                 │
│  └──────────────────────────────────────┘                 │
│         │                                                   │
│         │                                                   │
│         ▼                                                   │
│  ┌──────────────────────────────────────┐                 │
│  │      Reconciliation                   │                 │
│  │  - reconcile()                        │                 │
│  │  - reconcileChildren()                │                 │
│  │  - renderFunctionComponent()          │                 │
│  └──────────────────────────────────────┘                 │
│         │                                                   │
│         ▼                                                   │
│  ┌──────────────────────────────────────┐                 │
│  │      Render Cycle                    │                 │
│  │  - render()                          │                 │
│  │  - cleanupUnusedHooks()              │                 │
│  └──────────────────────────────────────┘                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 핵심 데이터 구조

### 1. Context 구조 (`context.ts`)

```typescript
interface Context {
  root: RootContext;      // 루트 렌더링 정보
  hooks: HooksContext;    // 훅 상태 관리
  effects: EffectsContext; // 이펙트 큐
}

interface HooksContext {
  // path를 키로 사용하여 각 컴포넌트의 훅 상태를 격리
  state: Map<string, State[]>;        // path별 훅 상태 배열
  cursor: Map<string, number>;        // path별 훅 커서 (다음 훅 인덱스)
  visited: Set<string>;               // 현재 렌더링에서 방문한 path
  componentStack: string[];           // 컴포넌트 스택 (현재 실행 중인 컴포넌트 추적)
  
  // Getter 프로퍼티
  currentPath: string;                 // 현재 컴포넌트의 path
  currentCursor: number;               // 현재 컴포넌트의 훅 커서
  currentHooks: State[];               // 현재 컴포넌트의 훅 배열
}
```

### 2. Path 구조

Path는 컴포넌트 트리에서의 위치를 나타내는 고유 식별자입니다.

**Path 생성 규칙** (`createChildPath`):
```typescript
createChildPath(parentPath, key, index) {
  const id = key ?? index.toString();
  return parentPath ? `${parentPath}.${id}` : id;
}
```

**예시**:
- 루트: `"root"`
- 루트의 첫 번째 자식: `"root.0"`
- 루트의 첫 번째 자식의 두 번째 자식: `"root.0.1"`
- key가 있는 경우: `"root.0.user-123"`

**타입 충돌 방지 Path**:
- 타입이 다를 때: `"root.0.3_cItem"` (Item 컴포넌트)
- 타입이 다를 때: `"root.0.3_hdiv"` (div 엘리먼트)

### 3. Hook 상태 구조

```typescript
interface StateHook {
  kind: "state";
  type: "state";
  value: T;  // 실제 상태 값
}
```

---

## useState 구현 상세

### 함수 시그니처

```typescript
function useState<T>(
  initialValue: T | (() => T)
): [T, (nextValue: T | ((prev: T) => T)) => void]
```

### 실행 흐름

#### 1단계: 현재 컴포넌트 정보 가져오기

```typescript
const path = context.hooks.currentPath;      // 현재 컴포넌트의 path
const cursor = context.hooks.currentCursor;  // 현재 훅 커서
```

**동작 원리**:
- `currentPath`: `componentStack`의 마지막 요소를 반환
- `componentStack`은 `renderFunctionComponent`에서 관리됨
- 컴포넌트 렌더링 시작 시 path를 스택에 push, 종료 시 pop

#### 2단계: 훅 상태 배열 초기화

```typescript
if (!context.hooks.state.has(path)) {
  context.hooks.state.set(path, []);
}
const hooksForPath = context.hooks.state.get(path)!;
```

**동작 원리**:
- 각 path마다 독립적인 훅 배열을 가짐
- 같은 path를 가진 컴포넌트는 같은 훅 배열을 공유
- 다른 path를 가진 컴포넌트는 완전히 격리된 상태를 가짐

#### 3단계: 훅 인스턴스 가져오기 또는 생성

```typescript
let hook = hooksForPath[cursor] as { kind: string; type?: string; value: T } | undefined;

if (!hook) {
  // 최초 실행: 초기값 평가 및 저장
  const value = typeof initialValue === "function" 
    ? (initialValue as () => T)() 
    : initialValue;
  
  hook = {
    kind: HookTypes.STATE,
    type: HookTypes.STATE,
    value,
  };
  hooksForPath[cursor] = hook;
}
```

**동작 원리**:
- `cursor`는 현재 컴포넌트에서 호출된 훅의 순서를 나타냄
- 첫 번째 `useState` 호출: `cursor = 0`
- 두 번째 `useState` 호출: `cursor = 1`
- 훅이 없으면 초기값으로 생성, 있으면 기존 훅 재사용

**이니셜라이저 함수 처리**:
- `initialValue`가 함수인 경우: 최초 한 번만 실행
- 이후 렌더링에서는 이니셜라이저 함수를 무시하고 기존 값 사용

#### 4단계: setState 함수 생성

```typescript
const hookIndex = cursor;
const setState = (nextValue: T | ((prev: T) => T)) => {
  const currentHook = hooksForPath[hookIndex] as { value: T };
  const previous = currentHook.value;
  
  // 함수형 업데이트 또는 직접 값
  const next = typeof nextValue === "function" 
    ? (nextValue as (prev: T) => T)(previous) 
    : nextValue;
  
  // 값이 같으면 재렌더링 건너뛰기
  if (Object.is(previous, next)) return;
  
  // 상태 업데이트 및 재렌더링 요청
  currentHook.value = next;
  enqueueRender();
};
```

**동작 원리**:
- `Object.is()`를 사용하여 값 비교 (=== 와 유사하지만 NaN, +0/-0 처리)
- 값이 같으면 재렌더링을 건너뜀 (성능 최적화)
- 값이 다르면 상태를 업데이트하고 `enqueueRender()` 호출

**함수형 업데이트**:
- `setState(prev => prev + 1)`: 이전 값을 기반으로 새 값 계산
- `setState(5)`: 직접 값 설정

#### 5단계: 커서 증가 및 반환

```typescript
context.hooks.cursor.set(path, hookIndex + 1);
return [(hooksForPath[hookIndex] as { value: T }).value, setState];
```

**동작 원리**:
- 다음 훅이 올바른 인덱스를 참조하도록 커서를 증가시킴
- 현재 훅의 값과 setState 함수를 반환

---

## Path 기반 상태 격리 시스템

### Path의 역할

Path는 컴포넌트의 고유 식별자로, 다음 목적을 가집니다:

1. **상태 격리**: 각 컴포넌트의 훅 상태를 독립적으로 관리
2. **컴포넌트 추적**: 컴포넌트 트리에서의 위치 추적
3. **상태 유지**: 컴포넌트가 재렌더링되어도 같은 path를 사용하면 상태 유지

### Path 생성 시점

#### 1. 컴포넌트 마운트 시

```typescript
// mountNode 함수에서
if (typeof node.type === "function") {
  const componentVNode = renderFunctionComponent(node.type, node.props, path);
  // path는 createChildPath로 생성됨
}
```

#### 2. 컴포넌트 업데이트 시

```typescript
// reconcile 함수에서
if (typeof nextNode.type === "function") {
  const componentPath = instance.path;  // 기존 path 유지
  // 기존 인스턴스의 path를 사용하여 상태 유지
}
```

**중요**: 컴포넌트가 업데이트될 때는 기존 path를 유지하여 상태를 보존합니다.

### Path 충돌 방지

#### 문제 상황

타입이 다른 컴포넌트가 같은 path를 사용하면 훅 상태가 섞일 수 있습니다.

**예시**:
- Footer 컴포넌트: path `root.0.3`, 상태 `footerCount = 101`
- Item3 컴포넌트: path `root.0.3` (같은 인덱스)
- Item3이 Footer의 상태를 가져옴 ❌

#### 해결 방법

`reconcileChildren` 함수에서 타입이 다를 때 path 충돌을 방지:

```typescript
if (!isTypeMatch) {
  // 모든 oldChildren의 path를 확인하여 충돌 방지
  for (const oldChild of oldChildren) {
    if (oldChild && oldChild.path === childPath) {
      // 타입이 다르고 path가 같다면, 타입 정보를 포함하여 고유한 path 생성
      const typeIdentifier =
        typeof childVNode.type === "function"
          ? `c${childVNode.type.name || "Component"}`
          : typeof childVNode.type === "string"
            ? `h${childVNode.type}`
            : "unknown";
      childPath = `${childPath}_${typeIdentifier}`;
      break;
    }
  }
}
```

**결과**:
- Item3: `root.0.3_cItem` (충돌 방지)
- Footer: `root.0.3` (기존 path 유지)

---

## 컴포넌트 라이프사이클과 useState

### 1. 마운트 (Mount) 단계

#### 1.1 컴포넌트 렌더링 시작

```typescript
// renderFunctionComponent 함수
function renderFunctionComponent(component, props, path) {
  context.hooks.componentStack.push(path);  // 스택에 path 추가
  context.hooks.visited.add(path);          // visited에 추가
  context.hooks.cursor.set(path, 0);       // 커서를 0으로 초기화
  
  if (!context.hooks.state.has(path)) {
    context.hooks.state.set(path, []);      // 훅 배열 초기화
  }
  
  try {
    return component(props);  // 컴포넌트 함수 실행
  } finally {
    context.hooks.componentStack.pop();  // 스택에서 제거
  }
}
```

**동작 순서**:
1. `componentStack`에 path push → `currentPath`가 이 path를 반환
2. `visited`에 path 추가 → cleanup에서 제거되지 않도록 보호
3. `cursor`를 0으로 초기화 → 첫 번째 훅부터 시작
4. 훅 배열이 없으면 초기화
5. 컴포넌트 함수 실행 (useState 호출)
6. `componentStack`에서 path pop

#### 1.2 useState 호출

```typescript
// 첫 번째 useState 호출
const [count, setCount] = useState(0);
// path: "root.0.1"
// cursor: 0
// hooksForPath[0] = { kind: "state", type: "state", value: 0 }

// 두 번째 useState 호출
const [name, setName] = useState("");
// path: "root.0.1" (같은 컴포넌트)
// cursor: 1
// hooksForPath[1] = { kind: "state", type: "state", value: "" }
```

**상태 저장 구조**:
```
context.hooks.state = {
  "root.0.1": [
    { kind: "state", type: "state", value: 0 },      // 첫 번째 useState
    { kind: "state", type: "state", value: "" }      // 두 번째 useState
  ]
}
```

### 2. 업데이트 (Update) 단계

#### 2.1 상태 변경 트리거

```typescript
setCount(1);  // setState 호출
// 1. currentHook.value = 1로 업데이트
// 2. enqueueRender() 호출
```

#### 2.2 재렌더링 시작

```typescript
// render 함수
export const render = (): void => {
  context.hooks.visited.clear();  // visited만 초기화 (상태는 유지)
  const newInstance = reconcile(root.container, root.instance, root.node, "root");
  root.instance = newInstance;
  cleanupUnusedHooks();  // 사용되지 않은 훅 정리
};
```

**중요**: `visited`만 초기화하고 `state`와 `cursor`는 유지합니다.

#### 2.3 컴포넌트 재렌더링

```typescript
// renderFunctionComponent 함수
context.hooks.cursor.set(path, 0);  // 커서를 0으로 리셋
// 하지만 state는 유지됨
```

**동작 순서**:
1. `cursor`를 0으로 리셋 (훅 호출 순서 보장)
2. `visited`에 path 추가 (cleanup 방지)
3. 컴포넌트 함수 실행
4. `useState` 호출 시 기존 훅 재사용

```typescript
// useState에서
let hook = hooksForPath[cursor];  // cursor = 0
// hook이 이미 존재하므로 초기값 무시하고 기존 값 사용
// hook.value = 1 (이전에 setCount(1)로 업데이트된 값)
```

### 3. 언마운트 (Unmount) 단계

#### 3.1 컴포넌트 제거

```typescript
// reconcile 함수에서
if (!node) {
  if (instance) removeInstance(parentDom, instance);
  return null;
}
```

#### 3.2 훅 상태 정리

```typescript
// cleanupUnusedHooks 함수
export const cleanupUnusedHooks = () => {
  for (const [path, hooks] of context.hooks.state.entries()) {
    if (!context.hooks.visited.has(path)) {
      // 이펙트 클린업 함수 실행
      hooks.forEach((hook) => {
        if (hook.type === HookTypes.EFFECT && typeof hook.destroy === "function") {
          hook.destroy();
        }
      });
      
      // 훅 상태 삭제
      context.hooks.state.delete(path);
      context.hooks.cursor.delete(path);
    }
  }
};
```

**동작 원리**:
- `visited`에 없는 path는 사용되지 않는 컴포넌트
- 해당 path의 모든 훅 상태를 삭제
- 이펙트 클린업 함수 실행 (useEffect의 경우)

---

## Reconciliation과 useState 연동

### 1. reconcile 함수의 역할

`reconcile` 함수는 이전 인스턴스와 새로운 VNode를 비교하여 DOM을 업데이트합니다.

#### 1.1 함수형 컴포넌트 업데이트

```typescript
if (typeof nextNode.type === "function") {
  // 기존 인스턴스의 path를 사용하여 훅 상태를 올바르게 유지
  const componentPath = instance.path;
  const componentVNode = renderFunctionComponent(nextNode.type, nextNode.props, componentPath);
  // ...
}
```

**핵심 원칙**:
- 컴포넌트가 업데이트될 때는 **기존 path를 유지**합니다
- 이는 컴포넌트가 이동하거나 재렌더링되어도 상태를 보존하기 위함입니다

#### 1.2 타입이 다를 때 처리

```typescript
if (!instance || nextNode.type !== instance.node.type) {
  if (instance) {
    removeInstance(parentDom, instance);
  }
  
  // 타입이 다를 때는 기존 path의 훅 상태를 정리
  const isTypeChange = instance !== null && nextNode.type !== instance.node.type;
  if (isTypeChange && context.hooks.state.has(path)) {
    // 기존 path의 훅 상태를 정리
    const oldHooks = context.hooks.state.get(path);
    if (oldHooks) {
      // 이펙트 클린업 함수 실행
      oldHooks.forEach((hook) => {
        if (hook.type === HookTypes.EFFECT && typeof hook.destroy === "function") {
          hook.destroy();
        }
      });
    }
    context.hooks.state.delete(path);
    context.hooks.cursor.delete(path);
  }
  
  return mountNode(parentDom, nextNode, path);
}
```

**동작 원리**:
- 타입이 다를 때는 완전히 새로운 컴포넌트로 간주
- 기존 path의 훅 상태를 정리하여 타입이 다른 컴포넌트가 같은 path를 사용할 때 상태가 섞이지 않도록 보장

### 2. reconcileChildren 함수의 역할

`reconcileChildren` 함수는 자식 컴포넌트들을 재조정합니다.

#### 2.1 인스턴스 매칭 로직

```typescript
// key가 없는 경우: 인덱스로 매칭하되 타입도 확인
if (
  unkeyedInstances[index] !== undefined &&
  !usedUnkeyedIndices.has(index) &&
  unkeyedInstances[index]?.node.type === childVNode.type
) {
  matchedInstance = unkeyedInstances[index];
  usedUnkeyedIndices.add(index);
} else {
  // 타입이 같은 인스턴스를 찾기
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
```

**핵심 원칙**:
- **타입이 같을 때만** 인스턴스를 매칭합니다
- 타입이 다르면 새로 마운트합니다

#### 2.2 Path 생성 및 충돌 방지

```typescript
const isTypeMatch = matchedInstance !== null && matchedInstance.node.type === childVNode.type;
let childPath =
  isTypeMatch && matchedInstance
    ? matchedInstance.path  // 타입이 같으면 기존 path 사용
    : createChildPath(parentPath, childVNode.key ?? null, index);  // 새 path 생성

// 타입이 다를 때 path 충돌 방지
if (!isTypeMatch) {
  for (const oldChild of oldChildren) {
    if (oldChild && oldChild.path === childPath) {
      // 타입 정보를 포함하여 고유한 path 생성
      const typeIdentifier =
        typeof childVNode.type === "function"
          ? `c${childVNode.type.name || "Component"}`
          : typeof childVNode.type === "string"
            ? `h${childVNode.type}`
            : "unknown";
      childPath = `${childPath}_${typeIdentifier}`;
      break;
    }
  }
}
```

**동작 원리**:
1. 타입이 같으면 기존 path 사용 (상태 유지)
2. 타입이 다르면 새 path 생성
3. 새 path가 기존 인스턴스의 path와 충돌하면 타입 정보를 추가하여 고유하게 만듦

---

## 상태 업데이트 플로우

### 전체 플로우 다이어그램

```
사용자 액션 (setState 호출)
    │
    ▼
┌─────────────────────┐
│  setState 함수 실행  │
│  - 값 비교          │
│  - 상태 업데이트     │
│  - enqueueRender()  │
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│  enqueueRender()    │
│  - 마이크로태스크 큐 │
│  - 중복 실행 방지    │
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│  render() 함수      │
│  - visited.clear()  │
│  - reconcile()      │
│  - cleanupUnusedHooks()│
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│  reconcile()       │
│  - 인스턴스 비교     │
│  - 컴포넌트 재렌더링│
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ renderFunctionComponent()│
│  - componentStack.push()│
│  - cursor.set(0)    │
│  - component() 실행 │
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│  useState() 호출    │
│  - 기존 훅 재사용   │
│  - 업데이트된 값 반환│
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│  DOM 업데이트       │
│  - 변경된 값 반영   │
└─────────────────────┘
```

### 단계별 상세 설명

#### 1. setState 호출

```typescript
setCount(1);
// 또는
setCount(prev => prev + 1);
```

**내부 동작**:
1. 현재 훅의 값을 가져옴
2. 함수형 업데이트인 경우 이전 값을 인자로 함수 실행
3. `Object.is()`로 값 비교
4. 값이 같으면 early return (재렌더링 건너뜀)
5. 값이 다르면 상태 업데이트 및 `enqueueRender()` 호출

#### 2. enqueueRender (마이크로태스크 큐)

```typescript
export const enqueueRender = withEnqueue(render);
```

**동작 원리**:
- `withEnqueue`는 마이크로태스크 큐를 사용하여 중복 실행을 방지
- 여러 `setState` 호출이 있어도 `render`는 한 번만 실행됨
- `Promise.resolve().then(render)` 방식으로 비동기 실행

#### 3. render 함수

```typescript
export const render = (): void => {
  context.hooks.visited.clear();  // visited만 초기화
  const newInstance = reconcile(root.container, root.instance, root.node, "root");
  root.instance = newInstance;
  cleanupUnusedHooks();  // 사용되지 않은 훅 정리
};
```

**중요 사항**:
- `visited`만 초기화하고 `state`와 `cursor`는 유지
- 이는 컴포넌트가 재렌더링되어도 상태를 보존하기 위함

#### 4. reconcile 및 컴포넌트 재렌더링

```typescript
// reconcile에서 함수형 컴포넌트 업데이트
const componentPath = instance.path;  // 기존 path 유지
const componentVNode = renderFunctionComponent(nextNode.type, nextNode.props, componentPath);
```

**동작 순서**:
1. 기존 인스턴스의 path를 가져옴
2. `renderFunctionComponent` 호출하여 컴포넌트 재렌더링
3. 컴포넌트 함수 실행 중 `useState` 호출
4. `useState`는 기존 훅을 재사용하여 업데이트된 값 반환

#### 5. cleanupUnusedHooks

```typescript
export const cleanupUnusedHooks = () => {
  for (const [path, hooks] of context.hooks.state.entries()) {
    if (!context.hooks.visited.has(path)) {
      // 사용되지 않는 경로의 훅 정리
      context.hooks.state.delete(path);
      context.hooks.cursor.delete(path);
    }
  }
};
```

**동작 원리**:
- `visited`에 없는 path는 현재 렌더링에서 사용되지 않은 컴포넌트
- 해당 path의 훅 상태를 삭제하여 메모리 누수 방지

---

## 주요 문제 해결 사항

### 문제 1: 타입이 다른 컴포넌트가 같은 path를 사용하는 경우

#### 문제 상황

```
초기: [Item0, Item1, Item2, Footer]
      path: root.0.0, root.0.1, root.0.2, root.0.3

Item 개수 2로 줄임: [Item0, Item1, Footer]
      path: root.0.0, root.0.1, root.0.2 (Footer가 root.0.2로 이동)

Item 개수 4로 늘림: [Item0, Item1, Item2, Item3, Footer]
      Item3이 root.0.3 path를 사용 → Footer의 이전 상태(root.0.3)를 가져옴 ❌
```

#### 해결 방법

`reconcileChildren`에서 타입이 다를 때 path 충돌 방지:

```typescript
if (!isTypeMatch) {
  for (const oldChild of oldChildren) {
    if (oldChild && oldChild.path === childPath) {
      // 타입 정보를 포함하여 고유한 path 생성
      const typeIdentifier = `c${childVNode.type.name || "Component"}`;
      childPath = `${childPath}_${typeIdentifier}`;
      break;
    }
  }
}
```

**결과**:
- Item3: `root.0.3_cItem` (고유한 path)
- Footer: `root.0.2` (기존 path 유지)
- 상태가 섞이지 않음 ✅

### 문제 2: 타입이 다를 때 기존 path의 훅 상태가 남아있는 경우

#### 문제 상황

타입이 다른 컴포넌트로 교체될 때, 기존 path의 훅 상태가 남아있어 새 컴포넌트가 이전 상태를 가져올 수 있음

#### 해결 방법

`reconcile` 함수에서 타입이 다를 때 기존 path의 훅 상태 정리:

```typescript
const isTypeChange = instance !== null && nextNode.type !== instance.node.type;
if (isTypeChange && context.hooks.state.has(path)) {
  // 기존 path의 훅 상태를 정리
  const oldHooks = context.hooks.state.get(path);
  if (oldHooks) {
    oldHooks.forEach((hook) => {
      if (hook.type === HookTypes.EFFECT && typeof hook.destroy === "function") {
        hook.destroy();
      }
    });
  }
  context.hooks.state.delete(path);
  context.hooks.cursor.delete(path);
}
```

**결과**:
- 타입이 다른 컴포넌트로 교체될 때 기존 상태가 정리됨
- 새 컴포넌트는 깨끗한 상태로 시작 ✅

### 문제 3: 컴포넌트가 이동할 때 상태 유지

#### 문제 상황

컴포넌트가 인덱스 변경으로 이동할 때 상태를 유지해야 함

#### 해결 방법

`reconcile` 함수에서 기존 인스턴스의 path를 유지:

```typescript
if (typeof nextNode.type === "function") {
  const componentPath = instance.path;  // 기존 path 유지
  const componentVNode = renderFunctionComponent(nextNode.type, nextNode.props, componentPath);
  // ...
}
```

**결과**:
- 컴포넌트가 이동해도 같은 path를 사용하여 상태 유지 ✅

---

## 핵심 설계 원칙

### 1. Path 기반 상태 격리

- 각 컴포넌트는 고유한 path를 가짐
- 같은 path를 가진 컴포넌트는 같은 훅 배열을 공유
- 다른 path를 가진 컴포넌트는 완전히 격리된 상태를 가짐

### 2. 타입 기반 인스턴스 매칭

- 타입이 같을 때만 인스턴스를 재사용
- 타입이 다르면 새로 마운트
- 타입이 다를 때 path 충돌 방지

### 3. 상태 보존

- 컴포넌트가 재렌더링되어도 같은 path를 사용하면 상태 유지
- 컴포넌트가 이동해도 기존 path를 유지하여 상태 보존

### 4. 메모리 관리

- 사용되지 않는 컴포넌트의 훅 상태는 자동으로 정리
- `visited` Set을 사용하여 현재 렌더링에서 사용된 컴포넌트만 보존

---

## 코드 참조 위치

### 주요 파일

1. **`packages/react/src/core/hooks.ts`**
   - `useState` 구현 (38-79 라인)
   - `cleanupUnusedHooks` 구현 (13-31 라인)

2. **`packages/react/src/core/context.ts`**
   - `HooksContext` 구조 정의 (26-77 라인)
   - `currentPath`, `currentCursor`, `currentHooks` getter

3. **`packages/react/src/core/reconciler.ts`**
   - `reconcile` 함수 (26-123 라인)
   - `reconcileChildren` 함수 (151-267 라인)
   - `renderFunctionComponent` 함수 (269-285 라인)
   - `mountNode` 함수 (287-367 라인)

4. **`packages/react/src/core/render.ts`**
   - `render` 함수 (12-29 라인)
   - `enqueueRender` 함수 (34 라인)

5. **`packages/react/src/core/elements.ts`**
   - `createChildPath` 함수 (93-104 라인)

---

## 테스트 케이스 분석

### 성공한 테스트: "중첩된 컴포넌트에서 useState가 각각 독립적으로 동작한다"

#### 테스트 시나리오

```typescript
초기: [Item0, Item1, Item2, Footer]
  - Item0: path = root.0.0, count = 0
  - Item1: path = root.0.1, count = 0
  - Item2: path = root.0.2, count = 0
  - Footer: path = root.0.3, footerCount = 100

Item0.count = 1, Item1.count = 2, Footer.footerCount = 101

Item 개수 2로 줄임: [Item0, Item1, Footer]
  - Item0: path = root.0.0 (유지), count = 1 (유지) ✅
  - Item1: path = root.0.1 (유지), count = 2 (유지) ✅
  - Footer: path = root.0.2 (변경), footerCount = 101 (유지) ✅

Item 개수 4로 늘림: [Item0, Item1, Item2, Item3, Footer]
  - Item0: path = root.0.0 (유지), count = 1 (유지) ✅
  - Item1: path = root.0.1 (유지), count = 2 (유지) ✅
  - Item2: path = root.0.2_cItem (새로 생성), count = 0 (초기값) ✅
  - Item3: path = root.0.3_cItem (충돌 방지), count = 0 (초기값) ✅
  - Footer: path = root.0.2 (유지), footerCount = 101 (유지) ✅
```

#### 핵심 검증 사항

1. ✅ 각 컴포넌트의 상태가 독립적으로 동작
2. ✅ 컴포넌트가 이동해도 상태 유지
3. ✅ 새로 생성된 컴포넌트는 초기값 사용
4. ✅ 타입이 다른 컴포넌트가 같은 path를 사용해도 상태가 섞이지 않음

---

## 결론

이 구현은 React의 useState와 유사한 동작을 제공하며, 다음 핵심 기능을 구현합니다:

1. **Path 기반 상태 격리**: 각 컴포넌트의 상태를 독립적으로 관리
2. **상태 보존**: 컴포넌트 재렌더링 및 이동 시 상태 유지
3. **타입 기반 매칭**: 타입이 같을 때만 인스턴스 재사용
4. **충돌 방지**: 타입이 다른 컴포넌트가 같은 path를 사용해도 상태가 섞이지 않음
5. **메모리 관리**: 사용되지 않는 컴포넌트의 상태 자동 정리

이러한 설계를 통해 React와 유사한 상태 관리 시스템을 구현할 수 있습니다.

