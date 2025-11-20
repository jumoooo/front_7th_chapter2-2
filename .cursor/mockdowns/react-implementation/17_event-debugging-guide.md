# 이벤트 시스템 디버깅 가이드

> **상세한 단계별 가이드는 `18_event-debugging-step-by-step.md`를 참고하세요.**

## 문제 상황

- 단위 테스트: 통과
- 개발 서버: 이벤트 작동 안함 (검색 입력, 필터링 등)

## 디버깅 방법

### 1. 브라우저 콘솔에서 확인할 수 있는 정보

개발 서버를 실행한 후 브라우저 콘솔에서 다음을 확인하세요:

```javascript
// 1. 이벤트 루트가 설정되었는지 확인
// 콘솔에서 실행
window.__REACT_DEBUG__ = true;

// 2. 등록된 이벤트 타입 확인
// events.ts에 임시로 추가할 수 있는 디버깅 코드
```

### 2. 이벤트 시스템 상태 확인을 위한 로그 추가

다음 파일들에 디버깅 로그를 추가하여 문제를 파악할 수 있습니다:

#### 2.1 `packages/react/src/core/events.ts`에 로그 추가

```typescript
// setEventRoot 함수에 로그 추가
export const setEventRoot = (container: HTMLElement): void => {
  console.log("[EventSystem] setEventRoot called", {
    container,
    registeredEventsCount: registeredEvents.size,
    registeredEvents: Array.from(registeredEvents),
  });
  // ... 기존 코드
};

// addEventHandler 함수에 로그 추가
export const addEventHandler = (dom: HTMLElement, eventName: string, handler: EventHandler): void => {
  console.log("[EventSystem] addEventHandler called", {
    dom,
    eventName,
    hasHandler: typeof handler === "function",
    rootContainer: rootContainer,
  });
  // ... 기존 코드
};

// dispatchEvent 함수에 로그 추가
const dispatchEvent = (eventName: string, event: Event) => {
  console.log("[EventSystem] dispatchEvent called", {
    eventName,
    target: event.target,
    rootContainer: rootContainer,
  });
  // ... 기존 코드
};
```

#### 2.2 `packages/react/src/core/dom.ts`에 로그 추가

```typescript
// setDomProps 함수의 이벤트 핸들러 등록 부분에 로그 추가
if (key.startsWith("on") && typeof value === "function") {
  const eventName = key.slice(2).toLowerCase();
  console.log("[DOM] Registering event handler", {
    element: dom,
    prop: key,
    eventName,
    hasValue: typeof value === "function",
  });
  addEventHandler(dom, eventName, value);
  return;
}
```

### 3. 확인해야 할 사항

#### 3.1 이벤트 루트 설정 시점

1. `createRoot`가 호출되는 시점 확인
2. `setEventRoot`가 호출되는 시점 확인
3. `rootContainer`가 올바르게 설정되었는지 확인

#### 3.2 이벤트 등록 시점

1. `addEventHandler`가 호출되는지 확인
2. `registerEvent`가 호출되는지 확인
3. `listenToNativeEvent`가 호출되는지 확인
4. 네이티브 리스너가 실제로 부착되었는지 확인

#### 3.3 이벤트 디스패치 시점

1. 네이티브 이벤트가 발생했을 때 `dispatchEvent`가 호출되는지 확인
2. `elementEventStore`에 핸들러가 저장되어 있는지 확인
3. 핸들러가 실제로 실행되는지 확인

### 4. 브라우저 개발자 도구에서 확인

#### 4.1 Event Listeners 확인

1. 개발자 도구 → Elements 탭
2. 이벤트가 작동하지 않는 요소 선택 (예: 검색 입력 필드)
3. 우측 패널에서 "Event Listeners" 탭 확인
4. `click`, `keydown`, `change` 등의 이벤트 리스너가 부착되어 있는지 확인
5. 리스너가 루트 컨테이너에 부착되어 있는지 확인

#### 4.2 네트워크 탭 확인

- 이벤트 핸들러가 API 호출을 하는 경우, 네트워크 탭에서 요청이 발생하는지 확인

### 5. 체크리스트

다음 항목들을 순서대로 확인하세요:

- [ ] `createRoot`가 호출되었는가?
- [ ] `setEventRoot`가 호출되었는가?
- [ ] `rootContainer`가 올바르게 설정되었는가?
- [ ] 이벤트 핸들러가 `addEventHandler`를 통해 등록되었는가?
- [ ] `registerEvent`가 호출되어 이벤트 타입이 등록되었는가?
- [ ] `listenToNativeEvent`가 호출되어 네이티브 리스너가 부착되었는가?
- [ ] 네이티브 이벤트 발생 시 `dispatchEvent`가 호출되는가?
- [ ] `elementEventStore`에 핸들러가 저장되어 있는가?
- [ ] 핸들러가 실제로 실행되는가?

### 6. 예상되는 문제 시나리오

#### 시나리오 1: 이벤트 루트가 설정되지 않음

- 증상: 모든 이벤트가 작동하지 않음
- 원인: `createRoot`가 호출되지 않았거나, `setEventRoot`가 호출되지 않음
- 확인: `rootContainer`가 `null`인지 확인

#### 시나리오 2: 이벤트 타입이 등록되지 않음

- 증상: 특정 이벤트 타입만 작동하지 않음
- 원인: `registerEvent`가 호출되지 않았거나, `listenToNativeEvent`가 호출되지 않음
- 확인: `registeredEvents`에 해당 이벤트 타입이 있는지 확인

#### 시나리오 3: 네이티브 리스너가 부착되지 않음

- 증상: 이벤트 핸들러는 등록되었지만 네이티브 이벤트가 발생하지 않음
- 원인: `listenToNativeEvent`가 호출되지 않았거나, 리스너 부착이 실패함
- 확인: 브라우저 개발자 도구에서 Event Listeners 확인

#### 시나리오 4: 이벤트 디스패치가 실패함

- 증상: 네이티브 이벤트는 발생하지만 핸들러가 실행되지 않음
- 원인: `dispatchEvent`가 호출되지 않거나, `elementEventStore`에서 핸들러를 찾지 못함
- 확인: `dispatchEvent` 로그와 `elementEventStore` 내용 확인

### 7. 다음 단계

위의 디버깅 정보를 수집한 후, 결과를 공유해주시면 더 정확한 문제 분석이 가능합니다.
