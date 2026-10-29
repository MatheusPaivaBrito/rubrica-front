export interface DocumentItem { id: string; title: string; original_filename: string; version: number; status: string; created_at: string; created_by: string; sha256: string; size_bytes: number | null; signature_request_count: number; completed_signature_count: number; }
export type SignatureMode = 'evidence' | 'serpro_timestamp' | 'serproid';
export interface OrganizationSnapshot { tenant_id: string; legal_name?: string; name?: string; registration_country?: string; registration_type?: string; registration_masked?: string; }
export type ParticipantRole = 'personal_signer' | 'external_signer' | 'company_representative' | 'corporate_seal';
export interface SignatureRequest { id: string; document_id: string; document_version: number; document_title: string; original_filename: string; status: string; expires_at: string; created_at: string; opened_at: string | null; created_by: string; completed_at: string | null; signer_count: number; signed_count: number; signature_mode: SignatureMode; issuer_snapshot?: OrganizationSnapshot | null; has_custom_stamp_placement?: boolean; has_custom_stamp_branding?: boolean; parent_request_id?: string | null; round_number?: number; reopened_reason?: string | null; reopened_by?: string | null; reopened_at?: string | null; preserved_signature_count?: number; child_request_id?: string | null; }
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
export interface Signer { id: string; name: string; email: string; preferred_locale: 'pt-BR' | 'en' | 'es' | 'ja-JP'; status: string; signed_at: string | null; signature_mode?: 'serpro_timestamp' | 'serproid'; identity_account_status?: 'active' | 'pending' | null; identity_document_type?: string | null; identity_document_country?: string | null; identity_document_masked?: string | null; participant_role?: ParticipantRole; represented_tenant_id?: string | null; representation_snapshot?: OrganizationSnapshot | null; }
export interface UserCreated { id: string; name: string; email: string; role: string; is_active: boolean; }
export interface SignerOption { id: string; name: string; email: string; }
export interface SignerContact { name: string; email: string; }
export interface TenantItem { id: string; name: string; slug: string; role: string; currency: string; kind?: 'personal' | 'business'; legal_name?: string | null; registration_country?: string | null; registration_type?: string | null; registration_masked?: string | null; registration_verification_status?: string | null; }
export interface SuspendedTenantAccess { tenant_id: string; tenant_name: string; tenant_kind: 'personal' | 'business'; role: 'admin' | 'member' | 'auditor'; default_locale: 'pt-BR' | 'en' | 'es' | 'ja-JP'; country_code: string | null; currency: string; }
export interface TenantAccessState { active_tenant_count: number; suspended_tenants: SuspendedTenantAccess[]; can_create_personal_tenant: boolean; }
export interface TenantMember { id: string; auth_user_id: string; role: 'admin' | 'member' | 'auditor'; status: string; joined_at?: string | null; }
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
  custom_stamp_placement?: boolean;
  custom_stamp_branding?: boolean;
  usage_period_starts_at?: string | null;
  complimentary_lifetime: boolean;
  current_product_code?: string | null;
  plan_code?: string;
  contracted_seats?: number;
  entitlements?: string[];
  trusted_timestamp?: boolean;
  serproid_signature?: boolean;
  team_management?: boolean;
  provider_customer_id?: string | null;
  provider_subscription_id?: string | null;
  current_period_ends_at?: string | null;
  cancel_at_period_end?: boolean;
  cancels_at?: string | null;
}
export interface BillingCheckout { checkout_url: string; }
export interface BillingPortal { portal_url: string; }
export interface StampPosition { page: number; x: number; y: number; signer_id?: string | null; width?: number; height?: number; order?: number; display_variant?: 'full' | 'minimal' | 'drawn' | null; locale?: 'pt-BR' | 'en' | 'es' | 'ja-JP'; timezone?: string; }
export interface StampCustomization { template: 'standard' | 'business' | 'representative'; display_variant: 'full' | 'minimal'; primary_color: string; show_logo: boolean; logo_png_data_url?: string | null; require_drawn_signature: boolean; }
export interface StampConfiguration { placements: StampPosition[]; customization: StampCustomization | null; signer_customizations: Record<string, StampCustomization>; signer_signature_modes: Record<string, 'serpro_timestamp' | 'serproid'>; }
export interface SigningContext {
  request: SignatureRequest;
  signer: Signer;
  document_title: string;
  original_filename: string;
  account_country?: string | null;
  stamp: StampPosition | null;
  stamp_positions?: StampPosition[];
  stamp_customization?: StampCustomization | null;
  viewer_mode: 'signer' | 'administrator';
  issuer_snapshot?: OrganizationSnapshot | null;
}

export interface TenantTeam {
  members: TenantMember[];
  member_limit: number | null;
  active_count: number;
  requires_selection: boolean;
  can_manage: boolean;
  current_member_id: string;
  current_seat_member_ids: string[];
  next_cycle_member_ids: string[];
  next_cycle_starts_at: string | null;
  seat_roster_locked: boolean;
}
