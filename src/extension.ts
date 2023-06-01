// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import {
  TaskManagerProvider,
  Task,
  TaskFile,
  Note,
  SubTask,
  TaskTreeItem,
  ActiveTaskProvider,
  CompletedTaskProvider,
} from "./taskManager";
import Storage from "./storage";
import Core from "./core";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import { generateCssFile, reloadCss, setColor, unsetColor, addColor} from "./color_tab";
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
};

export function generateUniqueId() {
  return (
    new Date().getTime().toString(36) + Math.random().toString(36).substr(2, 5)
  );
};

export function generateRandomColor(): string {
  return "#" + Math.floor(Math.random() * 16777215).toString(16);
};

async function createTask(taskManagerProvider: TaskManagerProvider, context: vscode.ExtensionContext) {
  const taskName = await vscode.window.showInputBox({
    prompt: "Enter the task name",
  });
  if (taskName) {
    const newTask: Task = {
      id: generateUniqueId(),
      name: taskName,
      completionDate: null,
      isComplete: false,
      isActive: true,
      files: [],
      subtasks: [],
      color: generateRandomColor(),
    };
    taskManagerProvider.addTask(newTask);
    addColor(context, newTask.id, newTask.color, "Task")
  }
};

function unsetColorLoop(task: Task, context: vscode.ExtensionContext, storage: Storage) {
  for (let i = 0; i < task.files.length; i++) {
    const file = task.files[i];
    unsetColor(context, file.filePath.replace(/\\/g, "\\\\"));
    
  }
};

async function removeTask(
  taskManagerProvider: TaskManagerProvider,
  task: Task,
  context: vscode.ExtensionContext, 
  storage: Storage
) {
  taskManagerProvider.removeTask(task);
  unsetColorLoop(task, context, storage);
  storage.removeTab(task.id)
};

async function toggleTaskCompletion(
  taskManagerProvider: TaskManagerProvider,
  task: Task
) {
  task.isComplete = !task.isComplete;
  taskManagerProvider.refresh();
};

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
    setColor(context, task.id, fileUri[0].fsPath);
  }
};

async function addActiveFileToTask(taskManagerProvider: TaskManagerProvider, context: vscode.ExtensionContext) {
	const activeEditor = vscode.window.activeTextEditor;
  
	if (!activeEditor) {
	  vscode.window.showErrorMessage('No active file to add to task.');
	  return;
	}
  
	const activeFilePath = activeEditor.document.uri.fsPath;
  
	const tasks = taskManagerProvider.tasks;
  const activeTasks = tasks.filter((task: Task) => !task.isComplete);
  const pickedTask = await vscode.window.showQuickPick(
    activeTasks.map((task: Task) => task.name), 
    { placeHolder: 'Select a task to add the active file to' }
  );
  if (!pickedTask) {
	  return;
	}

  const task = tasks.find((task: Task) => task.name === pickedTask);
	if (task) {
    const fileExistsInTask = task.files.some(
      (file) => file.filePath === activeFilePath
    );
  
    if (fileExistsInTask) {
      vscode.window.showErrorMessage(`The file is already in the task "${task.name}".`);
      return;
    }
		taskManagerProvider.addFileToTask(task, activeFilePath)
		setColor(context, task.id, activeFilePath);
	} else {
	  vscode.window.showErrorMessage('Task not found.');
	}
};

async function addActiveTabToActiveTaskKeyboard(taskManagerProvider: TaskManagerProvider, context: vscode.ExtensionContext) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage("No active editor found.");
    return;
  }

  const filePath = editor.document.uri.fsPath;

  // Get the active task
  const activeTask = taskManagerProvider.getActiveTask();
  if (!activeTask) {
    vscode.window.showErrorMessage("No active task found.");
    return;
  }

  const fileExistsInTask = activeTask.files.some(
    (file) => file.filePath === filePath
  );

  if (fileExistsInTask) {
    vscode.window.showErrorMessage(`The file is already in the task "${activeTask.name}".`);
    return;
  }

  // Add the file to the active task
  taskManagerProvider.addFileToTask(activeTask, filePath);
  setColor(context, activeTask.id, filePath);
  vscode.window.showInformationMessage(
    `Added active tab to the active task: ${activeTask.name}`
  );
};

