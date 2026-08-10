export interface DocumentItem { id: string; title: string; original_filename: string; version: number; status: string; created_at: string; }
export interface SignatureRequest { id: string; document_id: string; document_version: number; status: string; expires_at: string; signer_count: number; signed_count: number; }
export interface SigningLink { signing_url: string; }
export interface SignatureEvidence {
  signature_id: string;
  signer_id: string;
  request_id: string;
  document_id: string;
  document_version: number;
  signed_at: string;
  signer_name: string;
  signer_email: string;
  subject_hmac_sha256: string;
  original_sha256: string;
  evidence_sha256: string;
  artifact_sha256: string;
  evidence: Record<string, unknown>;
}
export interface Signer { id: string; name: string; email: string; status: string; signed_at: string | null; }
export interface UserCreated { id: string; name: string; email: string; role: string; is_active: boolean; }
export interface SignerOption { id: string; name: string; email: string; }
export interface StampPosition { page: number; x: number; y: number; }
export interface SigningContext {
  request: SignatureRequest;
  signer: Signer;
  document_title: string;
  original_filename: string;
  stamp: StampPosition | null;
  viewer_mode: 'signer' | 'administrator';
}
