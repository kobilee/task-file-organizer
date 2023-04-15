import * as vscode from "vscode";
import { generateUniqueId } from "./extension";
import { setColor } from "./color_tab";
import Storage from "./storage";
import * as cp from 'child_process';

export interface Task {
  id: string;
  name: string;
  isComplete: boolean;
  files: TaskFile[];
  color: string;
}

export interface TaskFile {
  id: string;
  filePath: string;
}

export function generateColoredCircleSvg(color: string): string {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}">
      <circle cx="12" cy="12" r="6"/>
    </svg>`;
}

export class TaskTreeItem extends vscode.TreeItem {
  public taskJSON: string;
  public fileJSON: string;

  constructor(
    public readonly context: vscode.ExtensionContext,
    public readonly task: Task,
    public readonly taskFile: TaskFile | null,
    public readonly type: "task" | "file"
  ) {
    super(
      type === "task"
        ? task.name
        : vscode.workspace.asRelativePath(taskFile!.filePath)
    );
    this.id = type === "task" ? task.id : `${task.id}|${taskFile!.filePath}`;
    this.collapsibleState =
      type === "task" ? vscode.TreeItemCollapsibleState.Collapsed : void 0;
    this.contextValue = type;
    this.context = context;
    this.taskJSON = type === "task" ? JSON.stringify(task) : "";
    this.fileJSON = type === "file" ? JSON.stringify(taskFile) : "";

    if (type === "task") {
      const svgString = generateColoredCircleSvg(task.color);
      this.iconPath = vscode.Uri.parse(
        `data:image/svg+xml;base64,${Buffer.from(svgString).toString("base64")}`
      );
      this.command = {
        command: "taskManager.openAllFilesInTask",
        title: "Open All Files in Task",
        arguments: [task],
      };
    } else if (type === "file" && taskFile) {
      this.command = {
        command: "taskManager.openTaskFile",
        title: "Open Task File",
        arguments: [taskFile!.filePath],
      };
    }
  }
}

export class TaskManagerProvider
  implements vscode.TreeDataProvider<TaskTreeItem> {
  constructor(
    public readonly context: vscode.ExtensionContext,
    storage: Storage
  ) {
    this.context = context;
    this.storage = storage;
  }
  private _onDidChangeTreeData: vscode.EventEmitter<
    TaskTreeItem | undefined
  > = new vscode.EventEmitter<TaskTreeItem | undefined>();
  readonly onDidChangeTreeData: vscode.Event<TaskTreeItem | undefined> = this
    ._onDidChangeTreeData.event;

  public storage: Storage;
  public get tasks(): Task[] {
    return this.storage.get("tasks") || [];
  }

  async addAndCommitFiles(task:Task): Promise<void> {
  
    // Prompt the user for the commit message
    const commitMessage = await vscode.window.showInputBox({
      prompt: 'Enter the commit message',
      placeHolder: 'Commit message',
    });
  
    // If the user didn't provide a commit message, return early
    if (!commitMessage) {
      return;
    }
  
    // Iterate over all files in the task
    for (const file of task.files) {
      // Add file
      cp.execSync(`git add ${file.filePath}`, { cwd: vscode.workspace.rootPath });
  
      // Commit the file
      cp.execSync(`git commit -m "${commitMessage}" ${file.filePath}`, {
        cwd: vscode.workspace.rootPath,
      });
    }
  
    vscode.window.showInformationMessage(`Files in task ${task.name} have been added and committed.`);
  }

  
  public getTaskByFilePath(filePath: string): Task | undefined {
    return this.tasks.find((task) =>
      task.files.some((file) => file.filePath === filePath)
    );
  }

  addTask(task: Task): void {
    this.storage.add("tasks", task);
    this.refresh();
  }

  updateTaskToComplete(taskId: string): void {
    const tasks = this.tasks;
    const taskIndex = tasks.findIndex((task) => task.id === taskId);
    if (taskIndex !== -1) {
      tasks[taskIndex].isComplete = true;
      this.storage.set("tasks", tasks);
      this.refresh();
    }
  }

  removeTask(task: Task): void {
    this.storage.remove("tasks", task);
    this.refresh();
  }

  addFileToTask(task: Task, filePath: string): void {
    const tasks = this.tasks;
    const taskIndex = tasks.findIndex((t) => t.id === task.id);
    if (taskIndex !== -1) {
      tasks[taskIndex].files.push({ id: generateUniqueId(), filePath });
      this.storage.set("tasks", tasks);
      this.refresh();
    }
  }

  async removeFileFromTask(taskId: string, rfile: TaskFile) {
    // Find the index of the file in the task.files array

    const tasks = this.tasks;
    const taskIndex = tasks.findIndex((t) => t.id === taskId);
    if (taskIndex !== -1) {
      const index = tasks[taskIndex].files.findIndex(
        (file) => file.filePath === rfile.filePath
      );

      if (index !== -1) {
        // Remove the file from the task.files array
        tasks[taskIndex].files.splice(index, 1);
        // Persist changes to storage, if necessary
        this.storage.set("tasks", tasks);
        // Refresh the TreeView
        this.refresh();
      }
    }
  }
  getTreeItem(element: TaskTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TaskTreeItem): Thenable<TaskTreeItem[]> {
    if (element) {
      if (element.type === "task") {
        const task = this.tasks.find((t) => t.id === element.task.id) || null;
        if (task) {
          return Promise.resolve(
            task.files.map(
              (file) => new TaskTreeItem(this.context, task, file, "file")
            )
          );
        }
      }
    } else {
      return Promise.resolve(
        // Filter out completed tasks
        this.tasks
          .filter((task) => !task.isComplete)
          .map((task) => new TaskTreeItem(this.context, task, null, "task"))
      );
    }
    return Promise.resolve([]);
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }
}

// ActiveTaskProvider class
export class ActiveTaskProvider extends TaskManagerProvider {
  getChildren(element?: TaskTreeItem): Thenable<TaskTreeItem[]> {
    if (!element) {
      return Promise.resolve(
        this.tasks
          .filter((task) => !task.isComplete)
          .map((task) => new TaskTreeItem(this.context, task, null, "task"))
      );
    }
    return Promise.resolve([]);
  }
}

// CompletedTaskProvider class
export class CompletedTaskProvider extends TaskManagerProvider {

  private taskManagerProvider: TaskManagerProvider;
  private activeTaskProvider: ActiveTaskProvider;
  constructor(
    context: vscode.ExtensionContext,
    storage: Storage,
    taskManagerProvider: TaskManagerProvider,
    activeTaskProvider: ActiveTaskProvider
  ) {
    super(context, storage);
    this.taskManagerProvider = taskManagerProvider;
    this.activeTaskProvider = activeTaskProvider;
  }

  getChildren(element?: TaskTreeItem): Thenable<TaskTreeItem[]> {
    if (!element) {
      return Promise.resolve(
        this.tasks
          .filter((task) => task.isComplete)
          .map((task) => new TaskTreeItem(this.context, task, null, "task"))
      );
    }
    return Promise.resolve([]);
  }

  uncompleteTask(task: Task): void {
    const tasks = this.tasks;
    const taskIndex = tasks.findIndex((t) => t.id === task.id);
    if (taskIndex !== -1) {
      tasks[taskIndex].isComplete = false;
      this.storage.set("tasks", tasks);
      this.refresh();
      this.taskManagerProvider.refresh();
      this.activeTaskProvider.refresh();
    }
    
  }
}
