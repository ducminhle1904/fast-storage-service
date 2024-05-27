import { CommonModule, JsonPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  effect,
  inject,
} from '@angular/core';
import {
  NewFolderComponent,
  UploadFileComponent,
} from '@app/shared/components';
import { Directory } from '@app/shared/model';
import { ImageSrcPipe } from '@app/shared/pipe';
import { AppStore, StorageStore } from '@app/store';
import { patchState } from '@ngrx/signals';
import {
  ConfirmationService,
  MenuItem,
  MenuItemCommandEvent,
  MessageService,
} from 'primeng/api';
import { BreadcrumbItemClickEvent, BreadcrumbModule } from 'primeng/breadcrumb';
import { ButtonModule } from 'primeng/button';
import { ContextMenuModule } from 'primeng/contextmenu';
import { DialogService, DynamicDialogModule } from 'primeng/dynamicdialog';
import { SpeedDialModule } from 'primeng/speeddial';
import { TableModule } from 'primeng/table';
import { environment } from 'environments/environment';
import { LocalStorageJwtService } from '@app/shared/services';
import { lastValueFrom } from 'rxjs';

@Component({
  selector: 'app-folder-detail',
  standalone: true,
  imports: [
    ButtonModule,
    JsonPipe,
    BreadcrumbModule,
    TableModule,
    SpeedDialModule,
    DynamicDialogModule,
    CommonModule,
    ImageSrcPipe,
    ContextMenuModule,
  ],
  templateUrl: './folder-detail.component.html',
  styleUrl: './folder-detail.component.scss',
  providers: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FolderDetailComponent implements OnInit {
  public storageStore = inject(StorageStore);
  public appStore = inject(AppStore);

  private readonly dialogService = inject(DialogService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);
  private readonly localStorageJwtService = inject(LocalStorageJwtService);

  public home: MenuItem | undefined;
  public selectedDirectory: Directory | null = null;

  public tableContextMenu: MenuItem[] = [];
  public speedDialItems: MenuItem[] = [];

  constructor() {
    effect(
      () => {
        if (
          this.storageStore.hasNewFolder() ||
          this.storageStore.hasNewFile() ||
          this.storageStore.hasFileRemoved()
        ) {
          this.storageStore.getDetailsDirectory({
            path: this.storageStore.currentPath(),
            type: 'detailFolder',
          });
        }
      },
      { allowSignalWrites: true }
    );
  }

  ngOnInit(): void {
    this.home = { icon: 'pi pi-home' };
    this.speedDialItems = [
      {
        icon: 'pi pi-refresh',
        command: () => console.log('Update'),
      },
      {
        icon: 'pi pi-folder-plus',
        command: () => this.addNewFolder(),
      },
      {
        icon: 'pi pi-upload',
        command: () => this.uploadFile(),
      },
    ];

    this.tableContextMenu = [
      {
        label: 'Download',
        icon: 'pi pi-fw pi-download',
        command: () => this.downloadFile(),
      },
      {
        label: 'Delete',
        icon: 'pi pi-fw pi-times',
        command: (e) => this.removeFile(e),
      },
    ];
  }

  public handleBreadcrumb(event: BreadcrumbItemClickEvent): void {
    const item = event.item.label;
    const index = this.storageStore
      .breadcrumb()
      .findIndex((b) => b.label === item);
    patchState(this.storageStore, {
      breadcrumb: this.storageStore.breadcrumb().slice(0, index + 1),
    });
  }

  public retrieveDirectory(directory: Directory): void {
    if (directory.type === 'folder') {
      const newPath = this.storageStore.currentPath() + '/' + directory.name;
      patchState(this.storageStore, {
        currentPath: newPath,
        breadcrumb: newPath.split('/').map((p) => ({
          label: p,
          command: () => {
            const nextPath = newPath
              .split('/')
              .slice(0, newPath.split('/').indexOf(p) + 1)
              .join('/');
            this.storageStore.getDetailsDirectory({
              path: nextPath,
              type: 'detailFolder',
            });
          },
          styleClass: 'cursor-pointer',
        })),
      });
      this.storageStore.getDetailsDirectory({
        path: newPath,
        type: 'detailFolder',
      });
    }
  }

  private addNewFolder(): void {
    this.dialogService.open(NewFolderComponent, {
      header: 'Create new folder',
    });
  }

  private uploadFile(): void {
    const uploadFileDialogRef = this.dialogService.open(UploadFileComponent, {
      header: 'Upload file',
      width: '50vw',
    });

    uploadFileDialogRef.onClose.subscribe((res) => {
      if (res) {
        this.storageStore.getDetailsDirectory({
          path: this.storageStore.currentPath(),
          type: 'detailFolder',
        });
      }
    });
  }

  private async downloadFile() {
    const accessToken = await lastValueFrom(
      this.localStorageJwtService.getAccessToken()
    );
    if (!accessToken || !this.selectedDirectory) return;

    if (this.selectedDirectory.type === 'folder') {
      this.messageService.add({
        severity: 'warn',
        summary: 'Error',
        detail: 'Download folder is not supported.',
      });
      return;
    }

    window.location.href = `${
      environment.apiUrl
    }/storage/download_file?fileNameToDownload=${
      this.selectedDirectory?.name
    }&locationToDownload=${this.storageStore.currentPath()}&token=${accessToken}`;
  }

  private removeFile(event: MenuItemCommandEvent): void {
    this.confirmationService.confirm({
      target: event.originalEvent?.target as EventTarget,
      message: 'Do you want to delete this?',
      header: 'Delete Confirmation',
      icon: 'pi pi-info-circle',
      acceptButtonStyleClass: 'p-button-danger p-button-text',
      rejectButtonStyleClass: 'p-button-text p-button-text',
      accept: () => {
        this.storageStore.removeFile({
          request: {
            fileNameToRemove: this.selectedDirectory?.name ?? '',
            locationToRemove: this.storageStore.currentPath(),
          },
        });
      },
    });
  }
}
