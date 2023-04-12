import * as fs from "fs";
import * as os from "os";
import * as vscode from "vscode";

type SudoPromptCallback = (result: boolean) => void;

class Core {
  private context: vscode.ExtensionContext;
  private fileContent: string;
  private initialContent: string;
  public file: string;

  constructor(context: vscode.ExtensionContext, filePath: string) {
    this.context = context;
    this.fileContent = fs.readFileSync(filePath, "utf8");
    this.initialContent = this.fileContent;
    this.file = filePath;
  }

  exists(): boolean {
    return fs.existsSync(this.file);
  }

  startPatch(patchName: string, isReg = false): string {
    let patchString = `
        /* startpatch ${patchName} */
        `;
    if (isReg) patchString = patchString.replace(/\*/g, "\\*");
    return patchString;
  }

  isReadOnly(): boolean {
    try {
      fs.writeFileSync(this.file, this.initialContent);
    } catch (e) {
      return true;
    }
    return false;
  }

  chmod(): boolean {
    try {
      fs.chmodSync(this.file, 0o700);
    } catch (e) {
      console.log("Error Code:", e);
      return false;
    }
    return true;
  }

  hasPatch(patchName: string): boolean {
    return this.fileContent.includes(this.startPatch(patchName));
  }

  endPatch(patchName: string, isReg = false): string {
    let patchString = `
        /* endpatch ${patchName} */
        `;
    if (isReg) patchString = patchString.replace(/\*/g, "\\*");
    return patchString;
  }

  remove(patchName: string): this {
    const regString = `(${this.startPatch(
      patchName,
      true
    )})[^]*(${this.endPatch(patchName, true)})`;
    const reg = new RegExp(regString);
    this.fileContent = this.fileContent.replace(reg, "");
    return this;
  }

  add(patchName: string, code: string): this {
    const enclosedCode = `${this.startPatch(patchName)} ${code} ${this.endPatch(
      patchName
    )}`;
    this.fileContent = " " + enclosedCode + " " + this.fileContent;
    return this;
  }

  empty(): void {
    fs.writeFileSync(this.file, "");
    this.initialContent = "";
  }

  write(): void {
    console.log(this.fileContent);
    fs.writeFileSync(this.file, this.fileContent);
    this.initialContent = this.fileContent;
  }

  sudoPrompt(func: SudoPromptCallback): void {
    const options = {
      name: "TabsColor",
    };
    const separator = this.file.includes("/") ? "/" : "\\";
    const baseName = this.file.split(separator).reverse()[0];
    let command = `chmod 777 "${this.file}"`;
    switch (os.platform()) {
      case "win32":
        {
          command = `rename "${this.file}" "${baseName}"`;
        }
        break;
    }
    sudo.exec(
      command,
      options,
      (error: Error, stdout: string, stderr: string) => {
        if (error) {
          func(false);
          throw error;
        } else {
          func(true);
        }
      }
    );
  }
}

export default Core;
