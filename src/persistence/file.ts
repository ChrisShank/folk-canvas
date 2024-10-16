import { KeyValueStore } from './indexeddb';

export class FileSaver {
  #id;
  #fileType;
  #fileExtension;
  #mimeType;
  #store;
  #fileHandlerPromise;

  // Feature detection. The API needs to be supported and the app not run in an iframe.
  #supportsFileSystemAccess =
    'showSaveFilePicker' in window &&
    (() => {
      try {
        return window.self === window.top;
      } catch {
        return false;
      }
    })();

  constructor(id: string, fileType: string, mimeType: string) {
    this.#id = id;
    this.#fileType = fileType;
    this.#fileExtension = `.${this.#fileType}`;
    this.#mimeType = mimeType;
    this.#store = new KeyValueStore<FileSystemFileHandle>(this.#id);
    this.#fileHandlerPromise = this.#loadFileHandler();
  }

  async #loadFileHandler() {
    const file = await this.#store.get('file');

    if (file === undefined) return undefined;

    // We need to request permission since the file handler was persisted.
    // Calling `queryPermission` seems unnecessary atm since the browser prompts permission for each session
    const previousPermission = await file.queryPermission({ mode: 'readwrite' });
    if (previousPermission === 'granted') return file;

    const newPermission = await file.requestPermission({ mode: 'readwrite' });
    if (newPermission === 'granted') return file;

    return undefined;
  }

  async open(): Promise<string> {
    let fileHandler = await this.#fileHandlerPromise;

    if (fileHandler === undefined) {
      fileHandler = await this.#showFilePicker();
    }

    const file = await fileHandler.getFile();
    const text = await file.text();
    return text;
  }

  async save(content: string, promptNewFile = false) {
    // TODO: progressively enhance using anchor downloads?
    if (!this.#supportsFileSystemAccess) {
      throw new Error('File System Access API is not supported.');
    }

    let fileHandler = await this.#fileHandlerPromise;

    if (promptNewFile || fileHandler === undefined) {
      fileHandler = await this.#showFilePicker();
    }

    const writer = await fileHandler.createWritable();
    await writer.write(content);
    await writer.close();
  }

  async #showFilePicker() {
    this.#fileHandlerPromise = window.showSaveFilePicker({
      id: this.#id,
      suggestedName: `${this.#id}.${this.#fileType}`,
      types: [
        {
          description: `${this.#fileType.toUpperCase()} document`,
          accept: { [this.#mimeType]: [this.#fileExtension] },
        },
      ],
    });

    const fileHandler = (await this.#fileHandlerPromise)!;
    await this.#store.set('file', fileHandler);
    return fileHandler;
  }
}

declare global {
  var showSaveFilePicker: (args: any) => Promise<FileSystemFileHandle>;
  var showOpenFilePicker: (args: any) => Promise<FileSystemFileHandle[]>;

  interface FileSystemHandle {
    queryPermission: (args: any) => Promise<string>;
    requestPermission: (args: any) => Promise<string>;
  }
}
