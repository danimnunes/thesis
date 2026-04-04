import * as fs from "node:fs";

interface Options {
  basePath?: string;
}

export class Settings {
  #basePath: string;

  #data: Record<string, string>;

  #didRead = false;

  #fileName = "";

  #network: string;

  #tag: string | undefined;

  constructor(
    fileName: string,
    network: string,
    tag?: string,
    options?: Options,
  ) {
    const { basePath } = {
      basePath: "./settings",
      ...options,
    };

    this.#basePath = basePath;

    this.#network = network;

    this.#tag = tag;
    this.#fileName = fileName;
    this.#data = {};
  }

  get(key: string, defaultValue?: string) {
    if (!this.#didRead) {
      this.#readJSON();
    }

    const value = this.#data[key];
    if (!value) {
      return defaultValue;
    }

    return value;
  }

  mustGet(key: string) {
    const value = this.get(key);

    if (!value) {
      throw new Error(`Value for ${key} not found`);
    }

    return value;
  }

  set(key: string, value: string) {
    if (!this.#didRead) {
      this.#readJSON();
    }

    this.#data[key] = value;

    this.#writeJSON();
  }

  #ensureDirectoryExistence() {
    const path = this.#getDirectoryPath();

    if (!fs.existsSync(path)) {
      fs.mkdirSync(path, { recursive: true });
    }
  }

  #getDirectoryPath() {
    if (this.#tag === undefined) {
      return `./${this.#basePath}/${this.#network}`;
    }

    return `./${this.#basePath}/${this.#network}/${this.#tag}`;
  }

  #getPath() {
    return `${this.#getDirectoryPath()}/${this.#fileName}.json`;
  }

  #readJSON() {
    const path = this.#getPath();

    if (!fs.existsSync(path)) {
      this.#didRead = true;
      this.#data = {};

      return;
    }

    this.#data = JSON.parse(fs.readFileSync(path, "utf8")) as Record<
      string,
      string
    >;
    this.#didRead = true;
  }

  #writeJSON() {
    if (!this.#didRead) {
      return;
    }

    this.#ensureDirectoryExistence();

    const data = JSON.stringify(this.#data, undefined, 4);

    fs.writeFileSync(this.#getPath(), data, {
      flag: "w",
    });
  }
}
