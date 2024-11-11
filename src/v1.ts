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

                        processProjectFolder(currentProjectPath, 10, message.text);


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

async function processProjectFolder(projectPath: string, batchSize: number = 10, userMessage: string) {
    const fileData: Array<{ content: string, embed: number[] , score: number}> = [];
    const { CohereClient } = require('cohere-ai');
    const cohere = new CohereClient({
        token: 'w4Ud6rr4TcEDEBTEP7OoS6VAWjStj5wCCVsXJxAV',
    });

    function traverseDirectory(directory: string) {
        const entries = fs.readdirSync(directory, { withFileTypes: true });
        entries.forEach(entry => {
            const fullPath = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                traverseDirectory(fullPath);  // Recursively traverse subdirectories
            } else {
                const fileDetails = extractFileDetails(fullPath);
                fileData.push({ content: fileDetails, embed: [], score: 0});
            }
        });
    }

    function getFileLanguage(filePath: string): string {
        const extension = path.extname(filePath);
        switch (extension) {
            case '.js': return 'JavaScript';
            case '.ts': return 'TypeScript';
            case '.py': return 'Python';
            case '.java': return 'Java';
            case '.cpp': return 'C++';
            case '.rb': return 'Ruby';
            // NEED MORE CASES
            default: return 'Unknown';
        }
    }

    function extractFileDetails(filePath: string): string {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const language = getFileLanguage(filePath);

        let details;
        switch (language) {
            case 'JavaScript':
            case 'TypeScript':
                //details = extractJSDetails(fileContent, filePath);
                break;
            case 'Python':
                details = extractPythonDetails(fileContent, filePath);
                //console.log(details);
                break;
            // ADDITIONAL CASES FOR OTHER LANGUAGES
            default:
                details = `Path: ${filePath}, Language: ${language}, Message: Language not supported for detailed extraction`;
        }

        return typeof details === 'string' ? details : formatFileDetails(details);
    }

    function formatFileDetails(details?: {
        filePath: string;
        language: string;
        imports: string[];
        functions: Array<{ name: string; params: string; comments: string[] }>;
        classes: Array<{ name: string; comments: string[] }>;
        exports: string[];
        fileStructureSummary: string;
    }): string {
        if (!details) {
            return 'File details are unavailable';
        }

        /*console.log(`
    Path: ${details.filePath}, Language: ${details.language}
    
    File Structure Summary:
    ${details.fileStructureSummary}
    
    Imports:
    ${details.imports.join(', ')}
    
    Functions:
    ${details.functions.map(func => `Name: ${func.name}, Params: (${func.params}), Comments: ${func.comments.join(' ')}`).join('\n')}
    
    Classes:
    ${details.classes.map(cls => `Name: ${cls.name}, Comments: ${cls.comments.join(' ')}`).join('\n')}
    
    Variables:
    ${details.exports.join(', ')}
    `.trim());*/

        return `
    Path: ${details.filePath}, Language: ${details.language}
    
    File Structure Summary:
    ${details.fileStructureSummary}
    
    Imports:
    ${details.imports.join(', ')}
    
    Functions:
    ${details.functions.map(func => `Name: ${func.name}, Params: (${func.params}), Comments: ${func.comments.join(' ')}`).join('\n')}
    
    Classes:
    ${details.classes.map(cls => `Name: ${cls.name}, Comments: ${cls.comments.join(' ')}`).join('\n')}
    
    Variables:
    ${details.exports.join(', ')}
    `.trim();
    }

    





    function extractPythonDetails(fileContent: string, filePath: string) {
        const fileSize = Buffer.byteLength(fileContent, 'utf-8');

        // Extract imports
        const imports = fileContent.match(/(?:import|from)\s+\w+/g) || [];

        // Update to capture all functions (any line starting with `def`)
        const functions = Array.from(
            fileContent.matchAll(/def\s+(\w+)\s*\(([^)]*)\)\s*(?:->\s*\w+)?\s*:\s*((?:"""[\s\S]*?"""|'''\s*[\s\S]*?'''|#.*(?:\n#.*)*)?)/g)
        ).map(match => ({
            name: match[1],
            params: match[2],
            comments: Array.from(new Set((match[3]?.match(/(""".*?"""|'''.*?'''|#.*(?:\n#.*)*)/s) || []).map(comment => comment.trim())))
        }));





        // Extract classes with comments
        const classes = Array.from(
            fileContent.matchAll(/class\s+(\w+)\s*(?:\(\w+\))?:\s*([\s\S]*?(?=\bclass\b|\bdef\b|\Z))/g)
        ).map(match => ({
            name: match[1],
            comments: (match[2].match(/""".*?"""|'''.*?'''|#.*(?:\n#.*)*/s) || [])
                .map(comment => comment.trim())
        }));

        // Extract exports
        const exports = fileContent.match(/^\s*\w+\s*=\s*.+/gm) || [];

        // File structure summary
        const fileStructureSummary = `
        Imports: ${imports.length} items
        Classes: ${classes.length} items
        Functions: ${functions.length} items
        Exports: ${exports.length} items
        FileSize: ${fileSize} bytes
        `;

        return {
            filePath,
            language: 'Python',
            imports: imports,
            functions: functions,
            classes: classes,
            exports: exports,
            fileStructureSummary: fileStructureSummary.trim()
        };
    }

    function cosineSimilarity(a: number[], b: number[]): number {
        const dotProduct = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
        const magnitudeA = Math.sqrt(a.reduce((sum, ai) => sum + ai ** 2, 0));
        const magnitudeB = Math.sqrt(b.reduce((sum, bi) => sum + bi ** 2, 0));
    
        return dotProduct / (magnitudeA * magnitudeB);
    }


    // NEED MORE SPECIFIC LANGUAGE DETAIL FUNCTIONS

    // Collect relevant data from project files
    traverseDirectory(projectPath);

    //console.log(fileData[0].content);


    console.log(userMessage);

    const embed_userTask = await cohere.v2.embed({
        texts: [userMessage],
        model: 'embed-english-v3.0',
        inputType: 'classification',
        embeddingTypes: ['float'],
    });


    for (let i = 0; i < fileData.length; i += batchSize) {
        const batch: string[] = [];

        for (let j = i; j < i+batchSize && j < fileData.length; j++){

            batch.push(fileData[j].content);
        }

        
        const embed = await cohere.v2.embed({
            texts: batch,
            model: 'embed-english-v3.0',
            inputType: 'classification',
            embeddingTypes: ['float'],
        });

        for (let j = i, k = 0; j < i+batchSize && j < fileData.length; j++, k++){
            fileData[j].embed = embed.embeddings.float[k];
            //console.log(fileData[j].embed);
            fileData[j].score = cosineSimilarity(embed_userTask.embeddings.float[0], fileData[j].embed);
            console.log(fileData[j].content);
            console.log(fileData[j].score);
        }

    }


    

    
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

    // Reverse the files array to change the order
    return files;
}



export function deactivate() { }
