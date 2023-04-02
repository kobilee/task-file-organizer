import * as vscode from 'vscode';
import { generateUniqueId } from './extension';


export interface Task {
    id: string;
    name: string;
    isComplete: boolean;
    files: TaskFile[];
  }
  
  export interface TaskFile {
    id: string;
    filePath: string;
  }
  
  export class TaskTreeItem extends vscode.TreeItem {
    constructor(
      public readonly task: Task,
      public readonly taskFile: TaskFile | null,
      public readonly type: "task" | "file",
      public readonly contextValue: string
    ) {
      super(type === "task" ? task.name : vscode.workspace.asRelativePath(taskFile!.filePath));
      this.id = type === "task" ? task.id : task.id + taskFile!.filePath;
      this.collapsibleState = type === "task" ? vscode.TreeItemCollapsibleState.Collapsed : void 0;
    }
  }
  

export class TaskManagerProvider implements vscode.TreeDataProvider<TaskTreeItem> {
    
    private _onDidChangeTreeData: vscode.EventEmitter<TaskTreeItem | undefined> = new vscode.EventEmitter<TaskTreeItem | undefined>();
    readonly onDidChangeTreeData: vscode.Event<TaskTreeItem | undefined> = this._onDidChangeTreeData.event;

    private tasks: Task[] = [
        {
        id: '1',
        name: 'Sample Task 1',
        isComplete: false,
        files: [
            {
            id: '1-1',
            filePath: 'C:/Users/kalee/OneDrive/Documents/test/file1.txt',
            },
        ],
        },
        {
        id: '2',
        name: 'Sample Task 2',
        isComplete: true,
        files: [
            {
            id: '2-1',
            filePath: 'C:/Users/kalee/OneDrive/Documents/test/file2.txt',
            },
            {
            id: '2-2',
            filePath: 'C:/Users/kalee/OneDrive/Documents/test/file3.txt',
            },
        ],
        },
    ];

    addTask(task: Task): void {
        this.tasks.push(task);
        this.refresh();
    }

    addFileToTask(task: Task, filePath: string): void {
        const taskIndex = this.tasks.findIndex((t) => t.id === task.id);
            if (taskIndex !== -1) {
                this.tasks[taskIndex].files.push({ id: generateUniqueId(), filePath });
                this.refresh();
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
                task.files.map((file) => new TaskTreeItem(task, file, "file", "taskFile"))
            );
            }
        }
        } else {
        return Promise.resolve(
            this.tasks.map((task) => new TaskTreeItem(task, null, "task", "task"))
        );
        }
        return Promise.resolve([]);
    }
    
    
    refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
    }
}
  