# Fragment 업데이트 처리 수정

## 문제 상황

`basic.mini-react.test.tsx (1234-1284)` 테스트에서 에러 발생

- `#dynamic` 요소가 렌더링되지 않음
- Fragment의 조건부 자식이 업데이트될 때 제대로 처리되지 않음

## 원인 분석

`reconcile` 함수에서 Fragment 타입의 업데이트 처리가 누락되어 있었습니다.

현재 처리되는 타입:

- ✅ `TEXT_ELEMENT` - 텍스트 노드 업데이트
- ✅ `string` - 일반 DOM 요소 업데이트
- ✅ `function` - 함수형 컴포넌트 업데이트
- ❌ `Fragment` - Fragment 업데이트 (누락)

## 해결 방법

`reconcile` 함수에 Fragment 업데이트 로직을 추가했습니다.

### 구현 내용

1. **Fragment 업데이트 로직 추가** (`packages/react/src/core/reconciler.ts`)
   - Fragment는 자체 DOM이 없으므로, 자식들을 재조정할 때 부모 DOM을 사용
   - 기존 자식 인스턴스가 있으면 그 DOM의 부모를 찾아서 사용
   - 없으면 `parentDom`을 사용
   - `normalizeChildren`로 자식 VNode 배열 정규화
   - `reconcileChildren`으로 자식 인스턴스 재조정

2. **핵심 로직**

   ```typescript
   // Fragment 업데이트
   if (nextNode.type === Fragment) {
     // Fragment는 자체 DOM이 없으므로, 자식들을 재조정할 때 부모 DOM을 사용해야 합니다
     const existingChildInstance = instance.children?.[0];
     let childParentDom = parentDom;

     if (existingChildInstance) {
       const childDom = getFirstDomFromChildren([existingChildInstance]);
       if (childDom) {
         if (childDom.parentElement) {
           childParentDom = childDom.parentElement;
         } else if (childDom.parentNode && childDom.parentNode instanceof HTMLElement) {
           childParentDom = childDom.parentNode;
         }
       }
     }

     // Fragment의 자식들을 재조정합니다
     const childNodes = normalizeChildren(nextNode.props.children);
     instance.children = reconcileChildren(childParentDom, instance.children || [], childNodes, path);
     instance.node = nextNode;
     return instance;
   }
   ```

## 테스트 케이스

```typescript
function Dynamic({ visible }: { visible: boolean }) {
  return <>{visible && <p id="dynamic">dynamic</p>}</>;
}

function Sample() {
  const [visible, update] = useState(false);
  return (
    <div>
      <span id="static">static</span>
      <Dynamic visible={visible} />
      <Items />
    </div>
  );
}
```

- 초기: `visible=false` → Fragment 자식 없음
- 업데이트: `visible=true` → Fragment에 `<p id="dynamic">dynamic</p>` 추가
- 기존 DOM 요소들(`#static`, `#list`, `#first`, `#second`)은 유지되어야 함

## 변경 파일

- `packages/react/src/core/reconciler.ts` - Fragment 업데이트 로직 추가

## 완료 상태

✅ 테스트 통과
✅ 린터 에러 없음
