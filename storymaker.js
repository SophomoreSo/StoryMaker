class StoryNode {
    constructor(title) {
        this.title = title;
        this.children = [];
        this.current = false;
    }

    markCurrent() {
        this.current = true;
    }

    removeCurrent() {
        this.current = false;
    }

    getTitle() {
        return this.title;
    }

    toJSON() {
        const nodeData = {
            title: this.title,
            children: this.children.map(child => child.toJSON())
        };

        if (this.current) {
            nodeData.current = true;
        }

        return nodeData;
    }

    static fromJSON(json) {
        const node = new StoryNode(json.title);
        node.current = json.current || false;
        node.children = json.children.map(childJson => StoryNode.fromJSON(childJson));
        return node;
    }
}

class StoryWriter {
    constructor() {
        this.chapters = [];
        this.currentChapterIndex = null;
        this.currentParent = null;
        this.nodeCounter = 0;
        this.nodesSinceLastSave = 0;
        this.unsavedChanges = false;
        this.commands = ["/new", "/load", "/save", "/delete", "/recent", "/getparent", "/exit", "/chapteradd", "/brainstorm", "/previousnode"];
        this.singleHint = null;
        this.messageTimeout = null;
        this.currentMessage = null;
        this.nodeHistory = [];
        this.historyLimit = 10;

        this.initTitleEdit();
    }
    initTitleEdit() {
        const storyTitleElement = document.getElementById('storyTitle');

        storyTitleElement.addEventListener('click', () => {
            const inputField = document.createElement('input');
            inputField.type = 'text';
            inputField.value = this.storyTitle;
            inputField.id = 'titleInput';
            inputField.classList.add('title-edit-input');

            inputField.addEventListener('blur', () => {
                this.saveNewTitle(inputField.value);
            });

            inputField.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    this.saveNewTitle(inputField.value);
                } else if (event.key === 'Escape') {
                    this.renderTitle(); // Cancel the edit
                }
            });

