/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { Component, RefObject } from 'react';
import { first } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import { EuiLoadingChart } from '@elastic/eui';
import type { Filter } from '@kbn/es-query';
import type { Query, TimeRange } from '@kbn/es-query';
import type { LayerDescriptor, MapCenterAndZoom } from '../../common/descriptor_types';
import type { MapEmbeddableType } from './types';
import type { LazyLoadedMapModules } from '../lazy_load_bundle';
import { lazyLoadMapModules } from '../lazy_load_bundle';

interface Props {
  title: string;
  filters?: Filter[];
  query?: Query;
  timeRange?: TimeRange;
  getLayerDescriptors: (
    mapModules: Pick<
      LazyLoadedMapModules,
      'createTileMapLayerDescriptor' | 'createRegionMapLayerDescriptor'
    >
  ) => LayerDescriptor[];
  mapCenter?: MapCenterAndZoom;
  onInitialRenderComplete?: () => void;
  /*
   * Set to false to exclude sharing attributes 'data-*'.
   */
  isSharable?: boolean;
}

interface State {
  isLoaded: boolean;
}

export class MapComponent extends Component<Props, State> {
  private _isMounted = false;
  private _mapEmbeddable?: MapEmbeddableType | undefined;
  private readonly _embeddableRef: RefObject<HTMLDivElement> = React.createRef<HTMLDivElement>();

  state: State = { isLoaded: false };

  componentDidMount() {
    this._isMounted = true;
    this._load();
  }

  componentWillUnmount() {
    this._isMounted = false;
    if (this._mapEmbeddable) {
      this._mapEmbeddable.destroy();
    }
  }

  componentDidUpdate() {
    if (this._mapEmbeddable) {
      this._mapEmbeddable.updateInput({
        filters: this.props.filters,
        query: this.props.query,
        timeRange: this.props.timeRange,
      });
    }
  }

  async _load() {
    const mapModules = await lazyLoadMapModules();
    if (!this._isMounted) {
      return;
    }

    this.setState({ isLoaded: true });

    this._mapEmbeddable = new mapModules.MapEmbeddable(
      {
        editable: false,
      },
      {
        id: uuidv4(),
        attributes: {
          title: this.props.title,
          layerListJSON: JSON.stringify([
            mapModules.createBasemapLayerDescriptor(),
            ...this.props.getLayerDescriptors({
              createRegionMapLayerDescriptor: mapModules.createRegionMapLayerDescriptor,
              createTileMapLayerDescriptor: mapModules.createTileMapLayerDescriptor,
            }),
          ]),
        },
        mapCenter: this.props.mapCenter,
      }
    );

    if (this.props.onInitialRenderComplete) {
      this._mapEmbeddable
        .getOnRenderComplete$()
        .pipe(first())
        .subscribe(() => {
          if (this._isMounted && this.props.onInitialRenderComplete) {
            this.props.onInitialRenderComplete();
          }
        });
    }

    if (this.props.isSharable !== undefined) {
      this._mapEmbeddable.setIsSharable(this.props.isSharable);
    }
    if (this._embeddableRef.current) {
      this._mapEmbeddable.render(this._embeddableRef.current);
    }
  }

  render() {
    if (!this.state.isLoaded) {
      return <EuiLoadingChart mono size="l" />;
    }

    return <div className="mapEmbeddableContainer" ref={this._embeddableRef} />;
  }
}
