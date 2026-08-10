export interface DocumentItem { id: string; title: string; original_filename: string; version: number; status: string; created_at: string; }
export interface SignatureRequest { id: string; document_id: string; document_version: number; status: string; expires_at: string; signer_count: number; signed_count: number; }
export interface SignerCreated { id: string; email: string; signing_url: string; }
export interface Signer { id: string; name: string; email: string; status: string; signed_at: string | null; }
export interface SigningContext {
  request: SignatureRequest;
  signer: { name: string; email: string; status: string };
  document_title: string;
  original_filename: string;
}
