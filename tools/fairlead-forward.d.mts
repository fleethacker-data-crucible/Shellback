export function readLocalTokenText(text: string): string | null;
export function localTokenDisabled(env: { FAIRLEAD_LOCAL_TOKEN?: string }): boolean;
export function allowedForward(method: string, pathname: string): boolean;
export function parseFairleadId(value: unknown): { ok: true; pid: number; path: string } | { ok: false; error: string };
export function pathsEqual(a: string, b: string): boolean;
export function identityDecision(
  id: { ok: true; pid: number; path: string } | { ok: false; error: string },
  listenerPids: number[] | null,
  processPaths: string[],
): { ok: true } | { ok: false; error: string };
export function scrub(text: string, token: string): string;
export function parseProcNetTcp(text: string, port: number): string[];
export const ID_TIMEOUT_MS: number;
export const FORWARD_TIMEOUT_MS: number;
export const MAX_RESPONSE_BYTES: number;
export function fairleadSocketOptions(timeoutMs: number): { host: string; port: number; timeout: number };
export function pinnedContentType(raw: string | undefined): string;
export function loopbackFairleadRequest(call: {
  method: string;
  path: string;
  headers?: Record<string, string>;
  body?: Buffer;
  timeoutMs: number;
}): Promise<{ status: number; headers: Record<string, string>; body: Buffer }>;
export function handleFairleadProxy(input: {
  method: string;
  pathname: string;
  body?: Buffer;
  originOk: boolean;
  env: NodeJS.ProcessEnv;
  requestImpl?: typeof loopbackFairleadRequest;
  listenerPids: () => number[] | null;
  processPaths: (pid: number) => string[];
  readToken?: () => string | null;
}): Promise<{ status: number; contentType: string; body: Buffer }>;
