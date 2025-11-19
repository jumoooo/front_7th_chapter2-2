# 프로젝트 구조 및 Hook 시스템 정리

> **목적**: AI가 코드 작성 시 프로젝트 구조와 Hook 시스템을 참고할 수 있도록 정리한 문서

## 📁 프로젝트 구조

### 전체 구조

```
front_7th_chapter2-2/
├── packages/
│   ├── react/          # Mini-React 라이브러리 (핵심 구현)
│   └── app/            # React 애플리케이션 (사용 예제)
├── .cursor/
│   └── mockdowns/      # 구현 문서 및 학습 자료
├── docs/               # 프로젝트 문서
└── e2e/                # E2E 테스트
```

### Monorepo 구조

- **패키지 관리**: `pnpm workspace` 사용
- **루트 패키지**: `front-chapter2-2`
- **React 패키지**: `@hanghae-plus/react` (Mini-React 구현)
- **App 패키지**: `@hanghae-plus/shopping` (React 애플리케이션)

---

## 🎯 packages/react 구조

### 디렉토리 구조

```
packages/react/src/
├── core/               # 핵심 시스템 (렌더링, 재조정 등)
│   ├── constants.ts    # 상수 정의 (NodeTypes, HookTypes 등)
│   ├── context.ts      # 전역 컨텍스트 (hooks, effects, root)
│   ├── types.ts        # 타입 정의 (VNode, Instance, Context 등)
│   ├── hooks.ts        # 기본 Hook (useState, useEffect)
│   ├── reconciler.ts   # 재조정 알고리즘
│   ├── render.ts       # 렌더링 로직
│   ├── setup.ts        # 초기 설정
│   ├── dom.ts          # DOM 조작
│   └── elements.ts     # 엘리먼트 생성
├── hooks/              # 추가 Hook 구현
│   ├── index.ts        # Hook export
│   ├── types.ts        # Hook 타입 정의
│   ├── useRef.ts       # useRef 구현
│   ├── useMemo.ts      # useMemo 구현
│   ├── useCallback.ts  # useCallback 구현
│   ├── useAutoCallback.ts  # useAutoCallback 구현
│   └── useDeepMemo.ts  # useDeepMemo 구현
├── hocs/               # 고차 컴포넌트
│   ├── memo.ts         # memo HOC 구현
│   ├── deepMemo.ts     # deepMemo HOC 구현
│   └── index.ts        # HOC export
├── utils/              # 유틸리티 함수
│   ├── equals.ts       # 비교 함수 (shallowEquals, deepEquals)
│   ├── enqueue.ts      # 큐 관리
│   └── validators.ts   # 유효성 검사
├── client/             # 클라이언트 진입점
└── index.ts            # 메인 export
```

---

## 🔧 핵심 시스템

### 1. Context 시스템 (`core/context.ts`)

전역 컨텍스트는 Mini-React의 모든 런타임 데이터를 관리합니다.

```typescript
export const context: Context = {
  // 렌더링 루트 관리
  root: {
    container: HTMLElement | null,    // DOM 컨테이너
    node: VNode | null,               // 루트 VNode
    instance: Instance | null,         // 루트 인스턴스
    reset(options): void,              // 루트 초기화
  },

  // Hook 상태 관리
  hooks: {
    state: Map<string, State[]>,       // 컴포넌트별 훅 상태 배열
    cursor: Map<string, number>,      // 컴포넌트별 훅 커서 (인덱스)
    visited: Set<string>,              // 방문한 컴포넌트 경로
    componentStack: string[],         // 컴포넌트 스택 (현재 경로 추적)

    clear(): void,                     // 모든 훅 상태 초기화
    get currentPath(): string,         // 현재 컴포넌트 경로
    get currentCursor(): number,       // 현재 훅 커서
    get currentHooks(): State[],       // 현재 컴포넌트의 훅 배열
  },

  // Effect 큐 관리
  effects: {
    queue: Array<{ path: string; cursor: number }>,  // 실행할 이펙트 큐
  },
};
```