            storyTitleElement.replaceWith(inputField);
            inputField.focus();
        });
    }

    // Save the new title
    saveNewTitle(newTitle) {
        this.storyTitle = newTitle;
        this.unsavedChanges = true; // Mark as unsaved changes
        this.renderTitle();
    }

    renderTitle() {
        const titleInput = document.getElementById('titleInput'); // Check for the input field (during editing)
        const titleElement = document.getElementById('storyTitle'); // Check for the current title element (not editing)
    
        // Create a new h1 element for the title
        const newTitleElement = document.createElement('h1');
        newTitleElement.id = 'storyTitle';
        newTitleElement.textContent = this.storyTitle;
    
        // Replace the appropriate element (input if it's being edited, title if it's displayed)
        if (titleInput) {
            titleInput.replaceWith(newTitleElement); // If we're in edit mode, replace the input
        } else if (titleElement) {
            titleElement.replaceWith(newTitleElement); // Otherwise, replace the existing title element
        }
    
        // Re-initialize the click event for editing
        this.initTitleEdit();
    }
    

    addNode(text) {
        if (!this.currentParent) {
            this.showMessage("No chapter selected.", true);
            return;
        }

        const newNode = new StoryNode(text);
        this.currentParent.children.push(newNode);
        this.nodeCounter++;
        this.nodesSinceLastSave++;
        this.unsavedChanges = true;
        this.renderStory();
        this.focusInput();
    }

    executeCommand(command) {
        const commandParts = command.split(" ");
        const baseCommand = commandParts[0];
        
        switch (baseCommand) {
            case '/new':
                this.createNewStory();
                this.showMessage("New story created!");
                break;
            case '/load':
                this.showLoadModal();
                break;
            case '/save':
                this.saveStory();
                this.showMessage("Story saved!");
                break;
            case '/delete':
                if (commandParts.length === 2) {
                    const index = parseInt(commandParts[1], 10);
                    if (!isNaN(index)) {
                        this.deleteNode(index - 1);
                        this.showMessage(`Node ${index} deleted!`);
                    } else {
                        this.showMessage("Invalid delete command. Usage: /delete [number]", true);
                    }
                } else {
                    this.showMessage("Invalid delete command. Usage: /delete [number]", true);
                }
                break;
            case '/chapteradd':
                this.addChapter();
                this.showMessage("New chapter added!");
                break;
            case '/recent':
                this.moveToCurrent();
                break;
            case '/previousnode':
                this.moveToPreviousNode();
                break;
            case '/getparent':
                this.getAncestryAndCopyToClipboard();
                this.showMessage("Ancestry copied to clipboard!");
                break;
            case '/brainstorm':
                this.copyChildrenToClipboard();
                this.showMessage("Brainstorm list copied to clipboard!");
                break;
            case '/exit':
                if (this.unsavedChanges && !this.confirmDiscardChanges()) {
                    return;
                }
                this.showMessage("Exit command not implemented in this interface.", true);
                break;
            default:
                this.showMessage(`Unknown command: ${command}`, true);
        }

        this.focusInput();
    }

    createNewStory() {
        if (this.unsavedChanges && !this.confirmDiscardChanges()) {
            return;
        }

        this.chapters = [];
        this.currentChapterIndex = null;
        this.currentParent = null;

        this.addChapter();
        this.selectChapter(0);

        this.unsavedChanges = false;
        this.renderStory();
        this.renderChapters();
        this.focusInput();
        this.showMessage("New story created with one default chapter.");
    }

    addChapter() {
        const newRootNode = new StoryNode(`Chapter`);
        this.chapters.push(newRootNode);
        this.renderChapters();
    }

    selectChapter(index) {
        if (index >= 0 && index < this.chapters.length) {
            this.currentChapterIndex = index;
            this.currentParent = this.chapters[index];
            this.renderStory();
            this.showMessage(`Chapter ${index + 1} loaded.`);
        }
    }

    deleteChapter(index) {
        const confirmDelete = confirm("Are you sure you want to delete this chapter?");
        if (!confirmDelete) {
            return;
        }

        if (index >= 0 && index < this.chapters.length) {
            this.chapters.splice(index, 1);

            if (this.currentChapterIndex >= this.chapters.length) {
                this.currentChapterIndex = this.chapters.length - 1;
            }

            if (this.currentChapterIndex >= 0) {
                this.selectChapter(this.currentChapterIndex);
            } else {
                this.currentParent = null;
                this.renderStory();
            }

            this.renderChapters();
            this.showMessage(`Chapter ${index + 1} deleted.`);
        }
    }

    renameChapter(index, newName) {
        if (index >= 0 && index < this.chapters.length) {
            this.chapters[index].title = newName;
            this.renderChapters();
            this.showMessage(`Chapter ${index + 1} renamed to "${newName}".`);
        }
    }

    swapChapters(fromIndex, toIndex) {
        if (fromIndex >= 0 && toIndex >= 0 && fromIndex < this.chapters.length && toIndex < this.chapters.length) {
            const temp = this.chapters[fromIndex];
            this.chapters[fromIndex] = this.chapters[toIndex];
            this.chapters[toIndex] = temp;

            if (this.currentChapterIndex === fromIndex) {
                this.currentChapterIndex = toIndex;
            } else if (this.currentChapterIndex === toIndex) {
                this.currentChapterIndex = fromIndex;
            }

            this.renderChapters();
            this.renderStory();
        }
    }

    renderChapters() {
        const chapterContainer = document.getElementById('chapterContainer');
        chapterContainer.innerHTML = '';
    
        this.chapters.forEach((chapter, index) => {
            const chapterDiv = document.createElement('div');
            chapterDiv.className = 'chapter';
            chapterDiv.draggable = true;
    
            const dragHandle = document.createElement('span');
            dragHandle.className = 'drag-handle';
            dragHandle.textContent = '☰';
    
            const editIcon = document.createElement('img');
            editIcon.src = 'edit.png';
            editIcon.className = 'edit-icon';
            editIcon.addEventListener('click', (event) => {
                event.stopPropagation();
                this.showRenameInput(index);
            });
    
            const chapterTitle = document.createElement('span');
            chapterTitle.textContent = `${index + 1}. ${chapter.title}`;
            chapterTitle.addEventListener('click', () => this.selectChapter(index));
    
            const deleteButton = document.createElement('button');
            deleteButton.className = 'delete-chapter';
            deleteButton.textContent = 'x';
            deleteButton.addEventListener('click', (event) => {
                event.stopPropagation();
                this.deleteChapter(index);
            });
    
            chapterDiv.appendChild(dragHandle);
            chapterDiv.appendChild(editIcon);
            chapterDiv.appendChild(chapterTitle);
            chapterDiv.appendChild(deleteButton);
    
            chapterDiv.addEventListener('dragstart', (event) => {
                event.dataTransfer.setData('text/plain', index);
            });
    
            chapterDiv.addEventListener('dragover', (event) => {
                event.preventDefault();
                chapterDiv.style.backgroundColor = '#f0f0f0'; 
            });
    
            chapterDiv.addEventListener('dragleave', () => {
                chapterDiv.style.backgroundColor = ''; 
            });
    
            chapterDiv.addEventListener('drop', (event) => {
                event.preventDefault();
                const fromIndex = event.dataTransfer.getData('text/plain');
                this.swapChapters(parseInt(fromIndex), index);
                chapterDiv.style.backgroundColor = ''; 
            });
    
            // The DragDropTouch polyfill will handle the touch events, no need for manual touch event handlers.
    
            chapterContainer.appendChild(chapterDiv);
        });
    }
    

    copyChildrenToClipboard() {
        if (!this.currentParent || this.currentParent.children.length === 0) {
            this.showMessage("No children to copy.", true);
            return;
        }

        let textToCopy = this.currentParent.children.map((child, index) => `${index + 1}. ${child.getTitle()}`).join("\n");

        navigator.clipboard.writeText(textToCopy).then(() => {
            this.showMessage("Brainstorm list copied to clipboard!");
        }).catch(err => {
            this.showMessage("Failed to copy brainstorm list.", true);
        });
    }

    showRenameInput(index) {
        const chapterContainer = document.getElementById('chapterContainer');
        const chapterDiv = chapterContainer.children[index];

        const inputField = document.createElement('input');
        inputField.type = 'text';
        inputField.value = this.chapters[index].title;

        inputField.addEventListener('blur', () => {
            this.renameChapter(index, inputField.value);
        });

        inputField.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                this.renameChapter(index, inputField.value);
            } else if (event.key === 'Escape') {
                this.renderChapters();
            }
        });

        chapterDiv.innerHTML = '';
        chapterDiv.appendChild(inputField);
        inputField.focus();
    }

    deleteNode(index) {
        if (index >= 0 && index < this.currentParent.children.length) {
            const deletedNode = this.currentParent.children.splice(index, 1)[0];
            this.unsavedChanges = true;

            // Remove the deleted node from nodeHistory
            this.nodeHistory = this.nodeHistory.filter(node => node !== deletedNode);

            this.renderStory();
            this.showMessage(`Node ${index + 1} deleted.`);
        } else {
            this.showMessage("Invalid index. Please enter a valid number.", true);
        }
        this.focusInput();
    }

    saveStory() {
        const storyData = {
            title: this.storyTitle,
            chapters: this.chapters.map(chapter => chapter.toJSON()) // Assuming chapters are serialized this way
        };

        const json = JSON.stringify(storyData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'story.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.unsavedChanges = false;
    }

    loadStoryFromJSON(json) {
        try {
            const data = JSON.parse(json); // Parse the JSON
    
            // Extract the story title and chapters
            this.storyTitle = data.title || "Untitled Story";
            this.chapters = data.chapters.map(chapterJson => StoryNode.fromJSON(chapterJson));

            //print the data
            console.log(data);
            console.log(this.storyTitle);
            console.log(this.chapters);
    
            // Render the title and the first chapter (if any chapters exist)
            this.renderTitle();
            

            if (this.chapters.length > 0) {
                this.selectChapter(0); // Select the first chapter by default
            }
    
            this.unsavedChanges = false;
            this.renderChapters();
            this.renderStory();
            this.focusInput();
    
            this.showMessage("Story loaded successfully!");
        } catch (error) {
            this.showMessage("Failed to load story: Invalid JSON format.", true);
        }
    }
    
    

    confirmDiscardChanges() {
        return confirm("You have unsaved changes. Do you want to proceed without saving?");
    }

    findCurrentNode(node) {
        if (node.current) {
            return node;
        }
        for (let child of node.children) {
            const currentNode = this.findCurrentNode(child);
            if (currentNode) {
                return currentNode;
            }
        }
        return null;
    }

    showLoadModal() {
        const modal = document.createElement('div');
        modal.id = 'loadModal';
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100%';
        modal.style.height = '100%';
        modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        modal.style.display = 'flex';
        modal.style.justifyContent = 'center';
        modal.style.alignItems = 'center';
        modal.style.zIndex = '1000';

        const dropArea = document.createElement('div');
        dropArea.style.width = '300px';
        dropArea.style.height = '200px';
        dropArea.style.backgroundColor = '#fff';
        dropArea.style.borderRadius = '10px';
        dropArea.style.display = 'flex';
        dropArea.style.flexDirection = 'column';
        dropArea.style.justifyContent = 'center';
        dropArea.style.alignItems = 'center';
        dropArea.style.border = '2px dashed #ccc';
        dropArea.style.position = 'relative';
        dropArea.textContent = 'Drag & Drop JSON file here or click to upload';
        dropArea.style.textAlign = 'center';
        dropArea.style.padding = '10px';
        dropArea.style.cursor = 'pointer';

        const closeButton = document.createElement('button');
        closeButton.textContent = 'x';
        closeButton.style.position = 'absolute';
        closeButton.style.top = '10px';
        closeButton.style.right = '10px';
        closeButton.style.backgroundColor = 'transparent';
        closeButton.style.border = 'none';
        closeButton.style.fontSize = '20px';
        closeButton.style.cursor = 'pointer';
        closeButton.style.color = '#888';
        closeButton.addEventListener('click', (event) => {
            event.stopPropagation();
            document.body.removeChild(modal);
        });

        dropArea.addEventListener('dragover', (event) => {
            event.preventDefault();
            dropArea.style.borderColor = '#4CAF50';
        });

        dropArea.addEventListener('dragleave', () => {
            dropArea.style.borderColor = '#ccc';
        });

        dropArea.addEventListener('drop', (event) => {
            event.preventDefault();
            dropArea.style.borderColor = '#ccc';
            const file = event.dataTransfer.files[0];
            this.handleFile(file);
            document.body.removeChild(modal);
        });

        dropArea.addEventListener('click', () => {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'application/json';
            fileInput.style.display = 'none';
            fileInput.addEventListener('change', (event) => {
                const file = event.target.files[0];
                this.handleFile(file);
                document.body.removeChild(modal);
            });
            document.body.appendChild(fileInput);
            fileInput.click();
            document.body.removeChild(fileInput);
        });

        dropArea.appendChild(closeButton);
        modal.appendChild(dropArea);
        document.body.appendChild(modal);
    }

    handleFile(file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                this.loadStoryFromJSON(event.target.result);
                this.showMessage("Story loaded!");
            } catch (error) {
                this.showMessage('Failed to load story: Invalid JSON file.', true);
            }
        };
        reader.readAsText(file);
    }

    moveToCurrent() {
        this.showMessage("Move to current feature not implemented yet.", true);
        this.focusInput();
    }

    getAncestryAndCopyToClipboard() {
        const ancestry = this.getAncestry(this.currentParent);
        navigator.clipboard.writeText(ancestry).then(() => {
            this.showMessage("Ancestry copied to clipboard!");
        });
        this.focusInput();
    }

    pushToHistory() {
        if (this.currentParent) {
            this.nodeHistory.push(this.currentParent);

            if (this.nodeHistory.length > this.historyLimit) {
                this.nodeHistory.shift();
            }
        }
    }

    moveToNodeByReference(node) {
        if (node) {
            this.pushToHistory();
            this.currentParent = node;
            this.renderStory();
            this.showMessage(`Moved to node: ${node.getTitle()}`);
        } else {
            this.showMessage("Invalid node reference.", true);
        }
    }

    moveToPreviousNode() {
        while (this.nodeHistory.length > 0) {
            const previousNode = this.nodeHistory.pop();

            // Check if the node still exists (i.e., it hasn't been deleted)
            if (this.isNodeValid(previousNode)) {
                this.currentParent = previousNode;
                this.renderStory();
                this.showMessage(`Moved to previous node: ${previousNode.getTitle()}`);
                return;
            }
        }

        this.showMessage("No previous valid node to go back to.", true);
    }

    isNodeValid(node) {
        if (!node) return false;

        // Check if the node is still part of its parent's children
        const parent = this.findParent(node);
        if (parent && parent.children.includes(node)) {
            return true;
        }
        return false;
    }


    // Example method for moving to a new node (push the current node to history)
    moveToNode(index) {
        if (index === 0) {
            const parent = this.findParent(this.currentParent);
            if (parent) {
                this.pushToHistory(); // Save current node before moving to parent
                this.currentParent.removeCurrent();
                this.currentParent = parent;
                this.currentParent.markCurrent();
                this.renderStory();
                this.showMessage("Moved to parent node.");
            } else {
                this.showMessage("This is the root node, cannot move to a parent.", true);
            }
        } else if (index > 0 && index <= this.currentParent.children.length) {
            this.pushToHistory(); // Save current node before moving
            this.currentParent.removeCurrent();
            this.currentParent = this.currentParent.children[index - 1];
            this.currentParent.markCurrent();
            this.renderStory();
            this.showMessage(`Moved to node ${index}.`);
        } else {
            this.showMessage("Invalid node number.", true);
        }
        this.focusInput();
    }


    getAncestry(node) {
        const ancestry = [];
        let current = node;
        while (current) {
            ancestry.unshift(current);
            current = this.findParent(current);
        }
        return ancestry;
    }

    findParent(child) {
        for (const node of this.chapters) {
            if (node.children.includes(child)) {
                return node;
            }
            const parent = this.findParentRecursive(node, child);
            if (parent) return parent;
        }
        return null;
    }

    findParentRecursive(parent, child) {
        if (parent.children.includes(child)) {
            return parent;
        }
        for (const node of parent.children) {
            const result = this.findParentRecursive(node, child);
            if (result) return result;
        }
        return null;
    }

    renderStory() {
        const ancestryContainer = document.getElementById('ancestryContainer');
        ancestryContainer.innerHTML = '';
        
        const ancestry = this.getAncestry(this.currentParent);
        ancestry.forEach((node, index) => {
            const ancestryElement = document.createElement('span');
            ancestryElement.textContent = node.getTitle();
            ancestryElement.style.cursor = 'pointer';
            ancestryElement.addEventListener('click', () => this.moveToNodeByReference(node));

            ancestryContainer.appendChild(ancestryElement);
            if (index < ancestry.length - 1) {
                const separator = document.createElement('span');
                separator.textContent = ' → ';
                ancestryContainer.appendChild(separator);
            }
        });

        const storyContainer = document.getElementById('storyContainer');
        storyContainer.innerHTML = '';
        this.renderChildren(this.currentParent, storyContainer);
    }


    renderChildren(node, container) {
        if (!node) return;

        node.children.forEach((child, index) => {
            const nodeElement = document.createElement('div');
            nodeElement.className = 'story-node';
            nodeElement.textContent = `${index + 1}. ${child.getTitle()}`;
            nodeElement.style.cursor = 'pointer';

            nodeElement.addEventListener('click', () => {
                this.pushToHistory();
                this.currentParent = child;
                this.renderStory();
                this.showMessage(`Moved to node: ${child.getTitle()}`);
            });

            container.appendChild(nodeElement);
        });
    }

    updateHints(inputValue) {
        const hintContainer = document.getElementById('hintContainer');
        hintContainer.innerHTML = '';

        const parts = inputValue.split(" ");
        const commandPart = parts[0];

        if (commandPart.startsWith("/")) {
            const matchingCommands = this.commands
                .filter(cmd => cmd.startsWith(commandPart))
                .slice(0, 5);
            if (matchingCommands.length === 1) {
                this.singleHint = matchingCommands[0] + (parts.length > 1 ? " " + parts.slice(1).join(" ") : "");
            } else {
                this.singleHint = null;
            }
            matchingCommands.forEach(cmd => {
                const hintElement = document.createElement('div');
                hintElement.textContent = cmd + (parts.length > 1 ? " " + parts.slice(1).join(" ") : "");
                hintContainer.appendChild(hintElement);
            });
        } else {
            this.singleHint = null;
        }
    }

    focusInput() {
        document.getElementById('nodeInput').focus();
    }

    showMessage(message, isError = false) {
        if (this.currentMessage) {
            this.currentMessage.remove();
            clearTimeout(this.messageTimeout);
        }
        const messageContainer = document.createElement('div');
        messageContainer.className = 'message';
        messageContainer.textContent = message;
        if (isError) {
            messageContainer.style.backgroundColor = '#f8d7da';
            messageContainer.style.color = '#721c24';
        } else {
            messageContainer.style.backgroundColor = '#d4edda';
            messageContainer.style.color = '#155724';
        }
        document.body.appendChild(messageContainer);

        this.currentMessage = messageContainer;

        this.messageTimeout = setTimeout(() => {
            messageContainer.remove();
            this.currentMessage = null;
        }, 3000);
    }
}

