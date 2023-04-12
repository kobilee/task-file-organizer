# Task Manager Extension for Visual Studio Code

This Visual Studio Code extension provides a simple task manager, allowing you to manage tasks and associate files with each task. Tasks can be created, deleted, and marked as complete. The extension also allows you to set a random color for each task, which will be applied to associated files' tabs in the editor.

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
3. Use the command palette (`Ctrl+Shift+P` or `Cmd+Shift+P` on Mac) to access the extension's commands:
   - `Add Task`: Create a new task
   - `Add File to Task`: Add the currently open file to a task
   - `Remove Task`: Remove a selected task
   - `Remove File from Task`: Remove the currently open file from its associated task
4. The Explorer tab will display two sections: "Active Tasks" and "Completed Tasks".
   - Right-click on a task in either section to access the context menu with options to complete or uncomplete the task.
5. Click on a task to open all files associated with it.
6. Click on a file under a task to open the specific file.

## Installation

1. Open Visual Studio Code
2. Press `Ctrl+P` (or `Cmd+P` on macOS) to open the Quick Open dialog
3. Type `ext install your_extension_name` and press `Enter`
4. Reload Visual Studio Code

## Usage

After installing the extension, you can access the Task Manager view from the Activity Bar or the Explorer sidebar. You can create tasks, add files to tasks, and manage tasks using the provided commands. The extension will also apply the task color to the associated file tabs in the editor.

## Known Issues
After installing the extension, you may see a message saying "Your Code installation is corrupt..." Click on the gear icon and choose "Don't show again."

## Release Notes
This is a beta, please report any bug you find!

### 0.1.0
