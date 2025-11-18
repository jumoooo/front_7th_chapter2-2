# useEffect 구현 계획 및 완료 보고

## 목표 ✅

`basic.mini-react.test.tsx (1049-1069)` 테스트를 통과하기 위한 `useEffect` 훅 구현

## 완료 상태

✅ 모든 테스트 통과 (3/3)

- ✅ useEffect는 렌더 이후 비동기로 실행된다
- ✅ useEffect는 의존성이 변경될 때만 실행된다
- ✅ useEffect 클린업은 재실행과 언마운트 시 호출된다

## 테스트 요구사항 분석

### 테스트 1: "useEffect는 렌더 이후 비동기로 실행된다"

- 렌더링 중에는 "render"만 callOrder에 추가
- `flushMicrotasks()` 후에 "effect"가 추가되어야 함
- 즉, useEffect는 렌더링 후 비동기로 실행되어야 함

### 테스트 2: "useEffect는 의존성이 변경될 때만 실행된다"

- 의존성 배열이 변경될 때만 이펙트 실행
- `shallowEquals`를 사용하여 의존성 비교

### 테스트 3: "useEffect 클린업은 재실행과 언마운트 시 호출된다"

- 이펙트가 재실행될 때 이전 클린업 함수 먼저 실행
- 컴포넌트 언마운트 시 클린업 함수 실행

## 현재 구조 분석

### 1. Context 구조 (`context.ts`)

```typescript
effects: {
  queue: [], // Array<{ path: string; cursor: number }>
}
```

### 2. EffectHook 타입 (`types.ts`)

```typescript
export interface EffectHook {
  kind: HookType["EFFECT"];
  deps: unknown[] | null;
  cleanup: (() => void) | null;
  effect: () => (() => void) | void;
}
```

### 3. Render 함수 (`render.ts`)

- 렌더링 후 이펙트를 실행하는 로직이 필요함

## 구현 계획

### 1단계: useEffect 훅 구현 (`hooks.ts`)

1. **의존성 배열 비교**
   - 이전 훅이 없으면 첫 렌더링이므로 실행
   - 이전 훅이 있으면 `shallowEquals`로 의존성 비교
   - 의존성이 변경되었거나 첫 렌더링이면 실행

2. **이전 클린업 함수 실행**
   - 이전 훅의 `cleanup` 함수가 있으면 먼저 실행

3. **이펙트를 큐에 추가**
   - `context.effects.queue`에 `{ path, cursor }` 추가
   - 이펙트 함수 자체는 저장하지 않고, path와 cursor로 나중에 찾음

4. **훅 상태 저장**
   - `context.hooks.state`에 `EffectHook` 객체 저장
   - `deps`, `cleanup`, `effect` 저장

### 2단계: 이펙트 실행 로직 (`render.ts` 또는 별도 함수)

1. **렌더링 완료 후 이펙트 실행**
   - `render` 함수 끝에서 `flushEffects` 호출
   - `flushEffects`는 `context.effects.queue`를 순회하며 실행

2. **이펙트 실행**
   - `path`와 `cursor`로 훅 찾기
   - 이펙트 함수 실행
   - 클린업 함수가 반환되면 훅에 저장

3. **큐 초기화**
   - 실행 후 큐 비우기

### 3단계: 클린업 처리

1. **재실행 시 클린업**
   - `useEffect`에서 이전 클린업 함수 실행

2. **언마운트 시 클린업**
   - `cleanupUnusedHooks`에서 이미 처리됨 (확인 필요)

## 구현 순서

1. `useEffect` 함수 구현
2. `flushEffects` 함수 구현
3. `render` 함수에 `flushEffects` 호출 추가
4. 테스트 실행 및 디버깅
