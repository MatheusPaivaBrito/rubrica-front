import { Locale } from './i18n.service';

export type ClientPlatform = 'windows' | 'macos' | 'android' | 'ios' | 'linux' | 'other';

export function detectClientPlatform(userAgent: string, platform = '', maxTouchPoints = 0): ClientPlatform {
  const value = `${userAgent} ${platform}`.toLowerCase();
  if (/iphone|ipad|ipod/.test(value) || (value.includes('mac') && maxTouchPoints > 1)) return 'ios';
  if (value.includes('android')) return 'android';
  if (value.includes('windows')) return 'windows';
  if (value.includes('mac')) return 'macos';
  if (value.includes('linux')) return 'linux';
  return 'other';
}

export function pdfUploadHelp(locale: Locale, platform: ClientPlatform): { title: string; html: string } {
  const content = COPY[locale];
  const steps = content.steps[platform];
  return {
    title: content.title,
    html: `<div class="pdf-security-help"><p>${content.reason}</p><h3>${content.how}</h3><ol>${steps.map(step => `<li>${step}</li>`).join('')}</ol><p><strong>${content.review}</strong></p><p>${content.safety}</p></div>`,
  };
}

const COPY: Record<Locale, {
  title: string; reason: string; how: string; review: string; safety: string;
  steps: Record<ClientPlatform, string[]>;
}> = {
  'pt-BR': {
    title: 'Crie uma cópia segura deste PDF',
    reason: 'Este arquivo contém recursos ativos, anexos ou uma estrutura que pode executar ações. Por segurança, o Rubrica não armazena esse tipo de PDF.',
    how: 'Como gerar uma cópia somente com as páginas visíveis:',
    review: 'Abra a nova cópia e confira todas as páginas antes de enviá-la.',
    safety: 'Imprimir como PDF normalmente remove scripts, formulários ativos e anexos incorporados, preservando o conteúdo visual.',
    steps: {
      windows: ['Abra o arquivo no Microsoft Edge, Google Chrome ou Adobe Reader.', 'Pressione Ctrl + P.', 'Em Impressora, escolha Microsoft Print to PDF ou Salvar como PDF.', 'Clique em Imprimir ou Salvar, escolha outro nome e envie a nova cópia.'],
      macos: ['Abra o arquivo no app Pré-Visualização.', 'No menu Arquivo, escolha Imprimir.', 'Na parte inferior da janela, abra PDF e escolha Salvar como PDF.', 'Salve com outro nome e envie a nova cópia.'],
      android: ['Abra o PDF e toque no menu de três pontos ou em Compartilhar.', 'Escolha Imprimir.', 'Na lista de impressoras, selecione Salvar como PDF.', 'Toque no botão PDF, salve o arquivo e envie a nova cópia.'],
      ios: ['Abra o PDF e toque em Compartilhar.', 'Escolha Imprimir.', 'Na prévia, afaste dois dedos sobre uma página para abrir o PDF.', 'Toque em Compartilhar novamente, escolha Salvar em Arquivos e envie essa cópia.'],
      linux: ['Abra o PDF no visualizador ou navegador.', 'Pressione Ctrl + P.', 'Escolha Imprimir para arquivo e selecione PDF.', 'Salve com outro nome e envie a nova cópia.'],
      other: ['Abra o PDF em um navegador ou visualizador confiável.', 'Abra a opção Imprimir.', 'Escolha Salvar como PDF ou Imprimir para PDF.', 'Salve com outro nome e envie a nova cópia.'],
    },
  },
  en: {
    title: 'Create a safe copy of this PDF', reason: 'This file contains active features, attachments, or a structure that can perform actions. Rubrica does not store this type of PDF for security reasons.', how: 'Create a copy containing only the visible pages:', review: 'Open the new copy and review every page before uploading it.', safety: 'Print to PDF normally removes scripts, active forms, and embedded attachments while preserving visible content.',
    steps: {
      windows: ['Open the file in Microsoft Edge, Google Chrome, or Adobe Reader.', 'Press Ctrl + P.', 'Choose Microsoft Print to PDF or Save as PDF.', 'Print or save with a different name, then upload the new copy.'],
      macos: ['Open the file in Preview.', 'Choose File, then Print.', 'Open PDF at the bottom and choose Save as PDF.', 'Save with a different name, then upload the new copy.'],
      android: ['Open the PDF and use the three-dot or Share menu.', 'Choose Print.', 'Select Save as PDF as the printer.', 'Tap the PDF button, save, and upload the new copy.'],
      ios: ['Open the PDF and tap Share.', 'Choose Print.', 'Pinch outward on a preview page to open the PDF.', 'Tap Share again, save to Files, and upload that copy.'],
      linux: ['Open the PDF in a viewer or browser.', 'Press Ctrl + P.', 'Choose Print to File and select PDF.', 'Save with a different name, then upload the new copy.'],
      other: ['Open the PDF in a trusted browser or viewer.', 'Open Print.', 'Choose Save as PDF or Print to PDF.', 'Save with a different name, then upload the new copy.'],
    },
  },
  es: {
    title: 'Crea una copia segura de este PDF', reason: 'Este archivo contiene funciones activas, adjuntos o una estructura capaz de ejecutar acciones. Por seguridad, Rubrica no almacena este tipo de PDF.', how: 'Crea una copia que contenga solo las páginas visibles:', review: 'Abre la copia nueva y revisa todas las páginas antes de subirla.', safety: 'Imprimir como PDF normalmente elimina scripts, formularios activos y adjuntos incorporados, conservando el contenido visible.',
    steps: {
      windows: ['Abre el archivo en Microsoft Edge, Google Chrome o Adobe Reader.', 'Pulsa Ctrl + P.', 'Elige Microsoft Print to PDF o Guardar como PDF.', 'Guarda con otro nombre y sube la copia nueva.'],
      macos: ['Abre el archivo en Vista Previa.', 'Ve a Archivo y elige Imprimir.', 'Abre PDF en la parte inferior y elige Guardar como PDF.', 'Guarda con otro nombre y sube la copia nueva.'],
      android: ['Abre el PDF y toca el menú de tres puntos o Compartir.', 'Elige Imprimir.', 'Selecciona Guardar como PDF.', 'Guarda el archivo y sube la copia nueva.'],
      ios: ['Abre el PDF y toca Compartir.', 'Elige Imprimir.', 'Separa dos dedos sobre una página de la vista previa.', 'Comparte de nuevo, guarda en Archivos y sube esa copia.'],
      linux: ['Abre el PDF en un visor o navegador.', 'Pulsa Ctrl + P.', 'Elige Imprimir a archivo y selecciona PDF.', 'Guarda con otro nombre y sube la copia nueva.'],
      other: ['Abre el PDF en un navegador o visor confiable.', 'Abre Imprimir.', 'Elige Guardar como PDF o Imprimir a PDF.', 'Guarda con otro nombre y sube la copia nueva.'],
    },
  },
  'ja-JP': {
    title: 'このPDFの安全なコピーを作成してください', reason: 'このファイルには、アクティブ機能、添付ファイル、または操作を実行できる構造が含まれています。セキュリティ上、Rubricaではこの種類のPDFを保存しません。', how: '表示されているページだけを含むコピーの作成方法：', review: 'アップロードする前に、新しいコピーを開いて全ページを確認してください。', safety: 'PDFとして印刷すると、通常は表示内容を保ちながら、スクリプト、アクティブフォーム、埋め込み添付ファイルが削除されます。',
    steps: {
      windows: ['Microsoft Edge、Google Chrome、またはAdobe Readerで開きます。', 'Ctrl + Pを押します。', 'Microsoft Print to PDFまたはPDFとして保存を選びます。', '別名で保存し、新しいコピーをアップロードします。'],
      macos: ['プレビューで開きます。', 'ファイルからプリントを選びます。', '下部のPDFメニューからPDFとして保存を選びます。', '別名で保存し、新しいコピーをアップロードします。'],
      android: ['PDFを開き、3点メニューまたは共有をタップします。', '印刷を選びます。', 'プリンターでPDFとして保存を選びます。', '保存した新しいコピーをアップロードします。'],
      ios: ['PDFを開き、共有をタップします。', 'プリントを選びます。', 'プレビューのページを2本指で広げます。', 'もう一度共有し、ファイルに保存して、そのコピーをアップロードします。'],
      linux: ['ビューアーまたはブラウザーでPDFを開きます。', 'Ctrl + Pを押します。', 'ファイルに印刷でPDFを選びます。', '別名で保存し、新しいコピーをアップロードします。'],
      other: ['信頼できるブラウザーまたはビューアーでPDFを開きます。', '印刷を開きます。', 'PDFとして保存またはPDFに印刷を選びます。', '別名で保存し、新しいコピーをアップロードします。'],
    },
  },
};
