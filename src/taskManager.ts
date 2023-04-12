import * as vscode from 'vscode';
import { generateUniqueId } from './extension';
import { setColor } from './color_tab';

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

    constructor(
      public readonly context: vscode.ExtensionContext,
      public readonly task: Task,
      public readonly taskFile: TaskFile | null,
      public readonly type: "task" | "file",
    ) {
      super(type === "task" ? task.name : vscode.workspace.asRelativePath(taskFile!.filePath));
      this.id = type === "task" ? task.id : task.id + taskFile!.filePath;
      this.collapsibleState = type === "task" ? vscode.TreeItemCollapsibleState.Collapsed : void 0;
      this.contextValue = type;
      this.context = context;
      this.taskJSON = type === "task" ? JSON.stringify(task) : "";

      

      if (type === "task") {
        const svgString = generateColoredCircleSvg(task.color);
        this.iconPath = vscode.Uri.parse(`data:image/svg+xml;base64,${Buffer.from(svgString).toString('base64')}`);
        this.command = {
          command: "taskManager.openAllFilesInTask",
          title: "Open All Files in Task",
          arguments: [task],
        };
      } else if (type === "file" && taskFile) {
        setColor(context, task.color, taskFile.filePath)
        this.command = {
          command: "taskManager.openTaskFile",
          title: "Open Task File",
          arguments: [taskFile!.filePath],
        };
      }
    }
}


export class TaskManagerProvider implements vscode.TreeDataProvider<TaskTreeItem> {
    constructor(
      public readonly context: vscode.ExtensionContext,
    ) {
      this.context = context;
    }
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
                filePath: 'C:/Users/Jakobi Lee/Documents/test/file1.txt',
                },
            ],
            color: "#000000"
        },
        {
            id: '2',
            name: 'Sample Task 2',
            isComplete: true,
            files: [
                {
                id: '2-1',
                filePath: 'C:/Users/Jakobi Lee/Documents/test/file2.txt',
                },
                {
                id: '2-2',
                filePath: 'C:/Users/Jakobi Lee/Documents/test/file3.txt',
                },
            ],
            color: "#528752"
        },
    ];
    public getTaskByFilePath(filePath: string): Task | undefined {
      return this.tasks.find((task) => task.files.some((file) => file.filePath === filePath));
    }


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
                task.files.map((file) => new TaskTreeItem(this.context, task, file, "file"))
              );
            }
          }
        } else {
          return Promise.resolve(
            this.tasks.map((task) => new TaskTreeItem(this.context, task, null, "task"))
          );
        }
        return Promise.resolve([]);
    }
    
    
    
    refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
    }
}
  


  