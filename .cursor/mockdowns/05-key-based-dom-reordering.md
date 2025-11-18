# key 기반 DOM 재배치 처리

## 문제 상황

`basic.mini-react.test.tsx (1410-1447)` 테스트에서 에러 발생

- key가 있는 자식을 재배치할 때 기존 DOM이 재사용되지만 순서가 변경되지 않음
- 기대: `[initialOrder[1], initialOrder[2], initialOrder[0]]` (B, C, A 순서)
- 실제: `[initialOrder[0], initialOrder[1], initialOrder[2]]` (A, B, C 순서, 변경되지 않음)

## 원인 분석

`reconcileChildren` 함수에서 key 기반 매칭은 올바르게 작동하지만, DOM 순서 재배치 로직이 누락되어 있었습니다.

- ✅ key 기반 인스턴스 매칭: 올바르게 작동
- ✅ 인스턴스 재사용: 올바르게 작동
- ❌ DOM 순서 재배치: 누락됨

## 해결 방법

`reconcileChildren` 함수에 DOM 순서 재배치 로직을 추가했습니다.

### 구현 내용

1. **DOM 순서 재배치 로직 추가** (`packages/react/src/core/reconciler.ts`)
   - 역순으로 순회하여 DOM을 올바른 위치에 배치
   - 역순 순회를 사용하면 다음 인스턴스의 첫 DOM 노드를 anchor로 사용할 수 있어 효율적
   - 각 인스턴스의 첫 DOM 노드를 찾아 올바른 위치에 배치

2. **핵심 로직**

   ```typescript
   // 5. DOM 순서 재배치: 역순으로 순회하여 올바른 위치에 DOM 배치
   // 역순으로 순회하면 다음 인스턴스의 첫 DOM 노드를 anchor로 사용할 수 있어 효율적입니다
   for (let i = newInstances.length - 1; i >= 0; i--) {
     const instance = newInstances[i];
     if (!instance) continue;

     // 현재 인스턴스의 첫 DOM 노드 찾기
     const currentFirstDom = getFirstDomFromChildren([instance]);
     if (!currentFirstDom) continue;

     // 다음 인스턴스의 첫 DOM 노드를 anchor로 사용
     const nextInstance = i + 1 < newInstances.length ? newInstances[i + 1] : null;
     const nextFirstDom = nextInstance ? getFirstDomFromChildren([nextInstance]) : null;

     // 현재 DOM이 올바른 위치에 있는지 확인
     if (nextFirstDom) {
       // anchor 앞에 있어야 하는데 현재 위치가 다르면 재배치
       if (currentFirstDom.nextSibling !== nextFirstDom) {
         // DOM 노드들을 anchor 앞에 삽입
         const domNodes = getDomNodes(instance);
         domNodes.forEach((node) => {
           parentDom.insertBefore(node, nextFirstDom);
         });
       }
     } else {
       // anchor가 없으면 마지막 위치에 있어야 함
       if (currentFirstDom.nextSibling !== null) {
         // DOM 노드들을 마지막에 삽입
         const domNodes = getDomNodes(instance);
         domNodes.forEach((node) => {
           parentDom.appendChild(node);
         });
       }
     }
   }
   ```

### 동작 방식

1. **역순 순회**: 마지막 인스턴스부터 첫 번째 인스턴스까지 역순으로 순회
2. **Anchor 찾기**: 다음 인스턴스(i + 1)의 첫 DOM 노드를 anchor로 사용
3. **위치 확인**: 현재 인스턴스의 첫 DOM 노드가 anchor의 바로 앞에 있는지 확인
4. **재배치**: 위치가 다르면 DOM 노드들을 올바른 위치에 삽입

### 역순 순회를 사용하는 이유

- 정순 순회: 이전 인스턴스를 anchor로 사용하려면 이미 처리된 인스턴스의 위치를 기억해야 함
- 역순 순회: 다음 인스턴스(아직 처리되지 않음)를 anchor로 사용하면 효율적이고 간단함

## 테스트 케이스

```typescript
function List() {
  const [items, setItems] = useState<Item[]>([
    { id: "a", label: "A" },
    { id: "b", label: "B" },
    { id: "c", label: "C" },
  ]);
  reorder = () => setItems(([first, ...rest]) => [...rest, first]);
  return (
    <ul id="keyed-list">
      {items.map((item) => (
        <li key={item.id} data-id={item.id}>
          {item.label}
        </li>
      ))}
    </ul>
  );
}
```

- 초기: A, B, C 순서
- `reorder()` 호출: 첫 번째 아이템을 마지막으로 이동 → B, C, A 순서가 되어야 함
- 기존 DOM 요소들은 재사용되되 순서만 변경되어야 함

## 변경 파일

- `packages/react/src/core/reconciler.ts` - DOM 순서 재배치 로직 추가 (339-376줄)
- `packages/react/src/core/reconciler.ts` - `getDomNodes` import 추가

## 완료 상태

✅ 테스트 통과
✅ 린터 에러 없음
