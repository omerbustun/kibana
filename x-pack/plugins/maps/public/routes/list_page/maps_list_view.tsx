/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useCallback, memo } from 'react';
import type { SavedObjectsFindOptionsReference, ScopedHistory } from '@kbn/core/public';
import { METRIC_TYPE } from '@kbn/analytics';
import { i18n } from '@kbn/i18n';
import { TableListView } from '@kbn/content-management-table-list';
import type { UserContentCommonSchema } from '@kbn/content-management-table-list';

import type { MapItem } from '../../../common/content_management';
import { APP_ID, getEditPath, MAP_PATH } from '../../../common/constants';
import {
  getMapsCapabilities,
  getCoreChrome,
  getExecutionContextService,
  getNavigateToApp,
  getUiSettings,
  getUsageCollection,
} from '../../kibana_services';
import { getAppTitle } from '../../../common/i18n_getters';
import { mapsClient } from '../../content_management';

const SAVED_OBJECTS_LIMIT_SETTING = 'savedObjects:listingLimit';
const SAVED_OBJECTS_PER_PAGE_SETTING = 'savedObjects:perPage';

interface MapUserContent extends UserContentCommonSchema {
  type: string;
  attributes: {
    title: string;
  };
}

function navigateToNewMap() {
  const navigateToApp = getNavigateToApp();
  getUsageCollection()?.reportUiCounter(APP_ID, METRIC_TYPE.CLICK, 'create_maps_vis_editor');
  navigateToApp(APP_ID, {
    path: MAP_PATH,
  });
}

const toTableListViewSavedObject = (mapItem: MapItem): MapUserContent => {
  return {
    ...mapItem,
    updatedAt: mapItem.updatedAt!,
    attributes: {
      ...mapItem.attributes,
      title: mapItem.attributes.title ?? '',
    },
  };
};

async function deleteMaps(items: Array<{ id: string }>) {
  await Promise.all(items.map(({ id }) => mapsClient.delete(id)));
}

interface Props {
  history: ScopedHistory;
}

function MapsListViewComp({ history }: Props) {
  getExecutionContextService().set({
    type: 'application',
    name: APP_ID,
    page: 'list',
  });

  const isReadOnly = !getMapsCapabilities().save;
  const listingLimit = getUiSettings().get(SAVED_OBJECTS_LIMIT_SETTING);
  const initialPageSize = getUiSettings().get(SAVED_OBJECTS_PER_PAGE_SETTING);

  getCoreChrome().docTitle.change(getAppTitle());
  getCoreChrome().setBreadcrumbs([{ text: getAppTitle() }]);

  const findMaps = useCallback(
    async (
      searchTerm: string,
      {
        references = [],
        referencesToExclude = [],
      }: {
        references?: SavedObjectsFindOptionsReference[];
        referencesToExclude?: SavedObjectsFindOptionsReference[];
      } = {}
    ) => {
      return mapsClient
        .search({
          text: searchTerm ? `${searchTerm}*` : undefined,
          limit: getUiSettings().get(SAVED_OBJECTS_LIMIT_SETTING),
          tags: {
            included: references.map(({ id }) => id),
            excluded: referencesToExclude.map(({ id }) => id),
          },
        })
        .then(({ hits, pagination: { total } }) => {
          return {
            total,
            hits: hits.map(toTableListViewSavedObject),
          };
        })
        .catch((e) => {
          return {
            total: 0,
            hits: [],
          };
        });
    },
    []
  );

  return (
    <TableListView<MapUserContent>
      id="map"
      headingId="mapsListingPage"
      createItem={isReadOnly ? undefined : navigateToNewMap}
      findItems={findMaps}
      deleteItems={isReadOnly ? undefined : deleteMaps}
      listingLimit={listingLimit}
      initialFilter={''}
      initialPageSize={initialPageSize}
      entityName={i18n.translate('xpack.maps.mapListing.entityName', {
        defaultMessage: 'map',
      })}
      entityNamePlural={i18n.translate('xpack.maps.mapListing.entityNamePlural', {
        defaultMessage: 'maps',
      })}
      tableListTitle={getAppTitle()}
      onClickTitle={({ id }) => history.push(getEditPath(id))}
    />
  );
}

export const MapsListView = memo(MapsListViewComp);
