/**
 * 이벤트 핸들러 타입
 */
type EventHandler = (event: Event) => void;

/**
 * Synthetic Event 인터페이스 (React DOM 호환)
 * 추후 react-dom으로 교체 시 호환성을 보장하기 위한 최소 스텁
 */
export interface SyntheticEvent extends Event {
  target: EventTarget | null;
  currentTarget: EventTarget | null;
  nativeEvent: Event;
  preventDefault(): void;
  stopPropagation(): void;
  isDefaultPrevented(): boolean;
  isPropagationStopped(): boolean;
}

/**
 * React DOM 스타일: 전역 이벤트 레지스트리
 * - registeredEvents: 등록된 이벤트 타입 추적
 * - rootListeners: 루트 컨테이너별 리스너 매핑 (다중 루트 지원)
 */
const registeredEvents = new Set<string>();
const rootListeners = new Map<
  HTMLElement,
  Map<
    string,
    {
      capture: (event: Event) => void;
      bubble: (event: Event) => void;
    }
  >
>();

/**
 * 개별 DOM 요소의 이벤트 핸들러 저장소
 */
const elementEventStore = new WeakMap<HTMLElement, Record<string, EventHandler>>();

/**
 * 현재 활성화된 루트 컨테이너
 */
let rootContainer: HTMLElement | null = null;

/**
 * Synthetic Event 생성 (React DOM 호환)
 * 네이티브 이벤트를 Synthetic Event로 래핑하여 React DOM과 동일한 인터페이스 제공
 *
 * JSDOM 호환성: 네이티브 이벤트를 직접 사용하되 필요한 속성만 추가
 * - target, currentTarget은 네이티브 이벤트의 것을 그대로 사용
 * - nativeEvent 속성만 추가하여 React DOM 호환성 확보
 * - currentTarget은 이벤트 위임 환경에서 루트 컨테이너를 가리키므로
 *   각 핸들러에서 필요한 경우 event.currentTarget 대신 별도로 관리
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const createSyntheticEvent = (nativeEvent: Event, currentTarget?: EventTarget | null): SyntheticEvent => {
  // preventDefault/stopPropagation 래핑을 위한 상태 추적
  let defaultPrevented = false;
  let propagationStopped = false;

  const originalPreventDefault = nativeEvent.preventDefault.bind(nativeEvent);
  const originalStopPropagation = nativeEvent.stopPropagation.bind(nativeEvent);

  // 네이티브 이벤트를 직접 사용 (JSDOM 호환성을 위해)
  // 필요한 속성만 추가하여 SyntheticEvent 인터페이스 만족
  const syntheticEvent = nativeEvent as unknown as SyntheticEvent;

  // React DOM 호환 필드 설정
  // nativeEvent는 네이티브 이벤트 참조
  Object.defineProperty(syntheticEvent, "nativeEvent", {
    value: nativeEvent,
    writable: false,
    enumerable: true,
    configurable: false,
  });

  // currentTarget은 이벤트 위임 환경에서 루트 컨테이너를 가리킴
  // 각 핸들러에서 필요한 경우 별도로 관리
  // JSDOM 호환성을 위해 네이티브 이벤트의 currentTarget을 그대로 사용

  // preventDefault/stopPropagation 래핑
  syntheticEvent.preventDefault = function () {
    defaultPrevented = true;
    originalPreventDefault();
  };

  syntheticEvent.stopPropagation = function () {
    propagationStopped = true;
    originalStopPropagation();
  };

  syntheticEvent.isDefaultPrevented = () => defaultPrevented || nativeEvent.defaultPrevented;
  syntheticEvent.isPropagationStopped = () => propagationStopped || nativeEvent.cancelBubble;

  return syntheticEvent;
};

/**
 * 루트 컨테이너에 등록된 단일 리스너가 실제 이벤트를 타겟 요소까지 전달
 * React DOM 스타일: Synthetic Event를 사용하여 일관된 이벤트 처리
 */
