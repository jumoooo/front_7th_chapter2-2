# 이벤트 핸들러 등록 문제 분석

## 문제 상황

로그 분석 결과:
- **모든 요소에서 `hasHandlers: false`**: 핸들러가 전혀 등록되지 않음
- **`handlerKeys: Array(0)`**: 빈 배열 - 핸들러가 없음
- **`[DOM] updateDomProps: registering event handler` 로그 없음**: 이벤트 핸들러 등록 과정이 실행되지 않음

## 원인 분석

### 가능한 원인

1. **`setDomProps`/`updateDomProps`가 호출되지 않음**
   - 컴포넌트가 마운트/업데이트될 때 props가 전달되지 않음
   - reconcile 과정에서 props 업데이트가 누락됨

2. **이벤트 핸들러 props가 VNode에 포함되지 않음**
   - JSX 변환 과정에서 이벤트 핸들러가 props로 전달되지 않음
   - 컴포넌트 렌더링 시 props가 손실됨

3. **조건문을 통과하지 못함**
   - `key.startsWith("on")` 조건 실패
   - `typeof value === "function"` 조건 실패

## 해결 방법

### 1. 디버깅 로그 추가

`setDomProps`와 `updateDomProps`에 디버깅 로그를 추가하여:
- 함수가 호출되는지 확인
- props에 이벤트 핸들러가 포함되어 있는지 확인
- 조건문을 통과하는지 확인

### 2. 확인 사항

다음 로그들을 확인해야 합니다:

1. **`[DOM] setDomProps called`**:
   - `propsKeys`: props의 키 목록
   - `hasOnKeyDown`, `hasOnChange`, `hasOnClick`: 이벤트 핸들러 props 존재 여부

2. **`[DOM] updateDomProps called`**:
   - `prevPropsKeys`, `nextPropsKeys`: 이전/다음 props의 키 목록
   - `hasOnKeyDown`, `hasOnChange`, `hasOnClick`: 이벤트 핸들러 props 존재 여부

3. **`[DOM] updateDomProps: registering event handler`**:
   - 이벤트 핸들러가 실제로 등록되는지 확인

## 다음 단계

1. 페이지를 새로고침하고 Console 로그 확인
2. `[DOM] setDomProps called` 로그에서 props 확인
3. `[DOM] updateDomProps called` 로그에서 props 확인
4. 이벤트 핸들러 props가 있는데도 등록되지 않으면 조건문 문제
5. 이벤트 핸들러 props가 없으면 VNode 생성 과정 문제

