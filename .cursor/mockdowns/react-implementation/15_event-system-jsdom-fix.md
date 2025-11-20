# 이벤트 시스템 JSDOM 호환성 수정

## 문제 상황

### 발견된 오류

1. **단위 테스트 오류**:
   - `'get target' called on an object that is not a valid instance of Event.`
   - `Illegal invocation` 오류

2. **개발 서버 오류**:
   - 카테고리 클릭 시 `Illegal invocation` 오류
   - 검색어 검색 안됨
   - 카트 버튼 클릭 안됨
   - 필터링 안됨

### 원인 분석

1. **JSDOM 호환성 문제**:
   - `Object.create(nativeEvent)`로 만든 객체가 JSDOM에서 유효한 Event 인스턴스로 인식되지 않음
   - `Object.defineProperty`로 속성을 추가하는 것이 JSDOM의 내부 검증과 충돌

2. **Illegal invocation 오류**:
   - `handler.call(current, syntheticEvent)`에서 발생
   - 또는 `e.target.getAttribute` 호출 시 `e.target`이 텍스트 노드인 경우

## 해결 방법

### 1. 네이티브 이벤트 직접 사용

```typescript
// Object.create 대신 네이티브 이벤트를 직접 사용
const syntheticEvent = nativeEvent as unknown as SyntheticEvent;

// nativeEvent 속성만 추가
Object.defineProperty(syntheticEvent, "nativeEvent", {
  value: nativeEvent,
  writable: false,
  enumerable: true,
  configurable: false,
});
```

### 2. currentTarget 처리

- 이벤트 위임 환경에서는 네이티브 이벤트의 `currentTarget`이 루트 컨테이너를 가리킴
- 각 핸들러에서 필요한 경우 `event.target`을 사용하여 현재 요소 찾기
- 또는 `closest()` 메서드 사용

### 3. Handler 호출 방식

```typescript
// handler.call 대신 직접 호출
handler(syntheticEvent);
```

## 구현 상태

### 완료된 작업

- [x] 네이티브 이벤트 직접 사용으로 변경
- [x] `nativeEvent` 속성 추가
- [x] Handler 호출 방식 변경 (`handler.call` → `handler`)
- [x] `currentTarget` 오버라이드 제거 (JSDOM 호환성)

### 테스트 필요

- [ ] 단위 테스트 통과 확인
- [ ] 개발 서버에서 이벤트 동작 확인
- [ ] 카테고리 클릭 동작 확인
- [ ] 검색 기능 동작 확인
- [ ] 카트 버튼 동작 확인
- [ ] 필터링 동작 확인

## 다음 단계

1. 테스트 실행 및 결과 확인
2. 필요시 추가 수정
3. 진행도 문서 업데이트

