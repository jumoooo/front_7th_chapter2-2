# HomePage 클릭 이벤트 문제 분석 보고서

## 🔍 문제 상황

HomePage.jsx에서 ProductItem을 클릭하는 것 외에 다른 클릭 이벤트가 작동하지 않는 문제가 발생했습니다.

## 📋 분석 결과

### 1. 발견된 주요 문제점

#### ❌ 문제 1: `setDomProps`에서 이벤트 리스너 중복 등록

**위치**: `packages/react/src/core/dom.ts:14-53`

```typescript
export const setDomProps = (dom: HTMLElement, props: Record<string, any>): void => {
  // ...
  if (key.startsWith("on") && typeof value === "function") {
    const eventName = key.slice(2).toLowerCase();
    // ⚠️ 문제: 이전 리스너를 제거하지 않고 계속 추가만 함
    dom.addEventListener(eventName, value);
    return;
  }
  // ...
};
```

**문제점**:

- `setDomProps`는 초기 마운트 시 호출되는 함수입니다.
- 이벤트 핸들러를 등록할 때 이전 리스너를 제거하지 않고 계속 추가만 합니다.
- 컴포넌트가 재렌더링될 때마다 같은 이벤트 핸들러가 중복으로 등록될 수 있습니다.
- 중복 등록된 리스너들이 모두 실행되면 예상치 못한 동작이 발생할 수 있습니다.

**비교**: `updateDomProps`는 올바르게 구현되어 있습니다:

```typescript
// 이벤트 핸들러 업데이트
if (key.startsWith("on") && typeof nextValue === "function") {
  const eventName = key.slice(2).toLowerCase();
  // ✅ 이전 핸들러가 있으면 제거
  if (typeof prevValue === "function") {
    dom.removeEventListener(eventName, prevValue);
  }
  // ✅ 새로운 핸들러 등록
  dom.addEventListener(eventName, nextValue);
  return;
}
```

#### ⚠️ 잠재적 문제 2: Router의 document 레벨 클릭 이벤트 리스너

**위치**: `packages/app/src/lib/Router.js:22-30`

```javascript
document.addEventListener("click", (e) => {
  if (e.target.closest("[data-link]")) {
    e.preventDefault();
    const url = e.target.getAttribute("href") || e.target.closest("[data-link]").getAttribute("href");
    if (url) {
      this.push(url);
    }
  }
});
```

**분석**:

- 이 리스너는 document 레벨에서 모든 클릭 이벤트를 캡처합니다.
- `[data-link]` 속성을 가진 요소에만 `preventDefault()`를 호출하므로, 다른 요소의 클릭 이벤트에는 직접적인 영향을 주지 않아야 합니다.
- 하지만 이벤트 버블링 단계에서 실행되므로, React의 이벤트 핸들러와 실행 순서가 다를 수 있습니다.

### 2. 이벤트 처리 흐름 분석

#### React의 이벤트 등록 방식

1. **초기 마운트**: `setDomProps` 호출 → `addEventListener`로 이벤트 등록
2. **업데이트**: `updateDomProps` 호출 → 이전 리스너 제거 후 새 리스너 등록

#### 실제 이벤트 실행 순서

1. 사용자가 요소를 클릭
2. 브라우저가 네이티브 클릭 이벤트 발생
3. **캡처 단계**: document → ... → target
4. **타겟 단계**: target 요소
5. **버블링 단계**: target → ... → document
6. Router의 document 리스너가 버블링 단계에서 실행 (조건부로 `preventDefault()` 호출)
7. React의 이벤트 핸들러가 버블링 단계에서 실행

### 3. 영향받는 컴포넌트

#### ✅ 정상 작동하는 컴포넌트

- **ProductCard**: `onClick` 이벤트가 정상 작동 (사용자 보고)

#### ❌ 작동하지 않는 컴포넌트 (추정)

- **SearchBar**의 버튼들:
  - `category1-filter-btn`: `handleMainCategoryClick`
  - `category2-filter-btn`: `handleSubCategoryClick`
  - 브레드크럼 버튼: `handleBreadCrumbClick`
