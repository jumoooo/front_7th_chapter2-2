import { ValueOf } from "../types";

export const TEXT_ELEMENT = Symbol("mini-react.text");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Fragment = Symbol("mini-react.fragment") as any;

export const NodeTypes = {
  HOST: "host",
  TEXT: "text",
  COMPONENT: "component",
  FRAGMENT: "fragment",
} as const;

export type NodeType = ValueOf<typeof NodeTypes>;

export const HookTypes = {
  STATE: "state",
  EFFECT: "effect",
} as const;

export type HookType = typeof HookTypes;
