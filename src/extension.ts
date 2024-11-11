import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
//import fetch from 'node-fetch';


export function activate(context: vscode.ExtensionContext) {
    let currentProjectPath = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri.fsPath : '';

    let disposable = vscode.commands.registerCommand('fileguide.openCustomInput', () => {
        console.log('Opening custom input webview');
        const panel = vscode.window.createWebviewPanel(
            'customInput',
            'Custom Input',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        panel.webview.html = getWebviewContent(currentProjectPath, []);

        panel.webview.onDidReceiveMessage(
            async message => {
                console.log('Received message from webview:', message);
                switch (message.command) {
                    case 'analyze':

                        processProjectFolder(currentProjectPath, message.text);


                        const fileTree = await generateFileTree(currentProjectPath);
                        //console.log(fileTree);
                        panel.webview.html = getWebviewContent(currentProjectPath, fileTree);
                        break;
                    case 'changeProject':
                        vscode.window.showOpenDialog({
                            canSelectFiles: false,
                            canSelectFolders: true,
                            canSelectMany: false,
                            openLabel: 'Select Project Folder'
                        }).then(folderUri => {
                            if (folderUri && folderUri[0]) {
                                currentProjectPath = folderUri[0].fsPath;
                                panel.webview.html = getWebviewContent(currentProjectPath, []);
                            }
                        });
                        break;
                }
            },
            undefined,
            context.subscriptions
        );
    });

    context.subscriptions.push(disposable);
}

function getWebviewContent(currentProjectPath: string, fileTreeHTML: string[]) {
    const fileListHTML = fileTreeHTML.join(''); // Join without commas
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>File Guide</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    padding: 20px;
                    text-align: center;
                }
                h1 {
                    font-size: 36px;
                    margin-bottom: 20px;
                }
                textarea {
                    width: 80%;
                    height: 150px;
                    padding: 10px;
                    font-size: 16px;
                    border-radius: 10px;
                    border: 1px solid #ccc;
                    background-color: #342c2a; /* Darker gray */
                }
                button {
                    margin-top: 20px;
                    padding: 10px 20px;
                    font-size: 16px;
                    border-radius: 5px;
                    background-color: #4CAF50;
                    color: white;
                    border: none;
                    cursor: pointer;
                }
                button:hover {
                    background-color: #45a049;
                }
                #fileTree {
                    width: 80%;
                    background-color: #342c2a; /* Darker gray */
                    border: 1px solid #ccc;
                    padding: 15px;
                    margin: 20px auto;
                    text-align: left; /* Align the text to the left */
                }
                ul {
                    list-style-type: none;
                    padding-left: 20px;
                }
                li {
                    cursor: pointer;
                    font-size: 16px;
                    margin: 5px 0;
                }
                li.directory {
                    font-weight: bold;
                }
                li.collapsed:before {
                    content: '[+] ';
                }
                li.expanded:before {
                    content: '[-] ';
                }
                li.file:before {
                    content: '📄 ';
                }
            </style>
        </head>
        <body>
            <h1>File Guide</h1>
            <p id="currentProject">Current Project: ${currentProjectPath}</p>
            <button id="changeProjectButton">Change Project</button>
            <br /><br />
            <textarea id="userInput" placeholder="Enter task description here..."></textarea>
            <br />
            <button id="submitButton">Submit</button>
            <div id="fileTree">
                <ul id="fileList">${fileListHTML}</ul> <!-- Use the joined string here -->
            </div>

            <script>

               
                const vscode = acquireVsCodeApi();

                // Submit button logic
                document.getElementById('submitButton').addEventListener('click', () => {
                    const input = document.getElementById('userInput').value;
                    vscode.postMessage({
                        command: 'analyze',
                        text: input
                    });
                });

                // Change project button logic
                document.getElementById('changeProjectButton').addEventListener('click', () => {
                    vscode.postMessage({
                        command: 'changeProject'
                    });
                });

                // Collapse/Expand directories
                document.querySelectorAll('li.directory').forEach(directory => {
                    directory.addEventListener('click', (event) => {
                        event.stopPropagation();
                        const isCollapsed = directory.classList.contains('collapsed');
                        const subItems = document.querySelectorAll(\`[data-parent="\${directory.dataset.path}"]\`);

                        if (isCollapsed) {
                            // Expand
                            subItems.forEach(item => item.style.display = 'list-item');
                            directory.classList.remove('collapsed');
                            directory.classList.add('expanded');
                        } else {
                            // Collapse
                            subItems.forEach(item => item.style.display = 'none');
                            directory.classList.remove('expanded');
                            directory.classList.add('collapsed');
                        }
                    });
                });
                // Event listener for pressing "Enter" key
                document.getElementById('userInput').addEventListener('keydown', (event) => {
                    if (event.key === 'Enter') {
                        event.preventDefault(); // Prevent the default action of adding a new line in the textarea
                        const input = document.getElementById('userInput').value;
                    vscode.postMessage({
                        command: 'analyze',
                        text: input
                    });
                    }
                });
            </script>
        </body>
        </html>
    `;
}

async function processProjectFolder(projectPath: string, userMessage: string) {
    const { exec } = require('child_process');

    exec('python C:\\Users\\uc201\\FileGuide\\fileguide\\src\\analizeProject.py "${projectPath}" "${userMessage}"', (error: Error | null, stdout: string, stderr: string) => {
        if (error) {
          console.error(`Error: ${error.message}`);
          return;
        }
        if (stderr) {
          console.error(`stderr: ${stderr}`);
          return;
        }
        console.log(`stdout: ${stdout}`);
      });
}

async function generateFileTree(dir: string, level = 0): Promise<string[]> {
    let files: string[] = [];
    const items = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const item of items) {
        if (item.isDirectory()) {
            // Load the directory name, but collapse its contents by default
            const dirPath = path.join(dir, item.name);
            const subFiles = await generateFileTree(dirPath, level + 1); // Recursively load sub-files
            files.push(`<ul>${subFiles.join('')}</ul>`); // Wrap sub-files in an unordered list
            files.push(`<li class="directory collapsed" data-path="${dirPath}">${item.name}/</li>`);
        } else {
            // Add files at the current level
            files.push(`<li class="file">${item.name}</li>`);
        }
    }
    return files;
}

export function deactivate() { }
