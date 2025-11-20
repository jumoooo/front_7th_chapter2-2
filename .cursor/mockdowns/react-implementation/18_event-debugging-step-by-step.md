# 이벤트 시스템 디버깅 단계별 가이드

## 준비 단계

### 1. 개발 서버 실행

```bash
# 터미널에서 실행
pnpm run dev
```

### 2. 브라우저에서 디버깅 모드 활성화

1. 브라우저 개발자 도구 열기 (F12 또는 Ctrl+Shift+I)
2. **Console** 탭 선택
3. 다음 명령어 입력 후 Enter:

```javascript
window.__REACT_DEBUG_EVENTS__ = true;
```

4. 페이지 새로고침 (F5 또는 Ctrl+R)

## 확인 사항 1: 검색 입력 필드에 onKeyDown 핸들러 등록 확인

### 행위

1. 브라우저에서 개발 서버 접속 (보통 `http://localhost:5173`)
2. **Console 탭을 열어둔 상태**로 유지
3. 검색 입력 필드(상단의 "상품명을 검색해보세요..." 입력창)를 **한 번 클릭**하여 포커스
4. Console 탭에서 다음 로그를 확인:

### 확인할 로그

```
[DOM] updateDomProps: registering event handler
```

이 로그가 나타나야 하며, 다음 정보를 확인:

- `eventName: 'keydown'` ← **이것이 있어야 함**
- `prop: 'onKeyDown'` 또는 `prop: 'onkeydown'`
- `nextValue: true` (핸들러가 함수임을 의미)

### 예상 결과

- ✅ **정상**: `eventName: 'keydown'` 로그가 보임
- ❌ **문제**: `eventName: 'keydown'` 로그가 없음 → 핸들러가 등록되지 않음

### 추가 확인

로그가 나타난 후, 다음 로그도 확인:

```
[EventSystem] addEventHandler called
```

이 로그에서도 `eventName: 'keydown'`이 있어야 함

---

## 확인 사항 2: Select 요소에 onChange 핸들러 등록 확인

### 행위

1. Console 탭을 열어둔 상태로 유지
2. 페이지 하단의 **"개수"** 드롭다운(select)을 **한 번 클릭**
3. Console 탭에서 다음 로그를 확인:

### 확인할 로그

```
[DOM] updateDomProps: registering event handler
```

이 로그가 나타나야 하며, 다음 정보를 확인:

- `eventName: 'change'` ← **이것이 있어야 함**
- `prop: 'onChange'` 또는 `prop: 'onchange'`
- `nextValue: true`

### 예상 결과

- ✅ **정상**: `eventName: 'change'` 로그가 보임
- ❌ **문제**: `eventName: 'change'` 로그가 없음 → 핸들러가 등록되지 않음

### 추가 확인

로그가 나타난 후, 다음 로그도 확인:

```
[EventSystem] addEventHandler called
```

이 로그에서도 `eventName: 'change'`가 있어야 함

---

## 확인 사항 3: dispatchEvent에서 핸들러를 찾는 과정 확인

### 행위 1: 검색 입력 필드에서 키 입력

1. Console 탭을 열어둔 상태로 유지
2. 검색 입력 필드 클릭하여 포커스
3. 키보드에서 **아무 키나 한 번 입력** (예: 'a' 입력)
4. Console 탭에서 다음 로그들을 순서대로 확인:

### 확인할 로그 순서

1. **첫 번째 로그**:

```
[EventSystem] dispatchEvent called
```

- `eventName: 'keydown'` 확인
- `targetType: 'INPUT'` 확인

2. **두 번째 로그** (핸들러 검색):

```
[EventSystem] Looking for handler
```

이 로그에서 다음 정보 확인:

- `eventName: 'keydown'` ← 확인
- `elementId`: 입력 필드의 ID 또는 클래스명
- `hasHandlers`: `true` 또는 `false` ← **true여야 함**
- `handlerKeys`: 배열 형태 (예: `['keydown']`) ← **'keydown'이 포함되어야 함**
- `hasHandler`: `true` 또는 `false` ← **true여야 함**

3. **세 번째 로그** (핸들러 실행):

```
[EventSystem] Executing handler
```

- 이 로그가 나타나면 핸들러가 실행된 것
- 이 로그가 없으면 핸들러가 실행되지 않은 것

### 예상 결과

- ✅ **정상**:
  - `hasHandlers: true`
  - `handlerKeys`에 `'keydown'` 포함
  - `hasHandler: true`
  - `[EventSystem] Executing handler` 로그 나타남
- ❌ **문제**:
  - `hasHandlers: false` → 핸들러가 등록되지 않음
  - `handlerKeys`에 `'keydown'` 없음 → 핸들러가 등록되지 않음
  - `hasHandler: false` → 핸들러를 찾지 못함
  - `[EventSystem] Executing handler` 로그 없음 → 핸들러가 실행되지 않음

### 행위 2: Select 요소에서 옵션 변경

1. Console 탭을 열어둔 상태로 유지
2. "개수" 드롭다운 클릭
3. 다른 옵션 선택 (예: 10개 → 20개)
4. Console 탭에서 다음 로그들을 순서대로 확인:

### 확인할 로그 순서

1. **첫 번째 로그**:

```
[EventSystem] dispatchEvent called
```

- `eventName: 'change'` 확인
- `targetType: 'SELECT'` 확인

2. **두 번째 로그** (핸들러 검색):

```
[EventSystem] Looking for handler
```

이 로그에서 다음 정보 확인:

