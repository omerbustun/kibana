/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useCallback, useMemo } from 'react';
import { EuiBasicTableColumn, EuiText } from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import { TimeRange } from '@kbn/es-query';

import { useKibanaContextForPlugin } from '../../../../hooks/use_kibana';
import { createInventoryMetricFormatter } from '../../inventory_view/lib/create_inventory_metric_formatter';
import { HostsTableEntryTitle } from '../components/hosts_table_entry_title';
import type {
  SnapshotNode,
  SnapshotNodeMetric,
  SnapshotMetricInput,
} from '../../../../../common/http_api';
import { useHostFlyoutOpen } from './use_host_flyout_open_url_state';

/**
 * Columns and items types
 */
export type CloudProvider = 'gcp' | 'aws' | 'azure' | 'unknownProvider';

type HostMetric = 'cpu' | 'diskLatency' | 'rx' | 'tx' | 'memory' | 'memoryTotal';

type HostMetrics = Record<HostMetric, SnapshotNodeMetric>;

export interface HostNodeRow extends HostMetrics {
  os?: string | null;
  ip?: string | null;
  servicesOnHost?: number | null;
  title: { name: string; cloudProvider?: CloudProvider | null };
  name: string;
  id: string;
}

interface HostTableParams {
  time: TimeRange;
}

/**
 * Helper functions
 */
const formatMetric = (type: SnapshotMetricInput['type'], value: number | undefined | null) => {
  return value || value === 0 ? createInventoryMetricFormatter({ type })(value) : 'N/A';
};

const buildItemsList = (nodes: SnapshotNode[]) => {
  return nodes.map(({ metrics, path, name }, index) => ({
    id: `${name}-${index}`,
    name,
    os: path.at(-1)?.os ?? '-',
    ip: path.at(-1)?.ip ?? '',
    title: {
      name,
      cloudProvider: path.at(-1)?.cloudProvider ?? null,
    },
    ...metrics.reduce((data, metric) => {
      data[metric.name as HostMetric] = metric;
      return data;
    }, {} as HostMetrics),
  })) as HostNodeRow[];
};

/**
 * Columns translations
 */
const titleLabel = i18n.translate('xpack.infra.hostsViewPage.table.nameColumnHeader', {
  defaultMessage: 'Name',
});

const osLabel = i18n.translate('xpack.infra.hostsViewPage.table.operatingSystemColumnHeader', {
  defaultMessage: 'Operating System',
});

const averageCpuUsageLabel = i18n.translate(
  'xpack.infra.hostsViewPage.table.averageCpuUsageColumnHeader',
  {
    defaultMessage: 'CPU usage (avg.)',
  }
);

const diskLatencyLabel = i18n.translate('xpack.infra.hostsViewPage.table.diskLatencyColumnHeader', {
  defaultMessage: 'Disk Latency (avg.)',
});

const averageTXLabel = i18n.translate('xpack.infra.hostsViewPage.table.averageTxColumnHeader', {
  defaultMessage: 'TX (avg.)',
});

const averageRXLabel = i18n.translate('xpack.infra.hostsViewPage.table.averageRxColumnHeader', {
  defaultMessage: 'RX (avg.)',
});

const averageTotalMemoryLabel = i18n.translate(
  'xpack.infra.hostsViewPage.table.averageMemoryTotalColumnHeader',
  {
    defaultMessage: 'Memory total (avg.)',
  }
);

const averageMemoryUsageLabel = i18n.translate(
  'xpack.infra.hostsViewPage.table.averageMemoryUsageColumnHeader',
  {
    defaultMessage: 'Memory usage (avg.)',
  }
);

const toggleDialogActionLabel = i18n.translate(
  'xpack.infra.hostsViewPage.table.toggleDialogWithDetails',
  {
    defaultMessage: 'Toggle dialog with details',
  }
);

/**
 * Build a table columns and items starting from the snapshot nodes.
 */
