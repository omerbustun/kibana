/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { v4 as uuidV4 } from 'uuid';
import { get, isEmpty } from 'lodash';
import { ALERT_INSTANCE_ID } from '@kbn/rule-data-utils';
import { CombinedSummarizedAlerts } from '../types';
import {
  AlertInstanceMeta,
  AlertInstanceState,
  RawAlertInstance,
  rawAlertInstance,
  AlertInstanceContext,
  DefaultActionGroupId,
  LastScheduledActions,
} from '../../common';

import { parseDuration } from '../lib';

interface ScheduledExecutionOptions<
  State extends AlertInstanceState,
  Context extends AlertInstanceContext,
  ActionGroupIds extends string = DefaultActionGroupId
> {
  actionGroup: ActionGroupIds;
  context: Context;
  state: State;
}

export type PublicAlert<
  State extends AlertInstanceState = AlertInstanceState,
  Context extends AlertInstanceContext = AlertInstanceContext,
  ActionGroupIds extends string = DefaultActionGroupId
> = Pick<
  Alert<State, Context, ActionGroupIds>,
  | 'getContext'
  | 'getState'
  | 'getUuid'
  | 'hasContext'
  | 'replaceState'
  | 'scheduleActions'
  | 'setContext'
>;

export class Alert<
  State extends AlertInstanceState = AlertInstanceState,
  Context extends AlertInstanceContext = AlertInstanceContext,
  ActionGroupIds extends string = never
