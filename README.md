# Task Manager Extension for Visual Studio Code

This Visual Studio Code extension provides a simple task manager, allowing you to manage tasks and associate files with each task. Tasks can be created, deleted, and marked as complete. The extension also allows you to set a random color for each task, which will be applied to associated files' tabs in the editor.

## How it looks like
![Preview GIF](https://github.com/kobilee/task-file-organizer/blob/main/assests/preview.gif)

## Features

- Create a task with a unique color
- Add files to a task
- Open all files associated with a task
- Remove files from a task
- Remove a task
- Update a task's completion status
- Show active and completed tasks in separate sections in the Explorer tab
- Context menu to complete/uncomplete tasks

## Usage

1. Install the extension in Visual Studio Code.
2. Reload VS Code after installation.
3. Use the command palette (`Ctrl+Shift+P` or `Cmd+Shift+P` on Mac) to access the extension's commands( all other Task Manger commands have not been tested to run from the command palette):
   - `Create Task`: Create a new task
4. The Task Manger Tab will give you access to the reset of the commands:
    - `Create Task`: Create a new task, can be accessed through the button in the title or through the context menu ( accessed by right clicking on an existing task)
    - `Add File to Task`: Adds a file to a Task, avaliable in the task the context menu
    - `Remove Task`: Deletes a Task, avaliable in the task the context menu
    - `Activate Task`: Colors all File in task based on the selected Task and bring bring all file together, avaliable in the task the context menu
    - `Complete Task`: Marks a task as complete, complete tasks are not visable in the task manger tab and can be seen in the "Completed Tasks" explained below, avaliable in the task the context menu
    - `Close All Files in Task`: Closes all open files in Task, avaliable in the task the context menu
    - `Open All Files in Task`: Opens all files in Task, avaliable in the task the context menu
    - `Sort All Files in Task`: Sorts all open files in Task so they display next to one another, avaliable in the task the context menu
5. The Explorer tab will display two sections: "Active Tasks" and "Completed Tasks".
   - Right-click on a task in either section to access the context menu with options to uncomplete the task.
6. Click on a task to open all files associated with it.
7. Click on a file under a task to open the specific file.



## Installation

1. Open Visual Studio Code
2. Press `Ctrl+P` (or `Cmd+P` on macOS) to open the Quick Open dialog
3. Type `ext install file-organizer` and press `Enter`
4. Reload Visual Studio Code

## Usage

After installing the extension, you can access the Task Manager view from the Activity Bar or the Explorer sidebar. You can create tasks, add files to tasks, and manage tasks using the provided commands. The extension will also apply the task color to the associated file tabs in the editor.

## Known Issues
After installing the extension, you may see a message saying "Your Code installation is corrupt..." Click on the gear icon and choose "Don't show again."

## Release Notes
This is a beta, please report any bug you find!

### 0.1.4
