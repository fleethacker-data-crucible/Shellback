/**
 * Hand-off file for Lazarette's Synapse credential import
 * (`POST /api/packages/synapse/import`). Names, issuer, and expiry only.
 * Lazarette records each row as self-declared. Notes, ids, and verifiers stay in Shellback.
 */
export interface LazaretteSynapseCredential {
  name: string;
  authority: string;
  expiry: string;
}

export interface LazaretteSynapseImport {
  credentials: LazaretteSynapseCredential[];
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** At most 150 rows, which is the limit Lazarette accepts on that route. */
export function lazaretteSynapseImport(credentials: readonly { name: string; authority: string; expiry: string }[]): LazaretteSynapseImport {
  const out: LazaretteSynapseCredential[] = [];
  for (const c of credentials) {
    if (out.length >= 150) break;
    const name = c.name.trim().slice(0, 160);
    if (!name) continue;
    out.push({
      name,
      authority: c.authority.trim().slice(0, 160),
      expiry: DATE.test(c.expiry) ? c.expiry : '',
    });
  }
  return { credentials: out };
}
