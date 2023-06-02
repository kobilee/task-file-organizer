# Colored Task Manager for Visual Studio Code

This Visual Studio Code extension provides a simple task manager, allowing you to manage tasks and associate files with each task. Tasks can be created, deleted, and marked as complete. The extension also allows you to set a random color for each task, which will be applied to associated files' tabs in the editor.

> **IMPORTANT NOTE : AFTER INSTALLING TABSCOLOR YOU MAY GET THE POPUP "YOUR CODE INSTALLATION IS CORRUPT..." UPON RESTART. JUST CLICK ON THE GEAR ICON AND CHOOSE DON'T SHOW AGAIN.**

## How it looks

![Preview GIF](https://github.com/kobilee/task-file-organizer/raw/main/assests/preview.gif)

## Features

- Create a task with a unique color
- Add files to a task
- Open all files associated with a task
- Remove files from a task
- Remove a task
- Update a task's completion status
- Show active and completed tasks in separate sections in the Explorer tab
- Context menu to complete/uncomplete tasks
- Add and commit tasks
- Automatically close files not in tasks at a timed interval (configurable in settings)
- Control when files are added to tasks through settings
- Add notes to files in tasks
- Add Subtasks to Task and Files to subtasks

## Installation

You can install the latest version of the extension via the Visual Studio Marketplace [here](https://marketplace.visualstudio.com/items?itemName=JakobiLee.file-organizer).

or 

1. Open Visual Studio Code
2. Press `Ctrl+P` (or `Cmd+P` on macOS) to open the Quick Open dialog
3. Type `ext install file-organizer` and press `Enter`
4. Reload Visual Studio Code

IMPORTANT: to use this extention on macOS you must move your vscode install into the application folder

## Usage

After installing the extension, you can access the Task Manager view from the Activity Bar or the Explorer sidebar. You can create tasks, add files to tasks, and manage tasks using the provided commands. The extension will also apply the task color to the associated file tabs in the editor.

1. Close and Open VSCode after installation.

2. (Optional) Use the command palette (`Ctrl+Shift+P` or `Cmd+Shift+P` on Mac) to access the extension's commands:
   - `Create Task`: creates a new task

3. The Task Manger Tab in the activity bar will give you access to the reset of the commands:
   ### Tab view:
   - `Create Task`: Creates a new task, button at the top of the tab view.      
  
   ### Tasks:
   - `Rename Task`: Allows you to update the name of a Task,  `Inline`
   - `Remove Task`: Deletes a Task, `Inline`
   - `Generate Random Color`: Generates a new random color for a task, `Inline`
   - `Save Files in Task`: Saves all files in a task, `Inline`

   ### Manipluate Task Files:
   - `Close All Files in Task`: Closes all open files in Task, available in the task context menu 
   - `Close All Files not in Task`: Closes all open files in that are not in a Task, available in the task context menu
   - `Open All Files in Task`: Opens all files in Task, available in the task context menu
   - `Sort All Files in Task`: Sorts all open files in Task so they display next to one another, available in the task context menu
   - `Remove File from task`: Deletes a file from a task, `Inline`
   
   ### Subtasks:
   - `Add Subtask`: Adds a subtaskto a task, available in the task context menu
   - `Remove Subtask From Task`: Deletes a subtask, available in the task context menu
   - `Remove File From Subtask`: Removes a file from a subtask, `Inline`
   - `Add File to Subtask`: Adds a file to a subtask, `Inline`

   ### Add Files:
   - `Add File to Task`: Adds a file to a Task, available in the task context menu
   - `Add File to Active Task`: Adds a file to the active Task (Active task is indicated by the larger icon)
   - `Remove File from task`: Deletes a file from a task, available `Inline` 

   ### Notes:
   - `Add Note to file`: Adds a Note to the current file, available in the file context menu
   - `Add Note to file in Active Task`: Adds a Note to the current file if it's in the active task, 
      - Notes save the current highlighted text; clicking on a note will take you to the saved text
   - `Remove Note`: Deletes a Note, `Inline` 

   ### Utils:
   - `Activate Task`: Colors all files in task based on the selected Task and brings all files together, available in the task context menu
   - `Complete Task`: Marks a task as complete; complete tasks are not visible in the task manager tab and can be seen in the "Completed Tasks" explained below, available in the task context menu
   - `Add and commit Files in Task`: Allows you to add and commit any changes to files within

4. The Explorer tab will display two sections: "Active Tasks" and "Completed Tasks".
   - Right-click on a task in either section to access the context menu with options to uncomplete the task.

5. Click on a task to open all files associated with it.

6. Click on a file under a task to open the specific file.

## Keyboard Shortcuts

| Key                                                                                               | Command                                  |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>t</kbd> / <kbd>Cmd</kbd> + <kbd>Opt</kbd> + <kbd>t</kbd>  | Add File to `Active Task`                |
| <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>y</kbd> / <kbd>Cmd</kbd> + <kbd>Opt</kbd> + <kbd>y</kbd>  | Add Note to open file in `Active Task`   |
| <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>a</kbd> / <kbd>Cmd</kbd> + <kbd>Opt</kbd> + <kbd>a</kbd>  | Open All Files in Task in `Active Task`  |
| <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>c</kbd> / <kbd>Cmd</kbd> + <kbd>Opt</kbd> + <kbd>c</kbd>  | Close All Files in Task in `Active Task` |
| <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>s</kbd> / <kbd>Cmd</kbd> + <kbd>Opt</kbd> + <kbd>s</kbd>  | Save Files in `Active Task`              |
| <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>n</kbd> / <kbd>Cmd</kbd> + <kbd>Opt</kbd> + <kbd>n</kbd>  | Create a new Task             |

## Extension Settings
   - Go to on Windows/Linux `File > Preferences > Settings` or on macOS `Code > Preferences > Settings` 
      - (or `Ctrl + ,` on Windows/Linux or `Cmd + ,` on Mac).
   - Search for "Colored Task Manager" in the search bar:

| Name                                    | Default     | Values                                    | Description                                                                                                                 |
| --------------------------------------- | ----------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `taskFileOrganizer.openFileBehavior`    | `doNothing` | `doNothing/promptForTask/addToActiveTask` | Determine the behavior when a file is opened. You can choose to add the opened file to the active task, select a specific task to add the file to, or do nothing.  |
| `taskFileOrganizer.enableAutoClose`     | `false`     | `true/false`                              | Automatically close any files that are not associated with a task. This action is performed at specified intervals to help maintain a clean and focused workspace. |
| `taskFileOrganizer.closeFilesInterval` | `600000`       | `Any Int above 1000`                              | Interval (in milliseconds) to automatically close files not in tasks. Minimum: 1000 (1 second).  |
| `taskFileOrganizer.autoSetActiveTask` | `false`       | `true/false`                              | Automatically set the active task based on the most recently selected file. If you switch between files, the task associated with the current file will become the active task.  |

## Known Issues

- After installing the extension, you may see a message saying "Your Code installation is corrupt..." Click on the gear icon and choose "Don't show again."
- This extention has not been tested on Linux but is not expected to work.
- Subtask is early Beta, Generating a new color for task with subtasks will not always work and is discouraged 
- Any Tasks create before 0.1.11 Will need to have a new color generated

## TODO

- Color picker
- Sort Tabs based on subtask
- Remove Explandible attribute from complete and active views

## Release Notes

This is a beta, please report any bug you find!

### 0.2.5
