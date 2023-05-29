import * as vscode from "vscode";
import { generateUniqueId } from "./extension";
import { addColor, setColor,updateColor } from "./color_tab";
import Storage from "./storage";
import * as cp from 'child_process';
import * as path from "path";
import * as chroma from 'chroma-js';

export interface Task {
  id: string;
  name: string;
  isComplete: boolean;
  isActive: boolean;
  files: TaskFile[];
  subtasks: SubTask[];
  color: string;
}

export interface TaskFile {
  id: string;
  filePath: string;
  notes: Note[];
  color: string;
  subtask: string;
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
export interface SubTask {
  name: string;
  color: string
}


export function generateColoredCircleSvg(color: string, radius: number): string {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}">
      <circle cx="12" cy="12" r="${radius}"/>
    </svg>`;
}

const isValidHexColor = (color: string) => /^#([0-9A-Fa-f]{3}){1,2}$/.test(color);


export class TaskTreeItem extends vscode.TreeItem {
  public taskJSON: string;
  public fileJSON: string;
  public noteJSON: string;

  constructor(
    public readonly context: vscode.ExtensionContext,
    public readonly task: Task,
    public readonly taskFile: TaskFile | null,
    public readonly note: Note | null,
    public readonly type: "task" | "file" | "note"
  ) {
    super(
      type === "task"
        ? task.name
        :  type === "file"
        ? path.basename(taskFile!.filePath)
        : note!.text
    );
    this.id = type === "task" 
    ? task.id 
    : type === "file" 
    ? `${task.id}|${taskFile!.filePath}`
    : `${task.id}|${taskFile!.filePath}|${generateUniqueId()}`;
    this.collapsibleState =
    type === "task"
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
    } else if (type === "file" && taskFile) {
      const svgString = generateColoredCircleSvg(taskFile.color, 16);
      this.iconPath = vscode.Uri.parse(
        `data:image/svg+xml;base64,${Buffer.from(svgString).toString("base64")}`
      );
      const relativePath = vscode.workspace.asRelativePath(taskFile.filePath);
      const dirPath = vscode.workspace.asRelativePath(path.dirname(taskFile.filePath));
      this.description = taskFile.subtask ? taskFile.subtask : "";
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

  public fixtasks() {
    for (const task of this.tasks) {
      if (task.subtasks === undefined) {
        task.subtasks = [];
      }
    }
  }


// Updates the color of each subtask.
async updateSubtaskColors(task: Task, oldColor: string, newColor: string): Promise<void> {
  for (let subtask of task.subtasks) {
    let offset = chroma.deltaE(oldColor, subtask.color);
    let newSubtaskColor;
    try {
      newSubtaskColor = chroma(newColor).set('hsl.h', '+'.concat(offset.toString())).hex();
      // Ensure that the new color is valid.
      if (!isValidHexColor(newSubtaskColor)) {
        throw new Error("Invalid color");
      }
      subtask.color = newSubtaskColor;
    } catch (error) {
      // If the color is invalid, use the new task color as a fallback.
      console.log(`Invalid color: ${newSubtaskColor}. Using the new task color as fallback.`);
      
      subtask.color = newColor;
    }
    updateColor(this.context, task.id, subtask.color, subtask.name)
  }
}

// Updates the task color and all related colors.
async updateTaskColor(task: Task, newColor: string): Promise<void> {
  const tasks = this.tasks;
  const taskIndex = tasks.findIndex((t) => t.id === task.id);
  if (taskIndex !== -1) {
    const oldColor = tasks[taskIndex].color
    tasks[taskIndex].color = newColor;

    await this.updateSubtaskColors(tasks[taskIndex], oldColor, newColor);

    this.updateFileColors(tasks[taskIndex], newColor, oldColor);

    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
    this.storage.set(`tasks-${workspacePath}`, tasks);

    for (const file of tasks[taskIndex].files) {
      // Do something different if a file has a subtask.
      if (file.subtask) {
        updateColor(this.context, task.id, file.color, file.subtask)
      } else {
        updateColor(this.context, task.id, newColor, "Task")
      }
      setColor(this.context, task.id, file.filePath);
    }
    this.refresh();
  }
}
  
  async updateFileColors(task: Task, newTaskColor: string, oldTaskColor: string): Promise<void> {
    task.files.forEach(file => {
      if (file.subtask) {
        let offset = chroma.deltaE(oldTaskColor, file.color);
        let newColor = chroma(newTaskColor).set('hsl.h', '+'.concat(offset.toString())).hex();
  
        file.color = newColor;
      } else {
        file.color = newTaskColor;
      }
    });
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
      tasks[taskIndex].files.push({ id: generateUniqueId(), filePath, notes: [], color: tasks[taskIndex].color, subtask: ''});
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

  getSubTask(task: Task, name: string) {
    return task.subtasks.findIndex(
      (subtask) => subtask.name === name
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

  
  async addSubtasktoTask(task: Task, subtask: string, context: vscode.ExtensionContext) {
    const tasks = this.tasks;
    const taskIndex = tasks.findIndex((t) => t.id === task.id);
    if (taskIndex !== -1) {
      let usedLightnesses = tasks[taskIndex].subtasks.map(subtask => chroma(subtask.color).get('hsl.l'));
  
      let lightness = chroma(tasks[taskIndex].color).get('hsl.l');
      let hue: number;

      if (tasks[taskIndex].subtasks.length === 0) {
        hue = chroma(tasks[taskIndex].color).get('hsl.h');
      } else {
        let lastSubtaskColor = tasks[taskIndex].subtasks[tasks[taskIndex].subtasks.length - 1].color;
        hue = chroma(lastSubtaskColor).get('hsl.h');
      }

      let adjustment = 0.1; // Base adjustment
  
      let maxPosChanges = Math.floor((1 - lightness) / adjustment);
      let maxNegChanges = Math.floor(lightness / adjustment);

      // Count the number of positive and negative adjustments done so far
      let posCount = tasks[taskIndex].subtasks.filter(subtask => chroma(subtask.color).get('hsl.l') > lightness).length;
      let negCount = tasks[taskIndex].subtasks.filter(subtask => chroma(subtask.color).get('hsl.l') < lightness).length;
      
      if (tasks[taskIndex].subtasks.length % 2 === 0) {
        // If there are even number of subtasks (or no subtask), increment lightness
        adjustment *= (posCount + 1); // Increase the adjustment by the count
        adjustment = adjustment % maxPosChanges;
        if (lightness + adjustment > 1) {
          hue = (hue + (10 * (posCount/ maxPosChanges))) % 360; // change hue by 15 degrees when lightness is at the maximum
        } else {
          lightness += adjustment;
        }
      } else {
        // If there are odd number of subtasks, decrement lightness
        adjustment *= (negCount + 1); // Increase the adjustment by the count
        adjustment = adjustment % maxNegChanges;
        if (lightness - adjustment < 0) {
          hue = (hue + (10 * (negCount/ maxNegChanges))) % 360; // change hue by 15 degrees when lightness is at the maximum
          // change hue by 15 degrees when lightness is at the minimum
        } else {
          lightness -= adjustment;
        }
      }
  
      // Create new color with adjusted lightness
      const newColor = chroma(hue, chroma(tasks[taskIndex].color).get('hsl.s'), lightness, 'hsl').hex();
  
      tasks[taskIndex].subtasks.push({name: subtask, color: newColor});
      console.log(newColor, tasks[taskIndex].color)
      const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
      addColor(context, task.id, newColor, subtask);
  
      this.storage.set(`tasks-${workspacePath}`, tasks);
    }
  }
  
  
  
  
  async removeSubtaskFromTask(task: Task, subtaskName: string, context: vscode.ExtensionContext) {
    const tasks = this.tasks;
    const taskIndex = tasks.findIndex((t) => t.id === task.id);
    if (taskIndex !== -1) {
        const subtaskIndex = tasks[taskIndex].subtasks.findIndex(subtask => subtask.name === subtaskName);
        if (subtaskIndex !== -1) {

          for (let file of tasks[taskIndex].files) {
            if (file.subtask === subtaskName) {
                await this.removeFileFromSubtask(task.id, file, subtaskName, context);
            }
          }

          tasks[taskIndex].subtasks.splice(subtaskIndex, 1);

            const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
            this.storage.set(`tasks-${workspacePath}`, tasks);
            this.refresh();
        }
    }
}

  async addFileSubtask(taskId: string, rfile: TaskFile, subtask: string, context: vscode.ExtensionContext) {
    const tasks = this.tasks;
    const taskIndex = tasks.findIndex((t) => t.id === taskId);
    if (taskIndex !== -1) {
      const fileIndex = this.getFile(tasks[taskIndex], rfile.filePath);
      const subtaskIndex = this.getSubTask(tasks[taskIndex], subtask);

      if (fileIndex !== -1 && subtaskIndex !== -1) {
        tasks[taskIndex].files[fileIndex].color =  tasks[taskIndex].subtasks[subtaskIndex].color;
        tasks[taskIndex].files[fileIndex].subtask = tasks[taskIndex].subtasks[subtaskIndex].name ;

        const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
        this.storage.set(`tasks-${workspacePath}`, tasks);
        setColor(context, taskId, tasks[taskIndex].files[fileIndex].filePath);
        this.refresh();

      }
    }
  };

  async removeFileFromSubtask(taskId: string, rfile: TaskFile, subtask: string, context: vscode.ExtensionContext) {
    const tasks = this.tasks;
    const taskIndex = tasks.findIndex((t) => t.id === taskId);
    if (taskIndex !== -1) {
      const fileIndex = this.getFile(tasks[taskIndex], rfile.filePath);
      const subtaskIndex = this.getSubTask(tasks[taskIndex], subtask);
      if (fileIndex !== -1 && subtaskIndex !== -1) {
        // Reset file color to task's color and clear subtask association
        tasks[taskIndex].files[fileIndex].color = tasks[taskIndex].color;
        tasks[taskIndex].files[fileIndex].subtask = '';

        const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
        this.storage.set(`tasks-${workspacePath}`, tasks);
        setColor(context, taskId, tasks[taskIndex].files[fileIndex].filePath);
        this.refresh();
      }
    }
}


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
          const sortedFiles = task.files
            .slice()
            .sort((a, b) => {
              const aSubtask = a.subtask || '';
              const bSubtask = b.subtask || '';
              return aSubtask.localeCompare(bSubtask);
            });
          return Promise.resolve(
            sortedFiles.map((file) => new TaskTreeItem(this.context, task, file, null, "file"))
          );
        }
      } else if (element.type === "file") {
        const task = this.tasks.find((t) => t.id === element.task.id) || null;
        if (task) {
          const file = task.files.find((f) => f.id === element.taskFile!.id) || null;
          if (file) {
            return Promise.resolve(
              file.notes.map((note) => new TaskTreeItem(this.context, task, file, note, "note"))
            );
          }
        }
      }
    } else {
      return Promise.resolve(
        this.tasks
          .filter((task) => !task.isComplete)
          .map((task) => new TaskTreeItem(this.context, task, null, null, "task"))
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
          .map((task) => new TaskTreeItem(this.context, task, null, null, "task"))
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
          .map((task) => new TaskTreeItem(this.context, task, null, null, "task"))
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
