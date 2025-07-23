/**
 * Planning Poker Tool - P2P WebRTC Implementation
 * Features: Real-time P2P collaboration, fragment sharing fallback
 */

class PlanningPokerP2PApp {
    constructor() {
        this.currentUser = null;
        this.currentSession = null;
        this.isHost = false;
        this.participants = new Map();
        this.tasks = [];
        this.currentTaskId = null;
        this.votes = new Map();
        this.votingEnabled = false;
        this.votesRevealed = false;
        
        // Connection managers
        this.webrtcManager = null;
        this.fragmentManager = null;
        this.crossBrowserMessaging = null;
        this.connectionMode = 'none'; // 'cross-browser', 'fragment', 'none'
        
        this.init();
    }

    init() {
        this.initializeManagers();
        this.bindEvents();
        this.checkForSessionInURL();
    }

    initializeManagers() {
        // Initialize WebRTC manager
        this.webrtcManager = new WebRTCManager(
            (message) => this.handleP2PMessage(message),
            (peerId, state) => this.handleConnectionChange(peerId, state)
        );

        // Initialize fragment sharing manager
        this.fragmentManager = new FragmentSharingManager(
            (state) => this.handleFragmentStateUpdate(state)
        );
    }

    bindEvents() {
        // Session management
        document.getElementById('createSessionBtn').addEventListener('click', () => this.createSession());
        document.getElementById('joinSessionBtn').addEventListener('click', () => this.joinSession());
        document.getElementById('leaveSessionBtn').addEventListener('click', () => this.leaveSession());

        // Task management
        document.getElementById('addTaskBtn').addEventListener('click', () => this.showTaskModal());
        document.getElementById('saveTaskBtn').addEventListener('click', () => this.addTask());
        document.getElementById('cancelTaskBtn').addEventListener('click', () => this.hideTaskModal());
        document.getElementById('closeTaskModal').addEventListener('click', () => this.hideTaskModal());

        // Voting
        document.querySelectorAll('.card-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.vote(e.target.dataset.value));
        });
        document.getElementById('revealVotesBtn').addEventListener('click', () => this.revealVotes());
        document.getElementById('nextRoundBtn').addEventListener('click', () => this.nextRound());

        // Copy share URL button
        const shareBtn = document.getElementById('shareURLBtn');
        if (shareBtn) {
            shareBtn.addEventListener('click', () => this.copyShareURL());
        }

        // Modal close on background click
        document.getElementById('taskModal').addEventListener('click', (e) => {
            if (e.target.id === 'taskModal') {
                this.hideTaskModal();
            }
        });

