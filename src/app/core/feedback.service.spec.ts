import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { FeedbackService } from './feedback.service';

describe('FeedbackService', () => {
  let service: FeedbackService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    service = TestBed.inject(FeedbackService);
  });

  it('translates authentication errors', () => {
    const error = new HttpErrorResponse({ status: 401, error: { detail: 'Authentication required' } });
    expect(service.message(error)).toContain('sessão');
  });

  it('formats API validation errors', () => {
    const error = new HttpErrorResponse({ status: 422, error: { detail: [{ loc: ['body', 'cpf'], msg: 'Value error, CPF inválido' }] } });
    expect(service.message(error)).toBe('CPF: CPF inválido');
  });

  it('uses a friendly message when the server is unavailable', () => {
    expect(service.message(new HttpErrorResponse({ status: 503 }))).toContain('temporariamente indisponível');
  });
});
