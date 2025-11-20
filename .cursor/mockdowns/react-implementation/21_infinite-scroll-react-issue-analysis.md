# 무한 스크롤 문제 분석 - React 쪽 원인 조사

## 📋 문제 개요

무한 스크롤이 작동하지 않는 문제를 React 쪽에서 조사한 문서입니다.
app 쪽 스크롤 로직은 정상적으로 작성되어 있다고 가정하고, React의 렌더링/이펙트 시스템에서 원인을 찾습니다.

## 🔍 React 렌더링 사이클 분석

### 1. render 함수 실행 순서

**파일**: `packages/react/src/core/render.ts`

```typescript
export const render = (): void => {
  // 1. visited Set 초기화
  context.hooks.visited.clear();

  // 2. reconcile 함수 호출 (컴포넌트 렌더링)
  const newInstance = reconcile(root.container, root.instance, root.node, "root");
  root.instance = newInstance;

  // 3. 사용되지 않은 훅들을 정리
  cleanupUnusedHooks();

  // 4. 이펙트 큐 실행 (비동기)
  enqueue(flushEffects);
};
```

### 2. useEffect cleanup 실행 시점

**파일**: `packages/react/src/core/hooks.ts`

#### 시점 1: 의존성 변경 시 (Line 135-137)

```typescript
// useEffect 내부에서 의존성이 변경되었을 때
if (prevHook && prevHook.cleanup) {
  prevHook.cleanup(); // 이전 cleanup 실행
}
```

#### 시점 2: cleanupUnusedHooks에서 (Line 40-61)

```typescript
export const cleanupUnusedHooks = () => {
  for (const [path, hooks] of context.hooks.state.entries()) {
    if (!context.hooks.visited.has(path)) {
      // visited에 없는 경로의 cleanup 실행
      hooks.forEach((hook) => {
        if (hook.kind === HookTypes.EFFECT) {
          const effectHook = hook as EffectHook;
          if (effectHook.cleanup && typeof effectHook.cleanup === "function") {
            effectHook.cleanup(); // effect cleanup 실행
          }
        }
      });
      // 훅 상태 삭제
      context.hooks.state.delete(path);
      context.hooks.cursor.delete(path);
    }
  }
};
```

#### 시점 3: 컴포넌트 언마운트 시 (reconciler.ts Line 36-48)

```typescript
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
}
```

## 🐛 발견된 잠재적 문제점

### 문제 1: cleanupUnusedHooks의 실행 타이밍 ⚠️ **CRITICAL**

**위치**: `packages/react/src/core/render.ts` Line 36

**문제**:

- `cleanupUnusedHooks`가 `reconcile` 이후에 실행됨
- `reconcile` 과정에서 `visited` Set에 경로가 추가됨 (`renderFunctionComponent` Line 456)
- 하지만 **컴포넌트가 리렌더링될 때마다 `visited.clear()`가 먼저 실행됨** (Line 26)
- 만약 컴포넌트가 리렌더링되는 동안 `cleanupUnusedHooks`가 실행되면, 이전 렌더링의 경로가 `visited`에 없을 수 있음

**시나리오**:

1. 첫 렌더링: `HomePage` 컴포넌트가 마운트되고 `useEffect`가 실행되어 스크롤 리스너 등록
2. 상태 변경으로 리렌더링 발생
3. `render()` 호출:
   - `visited.clear()` 실행
   - `reconcile()` 실행 → `visited.add("root/...")` 실행
   - `cleanupUnusedHooks()` 실행
4. **문제**: 만약 `reconcile` 과정에서 경로가 제대로 추가되지 않았거나, 경로가 변경되었다면 `cleanupUnusedHooks`가 cleanup을 실행할 수 있음

**영향**:

- 컴포넌트가 실제로 언마운트되지 않았는데도 cleanup이 실행될 수 있음
- 스크롤 이벤트 리스너가 제거될 수 있음

### 문제 2: useEffect의 cleanup 실행 조건 ⚠️ **HIGH**

**위치**: `packages/react/src/core/hooks.ts` Line 134-137

**문제**:

```typescript
// 4. 이전 클린업 함수가 있으면 먼저 실행합니다.
if (prevHook && prevHook.cleanup) {
  prevHook.cleanup();
}
```

- 이 cleanup은 **의존성이 변경되었을 때만** 실행됨
- 하지만 빈 배열 `[]`의 경우 의존성이 변경되지 않으므로 이 cleanup은 실행되지 않아야 함
- **하지만** `cleanupUnusedHooks`에서 실행될 수 있음

**영향**:

