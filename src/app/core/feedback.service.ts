import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import Swal, { SweetAlertIcon } from 'sweetalert2';

import { accessTokenKey } from './api-auth.interceptor';

interface ValidationIssue {
  loc?: Array<string | number>;
  msg?: string;
}

@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private handlingUnauthorized = false;

  constructor(private readonly router: Router) {}

  async error(error: unknown, title = 'Não foi possível concluir'): Promise<void> {
    const unauthorized = this.status(error) === 401;
    if (unauthorized && this.handlingUnauthorized) return;
    if (unauthorized) this.handlingUnauthorized = true;
    await Swal.fire({
      icon: 'error',
      title,
      text: this.message(error),
      confirmButtonText: 'Entendi',
      confirmButtonColor: '#187a66',
    });
    if (unauthorized) {
      const returnUrl = this.router.url;
      sessionStorage.removeItem(accessTokenKey);
      await this.router.navigate(['/login'], { queryParams: returnUrl.startsWith('/login') ? undefined : { returnUrl } });
      this.handlingUnauthorized = false;
    }
  }

  async warning(message: string, title = 'Atenção'): Promise<void> {
    await this.show('warning', title, message);
  }

  message(error: unknown, fallback = 'Ocorreu um erro inesperado. Tente novamente.'): string {
    if (typeof error === 'string') return this.translate(error);
    if (!(error instanceof HttpErrorResponse) && !this.isHttpLike(error)) return fallback;

    const response = error as HttpErrorResponse;
    const detail = response.error?.detail;
    if (Array.isArray(detail)) return detail.map(issue => this.validationMessage(issue)).join('\n');
    if (typeof detail === 'string') return this.translate(detail, response.status);
    if (typeof response.error?.message === 'string') return this.translate(response.error.message, response.status);

    return this.statusMessage(response.status) || fallback;
  }

  private async show(icon: SweetAlertIcon, title: string, text: string): Promise<void> {
    await Swal.fire({ icon, title, text, confirmButtonText: 'Entendi', confirmButtonColor: '#187a66' });
  }

  private validationMessage(issue: ValidationIssue): string {
    const rawField = String(issue.loc?.at(-1) || 'campo');
    const fields: Record<string, string> = {
      cpf: 'CPF', email: 'E-mail', password: 'Senha', name: 'Nome', role: 'Perfil',
      expires_at: 'Data de expiração', document_id: 'Documento', stamp: 'Carimbo',
      page: 'Página', x: 'Posição horizontal', y: 'Posição vertical',
    };
    const message = (issue.msg || 'valor inválido')
      .replace('Field required', 'é obrigatório')
      .replace('Value error, ', '')
      .replace('String should have at least', 'deve ter pelo menos')
      .replace('characters', 'caracteres');
    return `${fields[rawField] || rawField}: ${message}`;
  }

  private translate(message: string, status = 0): string {
    const translations: Record<string, string> = {
      'authentication required': 'Sua sessão expirou ou você ainda não entrou. Faça login novamente.',
      'invalid or expired access token': 'Sua sessão expirou. Faça login novamente.',
      'invalid credentials': 'E-mail ou senha incorretos.',
      'forbidden': 'Seu perfil não possui permissão para realizar esta ação.',
      'signing link is invalid': 'Este link de assinatura é inválido ou foi substituído.',
      'signature request has expired': 'O prazo desta solicitação de assinatura terminou.',
      'signature request is not open': 'Esta solicitação não está aberta para assinatura.',
      'authenticated user does not match a signer for this request': 'Sua conta não está cadastrada como signatária deste documento.',
      'signing access has been revoked': 'O acesso a esta assinatura foi revogado.',
      'signer has already signed': 'Este documento já foi assinado por você.',
      'signer already answered': 'Você já respondeu a esta solicitação.',
      'explicit consent is required': 'É necessário confirmar o consentimento para assinar.',
      'a document linked to an active signature request cannot be deleted': 'O documento possui uma solicitação ativa e não pode ser excluído.',
      'email already registered': 'Já existe um usuário cadastrado com este e-mail.',
      'cpf already registered': 'Já existe um usuário cadastrado com este CPF.',
    };
    const translated = translations[message.trim().toLowerCase()];
    return translated || this.statusMessage(status) || message;
  }

  private statusMessage(status: number): string {
    const messages: Record<number, string> = {
      0: 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
      400: 'Os dados enviados são inválidos. Revise as informações e tente novamente.',
      401: 'Sua sessão expirou ou você ainda não entrou. Faça login novamente.',
      403: 'Seu perfil não possui permissão para realizar esta ação.',
      404: 'O recurso solicitado não foi encontrado.',
      409: 'A operação não pode ser concluída no estado atual.',
      410: 'Este link não está mais disponível.',
      413: 'O arquivo enviado é maior que o limite permitido.',
      422: 'Revise os campos informados e tente novamente.',
      500: 'O servidor encontrou um problema. Tente novamente em alguns instantes.',
      502: 'O serviço está temporariamente indisponível. Tente novamente.',
      503: 'O serviço está temporariamente indisponível. Tente novamente.',
    };
    return messages[status] || '';
  }

  private isHttpLike(error: unknown): error is { error?: unknown; status: number } {
    return typeof error === 'object' && error !== null && 'status' in error;
  }

  private status(error: unknown): number {
    return this.isHttpLike(error) ? Number(error.status) : 0;
  }
}