const storyWriter = new StoryWriter();

document.getElementById('nodeInput').addEventListener('input', (event) => {
    const nodeInput = event.target.value.trim();
    storyWriter.updateHints(nodeInput);
});

document.getElementById('nodeInput').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        const nodeInput = document.getElementById('nodeInput');
        const inputValue = nodeInput.value.trim();

        if (inputValue.startsWith("/")) {
            if (storyWriter.singleHint) {
                storyWriter.executeCommand(storyWriter.singleHint);
            } else {
                storyWriter.executeCommand(inputValue);
            }
        } else if (!isNaN(inputValue)) {
            storyWriter.moveToNode(parseInt(inputValue, 10));
        } else if (inputValue !== "") {
            storyWriter.addNode(inputValue);
        }

        nodeInput.value = "";
        document.getElementById('hintContainer').innerHTML = '';
    } else if (event.key === 'Tab' && storyWriter.singleHint) {
        event.preventDefault();
        document.getElementById('nodeInput').value = storyWriter.singleHint;
        storyWriter.updateHints(storyWriter.singleHint);
    }
    storyWriter.focusInput();
});

document.getElementById('toggleSidebar').addEventListener('click', function () {
    const sidebar = document.getElementById('sidebar');

    if (sidebar.style.width === '0px') {
        sidebar.style.width = '230px';
        this.innerHTML = '&#10094;';
    } else {
        sidebar.style.width = '0px';
        this.innerHTML = '&#10095;';
    }
});

document.getElementById('addNode').addEventListener('click', () => {
    const nodeInput = document.getElementById('nodeInput');
    const inputValue = nodeInput.value.trim();

    if (inputValue.startsWith("/")) {
        storyWriter.executeCommand(inputValue);
    } else if (!isNaN(inputValue) && inputValue !== "") {
        storyWriter.moveToNode(parseInt(inputValue, 10));
    } else if (inputValue !== "") {
        storyWriter.addNode(inputValue);
    }
    nodeInput.value = "";
    document.getElementById('hintContainer').innerHTML = ''; 
});

document.getElementById('nodeInput').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        document.getElementById('addNode').click();
    }
});

window.onload = function() {
    storyWriter.focusInput();
};