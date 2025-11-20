# 무한 스크롤 문제 분석

## 📋 문제 개요

무한 스크롤 기능이 작동하지 않는 문제를 전체적으로 분석한 문서입니다.

## 🔍 현재 구현 상태

### 1. 구현 위치

**파일**: `packages/app/src/pages/HomePage.jsx`

```javascript
// 무한 스크롤 이벤트 등록
let scrollHandlerRegistered = false;

const loadNextProducts = async () => {
  // 현재 라우트가 홈이 아니면 무한 스크롤 비활성화
  if (router.route?.path !== "/") {
    return;
  }

  if (isNearBottom(200)) {
    const productState = productStore.getState();
    const hasMore = productState.products.length < state.totalCount;

    // 로딩 중이거나 더 이상 로드할 데이터가 없으면 return
    if (productState.loading || !hasMore) {
      return;
    }

    try {
      await loadMoreProducts();
    } catch (error) {
      console.error("무한 스크롤 로드 실패:", error);
    }
  }
};

const registerScrollHandler = () => {
  if (scrollHandlerRegistered) return;

  window.addEventListener("scroll", loadNextProducts);
  scrollHandlerRegistered = true;
};

const unregisterScrollHandler = () => {
  if (!scrollHandlerRegistered) return;
  window.removeEventListener("scroll", loadNextProducts);
  scrollHandlerRegistered = false;
};

export const HomePage = () => {
  // ...
  useEffect(() => {
    registerScrollHandler();
    loadProductsAndCategories();
    return () => unregisterScrollHandler();
  }, []);
  // ...
};
```

### 2. 관련 함수들

**`isNearBottom`** (`packages/app/src/utils/domUtils.js`):

```javascript
export const isNearBottom = (threshold = 200) => {
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const windowHeight = window.innerHeight;
  const documentHeight = document.documentElement.scrollHeight;

  return scrollTop + windowHeight >= documentHeight - threshold;
};
```

**`loadMoreProducts`** (`packages/app/src/services/productService.js`):

```javascript
export const loadMoreProducts = async () => {
  const state = productStore.getState();
  const hasMore = state.products.length < state.totalCount;

  if (!hasMore || state.loading) {
    return;
  }

  router.query = { current: Number(router.query.current ?? 1) + 1 };
  await loadProducts(false);
};
```

## 🐛 발견된 문제점

### 문제 1: 함수 참조 불일치 ⚠️ **CRITICAL**

**위치**: `HomePage.jsx` Line 46, 52

**문제**:

- `registerScrollHandler`에서 `window.addEventListener("scroll", loadNextProducts)`로 등록
- `unregisterScrollHandler`에서 `window.removeEventListener("scroll", loadNextProducts)`로 제거
- **함수 참조가 동일해야 `removeEventListener`가 작동하는데**, 모듈 레벨에서 정의된 함수이므로 참조는 동일해야 함
- 하지만 컴포넌트가 리렌더링될 때 cleanup이 실행되고 다시 등록되는 과정에서 문제가 발생할 수 있음

**영향**:

- 이벤트 리스너가 중복 등록될 수 있음
- 메모리 누수 가능성
- 이벤트 핸들러가 여러 번 실행될 수 있음

### 문제 2: 전역 변수 관리 문제 ⚠️ **HIGH**

**위치**: `HomePage.jsx` Line 18

**문제**:

```javascript
let scrollHandlerRegistered = false;
```

- 전역 변수로 이벤트 리스너 등록 상태를 관리
- 컴포넌트가 여러 번 마운트/언마운트될 때 상태가 제대로 초기화되지 않을 수 있음
- React의 컴포넌트 생명주기와 독립적으로 동작하여 예측 불가능한 동작 가능

**영향**:

- 컴포넌트 언마운트 후에도 이벤트 리스너가 남아있을 수 있음
- 컴포넌트 마운트 시 이벤트 리스너가 등록되지 않을 수 있음

### 문제 3: useEffect 의존성 배열 문제 ⚠️ **MEDIUM**

**위치**: `HomePage.jsx` Line 70-74

**문제**:

```javascript
useEffect(() => {
  registerScrollHandler();
  loadProductsAndCategories();
  return () => unregisterScrollHandler();
}, []);
```

