import * as vscode from "vscode";
import { generateUniqueId } from "./extension";
import { setColor } from "./color_tab";
import Storage from "./storage";
import * as cp from 'child_process';
import * as path from "path";

export interface Task {
  id: string;
  name: string;
  isComplete: boolean;
  isActive: boolean;
  files: TaskFile[];
  subtasks: SubTask[];
  color: string;
}

export interface SubTask {
  id: string;
  name: string;
  isActive: boolean;
  files: TaskFile[];
  color: string;
}

export interface TaskFile {
  id: string;
  filePath: string;
  notes: Note[];
}

export interface Position {
  line: number;
  character: number;
}

export interface Note {
  fileName: string;
  fileLine: number;
  positionStart: Position;
  positionEnd: Position;
  text: string;
  codeSnippet: string;
  id: string;
}


export function generateColoredCircleSvg(color: string, radius: number): string {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}">
      <circle cx="12" cy="12" r="${radius}"/>
    </svg>`;
}

interface RGB {
  r: number;
  g: number;
  b: number;
}

function hexToRGB(hex: string): RGB {
  const bigint = parseInt(hex.slice(1), 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return { r, g, b };
}

function RGBToHex(r: number, g: number, b: number): string {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function modifyColorComponent(value: number, offset: number): number {
  const newValue = value + offset;
  return newValue < 0 ? 0 : newValue > 255 ? 255 : newValue;
}

function generateOffsetColor(hexColor: string, offset: number): string {
  const { r, g, b } = hexToRGB(hexColor);
  const newR = modifyColorComponent(r, offset);
  const newG = modifyColorComponent(g, offset);
  const newB = modifyColorComponent(b, offset);
  return RGBToHex(newR, newG, newB);
}

function getOffset(task: Task, storage: Storage): number {
  const offsets = storage.get("subtask")
  let offset = offsets[task.id]
  if (offset < 0) {
    offset *= -1 
  } else {
    offset = -(offset + 25)
  }
  return offset
}

const OFFSET = 25; // Adjust this value to control the color offset


export class TaskTreeItem extends vscode.TreeItem {
  public taskJSON: string;
  public fileJSON: string;
  public noteJSON: string;

  constructor(
    public readonly context: vscode.ExtensionContext,
    public readonly task: Task,
    public readonly subtask: SubTask | null,
    public readonly taskFile: TaskFile | null,
    public readonly note: Note | null,
    public readonly type: "task" | "subtask" | "file" | "note"
  ) {
    super(
      type === "task"
        ? task.name
        :  type === "subtask"
        ?  subtask!.name
        :  type === "file"
        ? path.basename(taskFile!.filePath)
        : note!.text
    );
    this.id = type === "task" 
    ? task.id 
    : type === "subtask" 
    ? subtask!.id 
    : type === "file" 
    ? `${task.id}|${taskFile!.filePath}`
    : `${task.id}|${taskFile!.filePath}|${generateUniqueId()}`;
    this.collapsibleState =
      type === "task"
      ? vscode.TreeItemCollapsibleState.Collapsed
      : type === "subtask"
      ? vscode.TreeItemCollapsibleState.Collapsed
      : type === "file"
      ? vscode.TreeItemCollapsibleState.Collapsed
      : void 0;
    this.contextValue = type;
    this.context = context;
    this.taskJSON = type === "task" ? JSON.stringify(task) : "";
    this.fileJSON = type === "file" ? JSON.stringify(taskFile) : "";
    this.noteJSON = type === "note" ? JSON.stringify(note) : "";

    if (type === "task") {
      const svgString = generateColoredCircleSvg(task.color, task.isActive ? 12 : 6);
      this.iconPath = vscode.Uri.parse(
        `data:image/svg+xml;base64,${Buffer.from(svgString).toString("base64")}`
      );
      this.command = {
        command: "taskManager.openAllFilesInTask",
        title: "Open All Files in Task",
        arguments: [task],
      };
    } else if (type === "subtask") {

        const svgString = generateColoredCircleSvg(subtask!.color, subtask!.isActive ? 12 : 6);
        this.iconPath = vscode.Uri.parse(
          `data:image/svg+xml;base64,${Buffer.from(svgString).toString("base64")}`
        );
    } else if (type === "file" && taskFile) {
      const relativePath = vscode.workspace.asRelativePath(taskFile.filePath);
      const dirPath = vscode.workspace.asRelativePath(path.dirname(taskFile.filePath));
      this.description = relativePath === path.basename(taskFile.filePath) ? "" : dirPath;
      this.command = {
        command: "taskManager.openTaskFile",
        title: "Open Task File",
        arguments: [taskFile!.filePath],
      };
    } else if (type === "note" && note) {
      this.command = {
        command: "taskManager.openNote",
        title: "Open Note",
        arguments: [taskFile, note.id],
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
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;

    // If there's no workspace folder open, return an empty array
    if (!workspacePath) {
      return [];
    }
    return this.storage.get(`tasks-${workspacePath}`) || [];
  }

  async addAndCommitFiles(task:Task): Promise<void> {
  
    const commitMessage = await vscode.window.showInputBox({
      prompt: 'Enter the commit message',
      placeHolder: 'Commit message',
    });
  
    if (!commitMessage) {
      return;
    }
  
    for (const file of task.files) {
      cp.execSync(`git add ${file.filePath}`, { cwd: vscode.workspace.rootPath });
      cp.execSync(`git commit -m "${commitMessage}" ${file.filePath}`, {
        cwd: vscode.workspace.rootPath,
      });
    }
  
    vscode.window.showInformationMessage(`Files in task ${task.name} have been added and committed.`);
  }

  public getActiveTask(): Task | undefined {
    return this.tasks.find((task) =>
      task.isActive === true)
  }
  
  public getTaskByFilePath(filePath: string): Task | undefined {
    const tabs = this.storage.get("tabs");
    return this.tasks.find((task) =>
      task.files.some((file) => file.filePath === filePath) &&
      (tabs[task.id] && tabs[task.id].includes(filePath.replace(/\\/g, "\\\\")))
    );
  }

  updateTaskColor(task: Task, newColor: string): void {
    const tasks = this.tasks;
    const taskIndex = tasks.findIndex((t) => t.id === task.id);
    if (taskIndex !== -1) {
      tasks[taskIndex].color = newColor;
      const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
      this.storage.set(`tasks-${workspacePath}`, tasks);

      for (const file of tasks[taskIndex].files) {
        setColor(this.context, task.id, newColor, file.filePath);
      }
      this.refresh();
    }
  }
  
  async renameTask(task: Task): Promise<void> {
    const newTaskName = await vscode.window.showInputBox({
      prompt: "Enter the new task name",
      value: task.name,
    });

    if (newTaskName && newTaskName !== task.name) {
      const taskIndex = this.tasks.findIndex((t) => t.id === task.id);
      if (taskIndex !== -1) {
        this.tasks[taskIndex].name = newTaskName;
        this.refresh();
      }
    }
  }

  addTask(task: Task): void {
    const tasks = this.tasks;
    tasks.forEach((t) => (t.isActive = false));
    task.isActive = true;
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
    this.storage.add(`tasks-${workspacePath}`, task);
    this.refresh();
  };

  setTaskAsActive(task: Task): void {
    const tasks = this.tasks;
    tasks.forEach((t) => (t.isActive = false));
    const taskIndex = tasks.findIndex((t) => t.id === task.id);
    if (taskIndex !== -1) {
      tasks[taskIndex].isActive = true;
      const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
      this.storage.set(`tasks-${workspacePath}`, tasks);
      this.refresh();
    }
  };
  
  updateTaskToComplete(taskId: string): void {
    const tasks = this.tasks;
    const taskIndex = tasks.findIndex((task) => task.id === taskId);
    if (taskIndex !== -1) {
      tasks[taskIndex].isComplete = true;
      const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
      this.storage.set(`tasks-${workspacePath}`, tasks);
      this.refresh();
    }
  };

  removeTask(task: Task): void {
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
    this.storage.remove(`tasks-${workspacePath}`, task);
    this.refresh();
  };

  addFileToTask(task: Task, filePath: string): void {
    const tasks = this.tasks;
    const taskIndex = tasks.findIndex((t) => t.id === task.id);
    if (taskIndex !== -1) {
      tasks[taskIndex].files.push({ id: generateUniqueId(), filePath, notes: []});
      const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
      this.storage.set(`tasks-${workspacePath}`, tasks);
      this.refresh();
    }
  };

  addSubtaskToTask(task: Task, subtask: string): void {
    const tasks = this.tasks;
    const taskIndex = tasks.findIndex((t) => t.id === task.id);
    if (taskIndex !== -1) {
      const offset = getOffset(task, this.storage)
      const newColor = generateOffsetColor(task.color, offset);
      tasks[taskIndex].subtasks.push({ id: generateUniqueId(), name: subtask, isActive: false, files: [], color: newColor});
      const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
      this.storage.set(`tasks-${workspacePath}`, tasks);
      this.refresh();
    }
  };

  addFileToSubTask(task: Task, filePath: string): void {
    const tasks = this.tasks;
    const taskIndex = tasks.findIndex((t) => t.id === task.id);
    if (taskIndex !== -1) {
      tasks[taskIndex].files.push({ id: generateUniqueId(), filePath, notes: []});
      const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
      this.storage.set(`tasks-${workspacePath}`, tasks);
      this.refresh();
    }
  };


  createNote = (label: string) => {
    const nextId = generateUniqueId()

    let codeSnippet = '';
    let fileName = '';
    let selection = undefined;
    let positionStart: Position = {line: 0, character: 0};
    let positionEnd: Position = {line: 0, character: 0};

    const editor = vscode.window.activeTextEditor;
    if (editor) {
        fileName = editor.document.uri.fsPath;
        selection = editor.selection;
        if (selection) {
            codeSnippet = editor.document.getText(selection);
            positionStart = { line: selection.start.line, character: selection.start.character };
            positionEnd = { line: selection.end.line, character: selection.end.character };
        }
    }
    const note: Note = {
        fileName: fileName,
        fileLine: selection ? selection.start.line : 0,
        positionStart: positionStart,
        positionEnd: positionEnd,
        text: label,
        codeSnippet: codeSnippet,
        id: nextId
    };
    return note;
  };

  openNote(file: TaskFile, id: string): void {
    const noteindex = this.getNote(file, id);

    
    if (noteindex >= 0) {
        const note = file.notes[noteindex];
        const fileName = note.fileName;
        const fileLine = note.fileLine;

        if (fileName.length <= 0) {
            return;
        }

        var openPath = vscode.Uri.file(fileName);
        vscode.workspace.openTextDocument(openPath).then(doc => {
            vscode.window.showTextDocument(doc).then(editor => {
                var range = new vscode.Range(fileLine, 0, fileLine, 0);
                editor.revealRange(range);

                var start = new vscode.Position(note.positionStart.line, note.positionStart.character);
                var end = new vscode.Position(note.positionEnd.line, note.positionEnd.character);
                editor.selection = new vscode.Selection(start, end);

                var range = new vscode.Range(start, start);
                editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
            });
        });
    }
  };

  addNoteToFile(taskId: string, file: TaskFile, noteStr: string): void {
    const tasks = this.tasks;
    const taskIndex = tasks.findIndex((t) => t.id === taskId);
    if (taskIndex !== -1) {
      const fileIndex = tasks[taskIndex].files.findIndex(
        (f) => f.id === file.id
      );
      if (fileIndex !== -1) {
        const note = this.createNote(noteStr)
        tasks[taskIndex].files[fileIndex].notes.push(note);
        const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
        this.storage.set(`tasks-${workspacePath}`, tasks);
        this.refresh();
      }
    }
  };

  updateTask(tasks: Task[]) {
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
    this.storage.set(`tasks-${workspacePath}`, tasks);
    this.refresh();
  }

  getFile(task: Task, filePath: string) {
    return task.files.findIndex(
      (file) => file.filePath === filePath
    );
  };

  getNote(file: TaskFile, id: string) {
    return file.notes.findIndex(
      (note) => note.id === id
    );
  };

  async removeFileFromTask(taskId: string, rfile: TaskFile) {
    // Find the index of the file in the task.files array

    const tasks = this.tasks;
    const taskIndex = tasks.findIndex((t) => t.id === taskId);
    if (taskIndex !== -1) {
      const index = this.getFile(tasks[taskIndex], rfile.filePath)
  

      if (index !== -1) {
        // Remove the file from the task.files array
        tasks[taskIndex].files.splice(index, 1);
        // Persist changes to storage, if necessary
        const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
        this.storage.set(`tasks-${workspacePath}`, tasks);
        // Refresh the TreeView
        this.refresh();
      }
    }
  };

  async removeNoteFromFile(taskId: string, filePath: string, noteStr: string) {
    const tasks = this.tasks;
    const taskIndex = tasks.findIndex((t) => t.id === taskId);
    if (taskIndex !== -1) {
      const fileIndex = this.getFile(tasks[taskIndex], filePath)

      if (fileIndex !== -1) {
        // Remove the file from the task.files array
        const index = tasks[taskIndex].files[fileIndex].notes.findIndex(
          (note) => note.text === noteStr
        );
        tasks[taskIndex].files[fileIndex].notes.splice(index, 1);
        // Persist changes to storage, if necessary
        const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
        this.storage.set(`tasks-${workspacePath}`, tasks);
        // Refresh the TreeView
        this.refresh();
      }
    }
  };
  
  getTreeItem(element: TaskTreeItem): vscode.TreeItem {
    return element;
  };

  getChildren(element?: TaskTreeItem): Thenable<TaskTreeItem[]> {
    if (element) {
      if (element.type === "task") {
        const task = this.tasks.find((t) => t.id === element.task.id) || null;
        if (task) {
          if (task) {
            const fileItems = task.files.map(
              (file) => new TaskTreeItem(this.context, task, null, file, null, "file")
            );
        
            const subtaskItems = task.subtasks.map(
              (subtask) => new TaskTreeItem(this.context, task, subtask, null, null, "subtask")
            );
        
            return Promise.resolve([...fileItems, ...subtaskItems]);
          }
        }
      } else if (element.type === "file") {
          const task = this.tasks.find((t) => t.id === element.task.id) || null;
          if (task) {
            const file = task.files.find((f) => f.id === element.taskFile!.id) || null;
            if (file) {
              return Promise.resolve(
                file.notes.map(
                  (note) => new TaskTreeItem(this.context, task, null, file, note, "note")
              )
            );
          }
        }
      }
    } else {
      return Promise.resolve(
        this.tasks
          .filter((task) => !task.isComplete)
          .map((task) => new TaskTreeItem(this.context, task, null, null, null, "task"))
      );
    }
    return Promise.resolve([]);
  };
  
  

  refresh(): void {
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;

    if (!workspacePath) {
      return;
    }

    // Refresh the tree
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
          .map((task) => new TaskTreeItem(this.context, task, null, null, null, "task"))
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
          .map((task) => new TaskTreeItem(this.context, task, null, null, null, "task"))
      );
    }
    return Promise.resolve([]);
  }

  uncompleteTask(task: Task): void {
    const tasks = this.tasks;
    const taskIndex = tasks.findIndex((t) => t.id === task.id);
    if (taskIndex !== -1) {
      tasks[taskIndex].isComplete = false;
      const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
      this.storage.set(`tasks-${workspacePath}`, tasks);
      this.refresh();
      this.taskManagerProvider.refresh();
      this.activeTaskProvider.refresh();
    }
    
  }
}
