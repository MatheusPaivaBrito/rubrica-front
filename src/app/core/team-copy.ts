import { Locale } from './i18n.service';

const en = {
  team: 'Team', dashboard: 'Dashboard', help: 'Manage who has access to this workspace.',
  active: 'Active', suspended: 'Suspended', admin: 'Administrator', member: 'Member', auditor: 'Auditor',
  selected: 'selected', limit: 'Plan limit', save: 'Save active members', saved: 'Team updated.',
  overLimit: 'Your current plan has fewer seats. Select the members who will remain active to resume workspace access.',
  owner: 'Keep your administrator account active.', readonly: 'Only administrators can change the active members.',
  preserved: 'Suspension only removes access to this workspace. Documents and signature history are preserved.',
  empty: 'No accessible workspace.', choose: 'Active access', nav: 'Workspace navigation', openMenu: 'Open navigation', closeMenu: 'Close navigation',
};
export type TeamCopy = typeof en;
export const teamCopy: Record<Locale, TeamCopy> = {
  en,
  'pt-BR': {
    team: 'Time', dashboard: 'Dashboard', help: 'Gerencie quem tem acesso a esta conta.',
    active: 'Ativo', suspended: 'Suspenso', admin: 'Administrador', member: 'Membro', auditor: 'Auditor',
    selected: 'selecionados', limit: 'Limite do plano', save: 'Salvar membros ativos', saved: 'Time atualizado.',
    overLimit: 'Seu plano atual tem menos vagas. Escolha os membros que permanecerão ativos para liberar o acesso à conta.',
    owner: 'Mantenha sua conta de administrador ativa.', readonly: 'Somente administradores podem alterar os membros ativos.',
    preserved: 'A suspensão remove apenas o acesso a esta conta. Documentos e histórico de assinaturas são preservados.',
    empty: 'Nenhuma conta disponível.', choose: 'Acesso ativo', nav: 'Navegação da conta', openMenu: 'Abrir menu', closeMenu: 'Fechar menu',
  },
  es: {
    team: 'Equipo', dashboard: 'Panel', help: 'Administra quién tiene acceso a esta cuenta.',
    active: 'Activo', suspended: 'Suspendido', admin: 'Administrador', member: 'Miembro', auditor: 'Auditor',
    selected: 'seleccionados', limit: 'Límite del plan', save: 'Guardar miembros activos', saved: 'Equipo actualizado.',
    overLimit: 'Tu plan actual tiene menos plazas. Selecciona quién seguirá activo para restablecer el acceso.',
    owner: 'Mantén activa tu cuenta de administrador.', readonly: 'Solo los administradores pueden cambiar los miembros activos.',
    preserved: 'La suspensión solo elimina el acceso a esta cuenta. Se conservan los documentos y el historial de firmas.',
    empty: 'No hay cuentas disponibles.', choose: 'Acceso activo', nav: 'Navegación de la cuenta', openMenu: 'Abrir menú', closeMenu: 'Cerrar menú',
  },
  'ja-JP': {
    team: 'チーム', dashboard: 'ダッシュボード', help: 'このアカウントにアクセスできるメンバーを管理します。',
    active: '有効', suspended: '停止中', admin: '管理者', member: 'メンバー', auditor: '監査者',
    selected: '選択済み', limit: 'プランの上限', save: '有効なメンバーを保存', saved: 'チームを更新しました。',
    overLimit: '現在のプランの人数上限を超えています。アクセスを再開するには有効なメンバーを選択してください。',
    owner: '自分の管理者アカウントは有効にしてください。', readonly: '有効なメンバーを変更できるのは管理者のみです。',
    preserved: '停止されるのはこのアカウントへのアクセスのみです。文書と署名履歴は保持されます。',
    empty: '利用可能なアカウントがありません。', choose: 'アクセスを有効にする', nav: 'アカウントのナビゲーション', openMenu: 'メニューを開く', closeMenu: 'メニューを閉じる',
  },
};