async function addNoteToFileKeyboard(taskManagerProvider: TaskManagerProvider, taskTreeItem: TaskTreeItem, context: vscode.ExtensionContext) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage("No active editor found.");
    return;
  }

  const filePath = editor.document.uri.fsPath;

  // Get the active task
  const activeTask = taskManagerProvider.getActiveTask();
  if (!activeTask) {
    vscode.window.showErrorMessage("No active task found.");
    return;
  }

  const file = activeTask.files.find(
    (file) => file.filePath === filePath
  );

  if (!file) {
    vscode.window.showErrorMessage(`The file not in active task "${activeTask.name}".`);
    return;
  }

    const note = await vscode.window.showInputBox({
      prompt: "Enter note content",
      placeHolder: "Note content",
    });

    if (note) {
      taskManagerProvider.addNoteToFile(activeTask.id, file, note);
    }
  vscode.window.showInformationMessage(
    `Added note to the active task: ${activeTask.name}`
  );
};

async function addActiveFileToTaskcontext(taskManagerProvider: TaskManagerProvider, task: Task, context: vscode.ExtensionContext) {
  const activeEditor = vscode.window.activeTextEditor;
  
  if (!activeEditor) {
    vscode.window.showErrorMessage('No active file to add to task.');
    return;
  }
  const tasks = taskManagerProvider.tasks;
  const activeFilePath = activeEditor.document.uri.fsPath;
  const fileExistsInTask = task.files.some((file) => file.filePath === activeFilePath)

  if (fileExistsInTask) {
    vscode.window.showErrorMessage(`The file is already in the task "${task.name}".`);
    return;
  }

  taskManagerProvider.addFileToTask(task, activeFilePath);
  setColor(context, task.id, activeFilePath);
};

async function removeFileFromTask(
  taskManagerProvider: TaskManagerProvider,
  taskTreeItem: TaskTreeItem,
  context: vscode.ExtensionContext,
  storage: Storage
) {
  const file = JSON.parse(taskTreeItem.fileJSON) as TaskFile;
  if (typeof taskTreeItem.id === "string") {
    const id = taskTreeItem.id.split("|")
    const taskId = id[0];
    taskManagerProvider.removeFileFromTask(taskId, file);
    const tabs = storage.get("tabs") || {}
    if (tabs[taskId].includes(id[1].replace(/\\/g, "\\\\"))) {
      unsetColor(context, id[1].replace(/\\/g, "\\\\"));
    }
  } else {
    // Handle the case where taskTreeItem.id is undefined, if necessary
    console.error("taskTreeItem.id is undefined");
  }
};

async function  addNoteToFileCommand(
  taskManagerProvider: TaskManagerProvider,
  taskTreeItem: TaskTreeItem
) {
    if (typeof taskTreeItem.id === "string") {
      const taskId =  taskTreeItem.id.split("|")[0];
      const file = JSON.parse(taskTreeItem.fileJSON) as TaskFile;

      const note = await vscode.window.showInputBox({
        prompt: "Enter note content",
        placeHolder: "Note content",
      });
  
      if (note) {
        taskManagerProvider.addNoteToFile(taskId, file, note);
      }
    }
};

