# 부분 이벤트 핸들링 문제 분석

## 문제 상황

### 발견된 증상

1. **작동하는 이벤트**:
   - `onClick` (장바구니 담기, product 카드 클릭)
   - `handleMainCategoryClick` (카테고리 선택)

2. **작동하지 않는 이벤트**:
   - `onKeyDown` (검색 입력)
   - `onChange` (개수, 정렬 필터링)
   - `handleBreadCrumbClick` (브레드크럼 클릭)
   - `handleSubCategoryClick` (2depth 카테고리 클릭)
   - 카트 버튼 클릭

### 패턴 분석

- **Store 관련 기능**: 작동 (장바구니 담기, product 카드 클릭)
- **a 태그**: 작동 (라우팅)
- **일부 onClick**: 작동 (handleMainCategoryClick)
- **대부분의 이벤트**: 작동 안함

## 원인 분석

### 1. 이벤트 버블링 처리 로직 문제

`listenToNativeEvent` 함수에서 이벤트 버블링 여부를 확인하는 로직이 있습니다:

```typescript
const captureListener = (event: Event) => {
  if (event.bubbles && event.eventPhase !== Event.CAPTURING_PHASE) {
    return; // 버블링하는 이벤트는 bubble 단계에서 처리
  }
  dispatchEvent(eventName, event);
};

const bubbleListener = (event: Event) => {
  if (!event.bubbles && event.eventPhase !== Event.BUBBLING_PHASE) {
    return; // 버블링하지 않는 이벤트는 capture 단계에서 처리
  }
  dispatchEvent(eventName, event);
};
```

**문제점**:
- `event.eventPhase`는 이벤트가 발생한 시점의 phase를 나타냅니다
- Capture 단계에서 발생한 이벤트는 `Event.CAPTURING_PHASE`이지만, 이벤트가 버블링하는 경우 bubble 단계에서도 발생합니다
- 하지만 `captureListener`는 capture 단계에서만 실행되고, `bubbleListener`는 bubble 단계에서만 실행됩니다
- 따라서 버블링하는 이벤트는 bubble 단계에서만 처리되어야 하는데, 현재 로직은 capture 단계에서도 처리하려고 시도합니다

### 2. 이벤트 타입별 버블링 특성

브라우저에서 이벤트 버블링 특성:
- `click`: 버블링함 ✓
- `keydown`: 버블링함 ✓
- `change`: 버블링하지 않음 ✗

### 3. 실제 문제

현재 로직의 문제:
1. **버블링하는 이벤트** (`click`, `keydown`):
   - Capture 단계: `event.bubbles === true`이고 `event.eventPhase === Event.CAPTURING_PHASE`이므로 `captureListener`에서 `dispatchEvent` 호출
   - Bubble 단계: `event.bubbles === true`이고 `event.eventPhase === Event.BUBBLING_PHASE`이므로 `bubbleListener`에서 `dispatchEvent` 호출
   - **결과**: 이벤트가 두 번 디스패치될 수 있음

2. **버블링하지 않는 이벤트** (`change`):
   - Capture 단계: `event.bubbles === false`이고 `event.eventPhase === Event.CAPTURING_PHASE`이므로 `captureListener`에서 `dispatchEvent` 호출
   - Bubble 단계: `event.bubbles === false`이므로 `bubbleListener`에서 early return
   - **결과**: 정상 작동해야 함

하지만 실제로는 `change` 이벤트가 작동하지 않는다는 것은 다른 문제가 있을 수 있습니다.

### 4. 가능한 추가 문제

1. **이벤트 등록 시점 문제**:
   - `registerEvent`가 호출될 때 `rootContainer`가 설정되어 있지 않으면 리스너가 부착되지 않음
   - 이후 `setEventRoot`가 호출되어도 이미 등록된 이벤트만 부착됨

2. **이벤트 디스패치 문제**:
   - `dispatchEvent`에서 `event.target`이 텍스트 노드인 경우 문제 발생 가능
   - `e.target.getAttribute` 호출 시 `Illegal invocation` 오류

## 해결 방법

### 1. 이벤트 버블링 처리 로직 수정

버블링하는 이벤트는 bubble 단계에서만 처리하고, 버블링하지 않는 이벤트는 capture 단계에서만 처리하도록 수정:

