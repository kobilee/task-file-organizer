import * as vscode from "vscode";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import Storage from "./storage";

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
  const rulesBasedStyle = vscode.workspace.getConfiguration("tabsColor");
  const byFileType = rulesBasedStyle.byFileType;
  const byDirectory = rulesBasedStyle.byDirectory;
  const activeTab = rulesBasedStyle.activeTab;
  const cssFile = path.join(modulesPath(context), "inject.css");
  const data = "";
  const tabs = storage.get("tabs") || {};
  let style = "";
  const homeDir = os.homedir() + "/";

  for (const fileType in byFileType) {
    if (fileType == "filetype") continue;
    style += `.tab[title$=".${formatTabTitle(fileType)}" i]{background-color:${
      byFileType[fileType].backgroundColor
    } !important; opacity:${byFileType[fileType].opacity || "0.6"};}
          .tab[title$="${formatTabTitle(
            fileType
          )}" i] a,.tab[title$="${formatTabTitle(
      fileType
    )}" i] .monaco-icon-label:after,.tab[title$="${formatTabTitle(
      fileType
    )}" i] .monaco-icon-label:before{color:${
      byFileType[fileType].fontColor
    } !important;}`;
  }

  for (const directory in byDirectory) {
    if (directory == "my/directory/") continue;
    const formattedTitle = directory.replace(/\\/g, "\\\\");
    style += `.tab[title*="${formatTabTitle(
      formattedTitle
    )}" i]{background-color:${
      byDirectory[directory].backgroundColor
    } !important; opacity: ${byDirectory[directory].opacity || "0.6"};}
          .tab[title*="${formatTabTitle(
            formattedTitle
          )}" i] a,.tab[title*="${formatTabTitle(
      formattedTitle
    )}" i] .monaco-icon-label:after,.tab[title*="${formatTabTitle(
      formattedTitle
    )}" i] .monaco-icon-label:before{color:${
      byDirectory[directory].fontColor
    } !important;}`;
  }

  let activeSelectors = "";
  const activeSelectorsArr = [];
  const colorsData = storage.get("customColors");
  for (const i in tabs) {
    if (colorsData[i]) {
      const _colorTabs = tabs[i];
      let backgroundSelectors = "";
      let fontColorSelectors = "";
      const _background = colorsData[i].background;
      const _fontColor = colorsData[i].color;
      const _opacity = colorsData[i].opacity || "0.6";
      const backgroundSelectorsArr = _colorTabs.map(function (a: string) {
        return `.tab[title*="${formatTabTitle(a)}" i]`;
      });
      activeSelectorsArr.push(
        ..._colorTabs.map(function (a: string) {
          return `.tab[title*="${formatTabTitle(a)}" i].active`;
        })
      );
      const fontColorSelectorsArr = _colorTabs.map(function (a: string) {
        return `.tab[title*="${formatTabTitle(
          a
        )}" i] a,.tab[title="${formatTabTitle(a)}" i] .monaco-icon-label:after,.tab[title*="${formatTabTitle(a)}" i] .monaco-icon-label:before`;
      });
      if (backgroundSelectorsArr.length > 0) {
        backgroundSelectors =
          backgroundSelectorsArr.join(",") +
          `{background-color:${_background} !important; opacity:${_opacity};}`;
      }

      if (fontColorSelectorsArr.length > 0) {
        fontColorSelectors =
          fontColorSelectorsArr.join(",") + `{color:${_fontColor} !important;}`;
      }
      style += backgroundSelectors + fontColorSelectors;
    }
    if (activeSelectorsArr.length > 0) {
      activeSelectors = activeSelectorsArr.join(",") + `{opacity:1;}`;
    }
    style += activeSelectors;
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
}

export function reloadCss(): void {
  vscode.window.showInformationMessage("---tab updated---");
}

export function setColor(
  context: vscode.ExtensionContext,
  task: string,
  color: string,
  title: string
): void {
  const storage = new Storage(context);
  const contrastColor = getContrastColor(color);
  if (storage.get("patchedBefore")) {
    if (storage.get("secondActivation")) {
      var colors = { [task]: { background: color, color: contrastColor } };
      storage.addCustomColor(colors);
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
      storage.removeTabColor(title);
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