async function  addSubtaskToFile(
  taskManagerProvider: TaskManagerProvider,
  taskTreeItem: TaskTreeItem,
  context: vscode.ExtensionContext
) {
    if (typeof taskTreeItem.id === "string") {
      const taskId =  taskTreeItem.id.split("|")[0];
      const file = JSON.parse(taskTreeItem.fileJSON) as TaskFile;
      const tasks = taskManagerProvider.tasks;
      const taskIndex = tasks.findIndex((t) => t.id === taskId);
      
      if (taskIndex === -1 || !tasks[taskIndex].subtasks) {
        vscode.window.showErrorMessage('No subtasks available. Please add a subtask first.');
        return;
      }
      
      const pickedSubTask = await vscode.window.showQuickPick(
        tasks[taskIndex].subtasks.map((subtask: SubTask) => subtask.name), 
        { placeHolder: 'Select a Subtask to add the file to' }
      );
  
      if (pickedSubTask) {
        taskManagerProvider.addFileSubtask(taskId, file, pickedSubTask, context);
      }
    }
};
async function  removeFileFromSubtask(
  taskManagerProvider: TaskManagerProvider,
  taskTreeItem: TaskTreeItem,
  context: vscode.ExtensionContext
) {
    if (typeof taskTreeItem.id === "string") {
      const taskId =  taskTreeItem.id.split("|")[0];
      const file = JSON.parse(taskTreeItem.fileJSON) as TaskFile;
      const tasks = taskManagerProvider.tasks;
      const taskIndex = tasks.findIndex((t) => t.id === taskId);
      
      if (taskIndex === -1 || !file.subtask) {
        vscode.window.showErrorMessage('No subtasks asigned. Please add a subtask first.');
        return;
      }
      
      taskManagerProvider.removeFileFromSubtask(taskId, file, file.subtask, context);
    }
};


async function  addSubtaskToTask(
  taskManagerProvider: TaskManagerProvider,
  task: Task,
  context: vscode.ExtensionContext
) {
    const subtask = await vscode.window.showInputBox({
      prompt: "Enter Subtask",
      placeHolder: "Subtask",
    });

    if (subtask) {
        const isDuplicate = task.subtasks.some((existingSubtask) => existingSubtask.name.toLowerCase() === subtask.toLowerCase());
        if (isDuplicate) {
          vscode.window.showErrorMessage("Duplicate subtask. Please enter a unique subtask.");
          return;
        }
      taskManagerProvider.addSubtasktoTask(task, subtask, context);
    }
};

async function  removeSubtaskFromTask(
  taskManagerProvider: TaskManagerProvider,
  task: Task,
  context: vscode.ExtensionContext
) {

    const tasks = taskManagerProvider.tasks;
    const taskIndex = tasks.findIndex((t) => t.id === task.id);
    
    if (taskIndex === -1 || !tasks[taskIndex].subtasks) {
      vscode.window.showErrorMessage('No subtasks available. Please add a subtask first.');
      return;
    }
    
    const removeSubTask = await vscode.window.showQuickPick(
      tasks[taskIndex].subtasks.map((subtask: SubTask) => subtask.name), 
      { placeHolder: 'Select a Subtask to remove' }
    );

    if (removeSubTask) {
      taskManagerProvider.removeSubtaskFromTask(task, removeSubTask, context);
      vscode.window.showInformationMessage(`The subtask "${removeSubTask}" was successfully removed from the task.`);
    }
};



async function  removeNoteFromFileCommand(
  taskManagerProvider: TaskManagerProvider,
  taskTreeItem: TaskTreeItem,
  context: vscode.ExtensionContext,
  storage: Storage
) {
    if (typeof taskTreeItem.id === "string") {
      const note = JSON.parse(taskTreeItem.noteJSON) as string;
      const id = taskTreeItem.id.split("|")
      const taskId = id[0];
      const fileId = id[1];
      taskManagerProvider.removeNoteFromFile(taskId, fileId, note);
  

    }
};

async function openTaskFile(filePath: string) {
  const fileUri = vscode.Uri.file(filePath);
  const document = await vscode.workspace.openTextDocument(fileUri);
  await vscode.window.showTextDocument(document, { preview: false });
};

async function activateTask(task: Task, context: vscode.ExtensionContext) {
  for (let i = 0; i < task.files.length; i++) {
    const file = task.files[i];
    setColor(context, task.id, file.filePath);
  }
};

