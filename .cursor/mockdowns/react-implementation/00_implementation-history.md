# React Implementation 전체 작업 이력

> **목적**: Mini-React 구현 과정의 전체 이력을 시간 순서대로 정리한 문서입니다.  
> **대상**: 추후 동일한 기능을 다시 구현하거나 문제를 해결할 때 참고할 수 있도록 작성되었습니다.

---

## 📋 목차

1. [1단계: 초기 핵심 기능 구현](#1단계-초기-핵심-기능-구현)
2. [2단계: Memo HOC 구현 및 디버깅](#2단계-memo-hoc-구현-및-디버깅)
3. [3단계: 이벤트 시스템 구현 및 문제 해결](#3단계-이벤트-시스템-구현-및-문제-해결)
4. [4단계: DOM 순서 문제 해결](#4단계-dom-순서-문제-해결)
5. [5단계: 무한 스크롤 문제 해결](#5단계-무한-스크롤-문제-해결)
6. [6단계: GitHub Pages 배포 설정](#6단계-github-pages-배포-설정)

---

## 1단계: 초기 핵심 기능 구현

### 1.1 Reconciliation 문제 분석 및 해결

**문서**: `01-reconciliation-issue-analysis.md`

#### 문제 상황
- 테스트 실패: 중첩된 컴포넌트에서 `useState`가 각각 독립적으로 동작하지 않음
- `item-3`이 `Footer`의 상태(101)를 가지고 있음 (기대값: 0)

#### 근본 원인
- Footer가 인덱스 변경으로 이동할 때 기존 path(`root.0.3`)를 유지해야 하지만, `reconcileChildren`에서 새 path를 생성함
- Footer의 훅 상태는 기존 path에 남아있고, Item3이 같은 path를 사용하면 Footer의 상태를 가져옴

#### 해결 방법
- `reconcileChildren`에서 타입이 다를 때 path 충돌 방지 로직 추가
- `reconcile`에서 타입이 다를 때 기존 path의 훅 상태 정리

#### 수정 파일
- `packages/react/src/core/reconciler.ts`

---

### 1.2 useState 구현 상세

**문서**: `02-useState-implementation-details.md`

#### 핵심 구조
- **Path 기반 상태 격리**: 각 컴포넌트의 고유 경로(path)를 키로 사용하여 훅 상태를 격리
- **커서(Cursor) 시스템**: 컴포넌트 내에서 훅의 호출 순서를 추적
- **상태 업데이트 플로우**: `setState` → 상태 변경 → `enqueueRender` → 비동기 렌더링

#### 주요 데이터 구조
```typescript
interface HooksContext {
  state: Map<string, State[]>;        // path별 훅 상태 배열
  cursor: Map<string, number>;        // path별 훅 커서
  visited: Set<string>;               // 현재 렌더링에서 방문한 path
  componentStack: string[];           // 컴포넌트 스택
}
```

#### Path 생성 규칙
- 루트: `"root"`
- 자식: `${parentPath}.${key ?? index}`
- 예시: `"root.0.1"`, `"root.0.1.0"`

#### 상태 업데이트 플로우
1. `useState` 호출 → 현재 path와 cursor로 훅 상태 조회/생성
2. `setState` 호출 → 상태 변경 감지 → `enqueueRender` 호출
3. `render` 실행 → `reconcile` → 컴포넌트 재렌더링
4. `cleanupUnusedHooks` → 사용되지 않은 훅 정리

---

### 1.3 useEffect 구현

**문서**: `03-useEffect-implementation-plan.md`

#### 구현 목표
- 렌더 이후 비동기로 실행
- 의존성이 변경될 때만 실행
- 클린업 함수 지원 (재실행 시, 언마운트 시)

#### 핵심 로직
1. **의존성 비교**: `shallowEquals`로 이전 deps와 현재 deps 비교
2. **이전 클린업 실행**: 의존성 변경 시 이전 클린업 함수 먼저 실행
3. **이펙트 큐에 추가**: `context.effects.queue`에 `{ path, cursor }` 추가
4. **비동기 실행**: `render` 완료 후 `flushEffects`로 실행

#### 구현 파일
- `packages/react/src/core/hooks.ts`: `useEffect` 함수
- `packages/react/src/core/hooks.ts`: `flushEffects` 함수
- `packages/react/src/core/render.ts`: `flushEffects` 호출 추가

#### 완료 상태
✅ 모든 테스트 통과 (3/3)

---

### 1.4 Fragment 업데이트 처리

**문서**: `04-fragment-update-fix.md`

#### 문제 상황
- Fragment의 조건부 자식이 업데이트될 때 제대로 처리되지 않음
- `#dynamic` 요소가 렌더링되지 않음

#### 원인
- `reconcile` 함수에서 Fragment 타입의 업데이트 처리가 누락됨

#### 해결 방법
- Fragment 업데이트 로직 추가
- Fragment는 자체 DOM이 없으므로, 자식들을 재조정할 때 부모 DOM을 사용
- `normalizeChildren`로 자식 VNode 배열 정규화
- `reconcileChildren`으로 자식 인스턴스 재조정

#### 수정 파일
- `packages/react/src/core/reconciler.ts`

---

### 1.5 Key 기반 DOM 재배치

**문서**: `05-key-based-dom-reordering.md`

#### 문제 상황
- key가 있는 자식을 재배치할 때 기존 DOM이 재사용되지만 순서가 변경되지 않음
- 기대: `[B, C, A]` 순서
- 실제: `[A, B, C]` 순서 (변경되지 않음)

#### 원인
- key 기반 매칭은 올바르게 작동하지만, DOM 순서 재배치 로직이 누락됨

#### 해결 방법
- DOM 순서 재배치 로직 추가
- **역순 순회**: 마지막 인스턴스부터 첫 번째까지 역순으로 순회
- **Anchor 사용**: 다음 인스턴스(i + 1)의 첫 DOM 노드를 anchor로 사용
- **위치 확인 및 재배치**: 현재 DOM이 올바른 위치에 있는지 확인하고, 다르면 재배치

#### 핵심 로직
```typescript
// 역순으로 순회하여 올바른 위치에 DOM 배치
for (let i = newInstances.length - 1; i >= 0; i--) {
  const currentFirstDom = getFirstDomFromChildren([instance]);
  const nextFirstDom = nextInstance ? getFirstDomFromChildren([nextInstance]) : null;
  
  if (nextFirstDom) {
    // anchor 앞에 있어야 함
    if (currentFirstDom.nextSibling !== nextFirstDom) {
      // DOM 재배치
      domNodes.forEach((node) => {
        parentDom.insertBefore(node, nextFirstDom);
      });
    }
  }
}
```

#### 수정 파일
- `packages/react/src/core/reconciler.ts`

---

### 1.6 추가 Hooks 구현

**문서**: `06-hooks-impl.md`

#### 구현된 Hooks
1. **useRef**: `useState` lazy initializer로 한 번만 생성
2. **useMemo**: 이전 deps/value를 `useRef`로 저장하여 의존성 변경 시에만 factory 재실행
3. **useCallback**: `useMemo`를 활용해 콜백 참조 메모이제이션
4. **useDeepMemo**: `deepEquals`를 이용해 깊은 비교 후 메모 제공
5. **useAutoCallback**: `useRef` + `useCallback`으로 안정된 참조에서 최신 함수 호출

#### 테스트 상태
- ✅ `useRef` 테스트 통과
- ✅ `useMemo` 테스트 통과
- ✅ `useCallback` 테스트 통과
- ✅ `useDeepMemo` 테스트 통과
- ⚠️ `useAutoCallback` 테스트는 실행 단계에서 거부됨 (IDE에서 직접 실행 권장)

---

## 2단계: Memo HOC 구현 및 디버깅

### 2.1 memo HOC 구현

**문서**: `07-memo-hoc-implementation.md`

#### 구현 목표
- 컴포넌트의 props가 변경되지 않았을 경우, 마지막 렌더링 결과를 재사용하여 리렌더링 방지

#### 핵심 로직
```typescript
const MemoizedComponent: FunctionComponent<P> = (props) => {
  const memoRef = useRef<MemoState>({
    prevProps: null,
    prevResult: null,
  });

  // 이전 props와 현재 props 비교
  if (memoRef.current.prevProps !== null && equals(memoRef.current.prevProps, props)) {
    return memoRef.current.prevResult; // 이전 결과 재사용
  }

  // props가 변경되었거나 첫 렌더링인 경우 컴포넌트 실행
  const result = Component(props);
  memoRef.current = { prevProps: props, prevResult: result };
  return result;
};
```

#### 구현 파일
- `packages/react/src/hocs/memo.ts`

---

### 2.2 memo 리렌더링 문제 디버깅

**문서**: `08-memo-rerender-debug.md`, `09-memo-rerender-issue.md`

#### 문제 상황
- 동일한 props `{ value: 1 }`로 `setState`를 호출했을 때, `TestComponent`가 2번 호출됨 (예상: 1번)
- `expected "spy" to be called 1 times, but got 2 times`

#### 원인 분석 과정
1. **1차 가설**: `useRef` 초기화 문제 → 해결 시도했으나 문제 지속
2. **2차 가설**: 훅의 `cursor`가 리렌더링 시 초기화되지 않음 → 틀림 (이미 0으로 리셋됨)
3. **최종 결론**: **경로(Path) 충돌**

#### 근본 원인
- 함수형 컴포넌트가 반환한 자식 VNode를 `reconcile` 할 때, **부모 컴포넌트의 경로를 그대로 전달**
- 부모와 자식이 동일한 `path`를 공유하게 되어 훅 상태가 충돌
- `memo` HOC의 `useRef`가 상태를 잃어버림

---

### 2.3 함수형 컴포넌트 Path 수정

**문서**: `10_function-component-path-fix.md`

#### 해결 방법
- 함수형 컴포넌트의 자식이 부모와 독립된 고유한 경로를 갖도록 수정
- `createChildPath`를 사용하여 자식의 고유 경로 생성

#### 수정 내용

**1. 컴포넌트 업데이트 로직 수정 (`reconcile` 함수)**
```typescript
// 수정 전
const childInstance = reconcile(childParentDom, existingChildInstance || null, componentVNode, componentPath);

// 수정 후
const childPath = createChildPath(componentPath, componentVNode.key ?? null, 0);
const childInstance = reconcile(childParentDom, existingChildInstance || null, componentVNode, childPath);
```

**2. 컴포넌트 마운트 로직 수정 (`mountNode` 함수)**
```typescript
// 수정 전
const childInstance = reconcile(parentDom, null, componentVNode, path);

// 수정 후
const childPath = createChildPath(path, componentVNode.key ?? null, 0);
const childInstance = reconcile(parentDom, null, componentVNode, childPath);
```

#### 수정 파일
- `packages/react/src/core/reconciler.ts`

#### 기대 효과
- 모든 컴포넌트가 트리 구조에 따라 고유한 경로를 부여받음
- 부모와 자식 간의 훅 상태 충돌 해결
- `memo` HOC가 정상적으로 동작

---

## 3단계: 이벤트 시스템 구현 및 문제 해결

### 3.1 이벤트 핸들링 문제 초기 분석

**문서**: `11_event-handling-issue-analysis.md`

#### 문제 상황
- 애플리케이션 전체에서 `onClick`, `onKeyDown`, `onChange` 등 모든 DOM 이벤트 핸들러가 동작하지 않음
- 브라우저 콘솔에 에러 메시지 없음

#### 원인 분석
- **이벤트 위임(Event Delegation)** 패턴 사용
- `addEventHandler`는 핸들러를 `elementEventStore`(WeakMap)에 저장
- 각 이벤트 타입에 대한 단일 리스너가 `rootContainer`에 부착되어야 함
- **문제**: `render` 함수에서 `setEventRoot`를 호출하는 코드가 누락됨

#### 해결 방법
- `packages/react/src/core/render.ts`의 `render` 함수 상단에 `setEventRoot` 호출 추가
- 중복 실행 방지를 위한 가드 추가

---

### 3.2 Reconciliation 로직 결함 분석

**문서**: `12_reconciliation-logic-flaw-analysis.md`

#### 문제 상황
- 이벤트 핸들러 등록 문제 해결 후에도 검색창 입력 오류, 무한 스크롤 미작동, 카트 버튼 클릭 시 모달창이 뜨지 않음

#### 원인 분석
- 함수형 컴포넌트 재조정 로직에 결함
- 함수형 컴포넌트를 먼저 실행하여 새로운 자식 VNode를 얻고, 이 VNode를 이전 인스턴스와 재조정하려고 시도
- **문제**: 부모가 리렌더링되어도 자식 컴포넌트의 함수 자체를 다시 실행하는 과정을 건너뛰게 만듦

#### 해결 방법
- `reconcile` 함수 내 함수형 컴포넌트 분기 로직 수정
- 타입이 같다면, 이전 자식 인스턴스와 컴포넌트를 새롭게 렌더링한 결과를 재귀적으로 `reconcile`

---

### 3.3 이벤트 시스템 & 재조정 로그 분석

**문서**: `13_event-and-reconcile-log-analysis.md`

#### 로그로 확인한 사실
1. **함수형 컴포넌트가 매번 새로 마운트됨**
   - 동일한 함수형 컴포넌트 경로가 첫 렌더 이후에도 계속 `decision: mount`로 남아있음
   - 부모가 상태를 갱신해도 자식 함수형 컴포넌트가 업데이트 단계로 진입하지 못함

2. **parentDom이 비어 있는 상태**
   - 동일한 DOM 컨테이너에 다시 렌더링할 때 `parentDom`이 비어 있음
   - 함수형 컴포넌트가 기존 자식 DOM을 모두 치운 뒤 새 자식을 삽입하려고 했지만, 부모 DOM을 잃어버림

#### 근본 원인
1. **이벤트 시스템 초기화 누락**: `setEventRoot`가 호출되지 않아 `rootContainer`가 `null`
2. **함수형 컴포넌트 재조정 순서 오류**: 부모 DOM을 인자로 전달하지 못하면 자식 인스턴스를 다시 DOM에 삽입할 위치를 잃어버림

#### 해결 방안
1. `setEventRoot` 보장 호출
2. 함수형 컴포넌트 재조정 순서 수정
3. 디버깅 가드 추가

---

### 3.4 React 스타일 이벤트 시스템 전환

**문서**: `14_event-system-debugging-plan.md`

#### 목표
- React DOM과 동일한 철학/흐름으로 재구성
- 추후 `react-dom`으로 교체해도 사용자 코드 변경 없이 동작하도록 준비

#### React DOM의 핵심 원칙
1. **createRoot 시점 단일 등록**: `createRoot`가 호출되면 해당 컨테이너를 이벤트 시스템에 등록
2. **이벤트 타입 전역 레지스트리**: 이벤트 타입이 처음 필요할 때만 네이티브 리스너를 붙이고, 이후에는 재사용
3. **Synthetic Event 디스패치 파이프라인**: 네이티브 이벤트 → Synthetic Event로 래핑 → 핸들러 실행

#### 전환 계획
1. **루트 라이프사이클 재정의**: `createRoot`에서 `setEventRoot` 호출 책임 이동
2. **전역 이벤트 레지스트리 도입**: `registeredEvents`, `rootListeners` 도입
3. **listenToNativeEvent 유틸 구현**: 이벤트 타입별 capture/bubble 핸들러 생성
4. **Synthetic Event 스텁 추가**: 네이티브 이벤트를 래핑하여 추후 React DOM drop-in 시 호환성 확보

#### 구현 완료 상태
- ✅ 이벤트 루트 설정 책임 이관
- ✅ 전역 이벤트 레지스트리 도입
- ✅ Synthetic Event 구현
- ✅ JSDOM 호환성 수정

---

### 3.5 JSDOM 호환성 수정

**문서**: `15_event-system-jsdom-fix.md`

#### 문제 상황
- 단위 테스트 오류: `'get target' called on an object that is not a valid instance of Event.`, `Illegal invocation`
- 개발 서버 오류: 카테고리 클릭 시 `Illegal invocation` 오류

#### 원인
- `Object.create(nativeEvent)`로 만든 객체가 JSDOM에서 유효한 Event 인스턴스로 인식되지 않음
- `handler.call(current, syntheticEvent)`에서 발생

#### 해결 방법
1. **네이티브 이벤트 직접 사용**: `Object.create` 대신 네이티브 이벤트를 직접 사용
2. **Handler 호출 방식 변경**: `handler.call` → `handler` 직접 호출
3. **currentTarget 처리**: 이벤트 위임 환경에서는 네이티브 이벤트의 `currentTarget` 사용

---

### 3.6 부분 이벤트 핸들링 문제

**문서**: `16_partial-event-handling-issue.md`

#### 문제 상황
- **작동하는 이벤트**: `onClick` (장바구니 담기, product 카드 클릭), `handleMainCategoryClick`
- **작동하지 않는 이벤트**: `onKeyDown`, `onChange`, `handleBreadCrumbClick`, `handleSubCategoryClick`, 카트 버튼 클릭

#### 원인 분석
1. **이벤트 버블링 처리 로직 문제**: `listenToNativeEvent`에서 이벤트 버블링 여부를 확인하는 로직이 잘못됨
2. **이벤트 타입별 버블링 특성**: `click`, `keydown`은 버블링함, `change`는 버블링하지 않음
3. **텍스트 노드 처리 문제**: `e.target`이 텍스트 노드인 경우 `getAttribute` 호출 시 오류 발생

#### 해결 방법
1. 이벤트 버블링 처리 로직 수정
2. 텍스트 노드 처리: `TEXT_NODE`인 경우 `parentNode`로 이동
3. `dispatchEvent`에서 `event.bubbles`와 `event.eventPhase` 확인하여 올바른 단계에서 처리

---

### 3.7 이벤트 핸들러 등록 문제

**문서**: `19_event-handler-registration-issue.md`

#### 문제 상황
- 로그 분석 결과: 모든 요소에서 `hasHandlers: false`
- `handlerKeys: Array(0)` - 빈 배열
- `[DOM] updateDomProps: registering event handler` 로그 없음

#### 원인
- `updateDomProps`에서 이벤트 핸들러를 등록하기 전에 `Object.is(prevValue, nextValue)` 체크를 먼저 수행
- 함수 참조가 같으면 이벤트 핸들러 등록 로직을 건너뜀

#### 해결 방법
- 이벤트 핸들러 처리 로직을 `Object.is` 체크 **이전**으로 이동
- 이벤트 핸들러는 항상 재등록하도록 수정

---

### 3.8 이벤트 디버깅 가이드

**문서**: `17_event-debugging-guide.md`, `18_event-debugging-step-by-step.md`

#### 디버깅 방법
1. **브라우저 콘솔에서 디버깅 모드 활성화**
   ```javascript
   window.__REACT_DEBUG_EVENTS__ = true;
   localStorage.setItem("__REACT_DEBUG_EVENTS__", "true"); // 새로고침 후에도 유지
   ```

2. **확인할 로그들**
   - `[EventSystem] setEventRoot called`
   - `[EventSystem] addEventHandler called`
   - `[EventSystem] dispatchEvent called`
   - `[EventSystem] Looking for handler`
   - `[DOM] setDomProps called`
   - `[DOM] updateDomProps: registering event handler`

3. **체크리스트**
   - `createRoot`가 호출되었는가?
   - `setEventRoot`가 호출되었는가?
   - `rootContainer`가 올바르게 설정되었는가?
   - 이벤트 핸들러가 `addEventHandler`를 통해 등록되었는가?
   - `registerEvent`가 호출되어 이벤트 타입이 등록되었는가?
   - 네이티브 이벤트 발생 시 `dispatchEvent`가 호출되는가?
   - 핸들러가 실제로 실행되는가?

---

### 3.9 클릭 이벤트 문제 분석

**문서**: `09-click-event-issue-analysis.md`

#### 문제 상황
- HomePage에서 ProductItem을 클릭하는 것 외에 다른 클릭 이벤트가 작동하지 않음

#### 발견된 문제점
1. **`setDomProps`에서 이벤트 리스너 중복 등록**: 이전 리스너를 제거하지 않고 계속 추가만 함
2. **이벤트 위임 시스템 미사용**: `addEventListener`를 직접 호출하는 대신 `addEventHandler`를 사용해야 함

#### 해결 방법
- `setDomProps`에서 `addEventListener` 직접 호출 제거
- `addEventHandler`를 사용하여 이벤트 위임 시스템에 등록

---

## 4단계: DOM 순서 문제 해결

### 4.1 DOM 순서 문제 원인 분석

**문서**: `dom-order-issue-analysis.md`, `footer-order-issue-analysis.md`

#### 문제 상황
- `PageWrapper`의 `<div>` 내부에서 `header`, `main`, `Footer` 순서로 작성했지만
- 실제 화면에서는 `Footer`, `header`, `main` 순서로 표시됨
- `Footer`를 `Toast` 아래로 옮기면 `Footer`가 맨 위로 올라가는 오류 발생

#### 원인 분석
- `reconcileChildren`에서 각 자식을 순차적으로 DOM에 삽입하지만, 재배치 로직이 올바르게 작동하지 않음
- 재배치 로직에서 `nextSibling` 비교가 정확하지 않음

#### 해결 방법
- 재배치 로직 개선
- DOM 위치 확인 로직 정확화
- 역순 순회를 사용하여 효율적으로 재배치

---

## 5단계: 무한 스크롤 문제 해결

### 5.1 무한 스크롤 문제 분석

**문서**: `20_infinite-scroll-issue-analysis.md`, `21_infinite-scroll-react-issue-analysis.md`

#### 문제 상황
- 무한 스크롤 기능이 작동하지 않음
- 스크롤을 내려도 추가 상품이 로드되지 않음

#### 원인 분석 (App 쪽)
1. **함수 참조 불일치**: `removeEventListener`에서 다른 함수 참조를 제거하려고 시도
2. **전역 변수 사용**: `scrollHandlerRegistered`가 전역 변수로 관리되어 컴포넌트 리렌더링 시 문제 발생
3. **useEffect 의존성 배열**: 빈 배열 `[]`로 인해 최신 상태를 캡처하지 못함

#### 원인 분석 (React 쪽)
1. **cleanupUnusedHooks의 실행 타이밍**: `cleanupUnusedHooks`가 `reconcile` 이후에 실행되며, `visited` Set이 먼저 초기화됨
2. **useEffect cleanup 실행 조건**: 의존성이 변경되지 않았는데도 cleanup이 실행됨

#### 해결 방법
1. **useEffect cleanup 로직 수정**: cleanup은 `shouldRunEffect`가 `true`일 때만 실행되도록 수정
2. **스크롤 핸들러 관리 개선**: `scrollHandler`를 외부 변수로 관리하여 cleanup에서 제거 가능하도록 수정

#### 수정 파일
- `packages/react/src/core/hooks.ts`: `useEffect` cleanup 로직 수정
- `packages/app/src/pages/HomePage.jsx`: 스크롤 핸들러 관리 개선

---

## 6단계: GitHub Pages 배포 설정

### 6.1 GitHub Pages 자동 배포 계획

**문서**: `22_github-pages-deployment-plan.md`

#### 목표
- GitHub Pages에 자동 배포를 설정하여 `main` 브랜치에 푸시될 때마다 자동으로 배포

#### 배포 링크
- `https://jumoooo.github.io/front_7th_chapter2-2/`

#### 현재 상태
- ✅ Base path 설정 완료 (`/front_7th_chapter2-2/`)
- ✅ 빌드 스크립트 존재
- ✅ 404 페이지 처리
- ❌ GitHub Actions 워크플로우 없음

#### 구현 내용
1. **GitHub Actions 워크플로우 생성**: `.github/workflows/deploy.yml`
2. **워크플로우 단계**:
   - 체크아웃
   - Node.js 및 pnpm 설정
   - 의존성 설치
   - 단위 테스트 실행
   - E2E 테스트 실행
   - 빌드
   - GitHub Pages 배포

#### 사용자가 해야 할 작업
1. GitHub 저장소 설정 확인
2. GitHub Pages 설정 (Settings > Pages)
3. GitHub Actions 권한 설정 (Settings > Actions > General)

---

## 📊 통합 요약

### 주요 해결된 문제들

1. **Reconciliation 문제**
   - Path 충돌 방지
   - 타입 변경 시 훅 상태 정리

2. **함수형 컴포넌트 Path 문제**
   - 부모와 자식이 동일한 path를 공유하던 문제 해결
   - `createChildPath`를 사용하여 고유 경로 생성

3. **이벤트 시스템 문제**
   - 이벤트 루트 설정 누락 해결
   - React DOM 스타일로 전환
   - JSDOM 호환성 수정
   - 이벤트 핸들러 등록 문제 해결

4. **useEffect cleanup 문제**
   - 의존성 변경 시에만 cleanup 실행하도록 수정

5. **무한 스크롤 문제**
   - useEffect cleanup 로직 수정
   - 스크롤 핸들러 관리 개선

### 핵심 아키텍처

1. **Path 기반 상태 격리**: 각 컴포넌트의 고유 경로로 훅 상태 격리
2. **이벤트 위임**: 루트 컨테이너에 단일 리스너 부착
3. **Synthetic Event**: 네이티브 이벤트를 래핑하여 React DOM 호환성 확보
4. **비동기 이펙트 실행**: 렌더링 후 마이크로태스크 큐에서 이펙트 실행

---

## 🔗 관련 문서

- **초기 구현**: `01-reconciliation-issue-analysis.md` ~ `06-hooks-impl.md`
- **Memo HOC**: `07-memo-hoc-implementation.md` ~ `10_function-component-path-fix.md`
- **이벤트 시스템**: `11_event-handling-issue-analysis.md` ~ `19_event-handler-registration-issue.md`
- **DOM 순서**: `dom-order-issue-analysis.md`, `footer-order-issue-analysis.md`
- **무한 스크롤**: `20_infinite-scroll-issue-analysis.md`, `21_infinite-scroll-react-issue-analysis.md`
- **배포**: `22_github-pages-deployment-plan.md`
- **기타**: `gemini-analysis-verification.md`, `09-click-event-issue-analysis.md`

---

## 📌 참고 사항

- 모든 구현은 **React DOM으로 교체 가능**하도록 설계됨 (규칙 17)
- 테스트 코드는 수정하지 않음 (`e2e/e2e.spec.js`, `packages/react/src/__tests__/`)
- 기존 기능은 모두 유지되어야 함

