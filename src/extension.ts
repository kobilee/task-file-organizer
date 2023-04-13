// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import {
  TaskManagerProvider,
  Task,
  TaskFile,
  TaskTreeItem,
  ActiveTaskProvider,
  CompletedTaskProvider,
} from "./taskManager";
import Storage from "./storage";
import Core from "./core";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import { generateCssFile, reloadCss, setColor, unsetColor } from "./color_tab";
let storage_: any = null;

const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
  ignorePunctuation: true,
});

const progressOptions: vscode.ProgressOptions = {
  location: vscode.ProgressLocation.Notification,
  title: "Sorting editors",
  cancellable: true,
};

function modulesPath(context: vscode.ExtensionContext): vscode.Uri {
  return vscode.Uri.joinPath(context.globalStorageUri, "modules");
}

export function generateUniqueId() {
  return (
    new Date().getTime().toString(36) + Math.random().toString(36).substr(2, 5)
  );
}

function generateRandomColor(): string {
  return "#" + Math.floor(Math.random() * 16777215).toString(16);
}

async function createTask(taskManagerProvider: TaskManagerProvider) {
  const taskName = await vscode.window.showInputBox({
    prompt: "Enter the task name",
  });
  if (taskName) {
    const newTask: Task = {
      id: generateUniqueId(),
      name: taskName,
      isComplete: false,
      files: [],
      color: generateRandomColor(),
    };
    taskManagerProvider.addTask(newTask);
  }
}

function unsetColorLoop(task: Task, context: vscode.ExtensionContext) {
  for (let i = 0; i < task.files.length; i++) {
    const file = task.files[i];
    unsetColor(context, file.filePath.replace(/\\/g, "\\\\"));
  }
}

async function removeTask(
  taskManagerProvider: TaskManagerProvider,
  task: Task,
  context: vscode.ExtensionContext
) {
  unsetColorLoop(task, context);
  taskManagerProvider.removeTask(task);
}

async function toggleTaskCompletion(
  taskManagerProvider: TaskManagerProvider,
  task: Task
) {
  task.isComplete = !task.isComplete;
  taskManagerProvider.refresh();
}

async function addFileToTask(
  taskManagerProvider: TaskManagerProvider,
  task: Task,
  context: vscode.ExtensionContext
) {
  const options: vscode.OpenDialogOptions = {
    canSelectMany: false,
    openLabel: "Select a file",
    filters: {
      "All files": ["*"],
    },
  };

  const fileUri = await vscode.window.showOpenDialog(options);
  if (fileUri && fileUri[0]) {
    taskManagerProvider.addFileToTask(task, fileUri[0].fsPath);
    setColor(context, task.id, task.color, fileUri[0].fsPath);
  }
}

async function addActiveFileToTask(taskManagerProvider: TaskManagerProvider, context: vscode.ExtensionContext) {
	const activeEditor = vscode.window.activeTextEditor;
  
	if (!activeEditor) {
	  vscode.window.showErrorMessage('No active file to add to task.');
	  return;
	}
  
	const activeFilePath = activeEditor.document.uri.fsPath;
  
	// Prompt the user to select a task.
	const tasks = taskManagerProvider.tasks; // Replace with your function to get the list of tasks.
	const pickedTask = await vscode.window.showQuickPick(
	  tasks.map((task: Task) => task.name), // Replace 'name' with the appropriate task property.
	  { placeHolder: 'Select a task to add the active file to' }
	);
  
	if (!pickedTask) {
	  return;
	}
  
	// Find the selected task and add the active file path to it.
	const task = tasks.find((task: Task) => task.name === pickedTask); // Replace 'name' with the appropriate task property.
	if (task) {
		taskManagerProvider.addFileToTask(task, activeFilePath)
		setColor(context, task.id, task.color, activeFilePath);
	} else {
	  vscode.window.showErrorMessage('Task not found.');
	}
  }

async function removeFileFromTask(
  taskManagerProvider: TaskManagerProvider,
  taskTreeItem: TaskTreeItem,
  context: vscode.ExtensionContext
) {
  const file = JSON.parse(taskTreeItem.fileJSON) as TaskFile;
  if (typeof taskTreeItem.id === "string") {
    const taskId = taskTreeItem.id.split("|")[0];
    taskManagerProvider.removeFileFromTask(taskId, file);
    unsetColor(context, taskTreeItem.id.split("|")[1].replace(/\\/g, "\\\\"));
  } else {
    // Handle the case where taskTreeItem.id is undefined, if necessary
    console.error("taskTreeItem.id is undefined");
  }
}