async function saveAllFilesInTask(task: Task) {
  // Get all open text documents
  const openDocuments = vscode.workspace.textDocuments;

  for (const taskFile of task.files) {
    // Check if this file is currently open
    const openDocument = openDocuments.find(document => document.fileName === taskFile.filePath);

    if (openDocument) {
      // If the file is open, save it
      await openDocument.save();
    }
  }
};

async function saveAllFilesInTaskKeyboard(taskManagerProvider: TaskManagerProvider,) {
  // Get the active task
  const activeTask = taskManagerProvider.getActiveTask();
  if (!activeTask) {
    vscode.window.showErrorMessage("No active task found.");
    return;
  }


  await saveAllFilesInTask(activeTask);

};

async function openAllFilesInTaskKeyboard(taskManagerProvider: TaskManagerProvider,) {
    // Get the active task
    const activeTask = taskManagerProvider.getActiveTask();
    if (!activeTask) {
      vscode.window.showErrorMessage("No active task found.");
      return;
    }

  for (const taskFile of activeTask.files) {
    await openTaskFile(taskFile.filePath);
  }
};

async function closeAllFilesInTaskKeyboard(taskManagerProvider: TaskManagerProvider,) {
    // Get the active task
    const activeTask = taskManagerProvider.getActiveTask();
    if (!activeTask) {
      vscode.window.showErrorMessage("No active task found.");
      return;
    }

  const filesToClose = activeTask.files.map((file) => vscode.Uri.file(file.filePath));

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
};

async function openAllFilesInTask(task: Task) {
  for (const taskFile of task.files) {
    await openTaskFile(taskFile.filePath);
  }
};

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
};

async function closeAllFilesNotInTasks(tasks: Task[]) {
  // Get a list of all files in tasks
  const taskFiles = tasks.reduce<string[]>((allFiles, task) => {
    return allFiles.concat(task.files.map((file) => file.filePath));
  }, []);

  // Iterate through open text documents
  for (const document of vscode.workspace.textDocuments) {
    // Check if the document is not in any task
    if (!taskFiles.includes(document.uri.fsPath)) {
      console.log(`Closing file not in tasks: ${document.uri.fsPath}`);
      await vscode.window.showTextDocument(document, {
        preview: false,
        preserveFocus: true,
      });
      await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
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
};

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
};

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
};

async function completeTask(
  taskManagerProvider: TaskManagerProvider,
  completedTaskProvider: CompletedTaskProvider,
  activeTaskProvider: ActiveTaskProvider,
  task: Task,
  context: vscode.ExtensionContext,
  storage: Storage
) {
  taskManagerProvider.updateTaskToComplete(task.id);
  unsetColorLoop(task, context, storage);

    if (task.completionDate) {
    const userResponse = await vscode.window.showInformationMessage(
      `The task has been completed before. Do you want to update it's completion to today's date?`,
      { modal: true },
      'Yes', 'No'
    );

    if (userResponse === 'Yes') {
      task.completionDate = new Date();
    }
  } else {
    task.completionDate = new Date();
  }

  completedTaskProvider.refresh()
  activeTaskProvider.refresh()
};

function promptRestart() {
  vscode.window.showInformationMessage(
    `Restart VS Code (not just reload) in order for tabscolor changes to take effect.`
  );
};

function promptRestartAfterUpdate() {
  vscode.window.showInformationMessage(
    `VS Code files change detected. Restart VS Code (not just reload) in order for tabscolor to work.`
  );
};

async function activateAllOpenTabs() {
  const editors = vscode.window.visibleTextEditors;
  for (const editor of editors) {
    await vscode.window.showTextDocument(editor.document, { viewColumn: editor.viewColumn, preserveFocus: false });
  }
}

