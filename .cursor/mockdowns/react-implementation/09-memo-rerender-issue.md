# Memo HOC 리렌더링 문제 통합 문서

> **최종 업데이트**: 2025-01-19  
> **상태**: 진행 중 (path 문제 해결 중)

## 📋 문제 상황

### 테스트 실패
- **파일**: `packages/react/src/__tests__/advanced.hoc.test.tsx`
- **라인**: 48-50
- **에러**: `expected "spy" to be called 1 times, but got 2 times`
- **시나리오**: 동일한 props `{ value: 1 }`로 `setState`를 호출했을 때, `TestComponent`가 2번 호출됨 (예상: 1번)

### 테스트 코드
```typescript
it("props로 전달하는 값이 변경되어야 리렌더링 된다.", async () => {
  const MemoizedComponent = memo(TestComponent);
  let rerender: ({ value }: { value: number }) => void;

  function TestWrapper() {
    const [props, setProps] = useState({ value: 1 });
    rerender = setProps;
    return <MemoizedComponent {...props} />;
  }

  const container = document.createElement("div");
  setup(<TestWrapper />, container);
  await flushMicrotasks();
  expect(TestComponent).toHaveBeenCalledTimes(1); // ✅ 통과

  // 동일한 값으로 setState - 메모이제이션으로 호출되지 않아야 함
  rerender!({ value: 1 }); // ❌ 여기서 실패
  await flushMicrotasks();
  expect(TestComponent).toHaveBeenCalledTimes(1); // 예상: 1, 실제: 2
});
```

## 🔍 원인 분석 과정

### 1단계: 초기 문제 분석

#### 문제 1: useRef 초기화 문제
- `useRef<MemoState | null>(null)`로 초기화하여 `memoRef.current`가 `null`일 수 있음
- **해결 시도**: 초기값을 객체로 변경 `useRef<MemoState>({ prevProps: null, prevResult: null })`

#### 문제 2: memoRef.current 접근 에러
- **에러**: `Cannot read properties of undefined (reading 'prevProps')`
- **증상**: 무한 로딩 발생
- **해결 시도**: 방어 로직 추가 및 `context` import 추가

#### 문제 3: 객체 할당 vs 속성 수정
- `memoRef.current = { ... }` 방식이 문제일 수 있음
- **해결 시도**: 속성 직접 수정으로 변경 → 여전히 문제 발생

### 2단계: 로그 분석 결과

#### 현재 로그 출력
```
[memo] useRef 호출: {
  memoRef: { value: 1 },
  memoRefCurrent: undefined,
  prevProps: undefined,
  currentPath: 'root',
  currentCursor: 1
}
[memo] memoRef.current가 undefined - 초기화
[memo] 첫 렌더링
[memo] 컴포넌트 실행
[memo] 저장 완료: {
  prevProps: { value: 1 },
  prevResult: { ... }
}
```

**핵심 발견**: 
1. `memoRef.current`가 매번 `undefined`로 초기화되고 있습니다.
2. `currentPath: 'root'` - path가 항상 'root'로 나옵니다. 이것은 문제입니다!
3. `memo` 컴포넌트는 `TestWrapper`의 자식이므로 더 구체적인 path를 가져야 합니다.

### 3단계: 근본 원인 추정

#### 문제: memo 컴포넌트의 path가 잘못 설정됨

**핵심 문제**: `memo` 컴포넌트가 렌더링될 때 path가 'root'로 나오는 것은 `memo` 컴포넌트가 `TestWrapper`의 자식으로 렌더링되는데, path가 제대로 설정되지 않았다는 의미입니다.

**가능한 원인들**:

1. **mountNode에서 path 전달 문제**
   - `mountNode`에서 함수형 컴포넌트를 처리할 때 `renderFunctionComponent`에 `path`를 전달
   - 하지만 `memo` 컴포넌트의 경우 부모의 path를 기반으로 새로운 path를 생성해야 함
   - 현재는 부모의 path를 그대로 사용하고 있어서 문제가 발생할 수 있음