#### 핵심 개념

- **경로(Path) 기반 격리**: 각 컴포넌트는 고유한 경로를 가지며, 이를 키로 훅 상태를 격리합니다.
- **커서(Cursor) 시스템**: 컴포넌트 내에서 훅이 호출된 순서를 추적하여 올바른 훅 상태를 참조합니다.
- **컴포넌트 스택**: 중첩된 컴포넌트 렌더링 시 경로를 추적합니다.

### 2. Hook 타입 정의 (`core/types.ts`)

```typescript
// State Hook
interface StateHook {
  kind: "state";
  type?: "state";
  value: T;
}

// Effect Hook
interface EffectHook {
  kind: "effect";
  deps: unknown[] | null;
  cleanup: (() => void) | null;
  effect: () => (() => void) | void;
}
```

### 3. Hook 상수 (`core/constants.ts`)

```typescript
export const HookTypes = {
  STATE: "state",
  EFFECT: "effect",
} as const;
```

---

## 🪝 Hook 시스템 상세

### 기본 Hook (core/hooks.ts)

#### useState

```typescript
export const useState = <T>(
  initialValue: T | (() => T)
): [T, (nextValue: T | ((prev: T) => T)) => void]
```

**동작 원리**:
1. 현재 컴포넌트의 경로와 커서를 가져옵니다.
2. 해당 경로의 훅 상태 배열이 없으면 생성합니다.
3. 최초 실행 시 초기값을 평가하여 저장합니다.
4. `setState`는 이전 값을 기반으로 새 값을 계산하고, 값이 변경된 경우에만 재렌더를 요청합니다.
5. 다음 훅이 올바른 인덱스를 참조하도록 커서를 증가시킵니다.

**특징**:
- `Object.is()`를 사용하여 값 비교 (얕은 비교)
- 함수형 업데이트 지원
- Lazy initialization 지원

#### useEffect

```typescript
export const useEffect = (
  effect: () => (() => void) | void,
  deps?: unknown[]
): void
```

**동작 원리**:
1. 현재 컴포넌트의 경로와 커서를 가져옵니다.
2. 이전 훅이 없거나 의존성이 변경되었는지 확인합니다.
3. 이전 클린업 함수가 있으면 먼저 실행합니다.
4. 이펙트를 실행해야 하는 경우, 큐에 추가합니다 (렌더링 후 비동기 실행).
5. 다음 훅이 올바른 인덱스를 참조하도록 커서를 증가시킵니다.

**특징**:
- 의존성 배열 비교는 `shallowEquals` 사용
- 클린업 함수 자동 실행
- 렌더링 후 비동기 실행 (큐 시스템)

**Effect 실행 흐름**:
1. 렌더링 중: `useEffect` 호출 → 이펙트를 큐에 추가
2. 렌더링 완료 후: `flushEffects()` 호출 → 큐의 모든 이펙트 실행
3. 클린업: 컴포넌트 언마운트 또는 의존성 변경 시 이전 클린업 실행

---

### 추가 Hook (hooks/)

#### useRef

```typescript
export const useRef = <T>(initialValue: T): { current: T }
```

**구현 방식**:
- `useState`를 사용하여 ref 객체를 한 번만 생성 (lazy initialization)
- 리렌더링되어도 같은 객체 참조를 반환
- `ref.current` 값을 변경해도 리렌더링을 트리거하지 않음

**사용 예시**:
```typescript
const ref = useRef(0);
ref.current = 1; // 리렌더링 없이 값 변경
```

#### useMemo

```typescript
export const useMemo = <T>(
  factory: () => T,
  deps: DependencyList,
  equals = shallowEquals
): T
```

**구현 방식**:
- `useRef`를 사용하여 이전 계산값과 의존성 배열을 저장
- 의존성 배열 비교 (`equals` 함수 사용, 기본값: `shallowEquals`)
- 의존성이 변경되지 않으면 이전 값을 재사용