async function openTaskFile(filePath: string) {
  const fileUri = vscode.Uri.file(filePath);
  const document = await vscode.workspace.openTextDocument(fileUri);
  await vscode.window.showTextDocument(document, { preview: false });
}

async function activateTask(task: Task, context: vscode.ExtensionContext) {
  for (let i = 0; i < task.files.length; i++) {
    const file = task.files[i];
    setColor(context, task.id, task.color, file.filePath);
  }
}

async function openAllFilesInTask(task: Task) {
  for (const taskFile of task.files) {
    await openTaskFile(taskFile.filePath);
  }
}

async function closeAllFilesInTask(task: Task) {
  const filesToClose = task.files.map((file) => vscode.Uri.file(file.filePath));

  for (const file of filesToClose) {
    const document = vscode.workspace.textDocuments.find(
      (doc) => doc.uri.fsPath === file.fsPath
    );

    if (document) {
      console.log(`Closing file: ${file.fsPath}`);
      await vscode.window.showTextDocument(document, {
        preview: false,
        preserveFocus: true,
      });
      await vscode.commands.executeCommand(
        "workbench.action.closeActiveEditor"
      );
    }
  }
}

function isTabInTask(tab: vscode.Tab, task: Task): boolean {
  const tabFilePath = (tab.input as vscode.TabInputText).uri.path.replace(
    /\//g,
    "\\"
  );
  for (const taskFile of task.files) {
    const file = "\\" + taskFile.filePath;
    if (file === tabFilePath) {
      return true;
    }
  }
  return false;
}

function sortTabGroupEditors(
  tabGroups: readonly vscode.TabGroup[],
  task: Task
) {
  const formatPath = (a: string) => path.basename(a);
  return tabGroups.flatMap((g) => {
    return g.tabs
      .filter(
        (t) => t.input instanceof vscode.TabInputText && isTabInTask(t, task)
      ) // Filter tabs that are part of a task
      .map((t) => ({ ...t, uri: (t.input as vscode.TabInputText).uri }))
      .sort((a, b) =>
        b.isPinned
          ? 1
          : collator.compare(formatPath(a.uri.path), formatPath(b.uri.path))
      );
  });
}

async function sortAllOpenedEditors(tabGroups: readonly vscode.TabGroup[], task: Task) {
	const sortedEditors = sortTabGroupEditors(tabGroups, task);
    const lastActiveEditor = vscode.window.activeTextEditor;
    const increment = 100 / sortedEditors.length;
    await vscode.window.withProgress(progressOptions, async (progress, cancellationToken) => {
        for (let i = 0; i < sortedEditors.length; i++) {
            if (cancellationToken.isCancellationRequested) {
                break;
            }

            progress.report({ message: `${i + 1}/${sortedEditors.length}` });

            if (sortedEditors[i].isPinned === false) {
                try {
                    await vscode.window.showTextDocument(sortedEditors[i].uri, { preview: false, viewColumn: sortedEditors[i].group.viewColumn });
                    await vscode.commands.executeCommand('moveActiveEditor', { to: 'position', value: i + 1 });
                } catch (error: any) {
                    vscode.window.showErrorMessage(error.message ?? 'Unknown Exception');
                }
            }

            progress.report({ increment });
        }
    });

    if (lastActiveEditor) {
        try {
            await vscode.window.showTextDocument(lastActiveEditor.document, { viewColumn: lastActiveEditor.viewColumn });
        } catch (error: any) {
            vscode.window.showErrorMessage(error.message ?? 'Unknown Exception');
        }
    }
}

async function completeTask(
  taskManagerProvider: TaskManagerProvider,
  completedTaskProvider: CompletedTaskProvider,
  activeTaskProvider: ActiveTaskProvider,
  task: Task,
  context: vscode.ExtensionContext
) {
  unsetColorLoop(task, context);
  taskManagerProvider.updateTaskToComplete(task.id);
  completedTaskProvider.refresh()
  activeTaskProvider.refresh()
}

function promptRestart() {
  vscode.window.showInformationMessage(
    `Restart VS Code (not just reload) in order for tabscolor changes to take effect.`
  );
}

function promptRestartAfterUpdate() {
  vscode.window.showInformationMessage(
    `VS Code files change detected. Restart VS Code (not just reload) in order for tabscolor to work.`
  );
}

