import type { Store } from '../store';
import type { OKRRecord, KeyResult } from '../shared/intent-types';

export interface OKRGap extends KeyResult {
  okrId: string;
  objective: string;
}

export class InspectorService {
  constructor(private readonly store: Store) {}

  /**
   * Scans all active OKRs and returns KRs that are behind or at risk.
   */
  public async inspect(): Promise<OKRGap[]> {
    const okrs = await this.store.getOKRs();
    const gaps: OKRGap[] = [];

    for (const okr of okrs) {
      if (okr.status !== 'active') continue;

      for (const kr of okr.keyResults) {
        if (kr.status === 'completed') continue;

        // Naive gap detection: current < target
        if (kr.currentValueValue < kr.targetValue) {
          gaps.push({
            ...kr,
            okrId: okr.id,
            objective: okr.objective,
          });
        }
      }
    }

    return gaps;
  }
}
