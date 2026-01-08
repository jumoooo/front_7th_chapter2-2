# React 구현 과제 문서

React의 핵심 기능을 직접 구현해보며 내부 동작 원리를 이해하기 위한 종합 가이드입니다.

## 📚 문서 구성

### [01. 구현 가이드](docs/01-implementation-guide.md)
- **함수 인터페이스**: 각 모듈별 타입 시그니처와 책임
- **수도코드**: 렌더링, 훅, 비교 로직의 전체 흐름
- **단계별 로드맵**: 기본·심화 과제에 맞춘 구현 체크포인트

### [02. 시퀀스 다이어그램](docs/02-sequence-diagrams.md)
- **기본 플로우**: 루트 초기화, 렌더, 훅 실행, Reconciliation
- **심화 플로우**: 고급 훅(useMemo/useRef/useAutoCallback)과 HOC 처리
- **시각 자료**: 주요 함수 호출 순서와 데이터 이동을 다이어그램으로 정리

### [03. 기초 지식](docs/03-fundamental-knowledge.md)
- **VNode & 경로 모델**: JSX 정규화와 key/경로 규칙
- **렌더 사이클**: 컨텍스트 초기화, 렌더 예약, 훅 정리 절차
- **리컨실리에이션 전략**: 자식 비교, anchor 계산, Fragment 다루기
- **DOM 상호작용**: 속성·스타일·이벤트 업데이트 패턴
- **Hook 컨텍스트**: 상태 저장 구조와 useState/useEffect 규칙
- **스케줄링 & 유틸**: 마이크로태스크 큐, equality 함수, memo 패턴

## 🎯 학습 목표

이 과제를 통해 다음을 이해할 수 있습니다:

- **Virtual DOM**의 동작 원리와 Reconciliation 알고리즘
- **React Hooks**의 내부 구현과 상태 관리 메커니즘
- **컴포넌트 생명주기**와 렌더링 최적화 기법
- **메모이제이션**과 **HOC** 패턴의 구현 원리
- **JavaScript 기반 DOM 조작**과 이벤트 처리 전략

## 🚀 시작하기

1. **기초 지식 학습**: [03-fundamental-knowledge.md](docs/03-fundamental-knowledge.md)로 필수 개념 정리
2. **시퀀스 이해**: [02-sequence-diagrams.md](docs/02-sequence-diagrams.md)에서 전체 호출 흐름 파악
3. **단계별 구현**: [01-implementation-guide.md](docs/01-implementation-guide.md)의 체크리스트에 따라 진행

## 📋 구현 체크리스트

### 기본과제
<img width="545" height="148" alt="image" src="https://github.com/user-attachments/assets/737156e0-d17c-48a0-9c57-d21527032f12" />

<img width="792" height="131" alt="image" src="https://github.com/user-attachments/assets/86cf5449-6623-43f4-85ca-e80e248920ee" />

#### Phase 1: VNode와 기초 유틸리티
- [x] `core/elements.ts`: `createElement`, `normalizeNode`, `createChildPath`
- [x] `utils/validators.ts`: `isEmptyValue`
- [x] `utils/equals.ts`: `shallowEquals`, `deepEquals`

#### Phase 2: 컨텍스트와 루트 초기화
- [x] `core/types.ts`: VNode/Instance/Context 타입 선언
- [x] `core/context.ts`: 루트/훅 컨텍스트와 경로 스택 관리
- [x] `core/setup.ts`: 컨테이너 초기화, 컨텍스트 리셋, 루트 렌더 트리거

#### Phase 3: DOM 인터페이스 구축
- [x] `core/dom.ts`: 속성/스타일/이벤트 적용 규칙, DOM 노드 탐색/삽입/제거

#### Phase 4: 렌더 스케줄링
- [x] `utils/enqueue.ts`: `enqueue`, `withEnqueue`로 마이크로태스크 큐 구성
- [x] `core/render.ts`: `render`, `enqueueRender`로 루트 렌더 사이클 구현

#### Phase 5: Reconciliation
- [x] `core/reconciler.ts`: 마운트/업데이트/언마운트, 자식 비교, key/anchor 처리
- [x] `core/dom.ts`: Reconciliation에서 사용할 DOM 재배치 보조 함수 확인

#### Phase 6: 기본 Hook 시스템
- [x] `core/hooks.ts`: 훅 상태 저장, `useState`, `useEffect`, cleanup/queue 관리
- [x] `core/context.ts`: 훅 커서 증가, 방문 경로 기록, 미사용 훅 정리

**기본 과제 완료 기준**: `basic.equals.test.tsx`, `basic.mini-react.test.tsx` 전부 통과

### 심화과제

#### Phase 7: 확장 Hook & HOC
- [x] `hooks/useRef.ts`: ref 객체 유지
- [x] `hooks/useMemo.ts`, `hooks/useCallback.ts`: shallow 비교 기반 메모이제이션
- [x] `hooks/useDeepMemo.ts`, `hooks/useAutoCallback.ts`: deep 비교/자동 콜백 헬퍼
- [x] `hocs/memo.ts`, `hocs/deepMemo.ts`: props 비교 기반 컴포넌트 메모이제이션

