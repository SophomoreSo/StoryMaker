// Define the StoryNode class at the top of the script
class StoryNode {
    constructor(title) {
        this.title = title;
        this.children = [];
        this.current = false;  // Attribute to track the current node
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
            nodeData.current = true;  // Only include 'current' if it's true
        }

        return nodeData;
    }

    static fromJSON(json) {
        const node = new StoryNode(json.title);
        node.current = json.current || false;
        node.children = json.children.map(childJson => StoryNode.fromJSON(childJson));
        return node;
    }
}class StoryWriter {
    constructor() {
        this.storyNodes = [];
        this.currentParent = null;
        this.nodeCounter = 0;
        this.nodesSinceLastSave = 0;
        this.unsavedChanges = false; // Track if there are unsaved changes
        this.commands = ["/new", "/load", "/save", "/delete", "/getparent"];
        this.singleHint = null;
        this.messageTimeout = null; // To track message timeout
        this.currentMessage = null; // To track the current message element
    }

    createNewStory() {
        if (this.unsavedChanges && !this.confirmDiscardChanges()) {
            return;
        }
        this.storyNodes = [];
        this.currentParent = new StoryNode("Root");
        this.currentParent.markCurrent();
        this.storyNodes.push(this.currentParent);
        this.unsavedChanges = false;
        this.renderStory();
        this.focusInput();
    }

    loadStory() {
        if (this.unsavedChanges && !this.confirmDiscardChanges()) {
            return;
        }
        this.showLoadModal();
    }

    addNode(text) {
        const newNode = new StoryNode(text);
        this.currentParent.children.push(newNode);
        this.nodeCounter++;
        this.nodesSinceLastSave++;
        this.unsavedChanges = true; // Mark changes as unsaved
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
                this.loadStory();
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
            case '/getparent':
                this.getAncestryAndCopyToClipboard();
                this.showMessage("Ancestry copied to clipboard!");
                break;
            default:
                this.showMessage(`Unknown command: ${command}`, true);
        }

        this.focusInput();
    }

    deleteNode(index) {
        if (index >= 0 && index < this.currentParent.children.length) {
            const deletedNode = this.currentParent.children.splice(index, 1)[0];
            this.unsavedChanges = true; // Mark changes as unsaved
            this.renderStory();
        } else {
            this.showMessage("Invalid index. Please enter a valid number.", true);
        }
        this.focusInput();
    }

    saveStory() {
        const json = JSON.stringify(this.storyNodes[0], null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'story.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.unsavedChanges = false; // Mark changes as saved
        this.focusInput();
    }

    loadStoryFromJSON(json) {
        const rootNode = StoryNode.fromJSON(JSON.parse(json));
        this.storyNodes = [rootNode];
        this.currentParent = this.findCurrentNode(rootNode);
        this.unsavedChanges = false; // Assume loaded story is the current state
        this.renderStory();
        this.focusInput();
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
            event.stopPropagation();  // Prevent the event from bubbling up to the dropArea
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
    
        dropArea.appendChild(closeButton); // Append close button to dropArea
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

    getAncestryAndCopyToClipboard() {
        const ancestry = this.getAncestry(this.currentParent);
        navigator.clipboard.writeText(ancestry).then(() => {
            this.showMessage("Ancestry copied to clipboard!");
        });
        this.focusInput();
    }

    moveToNode(index) {
        if (index === 0) {
            const parent = this.findParent(this.currentParent);
            if (parent) {
                this.currentParent.removeCurrent();
                this.currentParent = parent;
                this.currentParent.markCurrent();
                this.renderStory();
                this.showMessage("Moved to parent node.");
            } else {
                this.showMessage("This is the root node, cannot move to a parent.", true);
            }
        } else if (index > 0 && index <= this.currentParent.children.length) {
            this.currentParent.removeCurrent();
            this.currentParent = this.currentParent.children[index - 1]; // Adjusting for 0-based index
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
            ancestry.unshift(current.getTitle());
            current = this.findParent(current);
        }
        return ancestry.join(' → ');
    }

    findParent(child) {
        for (const node of this.storyNodes) {
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
        const ancestryElement = document.createElement('div');
        ancestryElement.textContent = "Ancestry: " + ancestry;
        ancestryContainer.appendChild(ancestryElement);

        const storyContainer = document.getElementById('storyContainer');
        storyContainer.innerHTML = '';
        this.renderChildren(this.currentParent, storyContainer);
    }

    renderChildren(node, container) {
        node.children.forEach((child, index) => {
            const nodeElement = document.createElement('div');
            nodeElement.className = 'story-node';
            if (child.current) {
                nodeElement.classList.add('current');
            }
            nodeElement.textContent = `${index + 1}. ${child.getTitle()}`;
            container.appendChild(nodeElement);
        });
    }

    updateHints(inputValue) {
        const hintContainer = document.getElementById('hintContainer');
        hintContainer.innerHTML = '';

        const parts = inputValue.split(" ");
        const commandPart = parts[0];  // First part of the command

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
        // Remove the current message if it exists
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

        this.currentMessage = messageContainer; // Track the current message

        this.messageTimeout = setTimeout(() => {
            messageContainer.remove();
            this.currentMessage = null; // Clear the reference after removal
        }, 3000); // Message disappears after 3 seconds
    }
}

// Initialize the StoryWriter instance and ensure focus on input
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
        document.getElementById('hintContainer').innerHTML = '';  // Clear hints after executing the command
    } else if (event.key === 'Tab' && storyWriter.singleHint) {
        event.preventDefault(); // Prevent the default tab behavior
        document.getElementById('nodeInput').value = storyWriter.singleHint;
        storyWriter.updateHints(storyWriter.singleHint); // Update hints to reflect the new state
    }
    storyWriter.focusInput();  // Ensure input is focused
});

// Focus the input when the page loads
window.onload = function() {
    storyWriter.focusInput();
};