        // Enter key handling
        document.getElementById('username').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.createSession();
        });
        document.getElementById('sessionId').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinSession();
        });
        document.getElementById('taskTitle').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addTask();
        });
    }

    checkForSessionInURL() {
        const hash = window.location.hash;
        
        if (hash.startsWith('#join=') || hash.startsWith('#state=')) {
            // Try to load from fragment sharing first
            const state = this.fragmentManager.loadFromCurrentURL();
            if (state) {
                this.connectionMode = 'fragment';
                document.getElementById('sessionId').value = state.sessionId;
                this.showAutoJoinPrompt(state);
                return;
            }
        } else if (hash.startsWith('#session-')) {
            // Legacy format - convert to session ID
            const sessionId = hash.replace('#session-', '');
            document.getElementById('sessionId').value = sessionId;
            this.showJoinPrompt();
            return;
        }
        
        // Check URL parameters as well (for ?session=ABC123 format)
        const urlParams = new URLSearchParams(window.location.search);
        const sessionParam = urlParams.get('session');
        if (sessionParam) {
            document.getElementById('sessionId').value = sessionParam;
            this.showJoinPrompt();
        }
    }

    showJoinPrompt() {
        // Auto-show the session panel if there's a session to join
        const sessionPanel = document.getElementById('sessionPanel');
        const joinSection = sessionPanel.querySelector('.join-session');
        if (joinSection) {
            joinSection.style.border = '2px solid var(--primary-color)';
            joinSection.style.backgroundColor = 'rgba(44, 90, 160, 0.05)';
            document.getElementById('username').focus();
        }
        
        // Show helpful message
        this.showJoinMessage('Enter your name to join this session');
    }
    
    showAutoJoinPrompt(sessionState) {
        // Enhanced auto-join for sessions with full state
        const sessionPanel = document.getElementById('sessionPanel');
        const joinSection = sessionPanel.querySelector('.join-session');
        if (joinSection) {
            joinSection.style.border = '2px solid var(--success-color)';
            joinSection.style.backgroundColor = 'rgba(16, 185, 129, 0.05)';
            document.getElementById('username').focus();
        }
        
        // Show session info
        const participantCount = sessionState.participants ? sessionState.participants.size : 0;
        const taskCount = sessionState.tasks ? sessionState.tasks.length : 0;
        
        this.showJoinMessage(
            `Found active session with ${participantCount} participant${participantCount !== 1 ? 's' : ''} and ${taskCount} task${taskCount !== 1 ? 's' : ''}. Enter your name to join!`
        );
    }
    
    showJoinMessage(message) {
        // Create or update join message element
        let messageEl = document.getElementById('joinMessage');
        if (!messageEl) {
            messageEl = document.createElement('div');
            messageEl.id = 'joinMessage';
            messageEl.className = 'join-message';
            
            const joinSection = document.querySelector('.join-session');
            if (joinSection) {
                joinSection.insertBefore(messageEl, joinSection.firstChild);
            }
        }
        
        messageEl.textContent = message;
        messageEl.style.display = 'block';
    }

    generateSessionId() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    generateUserId() {
        return 'user-' + Math.random().toString(36).substring(2, 9);
    }

    async createSession() {
        const username = document.getElementById('username').value.trim();
        if (!username) {
            alert('Please enter your name');
            return;
        }

        const sessionId = this.generateSessionId();
        const userId = this.generateUserId();
        
        this.currentUser = {
            id: userId,
            name: username,
            isHost: true
        };
        
        this.isHost = true;
        this.participants.set(userId, this.currentUser);
        
        this.currentSession = {
            id: sessionId,
            hostId: userId,
            createdAt: Date.now()
        };

        // Initialize cross-browser messaging
        this.crossBrowserMessaging = new CrossBrowserMessaging(
            sessionId,
            (message) => this.handleCrossBrowserMessage(message),
            (peerId, state) => this.handleConnectionChange(peerId, state)
        );
        
        const success = this.crossBrowserMessaging.initializeAsHost(userId);
        if (success) {
            this.connectionMode = 'cross-browser';
            console.log('Created cross-browser session:', sessionId);
        } else {
            // Fall back to fragment sharing
            this.connectionMode = 'fragment';
            const initialState = this.getSessionState();
            this.fragmentManager.createSession(sessionId, initialState);
            console.log('Fell back to fragment sharing');
        }
        
        this.showMainApp();
        this.broadcastMessage({
            type: 'user-joined',
            user: this.currentUser
        });
    }

    async joinSession() {
        const username = document.getElementById('username').value.trim();
        const sessionInput = document.getElementById('sessionId').value.trim();
        
        if (!username) {
            alert('Please enter your name');
            return;
        }

        let sessionId = sessionInput;
        let joinURL = null;

        // Handle different input formats
        if (sessionInput.includes('#')) {
            // Full URL provided
            joinURL = sessionInput;
            const state = this.fragmentManager.parseFragmentURL(joinURL);
            sessionId = state ? state.sessionId : null;
        } else if (sessionInput.length === 6) {
            // Just session ID provided
            sessionId = sessionInput;
        }

        if (!sessionId) {
            alert('Please enter a valid session ID or URL');
            return;
        }

        const userId = this.generateUserId();
        
        this.currentUser = {
            id: userId,
            name: username,
            isHost: false
        };
        
        this.isHost = false;
        this.currentSession = { id: sessionId };

        // Try to join via different methods
        let joinSuccessful = false;

        // Try fragment sharing first if we have a URL with state
        if (joinURL || this.fragmentManager.hasSessionInURL()) {
            try {
                const success = this.fragmentManager.joinSession(joinURL || window.location.href);
                if (success) {
                    this.connectionMode = 'fragment';
                    joinSuccessful = true;
                    console.log('Joined via fragment sharing');
                }
            } catch (error) {
                console.log('Fragment sharing failed:', error.message);
            }
        }

        // Try cross-browser messaging if fragment sharing didn't work or for regular session IDs
        if (!joinSuccessful) {
            try {
                this.crossBrowserMessaging = new CrossBrowserMessaging(
                    sessionId,
                    (message) => this.handleCrossBrowserMessage(message),
                    (peerId, state) => this.handleConnectionChange(peerId, state)
                );
                
                const success = this.crossBrowserMessaging.initializeAsParticipant(userId);
                if (success) {
                    this.connectionMode = 'cross-browser';
                    joinSuccessful = true;
                    
                    // Request current state from host
                    setTimeout(() => {
                        this.crossBrowserMessaging.requestState();
                    }, 1000);
                    
                    console.log('Joined via cross-browser messaging');
                }
            } catch (error) {
                console.log('Cross-browser messaging failed:', error.message);
            }
        }

        if (!joinSuccessful) {
            alert('Could not join session. Please check the session ID or URL.');
            return;
        }

        this.showMainApp();
        
        // Add ourselves to participants
        this.participants.set(userId, this.currentUser);
        
        // Broadcast that we joined
        this.broadcastMessage({
            type: 'user-joined',
            user: this.currentUser
        });
    }

    leaveSession() {
        // Broadcast leaving message
        if (this.connectionMode !== 'none') {
            this.broadcastMessage({
                type: 'user-left',
                userId: this.currentUser.id
            });
        }

        // Disconnect from P2P
        if (this.crossBrowserMessaging) {
            this.crossBrowserMessaging.disconnect();
        }
        if (this.webrtcManager) {
            this.webrtcManager.disconnect();
        }
        if (this.fragmentManager) {
            this.fragmentManager.reset();
        }

        // Reset state
        this.currentUser = null;
        this.currentSession = null;
        this.isHost = false;
        this.participants.clear();
        this.tasks = [];
        this.currentTaskId = null;
        this.votes.clear();
        this.votingEnabled = false;
        this.votesRevealed = false;
        this.connectionMode = 'none';
        
        this.showSessionPanel();
        window.location.hash = '';
        
        // Clear form fields
        document.getElementById('username').value = '';
        document.getElementById('sessionId').value = '';
    }

    // Handle incoming P2P messages (legacy WebRTC)
    handleP2PMessage(message) {
        console.log('Received P2P message:', message);
        this.processMessage(message);
    }
    
    // Handle cross-browser messages
    handleCrossBrowserMessage(message) {
        console.log('Received cross-browser message:', message);
        this.processMessage(message);
    }
    
    // Process messages from any source
    processMessage(message) {
        switch (message.type) {
            case 'user-joined':
                this.handleUserJoined(message.user);
                break;
            case 'user-left':
                this.handleUserLeft(message.userId);
                break;
            case 'task-added':
                this.handleTaskAdded(message.task);
                break;
            case 'task-selected':
                this.handleTaskSelected(message.taskId);
                break;
            case 'vote-cast':
                this.handleVoteCast(message.userId, message.vote);
                break;
            case 'votes-revealed':
                this.handleVotesRevealed();
                break;
            case 'next-round':
                this.handleNextRound();
                break;
            case 'state-sync':
                this.handleStateSync(message.state);
                break;
            case 'request-state-sync':
                // System message requesting us to send state sync
                if (this.isHost) {
                    this.sendFullStateSync(message.targetUserId);
                }
                break;
        }
        
        this.updateUI();
    }

    // Handle WebRTC connection changes
    handleConnectionChange(peerId, state) {
        console.log('Connection change:', peerId, state);
        
        const statusElement = document.getElementById('connectionStatus');
        if (statusElement) {
            statusElement.textContent = `Connection: ${state}`;
            statusElement.className = `connection-status ${state}`;
        }
    }

    // Handle fragment sharing state updates
    handleFragmentStateUpdate(state) {
        console.log('Fragment state update:', state);
        
        // Update local state from fragment
        this.participants = state.participants || new Map();
        this.tasks = state.tasks || [];
        this.currentTaskId = state.currentTaskId;
        this.votes = state.votes || new Map();
        this.votingEnabled = state.votingEnabled || false;
        this.votesRevealed = state.votesRevealed || false;
        
        this.updateUI();
    }

    // Broadcast message to all connected peers
    broadcastMessage(message) {
        if (this.connectionMode === 'cross-browser') {
            this.crossBrowserMessaging.broadcastMessage(message);
        } else if (this.connectionMode === 'webrtc') {
            this.webrtcManager.broadcastMessage(message);
        } else if (this.connectionMode === 'fragment') {
            // For fragment sharing, we update the state and generate new URL
            const newState = this.getSessionState();
            const shareURL = this.fragmentManager.updateState(newState);
            
            // Show the new URL to user for manual sharing
            this.showShareURL(shareURL);
        }
    }
    
    // Send full state sync to a specific user or all users
    sendFullStateSync(targetUserId = null) {
        if (!this.isHost) return;
        
        const fullState = {
            sessionId: this.currentSession.id,
            participants: Object.fromEntries(this.participants),
            tasks: this.tasks,
            currentTaskId: this.currentTaskId,
            votes: Object.fromEntries(this.votes),
            votingEnabled: this.votingEnabled,
            votesRevealed: this.votesRevealed,
            hostId: this.currentUser.id
        };
        
        console.log('Sending full state sync:', fullState);
        
        if (this.connectionMode === 'cross-browser') {
            this.crossBrowserMessaging.broadcastMessage({
                type: 'state-sync',
                state: fullState,
                targetUserId: targetUserId
            });
        } else {
            this.broadcastMessage({
                type: 'state-sync',
                state: fullState
            });
        }
    }

    // Get current session state for sharing
    getSessionState() {
        return {
            sessionId: this.currentSession.id,
            participants: this.participants,
            tasks: this.tasks,
            currentTaskId: this.currentTaskId,
            votes: this.votes,
            votingEnabled: this.votingEnabled,
            votesRevealed: this.votesRevealed,
            hostId: this.isHost ? this.currentUser.id : null
        };
    }

    // Message handlers
    handleUserJoined(user) {
        this.participants.set(user.id, user);
        
        // If we're the host, send current state to new user
        if (this.isHost) {
            this.broadcastMessage({
                type: 'state-sync',
                state: this.getSessionState()
            });
        }
    }

    handleUserLeft(userId) {
        this.participants.delete(userId);
        this.votes.delete(userId); // Remove their vote too
    }

    handleTaskAdded(task) {
        this.tasks.push(task);
    }

    handleTaskSelected(taskId) {
        this.currentTaskId = taskId;
        this.votingEnabled = true;
        this.votesRevealed = false;
        this.votes.clear();
    }

    handleVoteCast(userId, vote) {
        this.votes.set(userId, vote);
    }

    handleVotesRevealed() {
        this.votesRevealed = true;
    }

    handleNextRound() {
        this.votingEnabled = false;
        this.votesRevealed = false;
        this.votes.clear();
        this.currentTaskId = null;
    }

    handleStateSync(state) {
        console.log('Received state sync:', state);
        
        // Update our state with the received state (from host)
        if (state.participants) {
            // Convert from object back to Map if needed
            if (typeof state.participants === 'object' && !state.participants.has) {
                this.participants = new Map(Object.entries(state.participants));
            } else {
                this.participants = state.participants;
            }
        }
        
        if (state.tasks) {
            this.tasks = state.tasks;
        }
        
        if (state.currentTaskId !== undefined) {
            this.currentTaskId = state.currentTaskId;
        }
        
        if (state.votes) {
            // Convert from object back to Map if needed
            if (typeof state.votes === 'object' && !state.votes.has) {
                this.votes = new Map(Object.entries(state.votes));
            } else {
                this.votes = state.votes;
            }
        }
        
        if (state.votingEnabled !== undefined) {
            this.votingEnabled = state.votingEnabled;
        }
        
        if (state.votesRevealed !== undefined) {
            this.votesRevealed = state.votesRevealed;
        }
        
        console.log('State after sync:', {
            participants: this.participants.size,
            tasks: this.tasks.length,
            currentTaskId: this.currentTaskId,
            votes: this.votes.size,
            votingEnabled: this.votingEnabled,
            votesRevealed: this.votesRevealed
        });
    }

    // UI Methods (same as before but adapted for P2P)
    showMainApp() {
        document.getElementById('sessionPanel').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        document.getElementById('sessionInfo').style.display = 'flex';
        document.getElementById('currentSessionId').textContent = this.currentSession.id;
        
        // Show connection mode
        const modeElement = document.getElementById('connectionMode');
        if (modeElement) {
            modeElement.textContent = this.connectionMode.toUpperCase();
        }
        
        this.updateUI();
    }

    showSessionPanel() {
        document.getElementById('sessionPanel').style.display = 'block';
        document.getElementById('mainApp').style.display = 'none';
        document.getElementById('sessionInfo').style.display = 'none';
    }

    updateUI() {
        this.updateParticipantsTable();
        this.updateTaskList();
        this.updateVotingInterface();
        this.updateShareURL();
    }

    updateParticipantsTable() {
        const tbody = document.getElementById('participantsBody');
        const count = document.getElementById('participantCount');
        
        tbody.innerHTML = '';
        count.textContent = `${this.participants.size} participant${this.participants.size !== 1 ? 's' : ''}`;
        
        for (let [id, participant] of this.participants) {
            const row = document.createElement('div');
            row.className = 'table-row';
            
            const hasVoted = this.votes.has(id);
            const voteValue = this.votesRevealed ? (this.votes.get(id) || '-') : (hasVoted ? '✓' : '-');
            
            row.innerHTML = `
                <div class="col">
                    <div class="participant-info">
                        <div class="participant-avatar">${participant.name.charAt(0).toUpperCase()}</div>
                        <span class="participant-name">${participant.name}</span>
                    </div>
                </div>
                <div class="col">
                    <span class="badge ${participant.isHost ? 'badge-primary' : 'badge-secondary'}">
                        ${participant.isHost ? 'Host' : 'Participant'}
                    </span>
                </div>
                <div class="col">
                    <span class="badge ${hasVoted ? 'badge-success' : 'badge-warning'}">
                        ${hasVoted ? 'Voted' : 'Waiting'}
                    </span>
                </div>
                <div class="col">
                    <span class="text-center">${voteValue}</span>
                </div>
            `;
            
            tbody.appendChild(row);
        }
    }

    updateTaskList() {
        const taskList = document.getElementById('taskList');
        const currentTaskDisplay = document.getElementById('currentTaskDisplay');
        const currentTaskSection = document.getElementById('currentTask');
        
        if (this.tasks.length === 0) {
            taskList.innerHTML = '<div class="empty-state">No tasks yet. Add one to get started!</div>';
        } else {
            taskList.innerHTML = '';
            this.tasks.forEach((task) => {
                const taskItem = document.createElement('div');
                taskItem.className = `task-item ${task.id === this.currentTaskId ? 'selected' : ''}`;
                taskItem.innerHTML = `
                    <div class="task-title">${task.title}</div>
                    ${task.description ? `<div class="task-description">${task.description}</div>` : ''}
                `;
                
                if (this.isHost) {
                    taskItem.addEventListener('click', () => this.selectTask(task.id));
                }
                
                taskList.appendChild(taskItem);
            });
        }
        
        // Update current task display  
        if (this.currentTaskId) {
            const currentTask = this.tasks.find(t => t.id === this.currentTaskId);
            if (currentTask) {
                currentTaskDisplay.innerHTML = `
                    <div class="task-title">${currentTask.title}</div>
                    ${currentTask.description ? `<div class="task-description">${currentTask.description}</div>` : ''}
                `;
                currentTaskSection.style.display = 'block';
            }
        } else {
            currentTaskSection.style.display = 'none';
        }
        
        // Show/hide add task button based on host status
        document.getElementById('addTaskBtn').style.display = this.isHost ? 'block' : 'none';
    }

    updateVotingInterface() {
        const votingCards = document.getElementById('votingCards');
        const votingStatus = document.getElementById('votingStatus');
        const revealBtn = document.getElementById('revealVotesBtn');
        const nextRoundBtn = document.getElementById('nextRoundBtn');
        const resultsSection = document.getElementById('resultsSection');
        
        // Update voting status
        if (!this.currentTaskId) {
            votingStatus.innerHTML = '<span class="status-text">Waiting for task selection...</span>';
            votingCards.style.opacity = '0.5';
        } else if (!this.votingEnabled) {
            votingStatus.innerHTML = '<span class="status-text">Voting not started yet</span>';
            votingCards.style.opacity = '0.5';
        } else if (this.votesRevealed) {
            votingStatus.innerHTML = '<span class="status-text">Votes revealed! Check results below.</span>';
            votingCards.style.opacity = '0.5';
        } else {
            const hasVoted = this.votes.has(this.currentUser.id);
            votingStatus.innerHTML = `<span class="status-text">${hasVoted ? 'Vote submitted!' : 'Select your estimate'}</span>`;
            votingCards.style.opacity = '1';
        }
        
        // Update card buttons
        const cardBtns = document.querySelectorAll('.card-btn');
        const userVote = this.votes.get(this.currentUser.id);
        
        cardBtns.forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.value === userVote);
            btn.disabled = !this.votingEnabled || this.votesRevealed || !this.currentTaskId;
        });
        
        // Update host controls
        const allVoted = this.participants.size > 0 && 
                        Array.from(this.participants.keys()).every(id => this.votes.has(id));
        
        revealBtn.style.display = (this.isHost && this.votingEnabled && !this.votesRevealed && allVoted) ? 'block' : 'none';
        nextRoundBtn.style.display = (this.isHost && this.votesRevealed) ? 'block' : 'none';
        
        // Show/hide results
        if (this.votesRevealed) {
            this.updateResults();
            resultsSection.style.display = 'block';
        } else {
            resultsSection.style.display = 'none';
        }
    }

    updateResults() {
        const resultsContent = document.getElementById('resultsContent');
        
        if (this.votes.size === 0) {
            resultsContent.innerHTML = '<p class="text-center text-muted">No votes yet</p>';
            return;
        }
        
        // Count votes
        const voteCounts = {};
        for (let vote of this.votes.values()) {
            voteCounts[vote] = (voteCounts[vote] || 0) + 1;
        }
        
        // Create results display
        let resultsHTML = '<div class="vote-summary">';
        
        Object.entries(voteCounts).forEach(([value, count]) => {
            resultsHTML += `
                <div class="vote-result">
                    <div class="vote-value">${value}</div>
                    <div class="vote-count">${count} vote${count !== 1 ? 's' : ''}</div>
                </div>
            `;
        });
        
        resultsHTML += '</div>';
        
        // Add consensus detection
        const uniqueVotes = Object.keys(voteCounts).length;
        if (uniqueVotes === 1) {
            resultsHTML += '<p class="text-center text-success"><strong>🎉 Consensus reached!</strong></p>';
        } else {
            resultsHTML += '<p class="text-center text-warning">Discussion needed - votes vary</p>';
        }
        
        resultsContent.innerHTML = resultsHTML;
    }

    updateShareURL() {
        // Update the share URL display if element exists
        const shareURLElement = document.getElementById('shareURL');
        if (shareURLElement) {
            let shareURL = '';
            
            if (this.connectionMode === 'cross-browser') {
                // For cross-browser mode, create simple session URL
                shareURL = `${window.location.origin}${window.location.pathname}?session=${this.currentSession.id}`;
            } else if (this.connectionMode === 'webrtc') {
                shareURL = this.webrtcManager.generateSessionURL();
            } else if (this.connectionMode === 'fragment') {
                shareURL = this.fragmentManager.generateShareableURL();
            }
            
            shareURLElement.value = shareURL;
        }
    }

    showShareURL(url) {
        // Show the share URL to the user (for fragment sharing mode)
        const shareURLElement = document.getElementById('shareURL');
        if (shareURLElement) {
            shareURLElement.value = url;
            shareURLElement.select();
            
            // Try to copy to clipboard
            try {
                document.execCommand('copy');
                console.log('URL copied to clipboard');
            } catch (err) {
                console.log('Could not copy URL to clipboard');
            }
        }
    }

    // Action methods (adapted for P2P)
    showTaskModal() {
        document.getElementById('taskModal').style.display = 'flex';
        document.getElementById('taskTitle').focus();
    }

    hideTaskModal() {
        document.getElementById('taskModal').style.display = 'none';
        document.getElementById('taskTitle').value = '';
        document.getElementById('taskDescription').value = '';
    }

    addTask() {
        const title = document.getElementById('taskTitle').value.trim();
        if (!title) {
            alert('Please enter a task title');
            return;
        }
        
        const description = document.getElementById('taskDescription').value.trim();
        
        const task = {
            id: 'task-' + Date.now(),
            title: title,
            description: description,
            createdAt: Date.now(),
            createdBy: this.currentUser.id
        };
        
        this.tasks.push(task);
        this.broadcastMessage({
            type: 'task-added',
            task: task
        });
        
        this.updateUI();
        this.hideTaskModal();
    }

    selectTask(taskId) {
        if (!this.isHost) return;
        
        this.currentTaskId = taskId;
        this.votingEnabled = true;
        this.votesRevealed = false;
        this.votes.clear();
        
        this.broadcastMessage({
            type: 'task-selected',
            taskId: taskId
        });
        
        this.updateUI();
    }

    vote(value) {
        if (!this.votingEnabled || this.votesRevealed || !this.currentTaskId) return;
        
        this.votes.set(this.currentUser.id, value);
        
        this.broadcastMessage({
            type: 'vote-cast',
            userId: this.currentUser.id,
            vote: value
        });
        
        this.updateUI();
    }

    revealVotes() {
        if (!this.isHost) return;
        
        this.votesRevealed = true;
        
        this.broadcastMessage({
            type: 'votes-revealed'
        });
        
        this.updateUI();
    }

    nextRound() {
        if (!this.isHost) return;
        
        this.votingEnabled = false;
        this.votesRevealed = false;
        this.votes.clear();
        this.currentTaskId = null;
        
        this.broadcastMessage({
            type: 'next-round'
        });
        
        this.updateUI();
    }

    copyShareURL() {
        let shareURL = '';
        
        if (this.connectionMode === 'cross-browser') {
            shareURL = `${window.location.origin}${window.location.pathname}?session=${this.currentSession.id}`;
        } else if (this.connectionMode === 'webrtc') {
            shareURL = this.webrtcManager.generateSessionURL();
        } else if (this.connectionMode === 'fragment') {
            shareURL = this.fragmentManager.generateShareableURL();
        }
            
        if (shareURL) {
            navigator.clipboard.writeText(shareURL).then(() => {
                alert('Share URL copied to clipboard!');
            }).catch(() => {
                // Fallback for older browsers
                const textarea = document.createElement('textarea');
                textarea.value = shareURL;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                alert('Share URL copied to clipboard!');
            });
        }
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.planningPoker = new PlanningPokerP2PApp();
});