async function handleFileMove(event: vscode.FileRenameEvent, storage: Storage, context: vscode.ExtensionContext) {
  for (const { oldUri, newUri } of event.files) {
    const oldPath = oldUri.fsPath;
    const newPath = newUri.fsPath;
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(newUri);
    if (!workspaceFolder) {
      continue;
    }

    const workspacePath = workspaceFolder.uri.fsPath;
    const tasks = storage.get(`tasks-${workspacePath}`) || [];

    let tasksUpdated = false;
    for (const task of tasks) {
      for (const file of task.files) {

        if (file.filePath === oldPath) {
          file.filePath = newPath;
          for (const note of file.notes) {
            note.fileName = newPath
          }
          unsetColor(context, oldPath.replace(/\\/g, "\\\\"));
          setColor(context, task.id, file.filePath)


          tasksUpdated = true;
       }
     }
    }

    if (tasksUpdated) {
      storage.set(`tasks-${workspacePath}`, tasks);
    }
  }
}

function handleTextDocumentChange(
  event: vscode.TextDocumentChangeEvent,
  storage: Storage,
  taskManagerProvider: TaskManagerProvider,
) {
  const document = event.document;
  const filePath = document.uri.fsPath;
  const changes = event.contentChanges;

  // Retrieve tasks from storage
  const tasks = taskManagerProvider.tasks;

  let hasNotes = false;


  // Check the number of new lines added and removed
  for (const change of changes) {
    const addedLines = change.text.split('\n').length - 1;
    const removedLines = change.range.end.line - change.range.start.line;
    const netChange = addedLines - removedLines;

    if (netChange !== 0) {
      for (const task of tasks) {
        for (const file of task.files) {
          if (file.filePath === filePath) {
            hasNotes = true;
            updateNotesForLineChanges(filePath, change.range.start.line, netChange, file.notes);
          }
        }
      }
    }
  }

  if (hasNotes) {
    taskManagerProvider.updateTask(tasks);
  }
}

function updateNotesForLineChanges(filePath: string, startingLine: number, lineChange: number, notes: Note[]) {
  for (const note of notes) {
    if (note.fileName === filePath) {
      if (note.fileLine > startingLine) {
        note.fileLine += lineChange;
        note.positionStart.line = note.fileLine
        note.positionEnd.line = note.fileLine
      }
    }
  }
}

async function onNewFileOpened(
  taskManagerProvider: TaskManagerProvider,
  context: vscode.ExtensionContext
) {
  const config = vscode.workspace.getConfiguration("taskFileOrganizer");
  const openFileBehavior = config.get<string>("openFileBehavior") || "doNothing";

  if (openFileBehavior === "addToActiveTask") {
    await addActiveTabToActiveTaskKeyboard(taskManagerProvider, context);
  } else if (openFileBehavior === "promptForTask") {
    await addActiveFileToTask(taskManagerProvider, context);
  }
}

let autoCloseInterval: NodeJS.Timeout | null = null;

