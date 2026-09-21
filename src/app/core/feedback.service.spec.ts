import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { FeedbackService } from './feedback.service';
import { I18nService } from './i18n.service';

describe('FeedbackService', () => {
  let service: FeedbackService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    TestBed.inject(I18nService).setLocale('pt-BR');
    service = TestBed.inject(FeedbackService);
  });

  it('translates authentication errors', () => {
    const error = new HttpErrorResponse({ status: 401, error: { detail: 'Authentication required' } });
    expect(service.message(error)).toContain('sessão');
  });

  it('shows invalid credentials instead of a connection error on login', () => {
    const error = new HttpErrorResponse({ status: 401, error: { detail: 'Invalid credentials' } });
    expect(service.message(error)).toBe('E-mail ou senha incorretos.');
    expect(service.message('E-mail ou senha incorretos.')).toBe('E-mail ou senha incorretos.');
  });

  it('formats API validation errors', () => {
    const error = new HttpErrorResponse({ status: 422, error: { detail: [{ loc: ['body', 'cpf'], msg: 'Value error, CPF inválido' }] } });
    expect(service.message(error)).toBe('CPF: CPF inválido');
  });

  it('uses a friendly message when the server is unavailable', () => {
    expect(service.message(new HttpErrorResponse({ status: 503 }))).toContain('temporariamente indisponível');
  });
});