> {
  private scheduledExecutionOptions?: ScheduledExecutionOptions<State, Context, ActionGroupIds>;
  private meta: AlertInstanceMeta;
  private state: State;
  private context: Context;
  private readonly id: string;

  constructor(id: string, { state, meta = {} }: RawAlertInstance = {}) {
    this.id = id;
    this.state = (state || {}) as State;
    this.context = {} as Context;
    this.meta = meta;
    this.meta.uuid = meta.uuid ?? uuidV4();

    if (!this.meta.flappingHistory) {
      this.meta.flappingHistory = [];
    }
  }

  getId() {
    return this.id;
  }

  getUuid() {
    return this.meta.uuid!;
  }

  hasScheduledActions() {
    return this.scheduledExecutionOptions !== undefined;
  }

  isThrottled({
    throttle,
    actionHash,
    uuid,
  }: {
    throttle: string | null;
    actionHash?: string;
    uuid?: string;
  }) {
    if (this.scheduledExecutionOptions === undefined) {
      return false;
    }
    const throttleMills = throttle ? parseDuration(throttle) : 0;
    if (
      this.meta.lastScheduledActions &&
      this.scheduledActionGroupIsUnchanged(
        this.meta.lastScheduledActions,
        this.scheduledExecutionOptions
      )
    ) {
      if (uuid && actionHash) {
        if (this.meta.lastScheduledActions.actions) {
          const actionInState =
            this.meta.lastScheduledActions.actions[uuid] ||
            this.meta.lastScheduledActions.actions[actionHash]; // actionHash must be removed once all the hash identifiers removed from the task state
          const lastTriggerDate = actionInState?.date;
          return !!(lastTriggerDate && lastTriggerDate.getTime() + throttleMills > Date.now());
        }
        return false;
      } else {
        return this.meta.lastScheduledActions.date.getTime() + throttleMills > Date.now();
      }
    }
    return false;
  }

  scheduledActionGroupHasChanged(): boolean {
    if (!this.meta.lastScheduledActions && this.scheduledExecutionOptions) {
      // it is considered a change when there are no previous scheduled actions
      // and new scheduled actions
      return true;
    }

    if (this.meta.lastScheduledActions && this.scheduledExecutionOptions) {
      // compare previous and new scheduled actions if both exist
      return !this.scheduledActionGroupIsUnchanged(
        this.meta.lastScheduledActions,
        this.scheduledExecutionOptions
      );
    }
    // no previous and no new scheduled actions
    return false;
  }

  private scheduledActionGroupIsUnchanged(
    lastScheduledActions: NonNullable<AlertInstanceMeta['lastScheduledActions']>,
    scheduledExecutionOptions: ScheduledExecutionOptions<State, Context, ActionGroupIds>
  ) {
    return lastScheduledActions.group === scheduledExecutionOptions.actionGroup;
  }

  getLastScheduledActions() {
    return this.meta.lastScheduledActions;
  }

  getScheduledActionOptions() {
    return this.scheduledExecutionOptions;
  }

  unscheduleActions() {
    this.scheduledExecutionOptions = undefined;
    return this;
  }

  getState() {
    return this.state;
  }

  getContext() {
    return this.context;
  }

  hasContext() {
    return !isEmpty(this.context);
  }

  scheduleActions(actionGroup: ActionGroupIds, context: Context = {} as Context) {
    this.ensureHasNoScheduledActions();
    this.setContext(context);
    this.scheduledExecutionOptions = {
      actionGroup,
      context,
      state: this.state,
    };
    return this;
  }

  setContext(context: Context) {
    this.context = context;
    return this;
  }

  private ensureHasNoScheduledActions() {
    if (this.hasScheduledActions()) {
      throw new Error('Alert instance execution has already been scheduled, cannot schedule twice');
    }
  }

  replaceState(state: State) {
    this.state = state;
    return this;
  }

  updateLastScheduledActions(group: ActionGroupIds, actionHash?: string | null, uuid?: string) {
    if (!this.meta.lastScheduledActions) {
      this.meta.lastScheduledActions = {} as LastScheduledActions;
    }
    const date = new Date();
    this.meta.lastScheduledActions.group = group;
    this.meta.lastScheduledActions.date = date;

    if (this.meta.lastScheduledActions.group !== group) {
      this.meta.lastScheduledActions.actions = {};
    } else if (uuid) {
      if (!this.meta.lastScheduledActions.actions) {
        this.meta.lastScheduledActions.actions = {};
      }
      // remove deprecated actionHash
      if (!!actionHash && this.meta.lastScheduledActions.actions[actionHash]) {
        delete this.meta.lastScheduledActions.actions[actionHash];
      }
      this.meta.lastScheduledActions.actions[uuid] = { date };
    }
  }

  /**
   * Used to serialize alert instance state
   */
  toJSON() {
    return rawAlertInstance.encode(this.toRaw());
  }

  toRaw(recovered: boolean = false): RawAlertInstance {
    return recovered
      ? {
          // for a recovered alert, we only care to track the flappingHistory,
          // the flapping flag, and the UUID
          meta: {
            flappingHistory: this.meta.flappingHistory,
            flapping: this.meta.flapping,
            uuid: this.meta.uuid,
          },
        }
      : {
          state: this.state,
          meta: this.meta,
        };
  }

  setFlappingHistory(fh: boolean[] = []) {
    this.meta.flappingHistory = fh;
  }

  getFlappingHistory() {
    return this.meta.flappingHistory;
  }

  setFlapping(f: boolean) {
    this.meta.flapping = f;
  }

  getFlapping() {
    return this.meta.flapping || false;
  }

  incrementPendingRecoveredCount() {
    if (!this.meta.pendingRecoveredCount) {
      this.meta.pendingRecoveredCount = 0;
    }
    this.meta.pendingRecoveredCount++;
  }

  getPendingRecoveredCount() {
    return this.meta.pendingRecoveredCount || 0;
  }

  resetPendingRecoveredCount() {
    this.meta.pendingRecoveredCount = 0;
  }

  isFilteredOut(summarizedAlerts: CombinedSummarizedAlerts | null) {
    if (summarizedAlerts === null) {
      return false;
    }

    return !summarizedAlerts.all.data.some(
      (alert) => get(alert, ALERT_INSTANCE_ID) === this.getId()
    );
  }
}
