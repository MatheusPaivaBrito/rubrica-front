import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, QueryList, SimpleChanges, ViewChildren, signal } from '@angular/core';
import { firstValueFrom, Subscription } from 'rxjs';
import { GlobalWorkerOptions, getDocument, PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';

import { ApiService } from '../core/api.service';
import { StampPosition } from '../core/models';
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
    <div class="pdf-canvas-viewer" [class.readonly]="readonly">
      @if (loading()) { <p class="pdf-loading">{{ i18n.text('preparingPdf') }}</p> }
      @if (error()) { <p class="error">{{ error() }}</p> }
      @for (page of pages(); track page.number) {
        <div
          class="pdf-page"
          [style.width.px]="page.width"
          [style.aspect-ratio]="page.width + ' / ' + page.height"
          (pointerdown)="placeStamp($event, page.number)"
        >
          <canvas #pageCanvas [attr.aria-label]="'Página ' + page.number"></canvas>
          @if (placement?.page === page.number) {
            <div
              class="signature-stamp"
              [class.movable]="!readonly"
              [style.left.%]="placement!.x * 100"
              [style.top.%]="placement!.y * 100"
              (pointerdown)="startDrag($event)"
              (pointermove)="dragStamp($event, page.number)"
              (pointerup)="finishDrag($event)"
              (pointercancel)="finishDrag($event)"
            >
              @if (signerFlag()) { <span class="stamp-country" [attr.aria-label]="signerCountry">{{ signerFlag() }}</span> }
              <span>{{ i18n.text('signedBy') }}</span>
              <strong>{{ signerName }}</strong>
              @if (signerIdentity) { <small class="stamp-identity">{{ signerIdentity }}</small> }
              <small>{{ i18n.formatDate(stampDate) }}</small>
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
  @Input() signerCountry = '';
  @Input() stampDate: string | Date = new Date();
  @Input() placement: StampPosition | null = null;
  @Input() readonly = false;
  @Output() readonly placementChange = new EventEmitter<StampPosition>();
  @ViewChildren('pageCanvas') private readonly canvases!: QueryList<ElementRef<HTMLCanvasElement>>;

  readonly pages = signal<PdfPageView[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  private document: PDFDocumentProxy | null = null;
  private loadingTask: PDFDocumentLoadingTask | null = null;
  private canvasesSubscription?: Subscription;
  private renderingDocument: PDFDocumentProxy | null = null;
  private dragging = false;

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

  placeStamp(event: PointerEvent, page: number): void {
    if (this.readonly || this.dragging) return;
    this.updatePlacement(event, page);
  }

  startDrag(event: PointerEvent): void {
    if (this.readonly) return;
    event.stopPropagation();
    this.dragging = true;
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
  }

  signerFlag(): string { return countryFlag(this.signerCountry); }

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

  private updatePlacement(event: PointerEvent, page: number): void {
    const pageElement = (event.currentTarget as HTMLElement).closest('.pdf-page') as HTMLElement | null;
    if (!pageElement) return;
    const bounds = pageElement.getBoundingClientRect();
    const x = Math.min(0.84, Math.max(0.16, (event.clientX - bounds.left) / bounds.width));
    const y = Math.min(0.94, Math.max(0.06, (event.clientY - bounds.top) / bounds.height));
    this.placementChange.emit({ page, x, y });
  }
}
