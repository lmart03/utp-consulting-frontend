import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ChevronRight, Contact, LucideAngularModule, Search } from 'lucide-angular';

import { formatShortDateTime } from '@shared/utils/date-format';

import { PROSPECT_FIELD_LABELS, Prospect } from '../../models/prospect.model';
import { ProspectStatusBadgeComponent } from '../prospect-status-badge/prospect-status-badge';

@Component({
  selector: 'app-prospects-table',
  imports: [LucideAngularModule, ProspectStatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './prospects-table.html',
})
export class ProspectsTableComponent {
  readonly prospects = input<Prospect[]>([]);
  readonly loading = input(false);
  readonly search = input('');
  readonly selectProspect = output<number>();
  readonly searchChange = output<string>();

  protected readonly icons = { ChevronRight, Contact, Search };
  protected readonly formatShortDateTime = formatShortDateTime;

  protected missingText(prospect: Prospect): string {
    return prospect.missingFields.map((f) => PROSPECT_FIELD_LABELS[f]).join(', ');
  }

  protected onSearch(event: Event): void {
    this.searchChange.emit((event.target as HTMLInputElement).value);
  }
}
