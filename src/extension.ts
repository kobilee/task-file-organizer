// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { TaskManagerProvider, Task, TaskTreeItem, generateColoredCircleSvg} from './taskManager';
import Storage from './storage';
import Core from './core';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { generateCssFile, reloadCss, setColor } from './color_tab';




function modulesPath(context: vscode.ExtensionContext): vscode.Uri {
  return vscode.Uri.joinPath(context.globalStorageUri, 'modules');
}

export function generateUniqueId() {
  return new Date().getTime().toString(36) + Math.random().toString(36).substr(2, 5);
} 

function generateRandomColor(): string {
	return '#' + Math.floor(Math.random() * 16777215).toString(16);
  }

async function createTask(taskManagerProvider: TaskManagerProvider) {
  const taskName = await vscode.window.showInputBox({ prompt: 'Enter the task name' });
  if (taskName) {
    const newTask: Task = {
      id: generateUniqueId(),
      name: taskName,
      isComplete: false,
      files: [],
      color: generateRandomColor()
    };
    taskManagerProvider.addTask(newTask);
  }
}

async function toggleTaskCompletion(taskManagerProvider: TaskManagerProvider, task: Task) {
  task.isComplete = !task.isComplete;
  taskManagerProvider.refresh();
}

async function addFileToTask(taskManagerProvider: TaskManagerProvider, task: Task, context: vscode.ExtensionContext) {
  const options: vscode.OpenDialogOptions = {
    canSelectMany: false,
    openLabel: 'Select a file',
    filters: {
      'All files': ['*'],
    },
  };

  const fileUri = await vscode.window.showOpenDialog(options);
  if (fileUri && fileUri[0]) {
    taskManagerProvider.addFileToTask(task, fileUri[0].fsPath);
	setColor(context,task.color, fileUri[0].fsPath);
  }
}

async function openTaskFile(filePath: string) {
  const fileUri = vscode.Uri.file(filePath);
  const document = await vscode.workspace.openTextDocument(fileUri);
  await vscode.window.showTextDocument(document, { preview: false });
}

async function openAllFilesInTask(task: Task) {
  for (const taskFile of task.files) {
    await openTaskFile(taskFile.filePath);
  }
}

async function closeAllFilesInTask(task: Task) {
  const filesToClose = task.files.map((file) => vscode.Uri.file(file.filePath));

  for (const file of filesToClose) {
    const document = vscode.workspace.textDocuments.find((doc) => doc.uri.fsPath === file.fsPath);

    if (document) {
      console.log(`Closing file: ${file.fsPath}`);
      await vscode.window.showTextDocument(document, { preview: false, preserveFocus: true });
      await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    }
  }
}

function promptRestart() {
	vscode.window
	  .showInformationMessage(
		`Restart VS Code (not just reload) in order for tabscolor changes to take effect.`
	  );
  }
  
  function promptRestartAfterUpdate() {
	vscode.window
	  .showInformationMessage(
		`VS Code files change detected. Restart VS Code (not just reload) in order for tabscolor to work.`
	  );
  }

export function activate(context: vscode.ExtensionContext) {
  const storage = new Storage(context);

  let cssFileLink = path.join(modulesPath(context).path, "inject.css").replace(/\\/g, "/");
  if (os.platform() == "win32") { cssFileLink = "vscode-file://vscode-app" + cssFileLink; }
	
  let bootstrapPath = path.join(path.dirname((require.main as NodeJS.Module).filename), 'vs/workbench/workbench.desktop.main.js');
  if (!fs.existsSync(bootstrapPath)) {
    bootstrapPath = path.join(path.dirname((require.main as NodeJS.Module).filename), 'bootstrap-window.js');
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
		vscode.window.showInformationMessage(`After restart you may get the message "Your Code installation is corrupt..." click on the gear icon and choose "don't show again" `);
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
					vscode.window.showErrorMessage("Tabscolor was unable to write to " + bootstrap.file);
				}
			});
		} else {
			bootstrap.add("watcher", code).write();
			if (storage.get("patchedBefore")) {
				storage.set("firstActivation", false);
				storage.set("secondActivation", false);
				promptRestartAfterUpdate();
			}
			else {
				storage.set("patchedBefore", true);
				promptRestart();
			}
		}
	} else {
		storage.set("patchedBefore", true);
		storage.set("firstActivation", true);
	}

	if (storage.get("firstActivation")) {
		generateCssFile(context, "Here3");
		reloadCss();
		storage.set("secondActivation", true);
	  }

	vscode.workspace.onDidChangeConfiguration(e => {
		if (e.affectsConfiguration('tabsColor')) {
		  vscode.window.showInformationMessage('tabs colors updated');
		  generateCssFile(context, "Here4");
		  reloadCss();
		}
	});
	
	storage.set("firstActivation", true);


  	const taskManagerProvider = new TaskManagerProvider(context);
	context.subscriptions.push(
    vscode.window.registerTreeDataProvider('taskManagerView', taskManagerProvider),
	vscode.window.registerTreeDataProvider('taskManagerExplorer', taskManagerProvider),
	  vscode.commands.registerCommand('taskManager.createTask', () => createTask(taskManagerProvider)),
	  vscode.commands.registerCommand('taskManager.toggleTaskCompletion', (task: Task) => toggleTaskCompletion(taskManagerProvider, task)),
	  vscode.commands.registerCommand('taskManager.addFileToTask', (task: Task) => addFileToTask(taskManagerProvider, task, context)),
	  vscode.commands.registerCommand('taskManager.openTaskFile', (filePath: string) => openTaskFile(filePath)),
	  vscode.commands.registerCommand('taskManager.openAllFilesInTask', async (taskTreeItem: TaskTreeItem) => {
      const task = JSON.parse(taskTreeItem.taskJSON) as Task;
      await openAllFilesInTask(task);
    }),
    vscode.commands.registerCommand('taskManager.closeAllFilesInTask', async (taskTreeItem: TaskTreeItem) => {
      const task = JSON.parse(taskTreeItem.taskJSON) as Task;
      await closeAllFilesInTask(task);
    }),
	vscode.commands.registerCommand('taskManager.test', function (a, b) {
		
		setColor(context,"transparent", 'C:\\Users\\Jakobi Lee\\Documents\\test\\file1.txt');
		setColor(context,"transparent", 'C:\\Users\\Jakobi Lee\\Documents\\test\\file2.txt');
	}),
	vscode.commands.registerCommand('tabscolor.debugColors', function () {
		// Display the stored tabs colors in console
		console.log(storage.get("tabs"));
	}),
	vscode.commands.registerCommand('tabscolor.resetTabs', function () {
		// Display the stored tabs colors in console
		console.log(storage.clearTabColor());
	})
	)
  }
  



