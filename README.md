# Colored Task Manager for Visual Studio Code

This Visual Studio Code extension provides a simple task manager, allowing you to manage tasks and associate files with each task. Tasks can be created, deleted, and marked as complete. The extension also allows you to set a random color for each task, which will be applied to associated files' tabs in the editor.

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

## Installation

You can install the latest version of the extension via the Visual Studio Marketplace [here](https://marketplace.visualstudio.com/items?itemName=JakobiLee.file-organizer).

or 

1. Open Visual Studio Code
2. Press `Ctrl+P` (or `Cmd+P` on macOS) to open the Quick Open dialog
3. Type `ext install file-organizer` and press `Enter`
4. Reload Visual Studio Code

NOTE: to use this extention on macOS you must move your vscode install into the application folder

## Usage

After installing the extension, you can access the Task Manager view from the Activity Bar or the Explorer sidebar. You can create tasks, add files to tasks, and manage tasks using the provided commands. The extension will also apply the task color to the associated file tabs in the editor.

1. Reload VS Code after installation.
2. Configure extension settings:
   - Go to File > Preferences > Settings (or `Ctrl+,` on Windows/Linux or `Cmd+,` on Mac).
   - Search for "Task File Organizer" in the search bar.
   - Configure the settings for "Close Files Interval" and "Enable Auto Close" as desired.
3. Use the command palette (`Ctrl+Shift+P` or `Cmd+Shift+P` on Mac) to access the extension's commands( all other Task Manger commands have not been tested to run from the command palette):
   - `Create Task`: Create a new task
4. The Task Manger Tab will give you access to the reset of the commands:
   - `Create Task`: Create a new task, can be accessed through the button in the title or through the context menu (accessed by right-clicking on an existing task)
   - `Add File to Task`: Adds a file to a Task, available in the task context menu
   - `Add File to Active Task`: Adds a file to the active Task (Active task is indicated by the larger icon) ```crtl + shift + t ```
   - `Add Note to file`: Adds a Note to the current file, available in the file context menu
   - `Add Note to file in Active Task`: Adds a Note to the current file if it's in the active task, ```crtl + shift + y```
         - Notes save the current highlighted text; clicking on a note will take you to the saved text
   - `Remove Note`: Deletes a Note, available in the note context menu
   - `Remove File from task`: Deletes a file from a task, available in the file context menu
   - `Remove Task`: Deletes a Task, available in the task context menu
   - `Activate Task`: Colors all files in task based on the selected Task and brings all files together, available in the task context menu
   - `Complete Task`: Marks a task as complete; complete tasks are not visible in the task manager tab and can be seen in the "Completed Tasks" explained below, available in the task context menu
   - `Close All Files in Task`: Closes all open files in Task, available in the task context menu ```crtl + shift + c```
   - `Open All Files in Task`: Opens all files in Task, available in the task context menu ```crtl + shift + a```
   - `Sort All Files in Task`: Sorts all open files in Task so they display next to one another, available in the task context menu
   - `Rename Task`: Allows you to update the name of a Task, available in the task context menu
   - `Add and commit Files in Task`: Allows you to add and commit any changes to files within
5. The Explorer tab will display two sections: "Active Tasks" and "Completed Tasks".
   - Right-click on a task in either section to access the context menu with options to uncomplete the task.
6. Click on a task to open all files associated with it.
7. Click on a file under a task to open the specific file.


## Known Issues

After installing the extension, you may see a message saying "Your Code installation is corrupt..." Click on the gear icon and choose "Don't show again."

This extention has not been tested on Linux but is not expected to work.

## Release Notes

This is a beta, please report any bug you find!

### 0.1.10
