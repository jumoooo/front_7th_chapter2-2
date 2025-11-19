# Memo HOC 리렌더 디버깅 노트

## 진행 상황

- `memo` HOC에서 `useRef` 초기화가 null을 반환하며 `prevProps` 접근 시 에러 발생 → 방어 로직 추가.
- 동일 props 전달에도 `TestComponent`가 두 번 호출되는 문제 재현됨. shallow 비교에서 `{ value: 1 }` 객체가 항상 다른 참조라 true가 나오지 않아 memo 캐시가 갱신됨을 확인.
- 추정 원인: wrapper `TestWrapper`가 새로운 props 객체를 만들기 때문에 `prevProps`와 `props` 레퍼런스가 달라 `shallowEquals`가 false. 얕은 비교 함수가 구조적 동등을 판단하지 못함.

## 다음 액션

1. `shallowEquals` 동작을 점검해 객체 비교 시 key 존재 여부 확인이 `b` 대상 객체를 직접 사용하도록 수정 필요.
2. memo 내부에서 props 비교 시, hooks 흐름상 ref가 초기화되고 이후에는 항상 값이 존재하도록 보장.
3. 테스트는 사용자가 직접 실행 예정 → 수정 후 로직 설명과 예상 결과만 공유.

## 참고

- 실패 테스트: `src/__tests__/advanced.hoc.test.tsx` 48~50 라인.
- 현재 memo 구현 위치: `packages/react/src/hocs/memo.ts`.