**MemoRecord 구조**:
```typescript
type MemoRecord<T> = {
  initialized: boolean;      // 초기화 여부
  value: T;                  // 메모이제이션된 값
  deps: DependencyList | null; // 의존성 배열
};
```

**동작 흐름**:
1. `memoRef.current`에서 이전 값과 의존성 확인
2. 재계산 여부 판단: `!initialized || deps === null || !equals(prevDeps, deps)`
3. 재계산 필요 시 `factory()` 실행하여 새 값 생성
4. 새 값과 의존성을 `memoRef.current`에 저장
5. 저장된 값 반환

#### useCallback

```typescript
export const useCallback = <T extends (...args: any[]) => any>(
  callback: T,
  deps: DependencyList
): T
```

**구현 방식**:
- `useMemo`를 활용하여 콜백 함수를 메모이제이션
- `useMemo(() => callback, deps)`와 동일한 동작

**사용 예시**:
```typescript
const memoizedCallback = useCallback(() => {
  doSomething(a, b);
}, [a, b]);
```

#### useAutoCallback

```typescript
export const useAutoCallback = <T extends AnyFunction>(fn: T): T
```

**구현 방식**:
- 항상 최신 상태를 참조하면서도, 함수 자체의 참조는 변경되지 않는 콜백 생성
- `useRef`로 최신 함수를 보관
- `useCallback`으로 안정적인 참조 생성 (빈 deps 배열)
- 실행 시점에 항상 `latestFnRef.current`를 호출

**특징**:
- 의존성 배열 없이 항상 최신 함수 참조
- 함수 참조는 안정적 (리렌더링되어도 변경되지 않음)
- `useCallback`의 의존성 배열 관리 문제를 해결

**사용 예시**:
```typescript
const stableCallback = useAutoCallback(() => {
  // 항상 최신 state, props를 참조
  console.log(state, props);
});
```

#### useDeepMemo

```typescript
export const useDeepMemo = <T>(
  factory: () => T,
  deps: DependencyList
): T
```

**구현 방식**:
- `useMemo`를 사용하되, `deepEquals`를 비교 함수로 사용
- 의존성 배열을 깊은 비교로 판단

**특징**:
- 중첩된 객체나 배열의 변경도 감지
- `shallowEquals`보다 느리지만 정확한 비교

---

## 🎨 고차 컴포넌트 (HOC)

### memo

```typescript
export function memo<P extends object>(
  Component: FunctionComponent<P>,
  equals = shallowEquals
): FunctionComponent<P>
```

**구현 방식**:
- `useRef`를 사용하여 이전 props와 렌더링 결과를 저장
- `equals` 함수로 props 비교 (기본값: `shallowEquals`)
- props가 변경되지 않으면 이전 렌더링 결과를 재사용

**MemoState 구조**:
```typescript
type MemoState = {
  prevProps: P | null;              // 이전 props
  prevResult: ReturnType<FunctionComponent<P>> | null;  // 이전 렌더링 결과
};
```

**동작 흐름**:
1. `memoRef.current`에서 이전 props 확인
2. 이전 props가 있고 `equals(prevProps, newProps)`가 `true`이면 이전 결과 재사용
3. props가 변경되었거나 첫 렌더링인 경우 컴포넌트 실행
4. 새 props와 결과를 `memoRef.current`에 저장

**주의사항**:
- `memoRef.current`는 `useRef`로 관리되므로 리렌더링되어도 유지됨
- `equals` 함수는 얕은 비교를 기본으로 사용 (깊은 비교가 필요하면 `deepEquals` 전달)

---

## 🔄 재조정 시스템 (Reconciliation)

### reconcile 함수 (`core/reconciler.ts`)

**주요 동작**:
1. **Unmount**: 새 노드가 `null`이면 기존 인스턴스 제거 및 이펙트 클린업 실행
2. **Mount**: 기존 인스턴스가 없거나 타입이 변경되면 새로 마운트
3. **Update**: 타입과 키가 같으면 인스턴스 업데이트

