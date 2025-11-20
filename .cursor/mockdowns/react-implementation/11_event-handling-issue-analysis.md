# Event Handling System Analysis and Fix

## 1. 문제 상황

애플리케이션 전체에서 `onClick`, `onKeyDown`, `onChange` 등 모든 DOM 이벤트 핸들러가 동작하지 않습니다. 브라우저 개발자 도구의 콘솔에는 아무런 에러 메시지도 출력되지 않아 디버깅이 어려운 상황입니다.

## 2. 원인 분석

핵심 파일을 분석한 결과, 문제의 원인은 커스텀 React의 이벤트 시스템 초기화 로직이 누락되었기 때문입니다.

### `events.ts` - 이벤트 위임 시스템

-   우리 React는 **이벤트 위임(Event Delegation)** 패턴을 사용합니다.
-   `addEventHandler` 함수는 실제 DOM 요소에 `addEventListener`를 호출하는 대신, 핸들러를 `elementEventStore`(WeakMap)에 저장합니다.
-   각 이벤트 타입(`click`, `keydown` 등)에 대한 단일 리스너가 **`rootContainer`** 라는 최상위 DOM 요소에 한 번만 부착됩니다.
-   이 `rootContainer`는 `setEventRoot(container)` 함수를 통해 반드시 설정되어야 합니다.

### `dom.ts` - 속성 설정 로직

-   `setDomProps`와 `updateDomProps` 함수는 `on`으로 시작하는 속성을 이벤트 핸들러로 올바르게 식별합니다.
-   식별된 핸들러는 `events.ts`의 `addEventHandler`로 전달됩니다.
-   이 부분은 정상적으로 동작하여, 메모리상의 `elementEventStore`에는 핸들러가 잘 등록되고 있습니다.

### `render.ts` - 렌더링 로직 (문제의 핵심)

-   애플리케이션 렌더링의 시작점인 `render` 함수를 확인한 결과, **`setEventRoot`를 호출하는 코드가 누락**되어 있었습니다.
-   `rootContainer`가 설정되지 않았기 때문에, `events.ts`의 리스너 부착 로직(`rootContainer.addEventListener(...)`)이 실행되지 않았습니다.
-   결론적으로, 핸들러는 메모리에 등록되었지만 어떤 이벤트도 실제로 수신 대기하고 있지 않은 상태가 된 것입니다.

## 3. 근본 원인

**`render` 함수에서 `setEventRoot`를 호출하여 이벤트 시스템의 루트 컨테이너를 설정하는 초기화 코드가 누락된 것**이 모든 이벤트가 동작하지 않는 문제의 근본 원인입니다.

## 4. 해결 방안 제안

`packages/react/src/core/render.ts`의 `render` 함수 상단에 `setEventRoot`를 호출하는 로직을 추가합니다. 이 함수는 최초 렌더링 시 한 번만 실행되면 되므로, 이미 설정되었는지 확인하는 간단한 가드를 추가하여 중복 실행을 방지합니다.

```typescript
// packages/react/src/core/render.ts

import { setEventRoot } from "./events"; // 추가

// ...

export const render = (): void => {
  const root = context.root;
  if (!root.container || !root.node) return;

  // 이벤트 루트가 설정되지 않았을 경우, 최초 한 번만 설정
  if (!context.eventRoot) {
    setEventRoot(root.container);
    context.eventRoot = root.container; // context에 플래그 저장
  }

  // ... (이하 기존 코드)
};
```
