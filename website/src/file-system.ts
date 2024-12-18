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

    // this requires user interaction
    // const newPermission = await file.requestPermission({ mode: 'readwrite' });
    // if (newPermission === 'granted') return file;

    return undefined;
  }

  async open(showPicker = true): Promise<string> {
    let fileHandler = await this.#fileHandlerPromise;

    if (showPicker) {
      fileHandler = await this.#showOpenFilePicker();
    }

    if (fileHandler === undefined) return '';

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
      fileHandler = await this.#showSaveFilePicker();
    }

    const writer = await fileHandler.createWritable();
    await writer.write(content);
    await writer.close();
  }

  clear() {
    this.#store.clear();
  }

  async #showSaveFilePicker() {
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

  async #showOpenFilePicker() {
    this.#fileHandlerPromise = window
      .showOpenFilePicker({
        id: this.#id,
        suggestedName: `${this.#id}.${this.#fileType}`,
        types: [
          {
            description: `${this.#fileType.toUpperCase()} document`,
            accept: { [this.#mimeType]: [this.#fileExtension] },
          },
        ],
      })
      .then((files) => files[0]);

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

class KeyValueStore<Data> {
  #db: Promise<IDBDatabase>;
  #storeName;

  constructor(name = 'keyval-store') {
    this.#storeName = name;
    const request = indexedDB.open(name);
    request.onupgradeneeded = () => request.result.createObjectStore(name);

    this.#db = this.#promisifyRequest(request);
  }

  #promisifyRequest<T>(transaction: IDBRequest<T>) {
    return new Promise<T>((resolve, reject) => {
      transaction.onsuccess = () => resolve(transaction.result);
      transaction.onerror = () => reject(transaction.error);
    });
  }

  #promisifyTransaction(transaction: IDBTransaction) {
    return new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onabort = transaction.onerror = () => reject(transaction.error);
    });
  }

  #getStore(mode: 'readonly' | 'readwrite') {
    return this.#db.then((db) => db.transaction(this.#storeName, mode).objectStore(this.#storeName));
  }

  get(key: IDBValidKey): Promise<Data | undefined> {
    return this.#getStore('readonly').then((store) => this.#promisifyRequest(store.get(key)));
  }

  set(key: IDBValidKey, value: Data) {
    return this.#getStore('readwrite').then((store) => {
      store.put(value, key);
      return this.#promisifyTransaction(store.transaction);
    });
  }

  setMany(entries: [IDBValidKey, Data][]) {
    return this.#getStore('readwrite').then((store) => {
      entries.forEach((entry) => store.put(entry[1], entry[0]));
      return this.#promisifyTransaction(store.transaction);
    });
  }

  delete(key: IDBValidKey) {
    return this.#getStore('readwrite').then((store) => {
      store.delete(key);
      return this.#promisifyTransaction(store.transaction);
    });
  }

  clear() {
    return this.#getStore('readwrite').then((store) => {
      store.clear();
      return this.#promisifyTransaction(store.transaction);
    });
  }

  keys() {
    return this.#getStore('readwrite').then((store) => this.#promisifyRequest(store.getAllKeys()));
  }

  values(): Promise<Data[]> {
    return this.#getStore('readwrite').then((store) => this.#promisifyRequest(store.getAll()));
  }

  entries(): Promise<[IDBValidKey, Data][]> {
    return this.#getStore('readwrite').then((store) =>
      Promise.all([this.#promisifyRequest(store.getAllKeys()), this.#promisifyRequest(store.getAll())]).then(
        ([keys, values]) => keys.map((key, i) => [key, values[i]])
      )
    );
  }
}