- 의존성 배열이 비어있어서 컴포넌트 마운트 시에만 실행됨
- 하지만 `loadNextProducts` 함수가 클로저로 `router.route?.path`를 참조하는데, 이 값이 변경되어도 함수가 업데이트되지 않음
- 컴포넌트가 리렌더링될 때 cleanup이 실행되고 다시 등록되는데, 이 과정에서 문제가 발생할 수 있음

**영향**:

- 라우트 변경 시 이벤트 핸들러가 최신 상태를 반영하지 못할 수 있음
- 컴포넌트 리렌더링 시 불필요한 cleanup/등록이 발생할 수 있음

### 문제 4: router.query 업데이트 방식 문제 ⚠️ **MEDIUM**

**위치**: `packages/app/src/services/productService.js` Line 87

**문제**:

```javascript
router.query = { current: Number(router.query.current ?? 1) + 1 };
```

- `router.query`를 직접 할당하는 방식
- 기존 query 파라미터들이 유지되지 않고 `current`만 설정됨
- `router.query`가 객체 참조를 유지하지 않으면 라우터가 변경을 감지하지 못할 수 있음

**영향**:

- 페이지 번호가 제대로 업데이트되지 않을 수 있음
- 검색어, 필터 등 다른 query 파라미터가 손실될 수 있음

### 문제 5: loadNextProducts 내부 로직 확인 ⚠️ **INFO**

**위치**: `HomePage.jsx` Line 28

**확인**:

```javascript
const hasMore = productState.products.length < productState.totalCount;
```

- 코드는 정상적으로 작성되어 있음
- `productState`를 올바르게 사용하고 있음

**참고**:

- 이 부분은 문제가 없지만, 로직이 정확한지 확인 필요

### 문제 6: React 이벤트 시스템과의 관계 ⚠️ **LOW**

**확인 사항**:

- React의 이벤트 시스템(`packages/react/src/core/events.ts`)은 `window` 이벤트를 처리하지 않음
- `window.addEventListener`는 네이티브 DOM API를 직접 사용하므로 React 이벤트 시스템과 충돌하지 않음
- **하지만** React의 렌더링 사이클과 동기화되지 않아 문제가 발생할 수 있음

**영향**:

- React 컴포넌트가 리렌더링될 때 이벤트 핸들러가 최신 상태를 반영하지 못할 수 있음

## 🔬 문제 진단 체크리스트

### 1단계: 이벤트 리스너 등록 확인

- [ ] `registerScrollHandler`가 호출되는지 확인
- [ ] `window.addEventListener("scroll", loadNextProducts)`가 실제로 등록되는지 확인
- [ ] 브라우저 개발자 도구에서 이벤트 리스너 확인

### 2단계: 스크롤 이벤트 발생 확인

- [ ] 스크롤 시 `loadNextProducts` 함수가 호출되는지 확인
- [ ] `isNearBottom(200)`이 `true`를 반환하는지 확인
- [ ] 콘솔에 에러가 발생하는지 확인

### 3단계: 데이터 로드 확인

- [ ] `loadMoreProducts` 함수가 호출되는지 확인
- [ ] `router.query.current`가 제대로 업데이트되는지 확인
- [ ] API 요청이 발생하는지 확인 (Network 탭)
- [ ] `productStore`의 상태가 업데이트되는지 확인

### 4단계: 컴포넌트 리렌더링 확인

- [ ] 새로운 상품이 화면에 표시되는지 확인
- [ ] `ProductList` 컴포넌트가 새로운 `products` prop을 받는지 확인

## 💡 해결 방안

### 해결 방안 1: 함수 참조 문제 해결

**문제**: 함수 참조가 일치하지 않아 `removeEventListener`가 작동하지 않을 수 있음

**해결**:

```javascript
// useRef를 사용하여 함수 참조를 유지
import { useEffect, useRef } from "react";

export const HomePage = () => {
  const loadNextProductsRef = useRef(null);

  useEffect(() => {
    const loadNextProducts = async () => {
      // ... 기존 로직
    };

    loadNextProductsRef.current = loadNextProducts;
    window.addEventListener("scroll", loadNextProducts);

    return () => {
      window.removeEventListener("scroll", loadNextProductsRef.current);
    };
  }, []);
};
```

