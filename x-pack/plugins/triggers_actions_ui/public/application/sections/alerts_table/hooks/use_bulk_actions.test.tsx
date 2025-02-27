/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { renderHook } from '@testing-library/react-hooks';
import { useBulkActions, useBulkAddToCaseActions } from './use_bulk_actions';
import { AppMockRenderer, createAppMockRenderer } from '../../test_utils';
import { createCasesServiceMock } from '../index.mock';

jest.mock('./api');
jest.mock('../../../../common/lib/kibana');

const mockCaseService = createCasesServiceMock();
const mockKibana = jest.fn().mockReturnValue({
  services: {
    cases: mockCaseService,
  },
});

jest.mock('@kbn/kibana-react-plugin/public', () => {
  const original = jest.requireActual('@kbn/kibana-react-plugin/public');

  return {
    ...original,
    useKibana: () => mockKibana(),
  };
});

const caseId = 'test-case';

describe('bulk action hooks', () => {
  const casesConfig = { featureId: 'test-feature-id', owner: ['test-owner'] };
  let appMockRender: AppMockRenderer;

  beforeEach(() => {
    jest.clearAllMocks();
    appMockRender = createAppMockRenderer();
  });

  const refresh = jest.fn();
  const clearSelection = jest.fn();
  const openNewCase = jest.fn();
  const openExistingCase = jest.fn().mockImplementation(({ getAttachments }) => {
    getAttachments({ theCase: { id: caseId } });
  });
  mockCaseService.helpers.canUseCases = jest.fn().mockReturnValue({ create: true, read: true });
  mockCaseService.ui.getCasesContext = jest.fn().mockReturnValue(() => 'Cases context');

  const addNewCaseMock = (
    mockCaseService.hooks.useCasesAddToNewCaseFlyout as jest.Mock
  ).mockReturnValue({ open: openNewCase });

  const addExistingCaseMock = (
    mockCaseService.hooks.useCasesAddToExistingCaseModal as jest.Mock
  ).mockReturnValue({ open: openExistingCase });

  describe('useBulkAddToCaseActions', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should refetch when calling onSuccess of useCasesAddToNewCaseFlyout', async () => {
      renderHook(() => useBulkAddToCaseActions({ casesConfig, refresh, clearSelection }), {
        wrapper: appMockRender.AppWrapper,
      });

      addNewCaseMock.mock.calls[0][0].onSuccess();
      expect(refresh).toHaveBeenCalled();
    });

    it('should refetch when calling onSuccess of useCasesAddToExistingCaseModal', async () => {
      renderHook(() => useBulkAddToCaseActions({ casesConfig, refresh, clearSelection }), {
        wrapper: appMockRender.AppWrapper,
      });

      addExistingCaseMock.mock.calls[0][0].onSuccess();
      expect(refresh).toHaveBeenCalled();
    });

    it('should useCasesAddToExistingCaseModal with correct toaster params', async () => {
      renderHook(() => useBulkAddToCaseActions({ casesConfig, refresh, clearSelection }), {
        wrapper: appMockRender.AppWrapper,
      });

      expect(addExistingCaseMock).toHaveBeenCalledWith({
        noAttachmentsToaster: {
          title: 'No alerts added to the case',
          content: 'All selected alerts are already attached to the case',
        },
        onSuccess: expect.anything(),
      });
    });

    it('should open the case flyout', async () => {
      const { result } = renderHook(
        () => useBulkAddToCaseActions({ casesConfig, refresh, clearSelection }),
        {
          wrapper: appMockRender.AppWrapper,
        }
      );

      // @ts-expect-error: cases do not need all arguments
      result.current[0].onClick([]);

      expect(mockCaseService.helpers.groupAlertsByRule).toHaveBeenCalled();
      expect(openNewCase).toHaveBeenCalled();
    });

    it('should open the case modal', async () => {
      const { result } = renderHook(
        () => useBulkAddToCaseActions({ casesConfig, refresh, clearSelection }),
        {
          wrapper: appMockRender.AppWrapper,
        }
      );

      // @ts-expect-error: cases do not need all arguments
      result.current[1].onClick([]);

      expect(mockCaseService.helpers.groupAlertsByRule).toHaveBeenCalled();
      expect(openExistingCase).toHaveBeenCalled();
    });

    it('should remove alerts that are already attached to the case', async () => {
      const { result } = renderHook(
        () => useBulkAddToCaseActions({ casesConfig, refresh, clearSelection }),
        {
          wrapper: appMockRender.AppWrapper,
        }
      );

      // @ts-expect-error: cases do not need all arguments
      result.current[1].onClick([
        {
          _id: 'alert0',
          _index: 'idx0',
          data: [
            {
              field: 'kibana.alert.case_ids',
              value: [caseId],
            },
          ],
          ecs: {
            _id: 'alert0',
            _index: 'idx0',
          },
        },
        {
          _id: 'alert1',
          _index: 'idx1',
          data: [
            {
              field: 'kibana.alert.case_ids',
              value: ['test-case-2'],
            },
          ],
          ecs: {
            _id: 'alert1',
            _index: 'idx1',
          },
        },
      ]);

      expect(mockCaseService.helpers.groupAlertsByRule).toHaveBeenCalledWith([
        {
          _id: 'alert1',
          _index: 'idx1',
          data: [
            {
              field: 'kibana.alert.case_ids',
              value: ['test-case-2'],
            },
          ],
          ecs: {
            _id: 'alert1',
            _index: 'idx1',
          },
        },
      ]);
    });

    it('should not show the bulk actions when the user does not have write access', async () => {
      mockCaseService.helpers.canUseCases = jest
        .fn()
        .mockReturnValue({ create: false, read: true });

      const { result } = renderHook(
        () => useBulkAddToCaseActions({ casesConfig, refresh, clearSelection }),
        {
          wrapper: appMockRender.AppWrapper,
        }
      );

      expect(result.current.length).toBe(0);
    });

    it('should not show the bulk actions when the user does not have read access', async () => {
      mockCaseService.helpers.canUseCases = jest
        .fn()
        .mockReturnValue({ create: true, read: false });

      const { result } = renderHook(
        () => useBulkAddToCaseActions({ casesConfig, refresh, clearSelection }),
        {
          wrapper: appMockRender.AppWrapper,
        }
      );

      expect(result.current.length).toBe(0);
    });

    it('should call canUseCases with an empty owner when casesConfig is missing', async () => {
      renderHook(() => useBulkAddToCaseActions({ refresh, clearSelection }), {
        wrapper: appMockRender.AppWrapper,
      });

      expect(mockCaseService.helpers.canUseCases).toHaveBeenCalledWith([]);
    });

    it('should not show the bulk actions when the cases context is missing', async () => {
      mockCaseService.ui.getCasesContext = jest.fn().mockReturnValue(() => null);

      const { result } = renderHook(() => useBulkAddToCaseActions({ refresh, clearSelection }), {
        wrapper: appMockRender.AppWrapper,
      });

      expect(result.current.length).toBe(0);
    });

    it('should not show the bulk actions when the case service is not available', async () => {
      mockKibana.mockImplementation(() => ({ services: {} }));

      const { result } = renderHook(
        () => useBulkAddToCaseActions({ casesConfig, refresh, clearSelection }),
        {
          wrapper: appMockRender.AppWrapper,
        }
      );

      expect(result.current.length).toBe(0);
    });
  });

  describe('useBulkActions', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockKibana.mockImplementation(() => ({ services: { cases: mockCaseService } }));
      mockCaseService.helpers.canUseCases = jest.fn().mockReturnValue({ create: true, read: true });
    });

    it('appends the case bulk actions', async () => {
      const { result } = renderHook(
        () => useBulkActions({ alerts: [], query: {}, casesConfig, refresh }),
        {
          wrapper: appMockRender.AppWrapper,
        }
      );

      expect(result.current.bulkActions).toMatchInlineSnapshot(`
        Array [
          Object {
            "data-test-subj": "attach-new-case",
            "disableOnQuery": true,
            "disabledLabel": "Add to case is not supported for this selection",
            "key": "attach-new-case",
            "label": "Add to new case",
            "onClick": [Function],
          },
          Object {
            "data-test-subj": "attach-existing-case",
            "disableOnQuery": true,
            "disabledLabel": "Add to case is not supported for this selection",
            "key": "attach-existing-case",
            "label": "Add to existing case",
            "onClick": [Function],
          },
        ]
      `);
    });
  });
});
