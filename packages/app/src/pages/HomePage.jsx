import { useEffect } from "react";
import { ProductList, SearchBar } from "../components";
import { productStore } from "../stores";
import { router } from "../router";
import { loadMoreProducts, loadProducts, loadProductsAndCategories } from "../services";
import { isNearBottom } from "../utils";
import { PageWrapper } from "./PageWrapper";

const headerLeft = (
  <h1 className="text-xl font-bold text-gray-900">
    <a href="/" data-link="/">
      쇼핑몰
    </a>
  </h1>
);

// 무한 스크롤 이벤트 등록
let scrollHandlerRegistered = false;
let scrollHandler = null;

const loadNextProducts = async () => {
  // 디버깅: 스크롤 이벤트 발생 확인
  const isDebugMode =
    typeof window !== "undefined" &&
    (window.__REACT_DEBUG_SCROLL__ || localStorage.getItem("__REACT_DEBUG_SCROLL__") === "true");

  // 스크롤 이벤트가 발생했는지 확인하기 위한 로그 (항상 출력)
  console.log("[Scroll] loadNextProducts called", {
    routePath: router.route?.path,
    scrollTop: window.pageYOffset || document.documentElement.scrollTop,
    windowHeight: window.innerHeight,
    documentHeight: document.documentElement.scrollHeight,
  });

  if (isDebugMode) {
    console.log("[Scroll] loadNextProducts called (debug mode)", {
      routePath: router.route?.path,
      scrollTop: window.pageYOffset || document.documentElement.scrollTop,
      windowHeight: window.innerHeight,
      documentHeight: document.documentElement.scrollHeight,
    });
  }

  // 현재 라우트가 홈이 아니면 무한 스크롤 비활성화
  if (router.route?.path !== "/") {
    if (isDebugMode) {
      console.log("[Scroll] Not on home page, skipping");
    }
    return;
  }

  const isNear = isNearBottom(200);
  if (isDebugMode) {
    console.log("[Scroll] isNearBottom check", {
      isNear,
      threshold: 200,
    });
  }

  if (isNear) {
    const productState = productStore.getState();
    const hasMore = productState.products.length < productState.totalCount;

    if (isDebugMode) {
      console.log("[Scroll] Near bottom, checking conditions", {
        productsCount: productState.products.length,
        totalCount: productState.totalCount,
        hasMore,
        loading: productState.loading,
      });
    }

    // 로딩 중이거나 더 이상 로드할 데이터가 없으면 return
    if (productState.loading || !hasMore) {
      if (isDebugMode) {
        console.log("[Scroll] Skipping load", {
          reason: productState.loading ? "loading" : "no more products",
        });
      }
      return;
    }

    try {
      if (isDebugMode) {
        console.log("[Scroll] Loading more products...");
      }
      await loadMoreProducts();
      if (isDebugMode) {
        console.log("[Scroll] Load more products completed");
      }
    } catch (error) {
      console.error("무한 스크롤 로드 실패:", error);
    }
  }
};

const registerScrollHandler = () => {
  // 디버깅 모드 확인
  const isDebugMode =
    typeof window !== "undefined" &&
    (window.__REACT_DEBUG_SCROLL__ || localStorage.getItem("__REACT_DEBUG_SCROLL__") === "true");

  if (scrollHandlerRegistered) {
    if (isDebugMode) {
      console.log("[Scroll] Handler already registered, skipping");
    }
    return;
  }

  if (isDebugMode) {
    console.log("[Scroll] Registering scroll handler");
  }

  // 스크롤 이벤트 리스너 등록
  scrollHandler = () => {
    console.log("[Scroll] Scroll event fired!");
    loadNextProducts();
  };

  window.addEventListener("scroll", scrollHandler);
  scrollHandlerRegistered = true;

  if (isDebugMode) {
    console.log("[Scroll] Scroll handler registered successfully", {
      hasEventListener: true,
      scrollHandlerRegistered,
    });
  }
};

const unregisterScrollHandler = () => {
  if (!scrollHandlerRegistered || !scrollHandler) return;
  window.removeEventListener("scroll", scrollHandler);
  scrollHandler = null;
  scrollHandlerRegistered = false;
};

export const HomePage = () => {
  const productState = productStore.getState();
  const { search: searchQuery, limit, sort, category1, category2 } = router.query;
  const { products, loading, error, totalCount, categories } = productState;
  const category = { category1, category2 };
  const hasMore = products.length < totalCount;

  useEffect(() => {
    if (loading) {
      return;
    }
    loadProducts(true);
  }, [searchQuery, limit, sort, category1, category2]);

  useEffect(() => {
    // 디버깅 모드 확인
    const isDebugMode =
      typeof window !== "undefined" &&
      (window.__REACT_DEBUG_SCROLL__ || localStorage.getItem("__REACT_DEBUG_SCROLL__") === "true");

    if (isDebugMode) {
      console.log("[HomePage] useEffect (scroll handler) called");
    }

    registerScrollHandler();
    loadProductsAndCategories();

    return () => {
      if (isDebugMode) {
        console.log("[HomePage] useEffect cleanup (unregister scroll handler) called");
      }
      unregisterScrollHandler();
    };
  }, []);

  return (
    <PageWrapper headerLeft={headerLeft}>
      {/* 검색 및 필터 */}
      <SearchBar searchQuery={searchQuery} category={category} sort={sort} limit={limit} categories={categories} />

      {/* 상품 목록 */}
      <div className="mb-6">
        <ProductList products={products} loading={loading} error={error} totalCount={totalCount} hasMore={hasMore} />
      </div>
    </PageWrapper>
  );
};
