// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { TaskManagerProvider, Task, TaskTreeItem, generateColoredCircleSvg} from './taskManager';

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
      color: "#000000"
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

function updateEditorIcon(taskManagerProvider: TaskManagerProvider, editor: vscode.TextEditor) {
  const task = taskManagerProvider.getTaskByFilePath(editor.document.uri.fsPath);

  if (task) {
    const color = task.color;
    const svgString = generateColoredCircleSvg(color);
    const iconUri = vscode.Uri.parse(`data:image/svg+xml;base64,${Buffer.from(svgString).toString('base64')}`);

    editor.setDecorations(
      vscode.window.createTextEditorDecorationType({
        gutterIconPath: iconUri,
        gutterIconSize: 'contain',
      }),
      [{ range: new vscode.Range(0, 0, 0, 0) }],
    );
  }
}


export function activate(context: vscode.ExtensionContext) {
	const taskManagerProvider = new TaskManagerProvider();
	context.subscriptions.push(
    vscode.window.registerTreeDataProvider('taskManagerView', taskManagerProvider),
	  vscode.commands.registerCommand('taskManager.createTask', () => createTask(taskManagerProvider)),
	  vscode.commands.registerCommand('taskManager.toggleTaskCompletion', (task: Task) => toggleTaskCompletion(taskManagerProvider, task)),
	  vscode.commands.registerCommand('taskManager.addFileToTask', (task: Task) => addFileToTask(taskManagerProvider, task)),
	  vscode.commands.registerCommand('taskManager.openTaskFile', (filePath: string) => openTaskFile(filePath)),
	  vscode.commands.registerCommand('taskManager.openAllFilesInTask', async (taskTreeItem: TaskTreeItem) => {
      const task = JSON.parse(taskTreeItem.taskJSON) as Task;
      await openAllFilesInTask(task);
    }),
    vscode.commands.registerCommand('taskManager.closeAllFilesInTask', async (taskTreeItem: TaskTreeItem) => {
      const task = JSON.parse(taskTreeItem.taskJSON) as Task;
      await closeAllFilesInTask(task);
    }),
    vscode.window.onDidChangeVisibleTextEditors((visibleEditors) => {
      for (const editor of visibleEditors) {
        updateEditorIcon(taskManagerProvider, editor);
      }
    })

	);
  }
  



