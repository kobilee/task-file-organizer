import * as vscode from "vscode";

interface ColorInfo {
  background: string;
  color: string;
}

interface CustomColor {
  [colorName: string]: ColorInfo;
}

class Storage {
  private storage: vscode.Memento;

  constructor(context: vscode.ExtensionContext) {
    this.storage = context.globalState;
  }

  set(key: string, value: any): void {
    this.storage.update(key, value);
  }

  add(key: string, value: any): void {
    let data = this.storage.get(key) as any[];
    if (!data) {
      data = [];
    }
    data.push(value);
    this.set(key, data);
  }

  remove(key: string, value: any): void {
    let data = this.storage.get(key) as any[];
    if (data) {
      const index = data.findIndex(
        (item) => JSON.stringify(item) === JSON.stringify(value)
      );
      if (index !== -1) {
        data.splice(index, 1);
        this.set(key, data);
      }
    }
  }

  addTabColor(task: string, title: string): void {
    let tabs = this.get("tabs");
    if (!tabs) tabs = {};
    if (!tabs[task]) {
      tabs[task] = [];
    }
    for (const i in tabs) {
      const _tabsColor = tabs[i];
      tabs[i] = _tabsColor.filter(function (a: string) {
        return a != title;
      });
    }
    tabs[task].push(title);
    this.set("tabs", tabs);
  }

  removeTabColor(title: string): void {
    const tabs = this.get("tabs");
    for (const i in tabs) {
      const _tabsColor = tabs[i];
      tabs[i] = _tabsColor.filter(function (a: string) {
        return a != title;
      });
    }
    this.set("tabs", tabs);
  }

  clearTabColor(): void {
    const tabs = {};
    this.set("tabs", tabs);
  }

  addCustomColor(color: CustomColor) {
    const colors = this.get("customColors") || {};
    const colorName = Object.keys(color)[0];
    colors[colorName] = {
      background: color[colorName].background,
      color: color[colorName].color,
    };
    this.set("customColors", colors);
  }

  removeTab(tab: string): void {
    const tabs = this.get("tabs") || {};
    delete tabs[tab];
    this.set("tabs", tabs);
  }

  emptyTabs(): void {
    this.set("tabs", {});
  }

  get(key: string): any {
    return this.storage.get(key);
  }
}

export default Storage;
