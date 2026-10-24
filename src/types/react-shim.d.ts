/**
 * OFFLINE TYPE SHIM — used only when @types/react is not installed (tsconfig.offline.json).
 * It types the React 19 APIs this app uses so our own code is checked strictly, while JSX
 * intrinsic element attributes are left open. With @types/react installed (tsconfig.json)
 * this file is excluded and the real definitions take over.
 */
declare module 'react' {
  export type Key = string | number;
  export type ReactNode = ReactElement | string | number | boolean | null | undefined | Iterable<ReactNode>;
  export interface ReactElement<P = unknown> { type: unknown; props: P; key: Key | null }
  export type FC<P = {}> = (props: P) => ReactElement | null;
  export type PropsWithChildren<P = {}> = P & { children?: ReactNode };
  export type CSSProperties = Record<string, string | number | undefined>;
  export type Ref<T> = { current: T | null } | ((instance: T | null) => void) | null;
  export interface RefObject<T> { current: T }
  export type Dispatch<A> = (value: A) => void;
  export type SetStateAction<S> = S | ((prev: S) => S);
  export type Reducer<S, A> = (state: S, action: A) => S;
  export type DependencyList = ReadonlyArray<unknown>;
  export type EffectCallback = () => void | (() => void);

  export interface SyntheticEvent<T = Element, E = Event> { currentTarget: T; target: EventTarget & T; nativeEvent: E; preventDefault(): void; stopPropagation(): void }
  export interface ChangeEvent<T = Element> extends SyntheticEvent<T> {}
  export interface FormEvent<T = Element> extends SyntheticEvent<T> {}
  export interface MouseEvent<T = Element> extends SyntheticEvent<T, globalThis.MouseEvent> { button: number; clientX: number; clientY: number; shiftKey: boolean }
  export interface PointerEvent<T = Element> extends MouseEvent<T> { pointerId: number; pointerType: string }
  export interface KeyboardEvent<T = Element> extends SyntheticEvent<T, globalThis.KeyboardEvent> { key: string; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }
  export interface FocusEvent<T = Element> extends SyntheticEvent<T, globalThis.FocusEvent> {}
  export interface DragEvent<T = Element> extends MouseEvent<T> { dataTransfer: DataTransfer }

  export interface Context<T> { Provider: FC<{ value: T; children?: ReactNode }>; displayName?: string }
  export function createContext<T>(defaultValue: T): Context<T>;
  export function useContext<T>(ctx: Context<T>): T;
  export function useState<S>(initial: S | (() => S)): [S, Dispatch<SetStateAction<S>>];
  export function useState<S = undefined>(): [S | undefined, Dispatch<SetStateAction<S | undefined>>];
  export function useReducer<S, A>(reducer: Reducer<S, A>, initial: S): [S, Dispatch<A>];
  export function useEffect(effect: EffectCallback, deps?: DependencyList): void;
  export function useLayoutEffect(effect: EffectCallback, deps?: DependencyList): void;
  export function useMemo<T>(factory: () => T, deps: DependencyList): T;
  export function useCallback<T extends (...args: never[]) => unknown>(cb: T, deps: DependencyList): T;
  export function useRef<T>(initial: T): RefObject<T>;
  export function useRef<T>(initial: T | null): RefObject<T | null>;
  export function useRef<T = undefined>(): RefObject<T | undefined>;
  export function useId(): string;
  export function useSyncExternalStore<T>(subscribe: (cb: () => void) => () => void, getSnapshot: () => T): T;
  export function useTransition(): [boolean, (cb: () => void) => void];
  export function useDeferredValue<T>(value: T): T;
  export function memo<P>(component: FC<P>, areEqual?: (a: P, b: P) => boolean): FC<P>;
  export function startTransition(cb: () => void): void;
  export const StrictMode: FC<{ children?: ReactNode }>;
  export const Fragment: FC<{ children?: ReactNode; key?: Key }>;
  export function createElement(type: unknown, props?: unknown, ...children: ReactNode[]): ReactElement;
  const React: { createElement: typeof createElement; Fragment: typeof Fragment; StrictMode: typeof StrictMode };
  export default React;
}

declare module 'react/jsx-runtime' {
  export const jsx: unknown;
  export const jsxs: unknown;
  export const Fragment: unknown;
  export namespace JSX {
    type Element = import('react').ReactElement;
    interface ElementChildrenAttribute { children: {} }
    interface IntrinsicAttributes { key?: import('react').Key | null }
    // Attributes are not checked in the offline shim.
    interface IntrinsicElements { [elemName: string]: any }
  }
}

declare module 'react-dom/client' {
  import type { ReactNode } from 'react';
  export interface Root { render(node: ReactNode): void; unmount(): void }
  export function createRoot(container: Element | DocumentFragment): Root;
}
