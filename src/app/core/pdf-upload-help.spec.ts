import { detectClientPlatform, pdfUploadHelp } from './pdf-upload-help';

describe('PDF upload help', () => {
  it('detects common client operating systems', () => {
    expect(detectClientPlatform('Mozilla/5.0 (Windows NT 10.0)')).toBe('windows');
    expect(detectClientPlatform('Mozilla/5.0 (Linux; Android 15)')).toBe('android');
    expect(detectClientPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)')).toBe('ios');
    expect(detectClientPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X)')).toBe('macos');
    expect(detectClientPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X)', 'MacIntel', 5)).toBe('ios');
  });

  it('provides localized platform-specific steps', () => {
    const help = pdfUploadHelp('pt-BR', 'windows');
    expect(help.title).toContain('cópia segura');
    expect(help.html).toContain('Ctrl + P');
    expect(help.html).toContain('Microsoft Print to PDF');
  });
});
