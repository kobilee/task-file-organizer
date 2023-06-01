import * as vscode from "vscode";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import Storage from "./storage";
import { Task } from "./taskManager";

interface ColorInfo {
  background: string;
  color: string;
}

interface CustomColor {
  [colorName: string]: ColorInfo;
}

function modulesPath(context: vscode.ExtensionContext): string {
  return path.join(context.globalStoragePath, "modules");
}

function formatTabTitle(title: string): string {
  if (os.platform() !== "win32") {
    const homeDir = os.homedir() + "/";
    title = title.replace(homeDir, "");
  }
  return title;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

function getContrastColor(hexColor: string): string {
  const rgb = hexToRgb(hexColor);
  if (!rgb) return "white";

  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.5 ? "black" : "white";
}

export function generateCssFile(context: vscode.ExtensionContext): void {
  const storage = new Storage(context);
  const cssFile = path.join(modulesPath(context), "inject.css");
  const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
  const tasks = storage.get(`tasks-${workspacePath}`) || [];
  const colorsData = storage.get("customColors");

  let activeSelectorsArr: string[] = [];
  let fileToActiveTask = createFileToActiveTaskMap(tasks);

  let style = tasks.filter((task: { isComplete: any; }) => !task.isComplete)
                   .map((task: any) => generateTaskStyles(task, colorsData, activeSelectorsArr, fileToActiveTask))
                   .join('');

  if (activeSelectorsArr.length > 0) {
      style += activeSelectorsArr.join(",") + `{opacity:1;}`;
  }

  ensureDirectoryExistence(cssFile);
  writeStyleToFile(cssFile, style);
}

function createFileToActiveTaskMap(tasks: any[]): Map<string, any> {
  let fileToActiveTask = new Map();
  for (const task of tasks.filter(t => t.isActive)) {
      for (const file of task.files) {
          let filePath = file.filePath.replace(/\\/g, "\\\\");
          fileToActiveTask.set(filePath, task);
      }
  }
  return fileToActiveTask;
}

function generateTaskStyles(task: any, colorsData: any, activeSelectorsArr: string[], fileToActiveTask: Map<string, any>): string {
  let taskTabs = createTaskTabsMap(task, fileToActiveTask);
  console.log(taskTabs)
  let style = '';
  for (const subtaskName of Array.from(taskTabs.keys())) {
      let tabs = taskTabs.get(subtaskName);
      if (tabs) {
          let taskColorData = colorsData[task.id];
          style += generateStyleForTabs(tabs, taskColorData, subtaskName, activeSelectorsArr);
      }
  }
  return style;
}

function createTaskTabsMap(task: any, fileToActiveTask: Map<string, any>): Map<string, string[]> {
  let taskTabs = new Map();
  for (const file of task.files) {
      let fileSubtask = file.subtask || "Task";
      if (task.isActive || !fileToActiveTask.has(file.filePath.replace(/\\/g, "\\\\"))) {
          taskTabs.set(fileSubtask, (taskTabs.get(fileSubtask) || []).concat(file.filePath.replace(/\\/g, "\\\\")));
      }
  }
  return taskTabs;
}


function generateStyleForTabs(tabs: string[], taskColorDict: any, type: string, activeSelectorsArr: string[]): string {
  let style = "";
  const taskColorData = taskColorDict[type]
  if (taskColorData) {
      const _background = taskColorData.background;
      const _fontColor = taskColorData.color;
      const _opacity = taskColorData.opacity || "0.6";

      let backgroundSelectorsArr = tabs.map(a => `.tab[title*="${formatTabTitle(a)}" i]`);
      let fontColorSelectorsArr = tabs.map(a => `.tab[title*="${formatTabTitle(a)}" i] a,.tab[title="${formatTabTitle(a)}" i] .monaco-icon-label:after,.tab[title*="${formatTabTitle(a)}" i] .monaco-icon-label:before`);

      if (backgroundSelectorsArr.length > 0) {
          style += backgroundSelectorsArr.join(",") + `{background-color:${_background} !important; opacity:${_opacity};}`;
      }

      if (fontColorSelectorsArr.length > 0) {
          style += fontColorSelectorsArr.join(",") + `{color:${_fontColor} !important;}`;
      }

      activeSelectorsArr.push(
          ...tabs.map(a => `.tab[title*="${formatTabTitle(a)}" i].active`)
      );
  }

  return style;
}

function ensureDirectoryExistence(filePath: string) {
  const dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return;
  }
  fs.mkdirSync(dirname, { recursive: true });
}

function writeStyleToFile(cssFile: string, style: string) {
  if (fs.existsSync(cssFile)) {
      fs.writeFileSync(cssFile, style);
  } else {
      fs.appendFile(cssFile, style, function (err) {
          if (err) {
              vscode.window.showInformationMessage(`Could not create a css file. tabscolor won't be able to change your tabs color`);
              throw err;
          }
      });
  }
}

export function reloadCss(): void {
  vscode.window.showInformationMessage("---tab updated---");
}

export function addColor(
  context: vscode.ExtensionContext,
  task_id: string,
  color: string,
  task_type: string
) {
  const storage = new Storage(context);
  const contrastColor = getContrastColor(color);
  var colors = { [task_id]: { background: color, color: contrastColor, type: task_type} };
  storage.addCustomColor(colors);
}

export function updateColor(
  context: vscode.ExtensionContext,
  task_id: string,
  color: string,
  task_type: string
) {
  const storage = new Storage(context);
  const contrastColor = getContrastColor(color);
  var colors = { [task_id]: { background: color, color: contrastColor, type: task_type} };
  storage.addCustomColor(colors);
}

export function setColor(
  context: vscode.ExtensionContext,
  task: string,
  title: string,
): void {
  const storage = new Storage(context);

  if (storage.get("patchedBefore")) {
    if (storage.get("secondActivation")) {
      storage.addTabColor(task, title.replace(/\\/g, "\\\\"));
      generateCssFile(context);
      reloadCss();
    } else {
      vscode.window.showErrorMessage(
        "In order for Tabscolor to work, you need to restart your VS Code (not just reload) "
      );
    }
  } else {
    vscode.window.showErrorMessage(
      "Tabscolor was unable to patch your VS Code files. "
    );
  }
}

export function unsetColor(
  context: vscode.ExtensionContext,
  title: string
): void {
  const storage = new Storage(context);
  if (storage.get("patchedBefore")) {
    if (storage.get("secondActivation")) {
      generateCssFile(context);
      reloadCss();
    } else {
      vscode.window.showErrorMessage(
        "In order for Tabscolor to work, you need to restart your VS Code (not just reload) "
      );
    }
  } else {
    vscode.window.showErrorMessage(
      "Tabscolor was unable to patch your VS Code files. "
    );
  }
}