export const useHostsTable = (nodes: SnapshotNode[], { time }: HostTableParams) => {
  const {
    services: { telemetry },
  } = useKibanaContextForPlugin();

  const [hostFlyoutOpen, setHostFlyoutOpen] = useHostFlyoutOpen();

  const closeFlyout = () => setHostFlyoutOpen({ clickedItemId: '' });

  const reportHostEntryClick = useCallback(
    ({ name, cloudProvider }: HostNodeRow['title']) => {
      telemetry.reportHostEntryClicked({
        hostname: name,
        cloud_provider: cloudProvider,
      });
    },
    [telemetry]
  );

  const items = useMemo(() => buildItemsList(nodes), [nodes]);
  const clickedItem = useMemo(
    () => items.find(({ id }) => id === hostFlyoutOpen.clickedItemId),
    [hostFlyoutOpen.clickedItemId, items]
  );

  const columns: Array<EuiBasicTableColumn<HostNodeRow>> = useMemo(
    () => [
      {
        name: '',
        width: '40px',
        field: 'id',
        actions: [
          {
            name: toggleDialogActionLabel,
            description: toggleDialogActionLabel,
            icon: ({ id }) =>
              hostFlyoutOpen.clickedItemId && id === hostFlyoutOpen.clickedItemId
                ? 'minimize'
                : 'expand',
            type: 'icon',
            'data-test-subj': 'hostsView-flyout-button',
            onClick: ({ id }) => {
              setHostFlyoutOpen({
                clickedItemId: id,
              });
              if (id === hostFlyoutOpen.clickedItemId) {
                setHostFlyoutOpen({ clickedItemId: '' });
              } else {
                setHostFlyoutOpen({ clickedItemId: id });
              }
            },
          },
        ],
      },
      {
        name: titleLabel,
        field: 'title',
        sortable: true,
        truncateText: true,
        'data-test-subj': 'hostsView-tableRow-title',
        render: (title: HostNodeRow['title']) => (
          <HostsTableEntryTitle
            title={title}
            time={time}
            onClick={() => reportHostEntryClick(title)}
          />
        ),
      },
      {
        name: osLabel,
        field: 'os',
        sortable: true,
        'data-test-subj': 'hostsView-tableRow-os',
        render: (os: string) => <EuiText size="s">{os}</EuiText>,
      },
      {
        name: averageCpuUsageLabel,
        field: 'cpu.avg',
        sortable: true,
        'data-test-subj': 'hostsView-tableRow-cpuUsage',
        render: (avg: number) => formatMetric('cpu', avg),
        align: 'right',
      },
      {
        name: diskLatencyLabel,
        field: 'diskLatency.avg',
        sortable: true,
        'data-test-subj': 'hostsView-tableRow-diskLatency',
        render: (avg: number) => formatMetric('diskLatency', avg),
        align: 'right',
      },
      {
        name: averageRXLabel,
        field: 'rx.avg',
        sortable: true,
        'data-test-subj': 'hostsView-tableRow-rx',
        render: (avg: number) => formatMetric('rx', avg),
        align: 'right',
      },
      {
        name: averageTXLabel,
        field: 'tx.avg',
        sortable: true,
        'data-test-subj': 'hostsView-tableRow-tx',
        render: (avg: number) => formatMetric('tx', avg),
        align: 'right',
      },
      {
        name: averageTotalMemoryLabel,
        field: 'memoryTotal.avg',
        sortable: true,
        'data-test-subj': 'hostsView-tableRow-memoryTotal',
        render: (avg: number) => formatMetric('memoryTotal', avg),
        align: 'right',
      },
      {
        name: averageMemoryUsageLabel,
        field: 'memory.avg',
        sortable: true,
        'data-test-subj': 'hostsView-tableRow-memory',
        render: (avg: number) => formatMetric('memory', avg),
        align: 'right',
      },
    ],
    [hostFlyoutOpen.clickedItemId, reportHostEntryClick, setHostFlyoutOpen, time]
  );

  return {
    columns,
    items,
    clickedItem,
    isFlyoutOpen: !!hostFlyoutOpen.clickedItemId,
    closeFlyout,
  };
};