### 해결 방안 2: 전역 변수 제거

**문제**: 전역 변수로 상태를 관리하여 예측 불가능한 동작

**해결**:

```javascript
// useRef를 사용하여 컴포넌트 내부에서 상태 관리
export const HomePage = () => {
  const scrollHandlerRegistered = useRef(false);

  useEffect(() => {
    if (scrollHandlerRegistered.current) return;

    const loadNextProducts = async () => {
      // ... 기존 로직
    };

    window.addEventListener("scroll", loadNextProducts);
    scrollHandlerRegistered.current = true;

    return () => {
      window.removeEventListener("scroll", loadNextProducts);
      scrollHandlerRegistered.current = false;
    };
  }, []);
};
```

### 해결 방안 3: router.query 업데이트 방식 개선

**문제**: `router.query`를 직접 할당하여 기존 파라미터가 손실될 수 있음

**해결**:

```javascript
// 기존 query 파라미터를 유지하면서 current만 업데이트
export const loadMoreProducts = async () => {
  const state = productStore.getState();
  const hasMore = state.products.length < state.totalCount;

  if (!hasMore || state.loading) {
    return;
  }

  // 기존 query 파라미터 유지
  router.query = {
    ...router.query,
    current: Number(router.query.current ?? 1) + 1,
  };
  await loadProducts(false);
};
```

### 해결 방안 4: 로직 검증 강화

**문제**: `hasMore` 계산 로직이 정확한지 확인 필요

**해결**:

```javascript
// 더 명확한 로직 검증
const hasMore = productState.products.length < productState.totalCount;
// 디버깅 로그 추가 (개발 환경에서만)
if (process.env.NODE_ENV !== "production") {
  console.log("[InfiniteScroll] hasMore:", hasMore, {
    current: productState.products.length,
    total: productState.totalCount,
  });
}
```

### 해결 방안 5: throttle/debounce 추가 (성능 개선)

**문제**: 스크롤 이벤트가 너무 자주 발생하여 성능 문제

**해결**:

```javascript
// throttle 함수 추가
const throttle = (func, delay) => {
  let timeoutId;
  let lastExecTime = 0;
  return function (...args) {
    const currentTime = Date.now();

    if (currentTime - lastExecTime > delay) {
      func.apply(this, args);
      lastExecTime = currentTime;
    } else {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(
        () => {
          func.apply(this, args);
          lastExecTime = Date.now();
        },
        delay - (currentTime - lastExecTime),
      );
    }
  };
};

// 사용
const throttledLoadNextProducts = throttle(loadNextProducts, 200);
window.addEventListener("scroll", throttledLoadNextProducts);
```

## 📝 우선순위별 해결 계획

### 1순위: 즉시 수정 필요 (Critical)

1. ✅ **함수 참조 문제 해결**: useRef 사용하여 함수 참조 유지
2. ✅ **전역 변수 제거**: useRef로 컴포넌트 내부에서 상태 관리
3. ✅ **useEffect 의존성 배열 개선**: 필요한 의존성 추가

### 2순위: 중요 (High)

4. ✅ **router.query 업데이트 방식 개선**: 기존 파라미터 유지
5. ✅ **useEffect 의존성 배열 개선**: 필요한 의존성 추가

### 3순위: 개선 (Medium)

6. ✅ **throttle/debounce 추가**: 성능 개선
7. ✅ **에러 처리 개선**: 더 명확한 에러 메시지

## 🎯 예상 결과

위 해결 방안을 적용하면:

- ✅ 이벤트 리스너가 정확히 등록/제거됨
- ✅ 스크롤 시 무한 스크롤이 정상 작동함
- ✅ 메모리 누수 없음
- ✅ 성능 개선 (throttle 적용 시)
- ✅ 예측 가능한 동작

## 📌 참고 사항

- React의 이벤트 시스템은 `window` 이벤트를 처리하지 않으므로, 네이티브 DOM API를 직접 사용해야 함
- 하지만 React의 컴포넌트 생명주기와 동기화하여 사용해야 함
- `useEffect`의 cleanup 함수를 활용하여 이벤트 리스너를 정리해야 함
