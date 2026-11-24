import { Directive, ElementRef, HostListener, Input, inject } from '@angular/core';

export function dropdownPlacement(menuHeight: number, above: number, below: number) {
  const opensUp = menuHeight > below && above > below;
  return { opensUp, maxHeight: Math.max(0, opensUp ? above : below) };
}

@Directive({ selector: 'details[appViewportDropdown]', standalone: true })
export class ViewportDropdownDirective {
  @Input() appViewportDropdown = false;
  private readonly element = inject<ElementRef<HTMLDetailsElement>>(ElementRef);

  @HostListener('toggle')
  @HostListener('window:resize')
  fit(): void {
    const details = this.element.nativeElement;
    if (!this.appViewportDropdown || !details.open) return;
    const trigger = details.querySelector('summary');
    const menu = details.querySelector<HTMLElement>('.language-options, .rubrica-select-options');
    if (!trigger || !menu) return;

    const triggerRect = trigger.getBoundingClientRect();
    const viewport = window.visualViewport;
    const top = viewport?.offsetTop ?? 0;
    const bottom = top + (viewport?.height ?? window.innerHeight);
    const clearance = 16;
    const preferredHeight = Math.min(menu.scrollHeight + 2, 272);
    const placement = dropdownPlacement(
      preferredHeight, triggerRect.top - top - clearance, bottom - triggerRect.bottom - clearance,
    );
    details.classList.toggle('opens-up', placement.opensUp);
    details.style.setProperty('--sidebar-dropdown-height', `${placement.maxHeight}px`);
  }
}
