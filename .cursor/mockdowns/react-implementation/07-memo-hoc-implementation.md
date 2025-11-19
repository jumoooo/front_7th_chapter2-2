# memo HOC 구현 문서

## 📋 작업 개요

- **작업 일자**: 2025-01-19
- **작업 범위**: `packages/react/src/hocs/memo.ts` 구현
- **관련 테스트**: `packages/react/src/__tests__/advanced.hoc.test.tsx` (19-62 라인)

## 🎯 구현 목표

`memo` HOC를 구현하여 컴포넌트의 props가 변경되지 않았을 경우, 마지막 렌더링 결과를 재사용하여 리렌더링을 방지합니다.

## 📝 핵심 로직 설명

### 1. memo HOC 구조

```typescript
export function memo<P extends object>(Component: FunctionComponent<P>, equals = shallowEquals)
```

- **Component**: 메모이제이션할 컴포넌트
- **equals**: props를 비교할 함수 (기본값: `shallowEquals`)
- **반환값**: 메모이제이션이 적용된 새로운 컴포넌트

### 2. 메모이제이션 로직

```typescript
const MemoizedComponent: FunctionComponent<P> = (props) => {
  // 1. useRef로 이전 props와 렌더링 결과 저장
  const memoRef = useRef<MemoState>({
    prevProps: null,
    prevResult: null,
  });

  // 2. 이전 props와 현재 props 비교
  if (memoRef.current.prevProps !== null && equals(memoRef.current.prevProps, props)) {
    // props가 같으면 이전 렌더링 결과 재사용
    return memoRef.current.prevResult;
  }

  // 3. props가 변경되었거나 첫 렌더링인 경우 컴포넌트 실행
  const result = Component(props);
  memoRef.current = {
    prevProps: props,
    prevResult: result,
  };

  return result;
};
```

### 3. 동작 흐름

1. **첫 렌더링**: `prevProps`가 `null`이므로 컴포넌트를 실행하고 결과를 저장
2. **두 번째 렌더링**: `equals` 함수로 이전 props와 현재 props를 비교
   - **같으면**: 이전 렌더링 결과를 반환 (컴포넌트 재실행 안 함)
   - **다르면**: 컴포넌트를 실행하고 새로운 결과를 저장

## 🔍 주요 구현 포인트

### useRef를 사용한 이유

- `useRef`는 리렌더링 간에도 값을 유지하면서 리렌더링을 트리거하지 않습니다
- 이전 props와 렌더링 결과를 저장하기에 적합합니다
- `useState`를 사용하면 값 변경 시 리렌더링이 발생하므로 부적합합니다

### equals 함수의 역할

- 기본값은 `shallowEquals`로 얕은 비교를 수행합니다
- `deepMemo`는 `deepEquals`를 사용하여 깊은 비교를 수행합니다
- 사용자가 커스텀 비교 함수를 제공할 수 있습니다

## 📂 관련 파일

- **구현 파일**: `packages/react/src/hocs/memo.ts`
- **테스트 파일**: `packages/react/src/__tests__/advanced.hoc.test.tsx`
- **의존성**: `useRef` (hooks), `shallowEquals` (utils)

## ✅ 테스트 케이스

### memo 테스트

```typescript
it("props로 전달하는 값이 변경되어야 리렌더링 된다.", async () => {
  const MemoizedComponent = memo(TestComponent);
  // ...
  
  // 동일한 값으로 setState - 메모이제이션으로 호출되지 않아야 함
  rerender!({ value: 1 });
  expect(TestComponent).toHaveBeenCalledTimes(1);
  
  // 다른 값으로 setState - 새로 호출되어야 함
  rerender!({ value: 2 });
  expect(TestComponent).toHaveBeenCalledTimes(2);
});
```

## 🔗 관련 구현

### deepMemo

`deepMemo`는 `memo`를 사용하여 `deepEquals`를 전달합니다:

```typescript
export function deepMemo<P extends object>(Component: FunctionComponent<P>) {
  return memo(Component, deepEquals);
}
```

## 📌 주의사항

1. **props 비교**: `equals` 함수가 정확하게 동작해야 메모이제이션이 올바르게 작동합니다
2. **렌더링 결과 저장**: VNode를 저장하므로 참조 동일성에 주의해야 합니다
3. **첫 렌더링**: `prevProps`가 `null`인 경우를 반드시 처리해야 합니다

## 🚀 다음 단계

- [ ] 테스트 실행 및 검증
- [ ] deepMemo 관련 테스트 확인
- [ ] 성능 최적화 검토 (필요시)


