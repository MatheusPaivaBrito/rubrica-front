import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, QueryList, SimpleChanges, ViewChildren, signal } from '@angular/core';
import { firstValueFrom, Subscription } from 'rxjs';
import { GlobalWorkerOptions, getDocument, PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';

import { ApiService } from '../core/api.service';
import { Signer, StampCustomization, StampPosition } from '../core/models';
import { countryFlag } from '../core/countries';
import { I18nService } from '../core/i18n.service';

GlobalWorkerOptions.workerSrc = '/pdf.worker.compat.mjs?v=6.3.289';

interface PdfPageView {
  number: number;
  width: number;
  height: number;
}

@Component({
  selector: 'app-pdf-stamp-viewer',
  standalone: true,
  template: `
    <div class="pdf-canvas-viewer" [class.readonly]="readonly" [class.fit-page]="fitMode === 'page'" [class.fit-width]="fitMode === 'width'">
      @if (loading()) { <p class="pdf-loading">{{ i18n.text('preparingPdf') }}</p> }
      @if (error()) { <p class="error">{{ error() }}</p> }
      @for (page of pages(); track page.number) {
        <div
          class="pdf-page"
          [style.width.px]="page.width"
          [style.--pdf-page-ratio]="page.width / page.height"
          [style.aspect-ratio]="page.width + ' / ' + page.height"
          (pointerdown)="startPageInteraction($event)"
          (pointermove)="trackPageInteraction($event)"
          (pointerup)="finishPageInteraction($event, page.number)"
          (pointercancel)="cancelPageInteraction()"
        >
          <canvas #pageCanvas [attr.aria-label]="i18n.text('page') + ' ' + page.number"></canvas>
          @for (visiblePlacement of visiblePlacements(page.number); track placementKey(visiblePlacement, $index)) {
            <div
              class="signature-stamp"
              [class.active-signer]="isActivePlacement(visiblePlacement)"
              [class.inactive-signer]="!isActivePlacement(visiblePlacement)"
              [class.minimal]="stampVariant(visiblePlacement) === 'minimal'"
              [class.drawn]="stampVariant(visiblePlacement) === 'drawn'"
              [class.movable]="!readonly && isActivePlacement(visiblePlacement)"
              [style.left.%]="visiblePlacement.x * 100"
              [style.top.%]="visiblePlacement.y * 100"
              [style.width.%]="stampWidthPercent(page, visiblePlacement)"
              [style.height.%]="stampHeightPercent(page, visiblePlacement)"
              [style.border-color]="customization?.primary_color"
              (pointerdown)="startDrag($event, visiblePlacement)"
              (pointermove)="dragStamp($event, page.number)"
              (pointerup)="finishDrag($event)"
              (pointercancel)="finishDrag($event)"
              (click)="$event.stopPropagation()"
            >
              @if (stampVariant(visiblePlacement) === 'drawn') {
                <span class="stamp-drawn-preview">Sua assinatura</span>
              } @else {
                @if (placementSignerFlag(visiblePlacement)) { <span class="stamp-country">{{ placementSignerFlag(visiblePlacement) }}</span> }
                <span>{{ placementSignedByLabel(visiblePlacement) }}</span>
                <strong>{{ placementSignerName(visiblePlacement) }}</strong>
                @if (placementSignerIdentity(visiblePlacement) && stampVariant(visiblePlacement) === 'full') { <small class="stamp-identity">{{ placementSignerIdentity(visiblePlacement) }}</small> }
                @if (placementSignerRepresentation(visiblePlacement) && stampVariant(visiblePlacement) === 'full') { <small class="stamp-representation">{{ placementSignerRepresentation(visiblePlacement) }}</small> }
                @if (stampVariant(visiblePlacement) === 'full') { <small>{{ i18n.formatDate(stampDate) }}</small> }
                @if (stampVariant(visiblePlacement) === 'full') { <small class="stamp-evidence">Evidência: SHA-256 registrada ao assinar</small> }
                @if (customization?.show_logo && customization?.logo_png_data_url) { <img class="stamp-logo-preview" [src]="customization!.logo_png_data_url" alt="" /> }
              }
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class PdfStampViewerComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() token = '';
  @Input() sourceData: ArrayBuffer | null = null;
  @Input() documentEndpoint = 'document';
  @Input() signerName = '';
  @Input() signerIdentity = '';
  @Input() signerRepresentation = '';
  @Input() signerCountry = '';
  @Input() stampDate: string | Date = new Date();
  @Input() placement: StampPosition | null = null;
  @Input() placements: StampPosition[] = [];
  @Input() signers: Signer[] = [];
  @Input() activeSignerId = '';
  @Input() customization: StampCustomization | null = null;
  @Input() fitMode: 'page' | 'width' = 'width';
  @Input() readonly = false;
  @Output() readonly placementChange = new EventEmitter<StampPosition>();
  @Output() readonly pageCountChange = new EventEmitter<number>();
  @ViewChildren('pageCanvas') private readonly canvases!: QueryList<ElementRef<HTMLCanvasElement>>;

  readonly pages = signal<PdfPageView[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  private document: PDFDocumentProxy | null = null;
  private loadingTask: PDFDocumentLoadingTask | null = null;
  private canvasesSubscription?: Subscription;
  private renderingDocument: PDFDocumentProxy | null = null;
  private dragging = false;
  private draggingPlacement: StampPosition | null = null;
  private pagePointerStart: { id: number; x: number; y: number; moved: boolean } | null = null;

  constructor(private readonly api: ApiService, readonly i18n: I18nService) {}

  ngAfterViewInit(): void {
    this.canvasesSubscription = this.canvases.changes.subscribe(() => void this.renderPages());
    void this.loadDocument();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (
      (changes['token'] && !changes['token'].firstChange)
      || (changes['sourceData'] && !changes['sourceData'].firstChange)
      || (changes['documentEndpoint'] && !changes['documentEndpoint'].firstChange)
    ) void this.loadDocument();
  }

  ngOnDestroy(): void {
    this.canvasesSubscription?.unsubscribe();
    void this.loadingTask?.destroy();
  }

  startPageInteraction(event: PointerEvent): void {
    if (this.readonly || this.dragging) return;
    this.pagePointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
  }

  trackPageInteraction(event: PointerEvent): void {
    const start = this.pagePointerStart;
    if (!start || start.id !== event.pointerId) return;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) start.moved = true;
  }

  finishPageInteraction(event: PointerEvent, page: number): void {
    const start = this.pagePointerStart;
    this.pagePointerStart = null;
    if (!start || start.id !== event.pointerId || start.moved || this.readonly || this.dragging) return;
    this.updatePlacement(event, page);
  }

  cancelPageInteraction(): void { this.pagePointerStart = null; }

  startDrag(event: PointerEvent, placement: StampPosition): void {
    if (this.readonly || !this.isActivePlacement(placement)) return;
    event.stopPropagation();
    this.dragging = true;
    this.draggingPlacement = placement;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  dragStamp(event: PointerEvent, page: number): void {
    if (!this.dragging || this.readonly) return;
    event.stopPropagation();
    this.updatePlacement(event, page);
  }

  finishDrag(event: PointerEvent): void {
    event.stopPropagation();
    this.dragging = false;
    this.draggingPlacement = null;
  }

  signerFlag(): string { return countryFlag(this.effectiveSignerCountry()); }
  stampSignedByLabel(): string {
    return ({ BR: 'ASSINADO ELETRONICAMENTE POR', PT: 'ASSINADO ELETRONICAMENTE POR', ES: 'FIRMADO ELECTRÓNICAMENTE POR', JP: '電子署名者', US: 'ELECTRONICALLY SIGNED BY' } as Record<string, string>)[this.effectiveSignerCountry()] || this.i18n.text('signedBy');
  }
  private effectiveSignerCountry(): string {
    if (this.signerCountry) return this.signerCountry.toUpperCase();
    return /\b(?:CPF|CNPJ)\b/i.test(this.signerIdentity) ? 'BR' : '';
  }
  stampVariant(placement: StampPosition): 'full' | 'minimal' | 'drawn' { return placement.display_variant || this.customization?.display_variant || 'full'; }
  isActivePlacement(placement: StampPosition): boolean { return !this.activeSignerId || placement.signer_id === this.activeSignerId; }
  placementSignerName(placement: StampPosition): string { return this.placementSigner(placement)?.name || this.signerName; }
  placementSignerIdentity(placement: StampPosition): string {
    const signer = this.placementSigner(placement);
    return signer?.identity_document_masked
      ? `${(signer.identity_document_type || '').replace('BR_', '')}: ${signer.identity_document_masked}`
      : placement.signer_id === this.activeSignerId ? this.signerIdentity : 'CPF/CNPJ confirmado no momento da assinatura';
  }
  placementSignerRepresentation(placement: StampPosition): string {
    const signer = this.placementSigner(placement);
    const organization = signer?.representation_snapshot;
    return organization
      ? [organization.legal_name || organization.name, organization.registration_masked].filter(Boolean).join(' · CNPJ: ')
      : placement.signer_id === this.activeSignerId ? this.signerRepresentation : '';
  }
  placementSignerFlag(placement: StampPosition): string { return countryFlag(this.placementSignerCountry(placement)); }
  placementSignedByLabel(placement: StampPosition): string {
    return ({ BR: 'ASSINADO ELETRONICAMENTE POR', PT: 'ASSINADO ELETRONICAMENTE POR', ES: 'FIRMADO ELECTRÓNICAMENTE POR', JP: '電子署名者', US: 'ELECTRONICALLY SIGNED BY' } as Record<string, string>)[this.placementSignerCountry(placement)] || this.i18n.text('signedBy');
  }
  stampWidthPercent(page: PdfPageView, placement: StampPosition): number {
    const requested = placement.width ?? 0.4;
    const maximumPdfWidth = this.stampVariant(placement) === 'minimal' ? 210 : 320;
    return Math.min(requested, (maximumPdfWidth * 1.5) / page.width) * 100;
  }
  stampHeightPercent(page: PdfPageView, placement: StampPosition): number {
    const requested = placement.height ?? 0.12;
    const variant = this.stampVariant(placement);
    if (variant === 'minimal') return (42 * 1.5 / page.height) * 100;
    const minimumPdfHeight = variant === 'drawn' ? 58 : this.signerRepresentation ? 96 : 54;
    return Math.max(requested, (minimumPdfHeight * 1.5) / page.height) * 100;
  }
  visiblePlacements(page: number): StampPosition[] { return (this.placements.length ? this.placements : this.placement ? [this.placement] : []).filter(item => item.page === page); }
  placementKey(item: StampPosition, index: number): string { return `${item.signer_id || 'current'}:${item.page}:${item.order ?? index}`; }

  private placementSigner(placement: StampPosition): Signer | undefined { return this.signers.find((item) => item.id === placement.signer_id); }
  private placementSignerCountry(placement: StampPosition): string {
    const signer = this.placementSigner(placement);
    if (signer?.identity_document_country) return signer.identity_document_country.toUpperCase();
    if (/^BR_/.test(signer?.identity_document_type || '')) return 'BR';
    return placement.signer_id === this.activeSignerId ? this.effectiveSignerCountry() : '';
  }

  private async loadDocument(): Promise<void> {
    if (!this.sourceData && !this.token) return;
    this.loading.set(true);
    this.error.set('');
    try {
      await this.loadingTask?.destroy();
      this.pages.set([]);
      const data = this.sourceData
        ? this.sourceData.slice(0)
        : await firstValueFrom(this.api.getArrayBuffer(`/signing/links/${this.token}/${this.documentEndpoint}`));
      this.loadingTask = getDocument({ data: new Uint8Array(data) });
      this.document = await this.loadingTask.promise;
      const pageViews: PdfPageView[] = [];
      for (let number = 1; number <= this.document.numPages; number += 1) {
        const page = await this.document.getPage(number);
        const viewport = page.getViewport({ scale: 1.5 });
        pageViews.push({ number, width: viewport.width, height: viewport.height });
      }
      this.pages.set(pageViews);
      this.pageCountChange.emit(pageViews.length);
      queueMicrotask(() => void this.renderPages());
    } catch (error) {
      const message = this.i18n.text('pdfRenderFailed');
      this.error.set(message);
      console.error('PDF rendering failed', error);
    } finally {
      this.loading.set(false);
    }
  }

  private async renderPages(): Promise<void> {
    if (!this.document || this.canvases.length !== this.document.numPages) return;
    const document = this.document;
    if (this.renderingDocument === document) return;
    this.renderingDocument = document;
    const canvasItems = this.canvases.toArray();
    try {
      for (const [index, item] of canvasItems.entries()) {
        if (this.document !== document) return;
        const page = await document.getPage(index + 1);
        const viewport = page.getViewport({ scale: 1.5 });
        const outputScale = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(8_000_000 / (viewport.width * viewport.height)));
        const canvas = item.nativeElement;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('PDF canvas is unavailable');
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        await page.render({
          canvas,
          canvasContext: context,
          viewport,
          transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
        }).promise;
      }
    } catch (error) {
      if (this.document === document) {
        this.error.set(this.i18n.text('pdfRenderFailed'));
        console.error('PDF rendering failed', error);
      }
    } finally {
      if (this.renderingDocument === document) this.renderingDocument = null;
    }
  }

  private updatePlacement(event: MouseEvent, page: number): void {
    const pageElement = (event.currentTarget as HTMLElement).closest('.pdf-page') as HTMLElement | null;
    if (!pageElement) return;
    const bounds = pageElement.getBoundingClientRect();
    const x = Math.min(0.84, Math.max(0.16, (event.clientX - bounds.left) / bounds.width));
    const y = Math.min(0.94, Math.max(0.06, (event.clientY - bounds.top) / bounds.height));
    this.placementChange.emit({ ...(this.draggingPlacement || {}), page, x, y });
  }
}