**심화 과제 완료 기준**: `advanced.hooks.test.tsx`, `advanced.hoc.test.tsx` 전부 통과

## 🧪 테스트 가이드

```bash
# 기본 과제 검증
npm test basic.equals.test.tsx
npm test basic.mini-react.test.tsx

# 심화 과제 검증
npm test advanced.hooks.test.tsx
npm test advanced.hoc.test.tsx

# 전체 테스트
npm test
```

## 💡 주요 개념

### Virtual DOM
JavaScript 객체로 표현된 가상의 DOM 트리. 실제 DOM 조작의 비용을 줄이기 위해 사용됩니다.

### Reconciliation
이전 Virtual DOM과 새로운 Virtual DOM을 비교하여 실제 DOM에 최소한의 변경만 적용하는 과정입니다.

### Hooks
함수형 컴포넌트에서 상태와 생명주기 기능을 사용할 수 있게 해주는 메커니즘입니다. 호출 순서가 보장되어야 합니다.

### 컴포넌트 패스
각 컴포넌트 인스턴스를 고유하게 식별하기 위한 경로입니다. (`"0.c0.i1.c2"` 형식)

## 🔧 디버깅 팁

### 상태 추적
```javascript
console.log('Component path:', hooks.currentPath);
console.log('Hook cursor:', hooks.currentCursor);
console.log('Current state:', hooks.currentHooks);
```

### 렌더링 추적
```javascript
console.log('Reconciling:', {
  newType: newNode?.type,
  oldType: oldInstance?.node?.type
});
```

### 의존성 비교
```javascript
console.log('Deps changed:', {
  prev: prevDeps,
  next: nextDeps,
  equal: shallowEquals(prev, next)
});
```

## 📖 참고 자료