export function activate(context: vscode.ExtensionContext) {
  const storage = new Storage(context);
  let cssFileLink = path
    .join(modulesPath(context).path, "inject.css")
    .replace(/\\/g, "/");
  if (os.platform() == "win32") {
    cssFileLink = "vscode-file://vscode-app" + cssFileLink;
  }

  let bootstrapPath = path.join(
    path.dirname((require.main as NodeJS.Module).filename),
    "vs/workbench/workbench.desktop.main.js"
  );
  if (!fs.existsSync(bootstrapPath)) {
    bootstrapPath = path.join(
      path.dirname((require.main as NodeJS.Module).filename),
      "bootstrap-window.js"
    );
  }
  const bootstrap = new Core(context, bootstrapPath);
  const code = `
	function reloadCss(){
		let tabsCss=document.getElementById("tabscss");
		tabsCss.href=tabsCss.href.replace(/\\?refresh=(\\d)*/,"")+"?refresh="+Math.floor(Math.random() * 999999999999);
	}
	function createCss(){
		let head = document.getElementsByTagName('head')[0];
				let link = document.createElement('link');
				link.rel = 'stylesheet';
				link.id= 'tabscss';
				link.type = 'text/css';
				link.href = '${cssFileLink}';
				link.media = 'all';
				head.appendChild(link);
		return document.getElementById('tabscss') != null
	}
	function domInsert (element, callback=0) {
		var listen = (function(){
			var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
			return function( obj, callback ){
				if( !obj || !obj.nodeType === 1 ) return;  
				if( MutationObserver ){
					var obs = new MutationObserver(function(mutations, observer){
						callback(mutations);
					})
					obs.observe( obj, { childList:true, subtree:true });
				}
				else if( window.addEventListener ){
					obj.addEventListener('DOMNodeInserted', callback, false);
				}
			}
		})();
		let listElm = element;
		listen( listElm, function(m){ 
			var addedNodes = []
			m.forEach(record => record.addedNodes.length & addedNodes.push(...record.addedNodes))
			if(callback!=0)
				callback(addedNodes);
		});
	};
	
	document.addEventListener('readystatechange', function(){
		if(document.readyState=="complete"){
		setTimeout(function(){
			domInsert(document, function(appeared){
				let updatePopup = appeared.filter(function(a){
					return a.textContent.trim().includes("---tab updated---");
				})
				if(updatePopup.length>0){
					updatePopup.forEach(function(a){
						if(updatePopup && typeof updatePopup!="string"){
							if(a.classList && !a.classList.contains("notifications-toasts"))
								a.remove();
						}
					})
					reloadCss();
				}
				
			})
		},1000)
		var cssCreateProc = setInterval(function(){
			if(createCss()){
				clearInterval(cssCreateProc);
			}
		},500);
	}
	});
	`;
  if (!bootstrap.hasPatch("watcher")) {
    vscode.window.showInformationMessage(
      `After restart you may get the message "Your Code installation is corrupt..." click on the gear icon and choose "don't show again" `
    );
    if (bootstrap.isReadOnly() && !bootstrap.chmod()) {
      bootstrap.sudoPrompt(function (result) {
        if (result) {
          bootstrap.add("watcher", code).write();
          if (storage.get("patchedBefore")) {
            storage.set("firstActivation", false);
            storage.set("secondActivation", false);
            promptRestartAfterUpdate();
          } else {
            storage.set("patchedBefore", true);
            promptRestart();
          }
        } else {
          vscode.window.showErrorMessage(
            "Tabscolor was unable to write to " + bootstrap.file
          );
        }
      });
    } else {
      bootstrap.add("watcher", code).write();
      if (storage.get("patchedBefore")) {
        storage.set("firstActivation", false);
        storage.set("secondActivation", false);
        promptRestartAfterUpdate();
      } else {
        storage.set("patchedBefore", true);
        promptRestart();
      }
    }
  } else {
    storage.set("patchedBefore", true);
    storage.set("firstActivation", true);
  }

  if (storage.get("firstActivation")) {
    generateCssFile(context);
    reloadCss();
    storage.set("secondActivation", true);
  }

  vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("tabsColor")) {
      vscode.window.showInformationMessage("tabs colors updated");
      generateCssFile(context);
      reloadCss();
    }
  });

  storage.set("firstActivation", true);

  const taskManagerProvider = new TaskManagerProvider(context, storage);
  const activeTaskProvider = new ActiveTaskProvider(context, storage);
  const completedTaskProvider = new CompletedTaskProvider(context, storage, taskManagerProvider, activeTaskProvider);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider(
      "taskManagerView",
      taskManagerProvider
    ),
    vscode.window.registerTreeDataProvider("activeTasks", activeTaskProvider),
    vscode.window.registerTreeDataProvider(
      "completedTasks",
      completedTaskProvider
    ),
    vscode.commands.registerCommand("taskManager.createTask", () =>
      createTask(taskManagerProvider)
    ),
	vscode.commands.registerCommand('taskManager.addActiveFileToTask', async () => {
		await addActiveFileToTask(taskManagerProvider, context);
	  }),
    vscode.commands.registerCommand(
      "taskManager.removeTask",
      (taskTreeItem: TaskTreeItem) =>
        removeTask(taskManagerProvider, taskTreeItem.task, context)
    ),
    vscode.commands.registerCommand(
      "taskManager.toggleTaskCompletion",
      (task: Task) => toggleTaskCompletion(taskManagerProvider, task)
    ),
    vscode.commands.registerCommand(
      "taskManager.addFileToTask",
      (taskTreeItem: TaskTreeItem) =>
        addFileToTask(taskManagerProvider, taskTreeItem.task, context)
    ),
    vscode.commands.registerCommand(
      "taskManager.removeFileFromTask",
      (taskTreeItem: TaskTreeItem) =>
        removeFileFromTask(taskManagerProvider, taskTreeItem, context)
    ),
    vscode.commands.registerCommand(
      "taskManager.completeTask",
      async (taskTreeItem: TaskTreeItem) => {
        completeTask(taskManagerProvider, completedTaskProvider, activeTaskProvider, taskTreeItem.task, context)
	  }
    ),
    vscode.commands.registerCommand(
      "taskManager.uncompleteTask",
      async (taskTreeItem: TaskTreeItem) => {
        activateTask(taskTreeItem.task, context);
        completedTaskProvider.uncompleteTask(taskTreeItem.task);
      }
    ),
    vscode.commands.registerCommand(
      "taskManager.activateTask",
      async (taskTreeItem: TaskTreeItem) => {
        activateTask(taskTreeItem.task, context);
        await sortAllOpenedEditors(
          vscode.window.tabGroups.all,
          taskTreeItem.task
        );
      }
    ),
    vscode.commands.registerCommand(
      "taskManager.openTaskFile",
      (filePath: string) => openTaskFile(filePath)
    ),
    vscode.commands.registerCommand(
      "taskManager.sortAllOpenedEditors",
      async (taskTreeItem: TaskTreeItem) => {
        const task = JSON.parse(taskTreeItem.taskJSON) as Task;
        await sortAllOpenedEditors(vscode.window.tabGroups.all, task);
      }
    ),
    vscode.commands.registerCommand(
      "taskManager.openAllFilesInTask",
      async (taskTreeItem: TaskTreeItem) => {
        const task = JSON.parse(taskTreeItem.taskJSON) as Task;
        await openAllFilesInTask(task);
      }
    ),
    vscode.commands.registerCommand(
      "taskManager.closeAllFilesInTask",
      async (taskTreeItem: TaskTreeItem) => {
        const task = JSON.parse(taskTreeItem.taskJSON) as Task;
        await closeAllFilesInTask(task);
      }
    ),

    vscode.commands.registerCommand("tabscolor.debugColors", function () {
      // Display the stored tabs colors in console
      console.log(storage.get("tabs"));
    }),
    vscode.commands.registerCommand("tabscolor.resetTabs", function () {
      console.log(storage.clearTabColor());
    })
  );
}

export async function deactivate(context: vscode.ExtensionContext) {
	let bootstrapPath = '';
	if (require.main && require.main.filename) {
		bootstrapPath = path.join(path.dirname(require.main.filename), 'bootstrap-window.js');
	} else {
		// Handle the case when require.main is undefined
		console.error('Could not determine the bootstrap-window.js path');
	}
	const bootstrap = new Core(context, bootstrapPath);
	if (context) {
	  const storage = new Storage(context);
	  storage.set("firstActivation", false);
	  storage.set("secondActivation", false);
	}
	else {
	  storage_.update("firstActivation", false);
	  storage_.update("secondActivation", false);
	}
	bootstrap.remove("watcher").write();
  }