- 빈 배열을 사용하는 `useEffect`의 cleanup이 예상치 못한 시점에 실행될 수 있음

### 문제 3: visited Set 관리 문제 ⚠️ **MEDIUM**

**위치**: `packages/react/src/core/render.ts` Line 26, `reconciler.ts` Line 456

**문제**:

- `render()` 시작 시 `visited.clear()` 실행
- `reconcile()` 과정에서 `renderFunctionComponent`가 호출될 때만 `visited.add(path)` 실행
- **하지만** 함수 컴포넌트가 아닌 경우 (일반 DOM 요소, Fragment 등) `visited`에 추가되지 않음
- 이는 정상이지만, 컴포넌트 경로가 변경되면 문제가 될 수 있음

**영향**:

- 경로가 변경된 컴포넌트의 cleanup이 실행될 수 있음

### 문제 4: flushEffects의 비동기 실행 ⚠️ **LOW**

**위치**: `packages/react/src/core/render.ts` Line 41

**문제**:

- `flushEffects`는 `enqueue`를 통해 비동기로 실행됨
- 이는 정상이지만, cleanup이 실행된 직후에 새로운 effect가 실행되면 문제가 될 수 있음

**영향**:

- cleanup과 effect 실행 사이의 타이밍 이슈 가능성

## 🔬 문제 진단 체크리스트

### 1단계: cleanup 실행 확인

- [ ] `cleanupUnusedHooks`가 호출되는지 확인
- [ ] `HomePage` 컴포넌트의 경로가 `visited`에 제대로 추가되는지 확인
- [ ] cleanup이 예상치 못한 시점에 실행되는지 확인

### 2단계: visited Set 관리 확인

- [ ] 컴포넌트 리렌더링 시 경로가 변경되는지 확인
- [ ] `renderFunctionComponent`가 제대로 호출되는지 확인
- [ ] `visited.add(path)`가 제대로 실행되는지 확인

### 3단계: useEffect 실행 확인

- [ ] `useEffect`가 마운트 시 실행되는지 확인
- [ ] cleanup이 언마운트 시에만 실행되는지 확인
- [ ] 의존성 배열이 빈 배열일 때 cleanup이 실행되지 않는지 확인

## 💡 해결 방안

### 해결 방안 1: cleanupUnusedHooks 실행 순서 개선

**문제**: `cleanupUnusedHooks`가 `reconcile` 이후에 실행되지만, 경로 관리에 문제가 있을 수 있음

**해결**:

- `cleanupUnusedHooks`에서 cleanup을 실행하기 전에 경로가 실제로 언마운트되었는지 확인
- 또는 cleanup 실행을 더 안전하게 처리

### 해결 방안 2: useEffect cleanup 실행 조건 개선

**문제**: cleanup이 예상치 못한 시점에 실행될 수 있음

**해결**:

- `cleanupUnusedHooks`에서 cleanup을 실행할 때, 해당 경로가 실제로 언마운트되었는지 확인
- 또는 cleanup 실행을 더 보수적으로 처리

### 해결 방안 3: visited Set 관리 개선

**문제**: 경로가 변경되면 cleanup이 실행될 수 있음

**해결**:

- 경로 변경 시 이전 경로의 cleanup을 실행하는 로직 개선
- 또는 경로 변경을 더 안전하게 처리

## 📝 우선순위별 해결 계획

### 1순위: 즉시 확인 필요 (Critical)

1. ✅ **cleanupUnusedHooks 실행 로직 확인**: visited Set 관리가 올바른지 확인
2. ✅ **useEffect cleanup 실행 조건 확인**: 빈 배열일 때 cleanup이 실행되지 않는지 확인
3. ✅ **컴포넌트 경로 변경 확인**: 리렌더링 시 경로가 변경되는지 확인

### 2순위: 중요 (High)

4. ✅ **디버깅 로그 추가**: cleanup 실행 시점과 조건을 로깅
5. ✅ **visited Set 상태 확인**: 각 렌더링 사이클에서 visited Set의 상태 확인

## 🎯 예상 결과

위 해결 방안을 적용하면:

- ✅ cleanup이 올바른 시점에만 실행됨
- ✅ 스크롤 이벤트 리스너가 유지됨
- ✅ 컴포넌트가 리렌더링되어도 cleanup이 실행되지 않음

## 📌 참고 사항

- React의 이벤트 시스템은 `window` 이벤트를 처리하지 않으므로, 네이티브 DOM API를 직접 사용해야 함
- 하지만 React의 렌더링 사이클과 동기화되어야 함
- `useEffect`의 cleanup은 컴포넌트가 실제로 언마운트될 때만 실행되어야 함
