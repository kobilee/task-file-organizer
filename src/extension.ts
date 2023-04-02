// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { TaskManagerProvider, Task } from './taskManager';

export function generateUniqueId() {
  return new Date().getTime().toString(36) + Math.random().toString(36).substr(2, 5);
}

async function createTask(taskManagerProvider: TaskManagerProvider) {
  const taskName = await vscode.window.showInputBox({ prompt: 'Enter the task name' });
  if (taskName) {
    const newTask: Task = {
      id: generateUniqueId(),
      name: taskName,
      isComplete: false,
      files: [],
    };
    taskManagerProvider.addTask(newTask);
  }
}

async function toggleTaskCompletion(taskManagerProvider: TaskManagerProvider, task: Task) {
  task.isComplete = !task.isComplete;
  taskManagerProvider.refresh();
}

async function addFileToTask(taskManagerProvider: TaskManagerProvider, task: Task) {
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
  }
}

async function openTaskFile(filePath: string) {
  const fileUri = vscode.Uri.file(filePath);
  const document = await vscode.workspace.openTextDocument(fileUri);
  await vscode.window.showTextDocument(document);
}

async function closeAllFilesInTask(task: Task) {
  const openTextEditors = vscode.window.visibleTextEditors;
  const filesToClose = task.files.map((file) => vscode.Uri.file(file.filePath));

  openTextEditors.forEach(async (editor) => {
    if (filesToClose.some((file) => file.fsPath === editor.document.uri.fsPath)) {
      await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    }
  });
}


export function activate(context: vscode.ExtensionContext) {
	const taskManagerProvider = new TaskManagerProvider();
	vscode.window.registerTreeDataProvider('taskManagerView', taskManagerProvider);
  
	context.subscriptions.push(
	  vscode.commands.registerCommand('taskManager.createTask', () => createTask(taskManagerProvider)),
	  vscode.commands.registerCommand('taskManager.toggleTaskCompletion', (task: Task) => toggleTaskCompletion(taskManagerProvider, task)),
	  vscode.commands.registerCommand('taskManager.addFileToTask', (task: Task) => addFileToTask(taskManagerProvider, task)),
	  vscode.commands.registerCommand('taskManager.openTaskFile', (filePath: string) => openTaskFile(filePath)),
	  vscode.commands.registerCommand('taskManager.closeAllFilesInTask', (task: Task) => closeAllFilesInTask(task))
	);
  }
  



