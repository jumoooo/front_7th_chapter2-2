# `memo` HOC 버그 수정 계획서

> **목표**: `memo` 고차 컴포넌트(HOC)가 동일한 props에 대해 불필요하게 리렌더링하는 버그를 수정합니다.

---

### 1.  문제 분석 (Problem Analysis)

- **현상**: `memo`로 감싼 컴포넌트가 내용이 동일한 새로운 props 객체를 받으면, 리렌더링을 방지해야 하지만 실제로는 리렌더링이 발생하고 있습니다.
- **테스트 실패**: `packages/react/src/__tests__/advanced.hoc.test.tsx` 파일의 `"props로 전달하는 값이 변경되어야 리렌더링 된다."` 테스트에서 `TestComponent`가 1번 호출될 것을 기대했지만 2번 호출되어 실패했습니다.
- **예상 원인**: `memo`의 props 비교 로직 또는 상태 저장 방식에 결함이 있을 것으로 추정됩니다.

### 2. 핵심 가설 (Core Hypothesis)

`memo` HOC의 props 비교 로직을 담당하는 `shallowEquals` 함수 자체는 정상적으로 구현된 것으로 보입니다.

**진짜 원인은 `memo` HOC 내부에서 사용하는 `useRef` 훅이 렌더링 간에 상태를 유지하지 못하기 때문일 가능성이 높습니다.**

`useRef`가 매번 새로운 ref 객체를 반환한다면, 이전 props를 저장할 수 없으므로 메모이제이션 로직은 항상 실패하게 됩니다. 이는 현재 테스트 실패 현상과 정확히 일치합니다.

### 3. 조사 계획 (Investigation Plan)

1.  **`useRef` 구현 분석**:
    - `packages/react/src/hooks/useRef.ts` 파일의 코드를 분석하여 `useRef`가 상태를 어떻게 저장하고 반환하는지 확인합니다.
    - `useRef`가 내부적으로 `useState` 또는 `useMemo`를 사용한다면, 해당 훅들의 구현도 함께 살펴봅니다.

2.  **`useState` 및 컨텍스트 분석**:
    - `useRef`가 의존하는 `packages/react/src/core/hooks.ts`의 `useState` 구현을 분석합니다.
    - 특히, 훅의 상태가 `core/context.ts`의 전역 컨텍스트에 컴포넌트 경로(`path`)를 기반으로 저장되는데, `MemoizedComponent`의 경로가 렌더링 간에 올바르게 유지되는지 확인해야 합니다. 경로 생성 로직에 문제가 있다면 훅 상태를 제대로 불러올 수 없습니다.

### 4. 해결 전략 (Solution Strategy)

조사 결과를 바탕으로 다음 중 하나의 전략을 실행합니다.

- **시나리오 A: `useRef` 구현 오류**
  - `useRef`가 `useState`를 잘못 사용하고 있거나, 초기값을 처리하는 로직에 문제가 있다면 수정합니다. 훅이 렌더링 사이에 항상 동일한 ref 객체를 반환하도록 보장해야 합니다.

- **시나리오 B: 훅 컨텍스트(경로) 문제**
  - HOC로 감싸진 컴포넌트의 경로가 렌더링마다 변경되는 문제가 있다면, `reconciler`나 `context`에서 컴포넌트 경로를 생성하고 관리하는 로직을 수정하여 안정적인 경로를 보장해야 합니다.

현재로서는 **시나리오 A**의 가능성이 가장 높으므로 `useRef` 구현을 수정하는 데 집중할 것입니다.

### 5. 검증 방법 (Verification Method)

- **단위 테스트**: 수정한 코드가 의도대로 동작하는지 확인하기 위해 `packages/react/src/__tests__/advanced.hoc.test.tsx`의 실패하던 테스트를 다시 실행합니다.
- **테스트 통과**: `expect(TestComponent).toHaveBeenCalledTimes(1)` 단언을 포함한 모든 관련 테스트가 통과하는 것을 최종 목표로 합니다.
