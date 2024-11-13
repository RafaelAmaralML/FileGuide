import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    let currentProjectPath = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri.fsPath : '';

    let disposable = vscode.commands.registerCommand('fileguide.openCustomInput', () => {
        const panel = vscode.window.createWebviewPanel(
            'customInput',
            'Custom Input',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        panel.webview.html = getWebviewContent(currentProjectPath, []);

        panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'openFile':
                        console.log("OPEN FILE")
                        const document = await vscode.workspace.openTextDocument(message.path);
                        await vscode.window.showTextDocument(document);

                    case 'analyze':
                        const results = await processProjectFolder(currentProjectPath, message.text);

                        if (typeof results === 'string') {
                            // If results is a string, handle the custom message case
                            console.log("Custom Message:", results);
                            panel.webview.html = getWebviewContent(currentProjectPath, results);
                            panel.webview.postMessage({ command: 'processingComplete' });
                        } else {
                            // If results is an array, proceed with the file tree generation
                            console.log("here");
                            const tree = await generateFileTree(currentProjectPath, 0, results);
                            panel.webview.html = getWebviewContent(currentProjectPath, tree);
                            panel.webview.postMessage({ command: 'processingComplete' });
                        }
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

function getWebviewContent(currentProjectPath: string, fileTreeHTML: string | string[]) {
    const isSuggestion = typeof fileTreeHTML === 'string';
    const fileListHTML = isSuggestion ? "" : (fileTreeHTML as string[]).join('');

    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>File Guide</title>
            <style>
                body {
                    background-color: #1a1a1a;
                    color: #e0e0e0;
                    font-family: Arial, sans-serif;
                    padding: 20px;
                    text-align: center;
                }

                h1 {
                    font-size: 36px;
                    margin-bottom: 20px;
                    color: #e0e0e0;
                }

                textarea {
                    width: 80%;
                    height: 150px;
                    padding: 10px;
                    font-size: 16px;
                    border-radius: 10px;
                    border: 1px solid #666666;
                    background-color: #333333;
                    color: #e0e0e0;
                }

                button {
                    margin-top: 20px;
                    padding: 10px 20px;
                    font-size: 16px;
                    border-radius: 5px;
                    background-color: #4A90E2;
                    color: white;
                    border: none;
                    cursor: pointer;
                }

                button:hover {
                    background-color: #357ABD;
                }

                #fileTree {
                    width: 80%;
                    background-color: #333333;
                    border: 1px solid #666666;
                    padding: 15px;
                    margin: 20px auto;
                    text-align: left;
                }

                li {
                    color: #e0e0e0;
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
                <textarea id="userInput" placeholder="Enter task description here...">${isSuggestion ? fileTreeHTML : ''}</textarea>
                <br />
                <button id="submitButton">Submit</button>
                <div id="loadingIndicator" style="display: none; color: #4A90E2; margin-top: 10px;">Processing...</div>
                <div id="fileTree" style="${isSuggestion ? 'display:none;' : ''}">
                    <ul id="fileList">${fileListHTML}</ul>
                </div>

            <script>
                const vscode = acquireVsCodeApi();

                // Function to show the loading indicator
                function showLoadingIndicator() {
                    document.getElementById('loadingIndicator').style.display = 'block';
                }

                // Function to hide the loading indicator
                function hideLoadingIndicator() {
                    document.getElementById('loadingIndicator').style.display = 'none';
                }

                // Event listener for submit button
                document.getElementById('submitButton').addEventListener('click', () => {
                    const input = document.getElementById('userInput').value;
                    showLoadingIndicator();
                    vscode.postMessage({
                        command: 'analyze',
                        text: input
                    });
                });

                // Event listener for change project button
                document.getElementById('changeProjectButton').addEventListener('click', () => {
                    vscode.postMessage({
                        command: 'changeProject'
                    });
                });

                // Event listener for directory toggle
                document.querySelectorAll('li.directory').forEach(directory => {
                    directory.addEventListener('click', (event) => {
                        event.stopPropagation();
                        const isCollapsed = directory.classList.contains('collapsed');
                        const subItems = document.querySelectorAll(\`[data-parent="\${directory.dataset.path}"]\`);

                        if (isCollapsed) {
                            subItems.forEach(item => item.style.display = 'list-item');
                            directory.classList.remove('collapsed');
                            directory.classList.add('expanded');
                        } else {
                            subItems.forEach(item => item.style.display = 'none');
                            directory.classList.remove('expanded');
                            directory.classList.add('collapsed');
                        }
                    });
                });

                // Event listener for file click to open the file
                document.querySelectorAll('li.file').forEach(file => {
                    file.addEventListener('click', (event) => {
                        event.stopPropagation();
                        const filePath = file.getAttribute('data-path');
                        vscode.postMessage({
                            command: 'openFile',
                            path: filePath
                        });
                    });
                });

                // Event listener for pressing "Enter" key
                document.getElementById('userInput').addEventListener('keydown', (event) => {
                    if (event.key === 'Enter') {
                        event.preventDefault(); // Prevent the default action of adding a new line in the textarea
                        const input = document.getElementById('userInput').value;
                        showLoadingIndicator();
                        vscode.postMessage({
                            command: 'analyze',
                            text: input
                    });
                }});

                // Listen for messages from the extension to hide the loading indicator once processing is complete
                window.addEventListener('message', (event) => {
                    const message = event.data;
                    if (message.command === 'processingComplete') {
                        hideLoadingIndicator();
                    }
                });
            </script>
            </body>
            </html>
    `;
}

async function processProjectFolder(projectPath: string, userMessage: string): Promise<{ filePath: string; percentage: string }[] | string> {
    const { exec } = require('child_process');

    return new Promise((resolve, reject) => {
        const command = `python C:\\Users\\uc201\\FileGuide\\fileguide\\src\\analizeProjectV2.py "${projectPath}" "${userMessage}"`;

        exec(command, (error: Error | null, stdout: string, stderr: string) => {
            if (error) {
                console.error(`Error: ${error.message}`);
                reject(error);
                return;
            }
            if (stderr) {
                console.error(`stderr: ${stderr}`);

            }
            console.log(stdout);
            const lines = stdout.trim().split('\n').slice(3);
            const results: { filePath: string; percentage: string }[] = [];

            lines.forEach(line => {
                if (line.trim() === "The task does not seem to align with the project's context.") {
                    let customMessage = "The task does not seem to align with the project's context.\n" + lines[lines.indexOf(line) + 1] || '';
                    console.log(customMessage);
                    resolve(customMessage);
                    return;
                }
                const parts = line.split(' - ');
                if (parts.length === 2) {
                    const filePath = parts[0].trim();
                    const percentage = parts[1].trim();
                    results.push({ filePath, percentage });
                }
            });
            console.log(results);
            resolve(results);
        });
    });
}

async function generateFileTree(dir: string, level = 0, results: { filePath: string; percentage: string }[]): Promise<string[]> {
    let files: string[] = [];
    const items = await fs.promises.readdir(dir, { withFileTypes: true });

    // Helper function to check if a directory contains any file with a probability of change > 0
    async function directoryContainsChange(directory: string): Promise<boolean> {
        const subItems = await fs.promises.readdir(directory, { withFileTypes: true });
        for (const subItem of subItems) {
            const subItemPath = path.join(directory, subItem.name);
            if (subItem.isDirectory()) {
                if (await directoryContainsChange(subItemPath)) return true;
            } else if (results.some(res => res.filePath === subItemPath && parseFloat(res.percentage) > 0)) {
                return true;
            }
        }
        return false;
    }

    // Loop through the directory items
    for (const item of items) {
        const itemPath = path.join(dir, item.name);

        if (item.isDirectory()) {
            const shouldExpand = await directoryContainsChange(itemPath);

            if (shouldExpand) {
                files.push(`<li class="directory expanded" data-path="${itemPath}">${item.name}/</li>`);
                const subFiles = await generateFileTree(itemPath, level + 1, results);
                
                // Only add subFiles if there are relevant files or folders
                if (subFiles.length > 0) {
                    files.push(`<ul style="display:block">${subFiles.join('')}</ul>`);
                }
            }
        } else {
            // Only add files that have a non-zero probability
            const fileData = results.find(res => res.filePath === itemPath && parseFloat(res.percentage) > 0);
            if (fileData) {
                const label = `${item.name} (${fileData.percentage})`;
                files.push(`<li class="file change" data-path="${itemPath}">${label}</li>`);
            }
        }
    }
    return files;
}


export function deactivate() {}