- [React 공식 문서](https://react.dev/)
- [React Fiber Architecture](https://github.com/acdlite/react-fiber-architecture)
- [Virtual DOM and Internals](https://reactjs.org/docs/faq-internals.html)

---


## 과제 셀프회고

### 아하! 모먼트 (A-ha! Moment)

**JSX와 createElement의 관계**: 테스트 코드에 `createElement`가 없는데 어떻게 통과되는지 의문이었는데, JSX가 내부적으로 `createElement`를 자동 호출한다는 사실을 깨닫고 이마를 탁 쳤습니다. 이는 Babel이 JSX를 `createElement` 호출로 변환하는 트랜스파일 과정을 이해하는 중요한 순간이었습니다.

**VNode(청사진) vs Instance(실체)**: 처음엔 두 개념이 혼동되었으나, VNode는 설계도이고 Instance는 실제 DOM, children, key 등을 들고 있는 현장의 실체라는 개념이 잡히면서 Reconcile 로직을 정리할 수 있었습니다. 특히 `reconcile` 함수에서 기존 Instance와 새 VNode를 비교해 '버릴지, 고칠지, 새로 만들지' 판단하는 최적화 로직을 직접 구현해 본 것이 가장 큰 깨달음이었습니다.

**Hook의 전역 관리**: 지난 과제에서 상태 관리를 전역에서 해야 한다고 생각해서 뺐었는데, 실제로 React도 Context나 Hook(Map, Set 등)을 전역 컨텍스트에서 관리한다는 것을 확인하고 "내 예상이 틀리지 않았구나!" 하는 확신을 얻었습니다. Path 기반 상태 격리 시스템을 통해 각 컴포넌트의 훅 상태를 `Map<string, Hook[]>` 형태로 관리하는 구조를 이해하게 되었습니다.

**Fragment와 DOM 평탄화**: `<>`(Fragment)나 컴포넌트는 실제 DOM이 `null`이기 때문에, 왜 부모가 자식 노드를 찾을 때 'DOM 평탄화' 과정이 필요한지, 그리고 왜 `insertBefore` 같은 로직이 중요한지 화면 렌더링 순서 버그(Footer가 위로 올라가는 현상)를 고치며 깊이 이해했습니다. Fragment는 자체 DOM이 없으므로 자식들을 재조정할 때 부모 DOM을 사용해야 한다는 점을 배웠습니다.

---

### 기술적 성장

**함수형 컴포넌트의 처리**: 일반 태그와 달리 함수형 컴포넌트는 children을 직접 가지는 게 아니라, 함수 실행 결과(props 전달)를 렌더링해야 한다는 점을 테스트 실패를 통해 배웠습니다. 더 중요한 것은 함수형 컴포넌트의 자식이 부모와 독립된 고유한 경로를 가져야 한다는 점이었습니다. `reconcile` 함수에서 `createChildPath`를 사용하여 자식의 고유 경로를 생성하도록 수정하여 Path 충돌 문제를 해결했습니다.

**DOM 렌더링 순서 제어**: E2E 테스트 중 Footer, Header, Main의 순서가 뒤죽박죽 섞이는 문제가 발생했습니다. 원인은 key 기반 인스턴스 매칭은 올바르게 작동하지만, DOM 순서 재배치 로직이 누락되어 있었기 때문입니다. 역순으로 순회하여 다음 인스턴스의 첫 DOM 노드를 anchor로 사용하는 `insertBefore` 전략을 구현하여 해결했습니다. 이 과정에서 DOM 노드를 물리적으로 이동시켜야 한다는 점을 이해하게 되었습니다.

**useRef와 리렌더링**: `useRef`가 단순한 변수가 아니라, 리렌더링 되어도 버려지지 않는 '보관함'이며, 내부 값을 바꿔도 보관함 자체는 그대로라 리렌더링을 유발하지 않는다는 원리를 명확히 했습니다. `useRef`는 lazy initializer 패턴을 사용하여 최초 한 번만 초기값을 평가하고, 이후에는 같은 참조를 반환하여 값 보존과 리렌더링 방지를 동시에 달성합니다.

**이벤트 위임 패턴**: 이벤트 시스템을 구현하며 이벤트 위임(Event Delegation) 패턴을 깊이 이해하게 되었습니다. 모든 이벤트 리스너를 루트 컨테이너에 한 번만 부착하고, 실제 이벤트 발생 시 타겟 요소를 찾아 핸들러를 실행하는 방식입니다. React DOM 스타일로 `createRoot` 시점에 이벤트 루트를 설정하고, 전역 이벤트 레지스트리를 통해 이벤트 타입을 관리하는 구조를 구현했습니다.

**useEffect cleanup 실행 조건**: 무한 스크롤 기능이 작동하지 않는 문제를 디버깅하며, `useEffect`의 cleanup이 의존성 변경 없이도 실행되는 문제를 발견했습니다. cleanup은 `shouldRunEffect`가 `true`일 때만 실행되어야 하며, 의존성이 변경되지 않았으면 기존 훅을 유지하여 cleanup 함수를 보존해야 한다는 점을 배웠습니다.

**Path 기반 상태 격리**: 중첩된 컴포넌트에서 `useState`가 각각 독립적으로 동작하도록 Path 충돌을 방지하는 메커니즘을 구현했습니다. 타입이 다른 컴포넌트가 같은 path를 사용하지 않도록 타입 식별자를 추가하여 고유한 path를 생성하는 로직을 추가했습니다.

---

### 코드 품질

**만족스러운 구현**:

- **Path 충돌 방지 로직**: 타입이 다른 컴포넌트가 같은 path를 사용하지 않도록, 타입 식별자를 추가하여 고유한 path를 생성하는 로직을 구현했습니다. 이를 통해 중첩된 컴포넌트에서 `useState`가 각각 독립적으로 동작하도록 보장했습니다.

- **함수형 컴포넌트 Path 수정**: `createChildPath`를 사용하여 함수형 컴포넌트의 자식이 부모와 독립된 고유한 경로를 갖도록 수정하여 `memo` HOC가 정상적으로 동작하도록 했습니다.

**리팩토링 필요**:

- **이벤트 디버깅 도구**: 현재 `window.__REACT_DEBUG_EVENTS__` 플래그를 활용해 로그를 찍어보고 있지만, 더 체계적인 디버깅 도구가 필요할 수 있습니다. 이벤트 시스템의 상태를 시각화하거나 이벤트 흐름을 추적하는 도구가 있다면 추가해 보고 싶습니니다.

**설계 관련**:

- **학습과 구현의 분리**: AI를 활용한 학습 내용을 `.cursor/mockdowns/study` 폴더로 분리하고, 실제 구현 과정과 문제 해결 내용은 `.cursor/mockdowns/react-implementation`에서 진행하여 학습과 구현의 경계를 명확히 하려 노력했습니다. 이를 통해 추후 교육 자료로 활용할 수 있도록 구성했습니다.

---

### 학습 효과 분석

**가장 큰 배움**:

Reconcile 과정에서 기존 Instance와 새 VNode를 비교해 '버릴지, 고칠지, 새로 만들지' 판단하는 최적화 로직을 직접 구현해 본 것이 가장 컸습니다. 특히 타입이 다른 컴포넌트가 같은 path를 사용하지 않도록 Path 충돌을 방지하는 메커니즘을 구현하며, 컴포넌트 트리 구조와 상태 격리의 관계를 깊이 이해하게 되었습니다.

함수형 컴포넌트의 Path 충돌 문제를 해결하며, 각 컴포넌트가 트리 구조에 따라 고유한 경로를 부여받아야 훅 상태가 완전히 격리된다는 점을 배웠습니다. `createChildPath`를 사용하여 자식의 고유 경로를 생성하는 것이 얼마나 중요한지 깨달았습니다.

**추가 학습 필요**:

이벤트 시스템을 구현하면서 무한 스크롤 기능 등에서 이벤트가 제대로 등록/해제(cleanup)되지 않는 문제를 겪었습니다. React의 합성 이벤트(Synthetic Event)나 이벤트 위임 방식에 대해 더 깊은 학습이 필요함을 느꼈습니다. 특히 JSDOM 호환성 문제를 해결하며 네이티브 이벤트를 직접 사용하는 방식으로 수정했지만, 실제 React의 Synthetic Event 구현 방식을 더 자세히 공부하고 싶습니다.

---

