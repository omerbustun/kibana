/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { HttpSetup } from '@kbn/core/public';
import { RewriteRequestCase } from '@kbn/actions-plugin/common';
import {
  RuleAggregationFormattedResult,
  RuleTagsAggregationFormattedResult,
} from '@kbn/alerting-plugin/common';
import { RuleStatus } from '../../../types';

export const rewriteBodyRes: RewriteRequestCase<RuleAggregationFormattedResult> = ({
  rule_execution_status: ruleExecutionStatus,
  rule_last_run_outcome: ruleLastRunOutcome,
  rule_enabled_status: ruleEnabledStatus,
  rule_muted_status: ruleMutedStatus,
  rule_snoozed_status: ruleSnoozedStatus,
  rule_tags: ruleTags,
  ...rest
}: any) => ({
  ...rest,
  ruleExecutionStatus,
  ruleEnabledStatus,
  ruleMutedStatus,
  ruleSnoozedStatus,
  ruleLastRunOutcome,
  ruleTags,
});

export const rewriteTagsBodyRes: RewriteRequestCase<RuleTagsAggregationFormattedResult> = ({
  rule_tags: ruleTags,
}: any) => ({
  ruleTags,
});

export interface LoadRuleAggregationsProps {
  http: HttpSetup;
  searchText?: string;
  typesFilter?: string[];
  actionTypesFilter?: string[];
  ruleExecutionStatusesFilter?: string[];
  ruleLastRunOutcomesFilter?: string[];
  ruleStatusesFilter?: RuleStatus[];
  tagsFilter?: string[];
}
