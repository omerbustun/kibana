/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import React from 'react';
import { withKibana, KibanaReactContextValue } from '@kbn/kibana-react-plugin/public';
import { UI_SETTINGS } from '@kbn/data-plugin/common';
import { DataView, DataViewField } from '@kbn/data-views-plugin/common';
import { debounce } from 'lodash';

import { buildQueryFromFilters, Filter } from '@kbn/es-query';
import { IUnifiedSearchPluginServices } from '../../types';

export interface PhraseSuggestorProps {
  kibana: KibanaReactContextValue<IUnifiedSearchPluginServices>;
  indexPattern: DataView;
  field: DataViewField;
  timeRangeForSuggestionsOverride?: boolean;
  filtersForSuggestions?: Filter[];
}

export interface PhraseSuggestorState {
  suggestions: string[];
  isLoading: boolean;
}

/**
 * Since both "phrase" and "phrases" filter inputs suggest values (if enabled and the field is
 * aggregatable), we pull out the common logic for requesting suggestions into this component
 * which both of them extend.
 */
export class PhraseSuggestorUI<T extends PhraseSuggestorProps> extends React.Component<
  T,
  PhraseSuggestorState
> {
  private services = this.props.kibana.services;
  private abortController?: AbortController;
  public state: PhraseSuggestorState = {
    suggestions: [],
    isLoading: false,
  };

  public componentDidMount() {
    this.updateSuggestions();
  }

  public componentWillUnmount() {
    if (this.abortController) this.abortController.abort();
  }

  protected isSuggestingValues() {
    const shouldSuggestValues = this.services.uiSettings.get(
      UI_SETTINGS.FILTERS_EDITOR_SUGGEST_VALUES
    );
    const { field } = this.props;
    const isVersionFieldType = field?.esTypes?.includes('version');

    return (
      shouldSuggestValues &&
      field &&
      field.aggregatable &&
      field.type === 'string' &&
      !isVersionFieldType // suggestions don't work for version fields
    );
  }

  protected onSearchChange = (value: string | number | boolean) => {
    this.updateSuggestions(`${value}`);
  };

  protected updateSuggestions = debounce(async (query: string = '') => {
    if (this.abortController) this.abortController.abort();
    this.abortController = new AbortController();
    const { indexPattern, field, timeRangeForSuggestionsOverride, filtersForSuggestions } = this
      .props as PhraseSuggestorProps;
    if (!field || !this.isSuggestingValues()) {
      return;
    }
    this.setState({ isLoading: true });
    const suggestions = await this.services.unifiedSearch.autocomplete.getValueSuggestions({
      indexPattern,
      field,
      query,
      signal: this.abortController.signal,
      useTimeRange: timeRangeForSuggestionsOverride,
      boolFilter: buildQueryFromFilters(filtersForSuggestions, undefined).filter,
      method: filtersForSuggestions?.length ? 'terms_agg' : 'terms_enum',
    });

    this.setState({ suggestions, isLoading: false });
  }, 500);
}

export const PhraseSuggestor = withKibana(PhraseSuggestorUI as any);
