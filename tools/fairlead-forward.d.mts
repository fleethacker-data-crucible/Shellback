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
export function handleFairleadProxy(input: {
  method: string;
  pathname: string;
  body?: Buffer;
  originOk: boolean;
  env: NodeJS.ProcessEnv;
  fetchImpl: typeof fetch;
  listenerPids: () => number[] | null;
  processPaths: (pid: number) => string[];
  readToken?: () => string | null;
}): Promise<{ status: number; contentType: string; body: Buffer }>;
