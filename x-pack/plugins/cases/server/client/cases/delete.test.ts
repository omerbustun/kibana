/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import { MAX_FILES_PER_CASE } from '../../../common/constants';
import type { FindFileArgs } from '@kbn/files-plugin/server';
import { createFileServiceMock } from '@kbn/files-plugin/server/mocks';
import type { FileJSON } from '@kbn/shared-ux-file-types';
import type { CaseFileMetadataForDeletion } from '../../../common/files';
import { constructFileKindIdByOwner } from '../../../common/files';
import { getFileEntities } from './delete';

const getCaseIds = (numIds: number) => {
  return Array.from(Array(numIds).keys()).map((key) => key.toString());
};
describe('delete', () => {
  describe('getFileEntities', () => {
    const numCaseIds = 1000;
    const caseIds = getCaseIds(numCaseIds);
    const mockFileService = createFileServiceMock();
    mockFileService.find.mockImplementation(async (args: FindFileArgs) => {
      const caseMeta = args.meta as unknown as CaseFileMetadataForDeletion;
      const numFilesToGen = caseMeta.caseIds.length * MAX_FILES_PER_CASE;
      const files = Array.from(Array(numFilesToGen).keys()).map(() => createMockFileJSON());

      return {
        files,
        total: files.length,
      };
    });

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('only provides 50 case ids in a single call to the find api', async () => {
      await getFileEntities(caseIds, mockFileService);

      for (const call of mockFileService.find.mock.calls) {
        const callMeta = call[0].meta as unknown as CaseFileMetadataForDeletion;
        expect(callMeta.caseIds.length).toEqual(50);
      }
    });

    it('calls the find function the number of case ids divided by the chunk size', async () => {
      await getFileEntities(caseIds, mockFileService);

      const chunkSize = 50;

      expect(mockFileService.find).toHaveBeenCalledTimes(numCaseIds / chunkSize);
    });

    it('returns the number of entities equal to the case ids times the max files per case limit', async () => {
      const expectedEntities = Array.from(Array(numCaseIds * MAX_FILES_PER_CASE).keys()).map(
        () => ({
          id: '123',
          owner: 'securitySolution',
        })
      );

      const entities = await getFileEntities(caseIds, mockFileService);

      expect(entities.length).toEqual(numCaseIds * MAX_FILES_PER_CASE);
      expect(entities).toEqual(expectedEntities);
    });
  });
});

const createMockFileJSON = (): FileJSON => {
  return {
    id: '123',
    fileKind: constructFileKindIdByOwner('securitySolution'),
    meta: {
      owner: ['securitySolution'],
    },
  } as unknown as FileJSON;
};