const dispatchEvent = (eventName: string, event: Event) => {
  // 디버깅 모드: 개발 환경에서 이벤트 디스패치 로깅
  const isDebugMode =
    typeof window !== "undefined" &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((window as any).__REACT_DEBUG_EVENTS__ || localStorage.getItem("__REACT_DEBUG_EVENTS__") === "true");

  if (isDebugMode) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const targetElement = event.target as any;
    console.log("[EventSystem] dispatchEvent called", {
      eventName,
      target: event.target,
      targetType: targetElement?.tagName || "unknown",
      rootContainer: rootContainer,
    });
  }

  if (!rootContainer) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof window !== "undefined" && (window as any).__REACT_DEBUG_EVENTS__) {
      console.warn("[EventSystem] dispatchEvent: rootContainer is null");
    }
    return;
  }

  let current: Node | null = event.target as Node | null;

  while (current) {
    // 텍스트 노드인 경우 부모 요소로 이동
    // 이벤트 핸들러는 HTMLElement에만 등록되므로 텍스트 노드는 건너뜀
    if (current.nodeType === Node.TEXT_NODE) {
      current = current.parentNode;
      continue;
    }

    if (current instanceof HTMLElement) {
      const handlers = elementEventStore.get(current);
      const handler = handlers?.[eventName];

      // 디버깅 모드: 핸들러 검색 로깅
      const isDebugMode =
        typeof window !== "undefined" &&
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ((window as any).__REACT_DEBUG_EVENTS__ || localStorage.getItem("__REACT_DEBUG_EVENTS__") === "true");

      if (isDebugMode) {
        console.log("[EventSystem] Looking for handler", {
          eventName,
          element: current,
          elementId: current.id || current.className || "no-id",
          hasHandlers: !!handlers,
          handlerKeys: handlers ? Object.keys(handlers) : [],
          hasHandler: typeof handler === "function",
        });
      }

      if (typeof handler === "function") {
        // 디버깅 모드: 핸들러 실행 로깅
        const isDebugMode =
          typeof window !== "undefined" &&
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ((window as any).__REACT_DEBUG_EVENTS__ || localStorage.getItem("__REACT_DEBUG_EVENTS__") === "true");

        if (isDebugMode) {
          console.log("[EventSystem] Executing handler", {
            eventName,
            element: current,
            elementId: (current as HTMLElement).id || (current as HTMLElement).className || "no-id",
          });
        }

        // currentTarget을 현재 요소로 설정하여 SyntheticEvent 생성 (React DOM 동작)
        const syntheticEvent = createSyntheticEvent(event, current);
        // handler를 직접 호출 (this 컨텍스트는 handler 내부에서 결정)
        // React DOM과 동일하게 syntheticEvent를 첫 번째 인자로 전달
        handler(syntheticEvent);

        // 이벤트 전파가 중단되었으면 종료
        if (syntheticEvent.isPropagationStopped() || event.cancelBubble) {
          return;
        }
      }

      // 루트 컨테이너에 도달하면 종료
      if (current === rootContainer) {
        return;
      }
    }

    current = current.parentNode;
  }
};

/**
 * React DOM 스타일: 네이티브 이벤트 리스너를 루트 컨테이너에 부착
 * 이벤트 타입이 처음 등록될 때만 호출되며, 이후에는 재사용됩니다.
 *
 * 이벤트 버블링 특성:
 * - 버블링하는 이벤트 (click, keydown 등): bubble 단계에서만 처리
 * - 버블링하지 않는 이벤트 (change, focus, blur 등): capture 단계에서만 처리
 */
const listenToNativeEvent = (eventName: string, container: HTMLElement): void => {
  // 이미 해당 루트에 리스너가 부착되어 있으면 스킵
  const containerListeners = rootListeners.get(container);
  if (containerListeners?.has(eventName)) {
    return;
  }

  // Capture 단계 리스너: 버블링하지 않는 이벤트 또는 버블링이 비활성화된 이벤트 처리
  const captureListener = (event: Event) => {
    if (event.eventPhase !== Event.CAPTURING_PHASE) {
      return;
    }
    if (event.bubbles) {
      return; // 버블링하는 이벤트는 bubble 단계에서 처리
    }
    dispatchEvent(eventName, event);
  };

  // Bubble 단계 리스너: 버블링하는 이벤트 처리
  const bubbleListener = (event: Event) => {
    if (!event.bubbles) {
      return; // 버블링하지 않는 이벤트는 capture 단계에서 처리
    }
    dispatchEvent(eventName, event);
  };

  // 리스너를 루트 컨테이너에 부착
  container.addEventListener(eventName, captureListener, true);
  container.addEventListener(eventName, bubbleListener, false);

  // 루트별 리스너 맵에 저장 (나중에 detach 가능하도록)
  if (!containerListeners) {
    rootListeners.set(container, new Map());
  }
  rootListeners.get(container)!.set(eventName, {
    capture: captureListener,
    bubble: bubbleListener,
  });
};

/**
 * React DOM 스타일: 이벤트 타입 등록
 * 이벤트 핸들러가 등록될 때 호출되며, 필요시 네이티브 리스너를 부착합니다.
 */
const registerEvent = (eventName: string): void => {
  // 이미 등록된 이벤트 타입이면 스킵
  if (registeredEvents.has(eventName)) {
    return;
  }

  // 이벤트 타입을 전역 레지스트리에 등록
  registeredEvents.add(eventName);

  // 루트 컨테이너가 설정되어 있으면 즉시 리스너 부착
  if (rootContainer) {
    listenToNativeEvent(eventName, rootContainer);
  }
};

