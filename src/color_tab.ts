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
  // set all colors
  const cssFile = path.join(modulesPath(context), "inject.css");
  const tabs = storage.get("tabs") || {};
  const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
  const tasks = storage.get(`tasks-${workspacePath}`) || [];
  let style = "";
  let activeSelectorsArr: string[] = [];
  const colorsData = storage.get("customColors");

  const generateStyleForTabs = (tabs: string[], taskColorDict: any, type: string): string => {

    let style = "";
    const taskColorData = taskColorDict[type]
    if (taskColorData) {
      let backgroundSelectors = "";
      let fontColorSelectors = "";
      const _background = taskColorData.background;
      const _fontColor = taskColorData.color;
      const _opacity = taskColorData.opacity || "0.6";
      const backgroundSelectorsArr = tabs.map(function (a: string) {
        return `.tab[title*="${formatTabTitle(a)}" i]`;
      });
      activeSelectorsArr.push(
        ...tabs.map(function (a: string) {
          return `.tab[title*="${formatTabTitle(a)}" i].active`;
        })
      );
      const fontColorSelectorsArr = tabs.map(function (a: string) {
        return `.tab[title*="${formatTabTitle(a)}" i] a,.tab[title="${formatTabTitle(a)}" i] .monaco-icon-label:after,.tab[title*="${formatTabTitle(a)}" i] .monaco-icon-label:before`;
      });
      if (backgroundSelectorsArr.length > 0) {
        backgroundSelectors = backgroundSelectorsArr.join(",") + `{background-color:${_background} !important; opacity:${_opacity};}`;
      }

      if (fontColorSelectorsArr.length > 0) {
        fontColorSelectors = fontColorSelectorsArr.join(",") + `{color:${_fontColor} !important;}`;
      }
      style += backgroundSelectors + fontColorSelectors;
    }

    if (activeSelectorsArr.length > 0) {
      let activeSelectors = activeSelectorsArr.join(",") + `{opacity:1;}`;
      style += activeSelectors;
    }
    return style;
  };

  for (const task of tasks) {
    if (!task.isComplete){
      let taskTabs = new Map();

      // Create a map of subtask names to file paths
      for (const file of task.files) {
        let fileSubtask = file.subtask || "Task";

        if (!taskTabs.has(fileSubtask)) {
          taskTabs.set(fileSubtask, []);
        }
        taskTabs.get(fileSubtask).push(file.filePath.replace(/\\/g, "\\\\"));
      }

      // Generate style for each subtask
      for (const subtask of task.subtasks) {
        let subtabs = taskTabs.get(subtask.name);
        if (subtabs) {
          let subtaskColorData = colorsData[task.id];
          style += generateStyleForTabs(subtabs, subtaskColorData, subtask.name);
          

        }
      }

      // Generate style for files without a subtask
      let taskFiles = taskTabs.get("Task");
      if (taskFiles) {
        let taskColorData = colorsData[task.id];
        style += generateStyleForTabs(taskFiles, taskColorData, "Task");
      }
    }
  }
  const dirExists = fs.existsSync(modulesPath(context));
  if (!dirExists) {
    const test = fs.mkdirSync(modulesPath(context), { recursive: true });
    console.log("css", test);
  }
  console.log("file", cssFile);
  if (fs.existsSync(cssFile)) {
    fs.writeFileSync(cssFile, style);
  } else {
    fs.appendFile(cssFile, style, function (err) {
      if (err) {
        vscode.window.showInformationMessage(
          `Could not create a css file. tabscolor won't be able to change your tabs color`
        );
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