- **ProductList**의 `retry-btn`
- **PageWrapper**의 `cart-icon-btn`

### 4. 근본 원인 추정

#### 가장 가능성 높은 원인: `setDomProps`의 중복 리스너 등록

**시나리오**:

1. 컴포넌트가 처음 마운트될 때 `setDomProps`가 호출되어 이벤트 리스너가 등록됩니다.
2. 컴포넌트가 재렌더링될 때마다 `setDomProps`가 다시 호출될 수 있습니다.
3. 이전 리스너를 제거하지 않고 새 리스너를 추가하면 중복 등록이 발생합니다.
4. 중복 등록된 리스너들이 모두 실행되면서 예상치 못한 동작이 발생할 수 있습니다.
5. 특히 이벤트 핸들러 내에서 `preventDefault()`를 호출하는 경우, 여러 번 호출되면서 다른 이벤트에 영향을 줄 수 있습니다.

#### 추가 가능성: 이벤트 핸들러가 등록되지 않는 경우

- `setDomProps`가 재렌더링 시 호출되지 않아야 하는데 호출되는 경우
- 이벤트 핸들러 함수가 매번 새로 생성되어 참조가 달라지는 경우

## 🔧 해결 방안

### 해결책 1: `setDomProps`에서 이벤트 리스너 중복 등록 방지

**방법 1**: 이전 리스너를 제거하고 새로 등록

```typescript
if (key.startsWith("on") && typeof value === "function") {
  const eventName = key.slice(2).toLowerCase();
  // 이전 리스너 제거 (있다면)
  // 주의: 이전 핸들러 참조를 저장해야 함
  dom.removeEventListener(eventName /* 이전 핸들러 */);
  dom.addEventListener(eventName, value);
  return;
}
```

**방법 2**: 이벤트 핸들러를 DOM 요소에 저장하여 관리

```typescript
// 이벤트 핸들러를 DOM 요소의 속성으로 저장
const handlerKey = `__${key}Handler__`;
const prevHandler = (dom as any)[handlerKey];

if (prevHandler) {
  dom.removeEventListener(eventName, prevHandler);
}

dom.addEventListener(eventName, value);
(dom as any)[handlerKey] = value;
```

**방법 3**: `setDomProps`는 초기 마운트 시에만 사용하고, 업데이트는 `updateDomProps`만 사용

- `reconciler.ts`에서 마운트 시와 업데이트 시를 명확히 구분
- 마운트 시: `setDomProps` 사용
- 업데이트 시: `updateDomProps` 사용 (이미 올바르게 구현됨)

### 해결책 2: Router의 이벤트 리스너 개선

현재 구현은 문제가 없어 보이지만, 더 명확하게 개선할 수 있습니다:

```javascript
document.addEventListener(
  "click",
  (e) => {
    const linkElement = e.target.closest("[data-link]");
    if (linkElement) {
      e.preventDefault();
      e.stopPropagation(); // 명시적으로 버블링 중단
      const url = linkElement.getAttribute("href");
      if (url) {
        this.push(url);
      }
    }
  },
  true,
); // 캡처 단계에서 실행하여 React 이벤트보다 먼저 처리
```

## 📊 우선순위

1. **높음**: `setDomProps`의 이벤트 리스너 중복 등록 문제 해결
2. **중간**: Router의 이벤트 리스너 개선 (명시적 처리)
3. **낮음**: 이벤트 핸들러 참조 관리 개선

## 🧪 검증 방법

1. 브라우저 개발자 도구에서 이벤트 리스너 확인
   - Elements 탭 → 특정 요소 선택 → Event Listeners 탭에서 중복 등록 확인
2. 이벤트 핸들러에 로그 추가하여 실행 횟수 확인
3. `setDomProps`와 `updateDomProps` 호출 시점 확인

## 📝 참고 사항

- React의 실제 구현에서는 이벤트 위임(Event Delegation)을 사용하여 document 레벨에서 모든 이벤트를 처리합니다.
- 현재 Mini-React 구현은 각 요소에 직접 이벤트 리스너를 등록하는 방식입니다.
- 이는 실제 React와 다르지만, 더 단순한 구현입니다.
