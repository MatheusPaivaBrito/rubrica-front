import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, QueryList, SimpleChanges, ViewChildren, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { firstValueFrom, Subscription } from 'rxjs';
import { GlobalWorkerOptions, getDocument, PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist';

import { ApiService } from '../core/api.service';
import { FeedbackService } from '../core/feedback.service';
import { StampPosition } from '../core/models';

GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs?v=6.2.108';

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
      @if (loading()) { <p class="pdf-loading">Preparando o documento…</p> }
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
              <span>Assinado por</span>
              <strong>{{ signerName }}</strong>
              <small>{{ stampDate | date:'dd/MM/yyyy HH:mm' }}</small>
            </div>
          }
        </div>
      }
    </div>
  `,
  imports: [DatePipe],
})
export class PdfStampViewerComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) token = '';
  @Input({ required: true }) signerName = '';
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
  private dragging = false;

  constructor(private readonly api: ApiService, private readonly feedback: FeedbackService) {}

  ngAfterViewInit(): void {
    this.canvasesSubscription = this.canvases.changes.subscribe(() => void this.renderPages());
    void this.loadDocument();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['token'] && !changes['token'].firstChange) void this.loadDocument();
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

  private async loadDocument(): Promise<void> {
    if (!this.token) return;
    this.loading.set(true);
    this.error.set('');
    try {
      await this.loadingTask?.destroy();
      const data = await firstValueFrom(this.api.getArrayBuffer(`/signing/links/${this.token}/document`));
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
      const message = 'Não foi possível exibir o PDF. Você ainda pode baixá-lo pelo painel ao lado.';
      this.error.set(message);
      await this.feedback.error(error, message);
    } finally {
      this.loading.set(false);
    }
  }

  private async renderPages(): Promise<void> {
    if (!this.document || this.canvases.length !== this.document.numPages) return;
    const canvasItems = this.canvases.toArray();
    await Promise.all(canvasItems.map(async (item, index) => {
      const page = await this.document!.getPage(index + 1);
      const viewport = page.getViewport({ scale: 1.5 });
      const outputScale = window.devicePixelRatio || 1;
      const canvas = item.nativeElement;
      const context = canvas.getContext('2d');
      if (!context) return;
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
    }));
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
