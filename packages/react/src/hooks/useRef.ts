import { useState } from "../core";

/**
 * 리렌더링되어도 변경되지 않는 참조(reference) 객체를 반환합니다.
 * .current 속성을 통해 값에 접근하고 변경할 수 있습니다.
 *
 * @param initialValue - ref 객체의 초기 .current 값
 * @returns `{ current: T }` 형태의 ref 객체
 */
export const useRef = <T>(initialValue: T): { current: T } => {
  // useState를 사용하여 ref 객체를 한 번만 생성하도록 합니다.
  // lazy initialization을 사용하여 초기 렌더링 시에만 객체를 생성합니다.
  const [refObject] = useState(() => ({ current: initialValue }));

  // 리렌더링이 되어도 같은 객체 참조를 반환합니다.
  // ref.current 값을 변경해도 리렌더링을 트리거하지 않습니다.
  return refObject;
};
