# Mini-React Hooks 구현 인수인계 (2025-11-19)

## 1. 작업 개요
- `useRef`를 `useState` lazy initializer로 한 번만 생성하도록 구현했습니다.
- `useMemo`는 이전 deps/value를 `useRef`로 저장하여 의존성 변경 시에만 factory를 재실행합니다.
- `useCallback`은 `useMemo`를 활용해 콜백 참조를 메모이제이션합니다.
- `useDeepMemo`는 `deepEquals`를 이용해 깊은 비교 후 메모을 제공합니다.
- `useAutoCallback`은 `useRef` + `useCallback`으로 안정된 참조에서 최신 함수를 호출합니다.

## 2. 테스트 진행 현황
- `pnpm test -- advanced.hooks.test.tsx -t "리렌더링이 되어도 useRef의 참조값이 유지된다" --run`
- `pnpm test -- advanced.hooks.test.tsx -t "useMemo 메모이제이션 테스트" --run`
- `pnpm test -- advanced.hooks.test.tsx -t "useCallback 메모이제이션 테스트" --run`
- `pnpm test -- advanced.hooks.test.tsx -t "useDeepMemo" --run`
- `useAutoCallback` it 테스트는 명령 실행 단계에서 거부되어 반영되지 못했습니다. 동일한 패턴의 명령을 여러 번 시도했으나 시스템에서 실행을 중단했습니다.
- 모든 명령 실행 시 `advanced.hoc.test.tsx`의 다른 미구현 영역 때문에 전체 테스트는 실패 상태입니다. hooks 관련 it들은 위에 기재한 범위까지 통과했습니다.

## 3. 추가 메모
- 향후 `useAutoCallback` it 테스트를 실행해야 합니다. vitest가 허용되는 명령 형식을 요구하는 것으로 보이니 IDE에서 직접 실행하는 방식을 권장합니다.
- hoc 관련 실패 케이스는 이번 작업 범위 밖이므로 별도 이슈로 추적해야 합니다.
- 코드 내 주석은 모두 한글로 작성하여 주니어도 이해할 수 있게 했습니다.

