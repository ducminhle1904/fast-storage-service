import { computed, inject } from '@angular/core';
import { StorageService } from '@app/data-access';
import {
  COLOR_STATUS_STORAGE,
  DEFAULT_STATUS_STORAGE_COLOR,
} from '@app/shared/constant';
import { Directory, StorageStatus, UploadFileRequest } from '@app/shared/model';
import { tapResponse } from '@ngrx/operators';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { MenuItem, MessageService, TreeNode } from 'primeng/api';
import { pipe, switchMap } from 'rxjs';

type StorageState = {
  status: StorageStatus | null;
  allDirectorys: Directory[];
  subMenuDirectory: Directory[];
  isLoading: boolean;
  hasNewFolder: boolean;
  hasNewFile: boolean;
  breadcrumb: MenuItem[];
  detailFolder: Directory[];
};

const initialState: StorageState = {
  status: null,
  allDirectorys: [],
  subMenuDirectory: [],
  isLoading: false,
  hasNewFolder: false,
  hasNewFile: false,
  breadcrumb: [],
  detailFolder: [],
};

export const StorageStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ status, allDirectorys }) => ({
    percentage: computed(() => {
      return ((status()?.used || 0) / (status()?.maximunSize || 0)) * 100;
    }),
    colorStatus: computed(() => {
      const percentage =
        ((status()?.used || 0) / (status()?.maximunSize || 0)) * 100;

      for (let i = 0; i < COLOR_STATUS_STORAGE.length; i++) {
        if (percentage <= COLOR_STATUS_STORAGE[i].threshold) {
          return COLOR_STATUS_STORAGE[i].color;
        }
      }
      return DEFAULT_STATUS_STORAGE_COLOR;
    }),
    directories: computed<TreeNode[]>(() => {
      if (allDirectorys() === null || allDirectorys().length === 0) {
        return [];
      }
      return allDirectorys().map((dir) => ({
        key: dir.name,
        label: dir.name,
        data: dir,
        icon: dir.type === 'folder' ? 'pi pi-fw pi-folder' : 'pi pi-fw pi-file',
        leaf: false,
        loading: false,
        ...(dir.type === 'folder' && { children: [] }),
      }));
    }),
  })),
  withMethods(
    (
      store,
      storageService = inject(StorageService),
      messageService = inject(MessageService)
    ) => ({
      getSystemStorageStatus: rxMethod<void>(
        pipe(
          switchMap(() => {
            patchState(store, { isLoading: true });
            return storageService.getSystemStorageStatus().pipe(
              tapResponse({
                next: (res) => {
                  patchState(store, { status: res.response });
                },
                error: (err) => {
                  console.log(err);
                },
                finalize: () => patchState(store, { isLoading: false }),
              })
            );
          })
        )
      ),
      getDirectory: rxMethod<string>(
        pipe(
          switchMap((location) => {
            patchState(store, { isLoading: true, hasNewFolder: false });
            return storageService.getDirectory(location).pipe(
              tapResponse({
                next: (res) => {
                  patchState(store, { allDirectorys: res.response });
                },
                error: (err) => {
                  console.log(err);
                },
                finalize: () => patchState(store, { isLoading: false }),
              })
            );
          })
        )
      ),
      getDetailsDirectory: rxMethod<{
        path: string;
        type: 'subMenu' | 'detailFolder';
      }>(
        pipe(
          switchMap((payload) => {
            patchState(store, { isLoading: true });
            return storageService.getDirectory(payload.path).pipe(
              tapResponse({
                next: (res) => {
                  if (payload.type === 'subMenu') {
                    patchState(store, { subMenuDirectory: res.response });
                  } else {
                    patchState(store, { detailFolder: res.response });
                  }
                },
                error: (err) => {
                  console.log(err);
                },
                finalize: () => patchState(store, { isLoading: false }),
              })
            );
          })
        )
      ),
      uploadFile: rxMethod<UploadFileRequest>(
        pipe(
          switchMap((payload) => {
            patchState(store, { isLoading: true });
            return storageService.uploadFile(payload).pipe(
              tapResponse({
                next: (res) => {
                  messageService.add({
                    severity: 'success',
                    summary: 'Success',
                    detail: 'File uploaded successfully',
                  });
                },
                error: (err) => {
                  console.log(err);
                },
                finalize: () => patchState(store, { isLoading: false }),
              })
            );
          })
        )
      ),
      downloadFile: rxMethod<string>(
        pipe(
          switchMap((fileName) => {
            patchState(store, { isLoading: true });
            return storageService.downloadFile(fileName).pipe(
              tapResponse({
                next: (res) => {
                  const url = window.URL.createObjectURL(res.response);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = fileName;
                  a.click();
                  window.URL.revokeObjectURL(url);
                },
                error: (err) => {
                  console.log(err);
                },
                finalize: () => patchState(store, { isLoading: false }),
              })
            );
          })
        )
      ),
      createFolder: rxMethod<string>(
        pipe(
          switchMap((folderName) => {
            patchState(store, { isLoading: true });
            return storageService.createFolder(folderName).pipe(
              tapResponse({
                next: (res) => {
                  patchState(store, { hasNewFolder: true });
                  messageService.add({
                    severity: 'success',
                    summary: 'Success',
                    detail: 'Folder created successfully',
                  });
                },
                error: (err) => {
                  console.log(err);
                },
                finalize: () => patchState(store, { isLoading: false }),
              })
            );
          })
        )
      ),
    })
  )
);