2. **renderFunctionComponent의 path 사용 문제**
   - `renderFunctionComponent`는 전달받은 `path`를 `componentStack`에 push
   - 이때 `path`가 `memo` 컴포넌트의 path가 아니라 부모의 path일 수 있음
   - `memo` 컴포넌트 내부에서 `useRef`를 호출할 때 `currentPath`가 'root'로 나오는 것은 `componentStack`의 마지막 요소가 'root'라는 의미

3. **useRef의 상태 유지 실패**
   - `useRef`는 `useState`를 사용하여 path와 cursor를 기반으로 상태를 저장
   - path가 'root'로 나오면 `memo` 컴포넌트의 상태가 제대로 격리되지 않음
   - 매번 새로운 상태를 생성하게 되어 `memoRef.current`가 `undefined`로 초기화됨

## 🔧 현재 구현 상태

### memo.ts 현재 코드
```typescript
import { useRef } from "../hooks";
import { type FunctionComponent } from "../core";
import { shallowEquals } from "../utils";
import { context } from "../core/context";

export function memo<P extends object>(Component: FunctionComponent<P>, equals = shallowEquals) {
  const MemoizedComponent: FunctionComponent<P> = (props) => {
    type MemoState = {
      prevProps: P | null;
      prevResult: ReturnType<FunctionComponent<P>> | null;
    };

    const memoRef = useRef<MemoState>({
      prevProps: null,
      prevResult: null,
    });

    // 디버깅: path와 cursor 확인
    const currentPath = context.hooks?.currentPath;
    const currentCursor = context.hooks?.currentCursor;
    
    console.log("[memo] useRef 호출:", {
      memoRef,
      memoRefCurrent: memoRef.current,
      prevProps: memoRef.current?.prevProps,
      currentPath,
      currentCursor,
    });

    // 방어 로직
    if (!memoRef.current) {
      console.log("[memo] memoRef.current가 undefined - 초기화");
      memoRef.current = {
        prevProps: null,
        prevResult: null,
      };
    }

    // props 비교
    if (memoRef.current.prevProps !== null) {
      const isEqual = equals(memoRef.current.prevProps, props);
      console.log("[memo] 비교:", {
        prevProps: memoRef.current.prevProps,
        newProps: props,
        isEqual,
      });
      if (isEqual) {
        console.log("[memo] 재사용");
        return memoRef.current.prevResult;
      }
    } else {
      console.log("[memo] 첫 렌더링");
    }

    // 컴포넌트 실행 및 저장
    console.log("[memo] 컴포넌트 실행");
    const result = Component(props);
    memoRef.current = {
      prevProps: props,
      prevResult: result,
    };
    console.log("[memo] 저장 완료:", memoRef.current);

    return result;
  };

  MemoizedComponent.displayName = `Memo(${Component.displayName || Component.name})`;
  return MemoizedComponent;
}
```

### reconciler.ts 관련 코드

#### mountNode 함수
```typescript
// 4) 함수형 컴포넌트 처리
if (typeof node.type === "function") {
  const componentVNode = renderFunctionComponent(node.type, node.props, path);
  const childInstance = reconcile(parentDom, null, componentVNode, path);
  // ...
}
```

#### renderFunctionComponent 함수
```typescript
function renderFunctionComponent(
  component: (props: VNode["props"]) => VNode | null,
  props: VNode["props"],
  path: string,
): VNode | null {
  context.hooks.componentStack.push(path);
  context.hooks.visited.add(path);
  context.hooks.cursor.set(path, 0);
  // ...
  try {
    return component(props);
  } finally {
    context.hooks.componentStack.pop();
  }
}
```

## 🎯 해결 방안

### 핵심 문제: path가 'root'로 나오는 이유

`memo` 컴포넌트가 `TestWrapper`의 자식으로 렌더링되는데, path가 'root'로 나오는 것은 `renderFunctionComponent`가 호출될 때 전달받은 `path`가 'root'라는 의미입니다.