```typescript
const listenToNativeEvent = (eventName: string, container: HTMLElement): void => {
  // 이벤트 타입별 버블링 여부 확인
  // 브라우저에서 change, focus, blur 등은 버블링하지 않음
  const bubbles = eventName !== "change" && eventName !== "focus" && eventName !== "blur";

  if (bubbles) {
    // 버블링하는 이벤트: bubble 단계에서만 처리
    const bubbleListener = (event: Event) => {
      dispatchEvent(eventName, event);
    };
    container.addEventListener(eventName, bubbleListener, false);
    // ... 저장 로직
  } else {
    // 버블링하지 않는 이벤트: capture 단계에서만 처리
    const captureListener = (event: Event) => {
      dispatchEvent(eventName, event);
    };
    container.addEventListener(eventName, captureListener, true);
    // ... 저장 로직
  }
};
```

### 2. 이벤트 등록 시점 보장

`setEventRoot`가 호출될 때 이미 등록된 이벤트를 부착하도록 보장:

```typescript
export const setEventRoot = (container: HTMLElement): void => {
  // ... 기존 로직
  
  // 기존에 등록된 모든 이벤트 리스너를 새 루트에 부착
  attachToContainer(container);
};
```

### 3. 이벤트 타겟 처리 개선

`dispatchEvent`에서 텍스트 노드인 경우 부모 요소를 찾도록 개선:

```typescript
const dispatchEvent = (eventName: string, event: Event) => {
  if (!rootContainer) return;

  let current: Node | null = event.target as Node | null;

  while (current) {
    // 텍스트 노드인 경우 부모 요소로 이동
    if (current.nodeType === Node.TEXT_NODE) {
      current = current.parentNode;
      continue;
    }

    if (current instanceof HTMLElement) {
      // ... 핸들러 실행 로직
    }
    current = current.parentNode;
  }
};
```

## 추가 이슈 (2024-12-XX)

- 단위 테스트 `이벤트 핸들러가 올바르게 등록되고 실행된다`에서 `mouseover` 이벤트가 작동하지 않는 문제 발생
- 원인: 테스트에서 `new Event("mouseover")`를 사용할 때 기본으로 `bubbles: false`이기 때문에 bubble 단계 리스너가 호출되지 않음
- 해결: 모든 이벤트 타입에 대해 capture/bubble 리스너를 동시에 등록하고, 런타임에 `event.bubbles` 값을 확인하여 어느 단계에서 처리할지 결정
  - `event.bubbles === false`이면 capture 리스너에서 처리
  - `event.bubbles === true`이면 bubble 리스너에서 처리

## 구현 계획

1. [x] 이벤트 버블링 처리 로직 수정
2. [x] 이벤트 타입별 버블링 여부 확인 로직 추가 (런타임 판단)
3. [x] 텍스트 노드 처리 개선
4. [ ] 테스트 및 검증

## 구현 완료 (2024-12-XX)

### 수정 내용

1. **이벤트 버블링 처리 로직 개선**:
   - 버블링하는 이벤트 (`click`, `keydown` 등): bubble 단계에서만 처리
   - 버블링하지 않는 이벤트 (`change`, `focus`, `blur`): capture 단계에서만 처리
   - 이벤트 타입별로 적절한 단계에서만 리스너 부착

2. **텍스트 노드 처리 개선**:
   - `dispatchEvent`에서 텍스트 노드인 경우 부모 요소로 이동
   - 이벤트 핸들러는 HTMLElement에만 등록되므로 텍스트 노드는 건너뜀

3. **리스너 관리 개선**:
   - 모든 이벤트에 대해 capture/bubble 리스너를 동시에 등록
   - 런타임에서 `event.bubbles` 값으로 처리 단계를 결정
   - 리스너 제거 시 capture/bubble을 명확하게 해제

### 수정된 파일

- `packages/react/src/core/events.ts`:
  - `listenToNativeEvent`: 모든 이벤트에 대해 capture/bubble 리스너를 등록하고 런타임으로 처리 단계 결정
  - `dispatchEvent`: 텍스트 노드 처리 개선
  - `detachFromContainer`: capture/bubble 리스너를 명확하게 제거

## 참고

- React DOM의 이벤트 시스템은 모든 이벤트를 bubble 단계에서 처리합니다
- 하지만 `change`, `focus`, `blur` 같은 이벤트는 버블링하지 않으므로 capture 단계에서 처리해야 합니다
- 우리의 현재 구현은 이벤트 버블링 여부를 동적으로 확인하려고 하지만, 이는 복잡하고 오류가 발생하기 쉽습니다