**Hook 상태 관리**:
- 컴포넌트 언마운트 시: 이펙트 클린업 함수 실행
- 타입 변경 시: 기존 경로의 훅 상태 정리
- 업데이트 시: 기존 경로의 훅 상태 유지

---

## 🛠️ 유틸리티 함수

### equals (`utils/equals.ts`)

#### shallowEquals
- 얕은 비교: 객체의 최상위 속성만 비교
- 배열의 경우 각 요소를 `Object.is()`로 비교

#### deepEquals
- 깊은 비교: 중첩된 객체와 배열까지 재귀적으로 비교
- `shallowEquals`보다 느리지만 정확한 비교

---

## 📝 Hook 사용 규칙

### 1. Hook 호출 순서
- Hook은 항상 같은 순서로 호출되어야 합니다.
- 조건문, 반복문, 중첩 함수 내에서 Hook을 호출하면 안 됩니다.

### 2. 경로 기반 격리
- 각 컴포넌트는 고유한 경로를 가지며, 이를 키로 훅 상태를 격리합니다.
- 경로는 컴포넌트 트리에서의 위치를 나타냅니다.

### 3. 커서 시스템
- 컴포넌트 내에서 훅이 호출된 순서를 추적합니다.
- 각 훅은 고정된 인덱스에 저장되며, 리렌더링 시에도 같은 인덱스를 참조합니다.

### 4. Effect 실행 타이밍
- Effect는 렌더링 후 비동기로 실행됩니다.
- 클린업 함수는 다음 Effect 실행 전 또는 컴포넌트 언마운트 시 실행됩니다.

---

## 🔍 디버깅 팁

### Hook 상태 확인
```typescript
// context.hooks.state: Map<string, State[]>
// 각 경로별 훅 상태 배열 확인
console.log(Array.from(context.hooks.state.entries()));

// 현재 컴포넌트의 훅 상태 확인
console.log(context.hooks.currentHooks);
```

### 경로 추적
```typescript
// 현재 컴포넌트 경로 확인
console.log(context.hooks.currentPath);

// 컴포넌트 스택 확인
console.log(context.hooks.componentStack);
```

### Effect 큐 확인
```typescript
// 실행 대기 중인 이펙트 확인
console.log(context.effects.queue);
```

---

## 📚 참고 자료

### 관련 문서
- `.cursor/mockdowns/react-implementation/`: 구현 상세 문서
- `.cursor/mockdowns/study/`: 학습 자료

### 테스트 파일
- `packages/react/src/__tests__/advanced.hooks.test.tsx`: Hook 테스트
- `packages/react/src/__tests__/advanced.hoc.test.tsx`: HOC 테스트

---

## ⚠️ 주의사항

1. **Hook은 컴포넌트 내부에서만 호출**: `context.hooks.currentPath`가 없으면 에러 발생
2. **의존성 배열 비교**: `shallowEquals`를 기본으로 사용하므로, 객체나 배열의 참조 변경을 감지
3. **Effect 클린업**: 컴포넌트 언마운트 시 자동으로 클린업 함수 실행
4. **메모이제이션**: `useMemo`, `useCallback`은 의존성 배열이 변경되지 않으면 이전 값을 재사용

---

## 🎯 코드 작성 시 참고사항

### Hook 구현 시
1. `context.hooks.currentPath`와 `context.hooks.currentCursor`를 사용하여 현재 컴포넌트와 훅 인덱스 확인
2. `context.hooks.state`에서 해당 경로의 훅 상태 배열 가져오기
3. 최초 실행 시 초기화, 이후 실행 시 기존 값 사용
4. 훅 사용 후 `context.hooks.cursor.set(path, cursor + 1)`로 커서 증가

### HOC 구현 시
1. `useRef`를 사용하여 이전 props와 결과 저장
2. `equals` 함수로 props 비교
3. props가 변경되지 않으면 이전 결과 재사용

### Effect 구현 시
1. 의존성 배열 비교는 `shallowEquals` 사용
2. 이펙트 실행은 큐에 추가하여 렌더링 후 비동기 실행
3. 클린업 함수는 훅에 저장하여 나중에 실행

