export interface DocumentItem { id: string; title: string; original_filename: string; version: number; status: string; created_at: string; created_by: string; sha256: string; size_bytes: number | null; signature_request_count: number; completed_signature_count: number; }
export type SignatureMode = 'evidence' | 'serpro_timestamp' | 'serproid';
export interface SignatureRequest { id: string; document_id: string; document_version: number; document_title: string; original_filename: string; status: string; expires_at: string; created_at: string; created_by: string; completed_at: string | null; signer_count: number; signed_count: number; signature_mode: SignatureMode; }
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
export interface Signer { id: string; name: string; email: string; preferred_locale: 'pt-BR' | 'en' | 'es' | 'ja-JP'; status: string; signed_at: string | null; identity_document_type?: string | null; identity_document_country?: string | null; identity_document_masked?: string | null; }
export interface UserCreated { id: string; name: string; email: string; role: string; is_active: boolean; }
export interface SignerOption { id: string; name: string; email: string; }
export interface SignerContact { name: string; email: string; }
export interface TenantItem { id: string; name: string; slug: string; role: string; currency: string; }
export interface BillingAccount {
  id: string;
  tenant_id: string;
  status: string;
  free_signatures_limit: number;
  signatures_used: number;
  signatures_remaining: number | null;
  unlimited_signatures: boolean;
  files_uploaded_in_period?: number;
  files_limit?: number | null;
  files_remaining?: number | null;
  unlimited_files?: boolean;
  email_invitations_enabled?: boolean;
  usage_period_starts_at?: string | null;
  complimentary_lifetime: boolean;
  current_product_code?: string | null;
  provider_customer_id?: string | null;
  provider_subscription_id?: string | null;
  current_period_ends_at?: string | null;
  cancel_at_period_end?: boolean;
  cancels_at?: string | null;
}
export interface BillingCheckout { checkout_url: string; }
export interface BillingPortal { portal_url: string; }
export interface StampPosition { page: number; x: number; y: number; locale?: 'pt-BR' | 'en' | 'es' | 'ja-JP'; timezone?: string; }
export interface SigningContext {
  request: SignatureRequest;
  signer: Signer;
  document_title: string;
  original_filename: string;
  account_country?: string | null;
  stamp: StampPosition | null;
  viewer_mode: 'signer' | 'administrator';
}
