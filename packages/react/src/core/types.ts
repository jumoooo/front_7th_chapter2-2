import type { HookType, NodeType } from "./constants";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Props = Record<string, any> & { children?: VNode[] };

export interface FunctionComponent<P extends Props> {
  (props: P): VNode | null;
  displayName?: string;
}

export interface VNode {
  type: string | symbol | React.ComponentType;
  key: string | null;
  props: Props;
}

/**
 * Instance는 실제 DOM 노드와 VNode를 연결하는 중간 단계 객체입니다.
 * => VNode = 청사진, Instance = 현장에 설치된 실체
 * kind: 인스턴스의 종류(텍스트, 일반 DOM(host), 컴포넌트, 프래그먼트).
 * dom: 실제로 생성된 브라우저 노드. (컴포넌트/프래그먼트는 자체 DOM이 없어서 null인 경우가 많음.)
 * node: 이 인스턴스를 만든 VNode (props, type 정보 등) — 업데이트 시 비교 대상.
 * children: 이 인스턴스의 자식 인스턴스들(트리 구조).
 * key: 리스트 렌더링 등에서 재사용 판단에 도움.
 * path: 트리 내의 위치 식별자(디버깅·훅 상태 분리 등에 사용).
 */
export interface Instance {
  kind: NodeType;
  dom: HTMLElement | Text | null;
  node: VNode;
  children: (Instance | null)[];
  key: string | null;
  path: string;
}

export interface EffectHook {
  kind: HookType["EFFECT"];
  deps: unknown[] | null;
  cleanup: (() => void) | null;
  effect: () => (() => void) | void;
}

export interface RootContext {
  container: HTMLElement | null;
  node: VNode | null;
  instance: Instance | null;

  reset(options: { container: HTMLElement; node: VNode }): void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type State = any;

export interface HooksContext {
  state: Map<string, State[]>;
  cursor: Map<string, number>;
  visited: Set<string>;
  componentStack: string[];

  clear(): void;

  readonly currentPath: string;
  readonly currentCursor: number;
  readonly currentHooks: State[];
}

export interface EffectsContext {
  queue: Array<{ path: string; cursor: number }>;
}

export interface Context {
  root: RootContext;
  hooks: HooksContext;
  effects: EffectsContext;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace React {
    interface ComponentType<P extends Props = Props> {
      (props: P): VNode | null;
    }
  }
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [elemName: string]: any;
    }

    const Fragment: React.ComponentType;
  }
}
