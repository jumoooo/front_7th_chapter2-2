# 이벤트 시스템 & 재조정 로그 분석 보고서

## 1. 로그로 확인한 사실

- `consolechk.md`의 `reconciler.ts` 로그를 보면 동일한 함수형 컴포넌트 경로(`root.0.0.0.1.*`)가 첫 렌더 이후에도 계속 `decision: mount`로 남아 있습니다. 즉, 부모가 상태를 갱신해도 자식 함수형 컴포넌트가 **업데이트 단계**로 진입하지 못하고 매번 새로 마운트되고 있습니다.

```
```133:152:.cursor/mockdowns/consolechk.md
reconciler.ts:33 [reconcile] path: root.0.0.0.1 type: string ... decision: update path: root.0.0.0.1
reconciler.ts:33 [reconcile] path: root.0.0.0.1.0 type: function ... decision: update path: root.0.0.0.1.0
reconciler.ts:33 [reconcile] path: root.0.0.0.1.0.0 type: string ... decision: update path: root.0.0.0.1.0.0
reconciler.ts:33 [reconcile] path: root.0.0.0.1.0.0.0 ... decision: update path: root.0.0.0.1.0.0.0
reconciler.ts:33 [reconcile] path: root.0.0.0.1.0.0.1 ... decision: update path: root.0.0.0.1.0.0.1
reconciler.ts:33 [reconcile] path: root.0.0.0.1.0.0.1.0 ... decision: update path: root.0.0.0.1.0.0.1.0
reconciler.ts:33 [reconcile] path: root.0.0.0.1.0.0.1.0.1 type: string ... decision: mount path: root.0.0.0.1.0.0.1.0.1
```
```

- `localhost-1763633857912.md`의 `insertInstance` 로그에서는 **동일한 DOM 컨테이너에 다시 렌더링할 때 `parentDom`이 비어 있는 상태**로 출력됩니다. 실제 브라우저 로그에서는 `parentDom`에 해당 DOM 객체가 별도 컬럼으로 찍히지만, 텍스트로 떨어진 로그에는 값이 빠져 있습니다. 즉, 함수형 컴포넌트가 기존 자식 DOM을 모두 치운 뒤 새 자식을 삽입하려고 했지만, 연결해야 할 부모 DOM을 잃어버린 상태라는 것을 확인할 수 있습니다.

```
```120:135:.cursor/mockdowns/localhost-1763633857912.md
 [insertInstance] instance kind : text parentDom:  domNodes to insert: [text]
 [insertInstance] instance kind : host parentDom:  domNodes to insert: [button.category1-filter-btn...]
 [insertInstance] instance kind : text parentDom:  domNodes to insert: [text]
 [insertInstance] instance kind : host parentDom:  domNodes to insert: [button.category1-filter-btn...]
 ...
```
```

## 2. 근본 원인

### 2.1 이벤트 시스템 초기화 누락

- `events.ts`는 이벤트 위임용 전역 리스너를 `rootContainer`에 부착해야 정상 동작합니다. 그러나 `render` 진입 시점에 `setEventRoot`를 호출하지 않아 `rootContainer`가 `null`로 남고, 위임 리스너가 한 번도 연결되지 않은 상태입니다. 그 결과, `addEventHandler`가 저장해둔 핸들러가 실제 브라우저 이벤트를 받을 기회가 없어 모든 `onClick`, `onChange` 계열 이벤트가 무력화되었습니다.

### 2.2 함수형 컴포넌트 재조정 순서 오류

- `reconciler.ts`의 함수형 컴포넌트 분기에서 **새로운 VNode를 먼저 렌더링**한 뒤 이전 인스턴스와 비교하려고 합니다. 이때 부모 DOM을 인자로 전달하지 못하면 자식 인스턴스를 다시 DOM에 삽입할 위치를 잃어버립니다.
- 실제 로그처럼 부모 DOM 참조가 사라지면 `insertInstance`가 `parentDom` 없이 호출되고, 브라우저 콘솔에는 값이 비어 보입니다. 구현체에서는 `parentDom.appendChild` 호출 직전에 예외가 발생하고, 해당 렌더 패스가 조용히 실패하면서 UI가 갱신되지 않습니다.

## 3. 해결 방안

1. **`setEventRoot` 보장 호출**
   - `packages/react/src/core/render.ts` 혹은 `setup.ts`에서 루트 컨테이너가 준비되는 즉시 `setEventRoot(container)` 호출.
   - 중복 호출을 막기 위해 `context.eventRoot`에 컨테이너를 캐시하여 이미 설정된 경우 스킵.

2. **함수형 컴포넌트 재조정 순서 수정**
   - `reconciler.ts` 함수형 컴포넌트 분기에서 `instance.node.type === nextNode.type`인 경우에만 업데이트 루틴으로 진입.
   - 업데이트 루틴에서는
     1. `renderFunctionComponent`로 새 VNode 생성
     2. 이전 자식 인스턴스와 새 VNode를 `reconcile(childParentDom, prevChild, nextChild, childPath)`에 전달
     3. `childParentDom`은 우선 이전 자식의 실제 DOM 부모(`getFirstDomFromChildren`)를 사용하고, 없으면 상위에서 받은 `parentDom`을 그대로 사용
   - 이렇게 하면 부모 DOM 참조가 끊기지 않아 `insertInstance`가 항상 유효한 `parentDom`을 받게 됩니다.

3. **디버깅 가드 추가 (선택)**
   - 개발 환경에서 `insertInstance` 호출 시 `if (!parentDom)` 분기에서 콘솔 경고를 띄우면, 추후 비슷한 회귀를 빠르게 감지할 수 있습니다.

## 4. 다음 조치

- [ ] `render.ts`에 `setEventRoot` 호출/가드 추가
- [ ] `reconciler.ts` 함수형 컴포넌트 분기 재작성
- [ ] 수정 후 `SearchBar`, `ProductList`, `CartModal` 상호작용 수동 검증
- [ ] 사용자에게 테스트 실행 요청 (`pnpm test`, `pnpm run dev`)