/**
 * React DOM 스타일: 루트 컨테이너에서 모든 리스너 제거
 * 루트가 변경되거나 언마운트될 때 호출됩니다.
 */
const detachFromContainer = (container: HTMLElement): void => {
  const containerListeners = rootListeners.get(container);
  if (!containerListeners) {
    return;
  }

  // 해당 루트에 부착된 모든 리스너 제거
  containerListeners.forEach(({ capture, bubble }, eventName) => {
    container.removeEventListener(eventName, capture, true);
    container.removeEventListener(eventName, bubble, false);
  });

  // 루트별 리스너 맵에서 제거
  rootListeners.delete(container);
};

/**
 * React DOM 스타일: 기존에 등록된 모든 이벤트 리스너를 새 루트 컨테이너에 부착
 * 루트가 변경될 때 호출됩니다.
 */
const attachToContainer = (container: HTMLElement): void => {
  // 등록된 모든 이벤트 타입에 대해 리스너 부착
  registeredEvents.forEach((eventName) => {
    listenToNativeEvent(eventName, container);
  });
};

/**
 * React DOM 스타일: 이벤트 루트 컨테이너 설정
 * createRoot 시점에 단 한 번만 호출되어야 하며, 이후 render 호출 시에는 재설정하지 않습니다.
 */
export const setEventRoot = (container: HTMLElement): void => {
  // 디버깅 모드: 개발 환경에서 이벤트 시스템 상태 로깅
  // localStorage를 통해 설정 유지 (새로고침 후에도 유지)
  const isDebugMode =
    typeof window !== "undefined" &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((window as any).__REACT_DEBUG_EVENTS__ || localStorage.getItem("__REACT_DEBUG_EVENTS__") === "true");

  if (isDebugMode) {
    console.log("[EventSystem] setEventRoot called", {
      container,
      containerId: container.id || container.className || "no-id",
      registeredEventsCount: registeredEvents.size,
      registeredEvents: Array.from(registeredEvents),
      existingRootContainer: rootContainer,
    });
  }

  // 이미 같은 컨테이너가 설정되어 있으면 스킵
  if (rootContainer === container) {
    return;
  }

  // 기존 루트가 있으면 모든 리스너 제거
  if (rootContainer) {
    detachFromContainer(rootContainer);
  }

  // 새 루트 컨테이너 설정
  rootContainer = container;

  // 기존에 등록된 모든 이벤트 리스너를 새 루트에 부착
  attachToContainer(container);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof window !== "undefined" && (window as any).__REACT_DEBUG_EVENTS__) {
    console.log("[EventSystem] setEventRoot completed", {
      rootContainer,
      registeredEventsCount: registeredEvents.size,
    });
  }
};

/**
 * React DOM 스타일: 개별 DOM 요소에 이벤트 핸들러 등록
 * 이벤트 타입을 전역 레지스트리에 등록하고, 필요시 네이티브 리스너를 부착합니다.
 */
export const addEventHandler = (dom: HTMLElement, eventName: string, handler: EventHandler): void => {
  // 디버깅 모드: 개발 환경에서 이벤트 핸들러 등록 로깅
  const isDebugMode =
    typeof window !== "undefined" &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((window as any).__REACT_DEBUG_EVENTS__ || localStorage.getItem("__REACT_DEBUG_EVENTS__") === "true");

  if (isDebugMode) {
    console.log("[EventSystem] addEventHandler called", {
      dom,
      domId: dom.id || dom.className || "no-id",
      domTag: dom.tagName,
      eventName,
      hasHandler: typeof handler === "function",
      rootContainer: rootContainer,
      isRegistered: registeredEvents.has(eventName),
    });
  }

  // 이벤트 타입을 전역 레지스트리에 등록 (필요시 네이티브 리스너 부착)
  registerEvent(eventName);

  // 개별 DOM 요소에 핸들러 저장
  let handlers = elementEventStore.get(dom);
  if (!handlers) {
    handlers = {};
    elementEventStore.set(dom, handlers);
  }

  handlers[eventName] = handler;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof window !== "undefined" && (window as any).__REACT_DEBUG_EVENTS__) {
    console.log("[EventSystem] addEventHandler completed", {
      eventName,
      hasRootContainer: !!rootContainer,
    });
  }
};

/**
 * DOM 요소에 매핑된 이벤트 핸들러를 제거
 */
export const removeEventHandler = (dom: HTMLElement, eventName: string): void => {
  const handlers = elementEventStore.get(dom);
  if (!handlers) {
    return;
  }

  if (eventName in handlers) {
    delete handlers[eventName];
  }

  if (Object.keys(handlers).length === 0) {
    elementEventStore.delete(dom);
  }
};