**문제 분석**:
1. `TestWrapper`가 렌더링될 때 path는 'root.0' 같은 형태여야 함
2. `memo` 컴포넌트가 `TestWrapper`의 자식으로 렌더링될 때 path는 'root.0.0' 같은 형태여야 함
3. 하지만 로그에서는 `currentPath: 'root'`로 나오므로, `memo` 컴포넌트가 렌더링될 때 `componentStack`의 마지막 요소가 'root'임

**가능한 원인**:
- `mountNode`에서 함수형 컴포넌트를 처리할 때 `renderFunctionComponent`에 부모의 path를 전달하는데, 이 path가 'root'일 수 있음
- 또는 `memo` 컴포넌트가 렌더링될 때 `componentStack`이 제대로 설정되지 않았을 수 있음

### 해결 방안

1. **path 생성 로직 확인**
   - `memo` 컴포넌트가 렌더링될 때 올바른 path가 생성되는지 확인
   - `mountNode`에서 함수형 컴포넌트를 처리할 때 path가 제대로 전달되는지 확인

2. **renderFunctionComponent의 path 사용 확인**
   - `renderFunctionComponent`가 전달받은 `path`를 `componentStack`에 push하는 것이 맞는지 확인
   - `memo` 컴포넌트의 경우 부모의 path를 기반으로 새로운 path를 생성해야 할 수도 있음

3. **useRef의 상태 유지 확인**
   - path가 올바르게 설정되면 `useRef`의 상태가 제대로 유지될 것
   - 같은 path와 cursor에서 호출되면 같은 상태를 반환해야 함

## 📝 관련 파일

- **구현 파일**: `packages/react/src/hocs/memo.ts`
- **테스트 파일**: `packages/react/src/__tests__/advanced.hoc.test.tsx`
- **의존성 파일**:
  - `packages/react/src/hooks/useRef.ts` - useRef 구현
  - `packages/react/src/utils/equals.ts` - shallowEquals 구현
  - `packages/react/src/core/reconciler.ts` - reconciler 구현
  - `packages/react/src/core/hooks.ts` - useState 구현
  - `packages/react/src/core/context.ts` - context 구현
  - `packages/react/src/core/elements.ts` - createChildPath 구현

## 📌 핵심 이슈

### path가 'root'로 나오는 문제

**현상**: `memo` 컴포넌트가 렌더링될 때 `currentPath: 'root'`로 나옴

**원인 추정**:
1. `mountNode`에서 함수형 컴포넌트를 처리할 때 path가 제대로 전달되지 않음
2. `renderFunctionComponent`가 호출될 때 전달받은 path가 'root'임
3. `memo` 컴포넌트가 `TestWrapper`의 자식으로 렌더링되는데, path가 제대로 설정되지 않음

**확인 필요 사항**:
- `TestWrapper`가 렌더링될 때 path는 무엇인가?
- `memo` 컴포넌트가 렌더링될 때 전달되는 path는 무엇인가?
- `renderFunctionComponent`가 호출될 때 `componentStack`의 상태는 무엇인가?

## 🚀 다음 작업

1. **path 생성 로직 확인**: `memo` 컴포넌트가 렌더링될 때 올바른 path가 생성되는지 확인
2. **renderFunctionComponent 확인**: path가 제대로 전달되고 `componentStack`에 push되는지 확인
3. **useRef 상태 유지 확인**: path가 올바르게 설정되면 `useRef`의 상태가 제대로 유지되는지 확인
4. **테스트 검증**: 수정 후 테스트 실행하여 검증
5. **디버깅 로그 제거**: 문제 해결 후 디버깅 로그 제거

## 📌 변경 이력

- **2025-01-19**: 초기 문제 분석 및 여러 해결 시도
- **2025-01-19**: 로그 분석 결과 `memoRef.current`가 매번 `undefined`로 초기화되는 문제 발견
- **2025-01-19**: Path와 cursor 로그 추가하여 근본 원인 파악 진행 중
- **2025-01-19**: `context is not defined` 에러 해결 - `memo.ts`에 `context` import 추가
- **2025-01-19**: 로그 분석 결과 `currentPath: 'root'`로 나오는 문제 발견 - path 생성 로직 확인 필요