- `eventName: 'change'` ← 확인
- `elementId`: select 요소의 ID 또는 클래스명
- `hasHandlers`: `true` 또는 `false` ← **true여야 함**
- `handlerKeys`: 배열 형태 (예: `['change']`) ← **'change'가 포함되어야 함**
- `hasHandler`: `true` 또는 `false` ← **true여야 함**

3. **세 번째 로그** (핸들러 실행):

```
[EventSystem] Executing handler
```

- 이 로그가 나타나면 핸들러가 실행된 것

### 예상 결과

- ✅ **정상**:
  - `hasHandlers: true`
  - `handlerKeys`에 `'change'` 포함
  - `hasHandler: true`
  - `[EventSystem] Executing handler` 로그 나타남
- ❌ **문제**:
  - `hasHandlers: false` → 핸들러가 등록되지 않음
  - `handlerKeys`에 `'change'` 없음 → 핸들러가 등록되지 않음
  - `hasHandler: false` → 핸들러를 찾지 못함
  - `[EventSystem] Executing handler` 로그 없음 → 핸들러가 실행되지 않음

---

## 전체 테스트 시나리오

### 시나리오 1: 검색 입력 필드 테스트

1. 페이지 로드 후 Console 탭 열기
2. `window.__REACT_DEBUG_EVENTS__ = true;` 실행
3. 페이지 새로고침
4. 검색 입력 필드 클릭
5. Console에서 `[DOM] updateDomProps: registering event handler` 로그 확인 (keydown)
6. 검색 입력 필드에 'a' 입력
7. Console에서 `[EventSystem] dispatchEvent called` 로그 확인 (keydown)
8. Console에서 `[EventSystem] Looking for handler` 로그 확인
9. Console에서 `[EventSystem] Executing handler` 로그 확인

### 시나리오 2: Select 요소 테스트

1. 페이지 로드 후 Console 탭 열기
2. `window.__REACT_DEBUG_EVENTS__ = true;` 실행
3. 페이지 새로고침
4. "개수" 드롭다운 클릭
5. Console에서 `[DOM] updateDomProps: registering event handler` 로그 확인 (change)
6. 다른 옵션 선택 (예: 20개)
7. Console에서 `[EventSystem] dispatchEvent called` 로그 확인 (change)
8. Console에서 `[EventSystem] Looking for handler` 로그 확인
9. Console에서 `[EventSystem] Executing handler` 로그 확인

### 시나리오 3: 카트 버튼 클릭 테스트

1. 페이지 로드 후 Console 탭 열기
2. `window.__REACT_DEBUG_EVENTS__ = true;` 실행
3. 페이지 새로고침
4. 우측 상단의 카트 아이콘 버튼 클릭
5. Console에서 `[EventSystem] dispatchEvent called` 로그 확인 (click)
6. Console에서 `[EventSystem] Looking for handler` 로그 확인
7. Console에서 `[EventSystem] Executing handler` 로그 확인

---

## 로그 해석 가이드

### 정상적인 흐름

```
1. [DOM] updateDomProps: registering event handler { eventName: 'keydown', ... }
2. [EventSystem] addEventHandler called { eventName: 'keydown', ... }
3. [EventSystem] addEventHandler completed { eventName: 'keydown', ... }
4. (사용자가 키 입력)
5. [EventSystem] dispatchEvent called { eventName: 'keydown', ... }
6. [EventSystem] Looking for handler { hasHandlers: true, handlerKeys: ['keydown'], hasHandler: true }
7. [EventSystem] Executing handler { eventName: 'keydown', ... }
```

### 문제가 있는 흐름 (핸들러 미등록)

```
1. (updateDomProps 로그 없음)
2. (addEventHandler 로그 없음)
3. (사용자가 키 입력)
4. [EventSystem] dispatchEvent called { eventName: 'keydown', ... }
5. [EventSystem] Looking for handler { hasHandlers: false, handlerKeys: [], hasHandler: false }
6. (Executing handler 로그 없음)
```

### 문제가 있는 흐름 (핸들러 등록되었지만 찾지 못함)

```
1. [DOM] updateDomProps: registering event handler { eventName: 'keydown', ... }
2. [EventSystem] addEventHandler called { eventName: 'keydown', ... }
3. (사용자가 키 입력)
4. [EventSystem] dispatchEvent called { eventName: 'keydown', ... }
5. [EventSystem] Looking for handler { hasHandlers: true, handlerKeys: ['click'], hasHandler: false }
   ← handlerKeys에 'keydown'이 없음!
6. (Executing handler 로그 없음)
```

---

## 결과 공유 방법

테스트 후 다음 정보를 공유해주세요:

1. **검색 입력 필드 테스트 결과**:
   - `[DOM] updateDomProps` 로그에 `eventName: 'keydown'`이 있었는지
   - `[EventSystem] Looking for handler` 로그의 `hasHandlers`, `handlerKeys`, `hasHandler` 값
   - `[EventSystem] Executing handler` 로그가 나타났는지

2. **Select 요소 테스트 결과**:
   - `[DOM] updateDomProps` 로그에 `eventName: 'change'`가 있었는지
   - `[EventSystem] Looking for handler` 로그의 `hasHandlers`, `handlerKeys`, `hasHandler` 값
   - `[EventSystem] Executing handler` 로그가 나타났는지

3. **카트 버튼 클릭 테스트 결과**:
   - `[EventSystem] Looking for handler` 로그의 `hasHandlers`, `handlerKeys`, `hasHandler` 값
   - `[EventSystem] Executing handler` 로그가 나타났는지

이 정보를 바탕으로 정확한 문제 원인을 파악할 수 있습니다.