function startAutoCloseFilesNotInTasks(tasks: Task[]): void {
  const config = vscode.workspace.getConfiguration('taskFileOrganizer');

  // Clear the existing interval if it exists
  if (autoCloseInterval) {
    clearInterval(autoCloseInterval);
    autoCloseInterval = null;
  }

  // Check if the auto close feature is enabled
  if (config.get('enableAutoClose')) {
    const interval = config.get<number>('closeFilesInterval') || 60000;

    // Start a new interval
    autoCloseInterval = setInterval(async () => {
      await closeAllFilesNotInTasks(tasks);
    }, interval);
  }
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
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
    const tasks = storage.get(`tasks-${workspacePath}`) || [];
    for (const task of tasks) {
      if (task.subtasks === undefined) {
        task.subtasks = [];
      }
    }
    storage.set(`tasks-${workspacePath}`, tasks);
    generateCssFile(context);
    reloadCss();
    storage.set("secondActivation", true);
  }

  storage.set("firstActivation", true);
  
  const taskManagerProvider = new TaskManagerProvider(context, storage);
  const activeTaskProvider = new ActiveTaskProvider(context, storage);
  const completedTaskProvider = new CompletedTaskProvider(context, storage, taskManagerProvider, activeTaskProvider);
  startAutoCloseFilesNotInTasks(taskManagerProvider.tasks);
  let autoSetActiveTask = vscode.workspace.getConfiguration().get('taskFileOrganizer.autoSetActiveTask');
  activateAllOpenTabs();
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
    vscode.window.onDidChangeActiveTextEditor(async (editor) => {
      if(autoSetActiveTask) {
        if (editor) {
          const filePath = editor.document.uri.fsPath;
          const task = taskManagerProvider.getTaskByFilePath(filePath);

          if (task) {
            taskManagerProvider.setTaskAsActive(task);
          }
        }
      }
    }),
    vscode.workspace.onDidChangeTextDocument((event) => handleTextDocumentChange(event, storage, taskManagerProvider)),
    vscode.workspace.onDidRenameFiles((event) => handleFileMove(event, storage, context)),
    vscode.window.onDidChangeActiveTextEditor(async () => {
      await onNewFileOpened(taskManagerProvider, context);
      }),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('taskFileOrganizer.enableAutoClose') || e.affectsConfiguration('taskFileOrganizer.closeFilesInterval')) {
        startAutoCloseFilesNotInTasks(taskManagerProvider.tasks);
      }
      if (e.affectsConfiguration('taskFileOrganizer.autoSetActiveTask')) {
        autoSetActiveTask = vscode.workspace.getConfiguration().get('taskFileOrganizer.autoSetActiveTask');
      }
    }),
    vscode.commands.registerCommand('taskManager.openNote', (file: TaskFile, noteId: string) => {
        taskManagerProvider.openNote(file, noteId);
      }
    ),
    vscode.commands.registerCommand('taskManager.addSubtaskToFile', (taskTreeItem: TaskTreeItem) => {
      addSubtaskToFile(taskManagerProvider, taskTreeItem, context);
     }
    ),   
      vscode.commands.registerCommand('taskManager.removeFileFromSubtask', (taskTreeItem: TaskTreeItem) => {
        removeFileFromSubtask(taskManagerProvider, taskTreeItem, context);
     }
    ),
    vscode.commands.registerCommand('taskManager.addSubtaskToTask', (taskTreeItem: TaskTreeItem) => {
      addSubtaskToTask(taskManagerProvider, taskTreeItem.task, context);
     }
    ),
    vscode.commands.registerCommand('taskManager.removeSubtaskFromTask', (taskTreeItem: TaskTreeItem) => {
      removeSubtaskFromTask(taskManagerProvider, taskTreeItem.task, context);
     }
    ),
    vscode.commands.registerCommand('taskManager.renameTask', async (taskTreeItem: TaskTreeItem) => {
      taskManagerProvider.renameTask(taskTreeItem.task)
    }),
    vscode.commands.registerCommand("taskManager.createTask", () =>
      createTask(taskManagerProvider, context)
    ),
	  vscode.commands.registerCommand('taskManager.addActiveFileToTask', async () => {
		  await addActiveFileToTask(taskManagerProvider, context);
	  }),
    vscode.commands.registerCommand(
      "taskManager.addActiveTabToActiveTask", () => {
        addActiveTabToActiveTaskKeyboard(taskManagerProvider, context)
    }),
    vscode.commands.registerCommand('taskManager.addAndCommitFiles', async (taskTreeItem: TaskTreeItem) => {
      await taskManagerProvider.addAndCommitFiles(taskTreeItem.task);
    }),
    vscode.commands.registerCommand('taskManager.addActiveFileToTaskcontext', async (taskTreeItem: TaskTreeItem) => {
      await addActiveFileToTaskcontext(taskManagerProvider, taskTreeItem.task,  context);
    }),
    vscode.commands.registerCommand("taskManager.generateNewRandomColorAndUpdateSvg", async (taskTreeItem: TaskTreeItem) => {
      const task = taskTreeItem.task;
      if (task.subtasks && task.subtasks.length > 0) {
        const option = await vscode.window.showWarningMessage(
          "This task has subtasks. Generating a new color while a task has a subtask is discouraged as the subtask feature is currently in beta. Are you sure you want to do this?",
          "Yes", "No"
        );
        if (option === "Yes") {
          const newColor = generateRandomColor();
          taskManagerProvider.updateTaskColor(task, newColor);
        } 
      } else {
        const newColor = generateRandomColor();
        taskManagerProvider.updateTaskColor(task, newColor);
      }
    }),
    
    vscode.commands.registerCommand(
      "taskManager.removeTask", (taskTreeItem: TaskTreeItem) =>
        removeTask(taskManagerProvider, taskTreeItem.task, context, storage)
    ),
    vscode.commands.registerCommand(
      "taskManager.toggleTaskCompletion", (task: Task) => 
        toggleTaskCompletion(taskManagerProvider, task)
    ),
    vscode.commands.registerCommand(
      "taskManager.addFileToTask", (taskTreeItem: TaskTreeItem) =>
        addFileToTask(taskManagerProvider, taskTreeItem.task, context)
    ),
    vscode.commands.registerCommand(
      "taskManager.addNoteToFile", (taskTreeItem: TaskTreeItem) =>
        addNoteToFileCommand(taskManagerProvider, taskTreeItem)
    ),
    vscode.commands.registerCommand(
      "taskManager.addNoteToFileKeyboard", (taskTreeItem: TaskTreeItem) =>
        addNoteToFileKeyboard(taskManagerProvider, taskTreeItem, context)
    ),
    vscode.commands.registerCommand(
      "taskManager.removeNoteFromFileCommand", (taskTreeItem: TaskTreeItem) =>
        removeNoteFromFileCommand(taskManagerProvider, taskTreeItem, context, storage)
    ),
    vscode.commands.registerCommand(
      "taskManager.removeFileFromTask", (taskTreeItem: TaskTreeItem) =>
        removeFileFromTask(taskManagerProvider, taskTreeItem, context, storage)
    ),
    vscode.commands.registerCommand(
      "taskManager.completeTask", async (taskTreeItem: TaskTreeItem) => {
        completeTask(taskManagerProvider, completedTaskProvider, activeTaskProvider, taskTreeItem.task, context, storage)
	  }
    ),
    vscode.commands.registerCommand(
      "taskManager.uncompleteTask", async (taskTreeItem: TaskTreeItem) => {
        completedTaskProvider.uncompleteTask(taskTreeItem.task);
        activateTask(taskTreeItem.task, context);

      }
    ),
    vscode.commands.registerCommand(
      "taskManager.activateTask", async (taskTreeItem: TaskTreeItem) => {
        taskManagerProvider.setTaskAsActive(taskTreeItem.task)
        activateTask(taskTreeItem.task, context);
        await sortAllOpenedEditors(
          vscode.window.tabGroups.all,
          taskTreeItem.task
        );
      }
    ),
    vscode.commands.registerCommand(
      "taskManager.openTaskFile",(filePath: string) => 
        openTaskFile(filePath)
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
    vscode.commands.registerCommand(
      "taskManager.openAllFilesInTaskKeyboard",
      async () => {
        await openAllFilesInTaskKeyboard(taskManagerProvider);
      }
    ),
    vscode.commands.registerCommand(
      "taskManager.closeAllFilesInTaskKeyboard",
      async () => {
        await closeAllFilesInTaskKeyboard(taskManagerProvider);
      }
    ),
    vscode.commands.registerCommand(
      "taskManager.closeAllFilesNotInTasks",
      async () => {
        await closeAllFilesNotInTasks(taskManagerProvider.tasks);
      }
    ),
    vscode.commands.registerCommand(
      "taskManager.saveAllFilesInTask",
      async (taskTreeItem: TaskTreeItem) => {
        await saveAllFilesInTask(taskTreeItem.task);
      }
    ),
    vscode.commands.registerCommand(
      "taskManager.saveAllFilesInTaskKeyboard",
      async () => {
        await saveAllFilesInTaskKeyboard(taskManagerProvider);
      }
    ),

    vscode.commands.registerCommand("tabscolor.debugColors", function () {
      console.log(storage.get("tabs"));
    }),
    vscode.commands.registerCommand("tabscolor.resetTabs", function () {
      console.log(storage.clearTabColor());
    })
  );
};

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