/**
 * Tracker milestones.
 *
 * A case follows one of two plans, fixed when it is submitted: one with an
 * in-person step at a service point, and one without. Milestones only ever move
 * forward, and they are computed by a single pure function so the tracker can
 * never disagree with the status the same workflow step sets.
 */
import { type Milestone } from '@hao/api-contracts';

const IN_PERSON_PLAN = [
  ['received', 'Application received'],
  ['checks', 'Identity and evidence checks'],
  ['capture', 'In-person capture'],
  ['processing', 'Processing and decision'],
  ['production', 'Document production'],
  ['collection', 'Collection or delivery'],
] as const;

const DIRECT_PLAN = [
  ['received', 'Application received'],
  ['checks', 'Identity and evidence checks'],
  ['processing', 'Processing and decision'],
  ['outcome', 'Outcome and next steps'],
] as const;

/** Passed as `reach` when the last milestone is finished. */
export const ALL_DONE = 'ALL_DONE';

/** How one workflow step moves the tracker. */
export interface MilestoneMove {
  /** The milestone that becomes current; everything before it is done. `ALL_DONE` finishes the plan. */
  reach?: string;
  /**
   * The journey ends here without finishing the plan (withdrawn, or a decision
   * that is not an approval). Milestones that were never reached are removed,
   * so the tracker does not suggest they are still to come.
   */
  stop?: boolean;
}

/** The plan for a new case, with nothing reached yet. */
export function blankMilestones(needsServicePoint: boolean): Milestone[] {
  const plan = needsServicePoint ? IN_PERSON_PLAN : DIRECT_PLAN;
  return plan.map(([key, label]) => ({ key, label, state: 'upcoming', at: null }));
}

/**
 * The milestones after a workflow step.
 *
 * Done milestones keep the time they were finished. A step can never move the
 * tracker backwards: asking for a milestone that is already done changes nothing.
 */
export function milestonesAfter(
  milestones: readonly Milestone[],
  move: MilestoneMove,
  at: string,
): Milestone[] {
  let next = milestones.map((milestone) => ({ ...milestone }));

  if (move.reach !== undefined) {
    const target =
      move.reach === ALL_DONE
        ? next.length
        : next.findIndex((milestone) => milestone.key === move.reach);
    const doneCount = next.filter((milestone) => milestone.state === 'done').length;
    if (target >= doneCount) {
      next = next.map((milestone, index): Milestone => {
        if (index < target) {
          return milestone.state === 'done' ? milestone : { ...milestone, state: 'done', at };
        }
        return { ...milestone, state: index === target ? 'current' : 'upcoming', at: null };
      });
    }
  }

  if (move.stop) next = next.filter((milestone) => milestone.state === 'done');
  return next;
}

/** True when the case follows the plan with an in-person step. */
export function hasInPersonStep(milestones: readonly Milestone[]): boolean {
  return milestones.some((milestone) => milestone.key === 'capture');
}

export function isMilestoneDone(milestones: readonly Milestone[], key: string): boolean {
  return milestones.some((milestone) => milestone.key === key && milestone.state === 'done');
}
