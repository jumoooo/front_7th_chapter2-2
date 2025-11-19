import { createStore } from "../lib";
import { CART_ACTIONS } from "./actionTypes";
import { cartStorage } from "../storage/index.js";

/**
 * 장바구니 스토어 초기 상태
 *
 * @typedef {Object} CartItem
 * @property {string} id - 상품 ID
 * @property {string} title - 상품 제목
 * @property {string} image - 상품 이미지 URL
 * @property {number} price - 상품 가격
 * @property {number} quantity - 상품 수량
 * @property {boolean} selected - 선택 여부
 *
 *
 * @typedef {Object} CartState
 * @property {CartItem[]} items - 장바구니 아이템 목록
 * @property {boolean} selectedAll - 전체 선택 여부
 *
 * @typedef {Object} CartAction
 * @property {string} type - 액션 타입
 * @property {Object} payload - 액션에 필요한 데이터
 */

/**
 * @type {CartState}
 */
const initialState = {
  items: [],
  selectedAll: false,
};

/**
 * 장바구니 아이템 찾기
 */
const findCartItem = (items, productId) => {
  return items.find((item) => item.id === productId);
};

/**
 * 장바구니 스토어 리듀서
 * @param {CartState} state - 현재 상태
 * @param {CartAction} action - 액션 객체
 */
const cartReducer = (_, action) => {
  const state = cartStorage.get() ?? initialState;
  switch (action.type) {
    case CART_ACTIONS.ADD_ITEM: {
      const { product, quantity = 1 } = action.payload;
      const existingItem = findCartItem(state.items, product.productId);

      if (existingItem) {
        // 기존 아이템 수량 증가
        return {
          ...state,
          items: state.items.map((item) =>
            item.id === product.productId ? { ...item, quantity: item.quantity + quantity } : item,
          ),
        };
      } else {
        // 새 아이템 추가
        const newItem = {
          id: product.productId,
          title: product.title,
          image: product.image,
          price: parseInt(product.lprice),
          quantity,
          selected: false,
        };
        return {
          ...state,
          items: [...state.items, newItem],
        };
      }
    }

    case CART_ACTIONS.REMOVE_ITEM:
      return {
        ...state,
        items: state.items.filter((item) => item.id !== action.payload),
      };

    case CART_ACTIONS.UPDATE_QUANTITY: {
      const { productId, quantity } = action.payload;
      return {
        ...state,
        items: state.items.map((item) => (item.id === productId ? { ...item, quantity: Math.max(1, quantity) } : item)),
      };
    }

    case CART_ACTIONS.CLEAR_CART:
      return {
        ...state,
        items: [],
        selectedAll: false,
      };
    case CART_ACTIONS.TOGGLE_SELECT: {
      const productId = action.payload;
      const updatedItems = state.items.map((item) =>
        item.id === productId ? { ...item, selected: !item.selected } : item,
      );

      // 전체 선택 상태 업데이트
      const allSelected = updatedItems.length > 0 && updatedItems.every((item) => item.selected);

      return {
        ...state,
        items: updatedItems,
        selectedAll: allSelected,
      };
    }

    case CART_ACTIONS.SELECT_ALL: {
      const updatedItems = state.items.map((item) => ({
        ...item,
        selected: true,
      }));

      return {
        ...state,
        items: updatedItems,
        selectedAll: true,
      };
    }

    case CART_ACTIONS.DESELECT_ALL: {
      const updatedItems = state.items.map((item) => ({
        ...item,
        selected: false,
      }));

      return {
        ...state,
        items: updatedItems,
        selectedAll: false,
      };
    }

    case CART_ACTIONS.REMOVE_SELECTED:
      return {
        ...state,
        items: state.items.filter((item) => !item.selected),
        selectedAll: false,
      };

    case CART_ACTIONS.LOAD_FROM_STORAGE:
      return {
        ...state,
        ...action.payload,
      };

    default:
      return state;
  }
};
/**
 * 장바구니 스토어 생성
 */
export const cartStore = createStore(cartReducer, initialState);

/**
 * 장바구니 스토어 초기화 함수
 * 스토리지에서 데이터를 로드하거나 초기값을 설정합니다.
 */
const initializeCartStore = () => {
  try {
    const savedCart = cartStorage.get();

    // 스토리지에 유효한 데이터가 있는지 검증
    if (
      savedCart &&
      typeof savedCart === "object" &&
      Array.isArray(savedCart.items) &&
      typeof savedCart.selectedAll === "boolean"
    ) {
      // 유효한 스토리지 데이터가 있으면 로드
      cartStore.dispatch({
        type: CART_ACTIONS.LOAD_FROM_STORAGE,
        payload: savedCart,
      });
    } else {
      // 유효하지 않거나 없으면 초기값 설정 및 스토리지에 저장
      cartStorage.set(initialState);
      cartStore.dispatch({
        type: CART_ACTIONS.LOAD_FROM_STORAGE,
        payload: initialState,
      });
    }
  } catch (error) {
    console.error("장바구니 스토어 초기화 실패:", error);
    // 에러 발생 시 초기값으로 설정
    cartStorage.set(initialState);
    cartStore.dispatch({
      type: CART_ACTIONS.LOAD_FROM_STORAGE,
      payload: initialState,
    });
  }
};

// 스토어 생성 직후 즉시 초기화
initializeCartStore();

// getState() 래핑: 항상 안전한 구조를 반환하도록 보장
const originalGetState = cartStore.getState;
cartStore.getState = () => {
  const state = originalGetState();

  // 안전장치: state가 유효하지 않거나 items가 배열이 아닌 경우 처리
  return {
    items: Array.isArray(state?.items) ? state.items : [],
    selectedAll: state?.selectedAll ?? false,
  };
};
