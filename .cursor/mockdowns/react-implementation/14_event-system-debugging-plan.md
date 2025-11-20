# React 스타일 이벤트 시스템 전환 계획

## 1. 목표

- 현재 커스텀 React 구현의 이벤트 시스템을 **React DOM**과 동일한 철학/흐름으로 재구성
- 추후 `react-dom`으로 교체해도 사용자 코드 변경 없이 동작하도록 준비
- 브라우저 환경에서도 단위 테스트와 동일하게 안정적으로 이벤트가 동작하도록 보장

## 2. React DOM이 따르는 핵심 원칙

1. **createRoot 시점 단일 등록**  
   `ReactDOM.createRoot(container)`가 호출되면 해당 컨테이너를 이벤트 시스템에 등록하고, 이후 `root.render`는 이벤트 루트를 다시 만지지 않음.

2. **이벤트 타입 전역 레지스트리**  
   이벤트 타입이 처음 필요할 때만 네이티브 리스너를 붙이고, 이후에는 재사용. (ex. `allNativeEvents`)

3. **Synthetic Event 디스패치 파이프라인**  
   네이티브 이벤트 → Synthetic Event로 래핑 → Fiber 트리를 따라 일관된 순서로 핸들러 실행.

## 3. 현재 시스템의 문제 지점

| 항목 | 현재 동작 | React DOM과의 차이 |
| --- | --- | --- |
| 이벤트 루트 설정 | `setup`/`render` 단계에서 매번 `setEventRoot` 호출 | `createRoot`에서 한 번만 설정 |
| 리스너 부착 시점 | `setEventRoot` 시점에 `delegatedListeners`가 비어있어 아무것도 붙지 않음 | `listenToNativeEvent`가 이벤트 타입 등록과 동시에 루트에 부착 |
| 전역 레지스트리 | `delegatedListeners`만 존재, 이벤트 타입과 루트 사이 관계 관리 X | 이벤트 타입별로 어떤 루트에 리스너가 붙었는지 추적 |
| Synthetic Event | 네이티브 이벤트 직접 호출 | Synthetic Event 래핑 없음 |

## 4. 단계별 전환 계획

### 4.1 루트 라이프사이클 재정의
- `packages/react/src/client/index.ts` (`createRoot`)
  - `setEventRoot(container)` 호출 책임을 `createRoot`로 이동
  - `context.eventRoot = container` 저장 (React DOM과 동일)
- `setup`/`render`에서는 `eventRoot`를 **읽기만** 하도록 정리 (중복 설정 제거)

### 4.2 전역 이벤트 레지스트리 도입
- `events.ts`에 다음 구조 도입
  - `const registeredEvents = new Set<string>();`
  - `const rootListeners = new Map<HTMLElement, Map<string, ListenerPair>>();`
- `addEventHandler` → `registerEvent(eventName)` 호출
  - 새 이벤트 타입이면 `listenToNativeEvent(eventName, rootContainer)` 실행
  - 이미 등록된 경우 skip

### 4.3 listenToNativeEvent 유틸 구현
- React의 `listenToNativeEvent`를 참고해 다음 역할 수행
  1. 이벤트 타입별 capture/bubble 핸들러 생성
  2. 지정된 루트 컨테이너에 addEventListener 두 번 (capture/bubble)
  3. `rootListeners` 맵에 저장해 나중에 detach 가능하게 함
- 기존 `ensureDelegatedListener` + `attachToContainer` 로직을 이 함수로 대체

### 4.4 루트 변경/파괴 대응
- 새 루트가 등록되면 이전 루트에서 모든 이벤트 제거 (`rootListeners` 참조)
- `createRoot(root).unmount()` 또는 `router` 교체 시 루트 단위로 detach (React DOM과 동일 패턴)

### 4.5 Synthetic Event 스텁 추가 (선택)
- `packages/react/src/core/events.ts`에 `createSyntheticEvent` 헬퍼 추가
- `dispatchEvent`에서 네이티브 이벤트를 래핑하여 추후 React DOM drop-in 시 호환성 확보
- 초기 버전에서는 최소 필드(`target`, `currentTarget`, `nativeEvent`, `preventDefault`)만 구현하고, 확장 가능하도록 설계

## 5. 구현 순서

1. `createRoot`에서 이벤트 루트 설정 책임 이관
2. `listenToNativeEvent` 도입 및 기존 `ensureDelegatedListener` 리팩터링
3. `registerEvent` 경로 정리 (`setDomProps`/`updateDomProps` → `addEventHandler` → `registerEvent`)
4. Synthetic Event 스텁 추가 (옵션)
5. 다중 루트나 루트 재설정 시나리오 테스트

## 6. 검증 플랜

- **단위 테스트**: 기존 테스트 유지 + 이벤트 시스템 전용 테스트 추가 (루트 교체, 이벤트 중복 등록 방지 등)
- **수동 검증**: SearchBar / ProductList / CartModal 등 실제 UI 상호작용 확인
- **React DOM 호환 수용력**: `createRoot`/`render`/이벤트 등록 시그니처가 React와 동일한지 체크, drop-in 체크리스트 작성

## 7. TODO 체크리스트
- [x] `createRoot`에서 `setEventRoot` 단 한 번 호출하도록 수정
- [x] `listenToNativeEvent` / `registerEvent` 리팩터링
- [x] `rootListeners`/`registeredEvents` 전역 상태 관리
- [x] Synthetic Event 스텁 도입 (JSDOM 호환성 고려)
- [ ] 브라우저/단위 테스트로 회귀 검증

## 8. 구현 완료 상태

### 완료된 작업 (2024-12-XX)

1. **이벤트 루트 설정 책임 이관**
   - `createRoot`에서 `setEventRoot` 호출
   - `setup`에서 테스트 호환성을 위한 조건부 설정

2. **전역 이벤트 레지스트리 도입**
   - `registeredEvents`: 등록된 이벤트 타입 추적
   - `rootListeners`: 루트 컨테이너별 리스너 매핑

3. **Synthetic Event 구현**
   - 네이티브 이벤트 직접 사용 (JSDOM 호환성)
   - `nativeEvent` 속성 추가
   - `preventDefault`/`stopPropagation` 래핑

4. **JSDOM 호환성 수정**
   - `Object.create` 대신 네이티브 이벤트 직접 사용
   - Handler 호출 방식 변경 (`handler.call` → `handler`)

### 참고 문서
- `15_event-system-jsdom-fix.md`: JSDOM 호환성 수정 상세 내용
