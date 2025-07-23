/**
 * Planning Poker App - Firebase Integration
 * Real-time multi-user planning poker using Firebase Realtime Database
 */

import FirebaseMessaging from './firebase-messaging.js';

class PlanningPokerFirebaseApp {
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
        
        // Firebase messaging
        this.firebaseMessaging = null;
        this.connectionStatus = 'disconnected';
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.checkForSessionInURL();
        this.updateConnectionStatus('initializing');
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

        // Share URL
        document.getElementById('shareURLBtn').addEventListener('click', () => this.copyShareURL());

        // Modal close on background click
        document.getElementById('taskModal').addEventListener('click', (e) => {
            if (e.target.id === 'taskModal') {
                this.hideTaskModal();
            }
        });

        // Enter key handling
        document.getElementById('username').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleEnterPress();
        });
        document.getElementById('sessionId').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinSession();
        });
        document.getElementById('taskTitle').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addTask();
        });
    }

    handleEnterPress() {
        const sessionId = document.getElementById('sessionId').value.trim();
        if (sessionId) {
            this.joinSession();
        } else {
            this.createSession();
        }
    }

    checkForSessionInURL() {
        // Check URL parameters for session ID
        const urlParams = new URLSearchParams(window.location.search);
        const sessionParam = urlParams.get('session');
        
        if (sessionParam) {
            document.getElementById('sessionId').value = sessionParam;
            this.showJoinPrompt();
        }
        
        // Also check hash for backwards compatibility
        const hash = window.location.hash;
        if (hash.startsWith('#session-')) {
            const sessionId = hash.replace('#session-', '');
            document.getElementById('sessionId').value = sessionId;
            this.showJoinPrompt();
        }
    }

    showJoinPrompt() {
        const sessionPanel = document.getElementById('sessionPanel');
        const joinSection = sessionPanel.querySelector('.join-session');
        if (joinSection) {
            joinSection.style.border = '2px solid var(--primary-color)';
            joinSection.style.backgroundColor = 'rgba(44, 90, 160, 0.05)';
            document.getElementById('username').focus();
        }
        
        this.showJoinMessage('Enter your name to join this session');
    }

    showJoinMessage(message) {
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

        this.updateConnectionStatus('connecting');

        const sessionId = this.generateSessionId();
        const userId = this.generateUserId();
        
        this.currentUser = {
            id: userId,
            name: username,
            isHost: true
        };
        
        this.isHost = true;
        this.currentSession = {
            id: sessionId,
            hostId: userId,
            createdAt: Date.now()
        };

        // Initialize Firebase messaging
        this.firebaseMessaging = new FirebaseMessaging(
            (state) => this.handleStateChange(state),
            (provider, status) => this.handleConnectionChange(provider, status)
        );

        try {
            const success = await this.firebaseMessaging.initializeAsHost(sessionId, userId, username);
            if (success) {
                this.showMainApp();
                console.log('Session created successfully:', sessionId);
            } else {
                throw new Error('Failed to create session');
            }
        } catch (error) {
            console.error('Error creating session:', error);
            alert('Failed to create session. Please try again.');
            this.updateConnectionStatus('disconnected');
        }
    }

    async joinSession() {
        const username = document.getElementById('username').value.trim();
        const sessionId = document.getElementById('sessionId').value.trim();
        
        if (!username) {
            alert('Please enter your name');
            return;
        }
        
        if (!sessionId) {
            alert('Please enter a session ID');
            return;
        }

        this.updateConnectionStatus('connecting');

        const userId = this.generateUserId();
        
        this.currentUser = {
            id: userId,
            name: username,
            isHost: false
        };
        
        this.isHost = false;
        this.currentSession = { id: sessionId };

        // Initialize Firebase messaging
        this.firebaseMessaging = new FirebaseMessaging(
            (state) => this.handleStateChange(state),
            (provider, status) => this.handleConnectionChange(provider, status)
        );

        try {
            const success = await this.firebaseMessaging.initializeAsParticipant(sessionId, userId, username);
            if (success) {
                this.showMainApp();
                console.log('Joined session successfully:', sessionId);
            } else {
                throw new Error('Failed to join session');
            }
        } catch (error) {
            console.error('Error joining session:', error);
            alert('Failed to join session. Please check the session ID and try again.');
            this.updateConnectionStatus('disconnected');
        }
    }

    async leaveSession() {
        if (this.firebaseMessaging) {
            await this.firebaseMessaging.disconnect();
            this.firebaseMessaging = null;
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
        
        this.showSessionPanel();
        this.updateConnectionStatus('disconnected');
        
        // Clear URL
        window.history.replaceState(null, '', window.location.pathname);
        
        // Clear form fields
        document.getElementById('username').value = '';
        document.getElementById('sessionId').value = '';
        
        // Clear join message
        const messageEl = document.getElementById('joinMessage');
        if (messageEl) {
            messageEl.style.display = 'none';
        }
    }

    // Handle Firebase state changes
    handleStateChange(state) {
        console.log('State change received:', state);
        
        // Update local state
        this.participants = state.participants || new Map();
        this.tasks = state.tasks || [];
        this.currentTaskId = state.currentTaskId;
        this.votes = state.votes || new Map();
        this.votingEnabled = state.votingEnabled || false;
        this.votesRevealed = state.votesRevealed || false;
        
        // Update UI
        this.updateUI();
    }

    // Handle connection changes
    handleConnectionChange(provider, status) {
        console.log('Connection change:', provider, status);
        this.updateConnectionStatus(status);
    }

    updateConnectionStatus(status) {
        this.connectionStatus = status;
        const statusElement = document.getElementById('connectionStatus');
        const modeElement = document.getElementById('connectionMode');
        
        if (statusElement) {
            statusElement.textContent = this.getStatusText(status);
            statusElement.className = `connection-status ${status}`;
        }
        
        if (modeElement) {
            modeElement.textContent = 'Firebase';
        }
    }

    getStatusText(status) {
        switch (status) {
            case 'connected': return 'Connected';
            case 'connecting': return 'Connecting...';
            case 'disconnected': return 'Disconnected';
            case 'initializing': return 'Initializing...';
            default: return status;
        }
    }

    showMainApp() {
        document.getElementById('sessionPanel').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        document.getElementById('sessionInfo').style.display = 'flex';
        document.getElementById('currentSessionId').textContent = this.currentSession.id;
        
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
            const connectionStatus = participant.connected ? 'Connected' : 'Disconnected';
            
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
                    <span class="badge ${participant.connected ? 'badge-success' : 'badge-warning'}">
                        ${connectionStatus}
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
        const connectedParticipants = Array.from(this.participants.values()).filter(p => p.connected);
        const allVoted = connectedParticipants.length > 0 && 
                        connectedParticipants.every(p => this.votes.has(p.id));
        
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

    // Action methods
    showTaskModal() {
        document.getElementById('taskModal').style.display = 'flex';
        document.getElementById('taskTitle').focus();
    }

    hideTaskModal() {
        document.getElementById('taskModal').style.display = 'none';
        document.getElementById('taskTitle').value = '';
        document.getElementById('taskDescription').value = '';
    }

    async addTask() {
        const title = document.getElementById('taskTitle').value.trim();
        if (!title) {
            alert('Please enter a task title');
            return;
        }
        
        const description = document.getElementById('taskDescription').value.trim();
        
        try {
            await this.firebaseMessaging.addTask(title, description);
            this.hideTaskModal();
        } catch (error) {
            console.error('Error adding task:', error);
            alert('Failed to add task. Please try again.');
        }
    }

    async selectTask(taskId) {
        if (!this.isHost) return;
        
        try {
            await this.firebaseMessaging.selectTask(taskId);
        } catch (error) {
            console.error('Error selecting task:', error);
            alert('Failed to select task. Please try again.');
        }
    }

    async vote(value) {
        if (!this.votingEnabled || this.votesRevealed || !this.currentTaskId) return;
        
        try {
            await this.firebaseMessaging.castVote(value);
        } catch (error) {
            console.error('Error casting vote:', error);
            alert('Failed to cast vote. Please try again.');
        }
    }

    async revealVotes() {
        if (!this.isHost) return;
        
        try {
            await this.firebaseMessaging.revealVotes();
        } catch (error) {
            console.error('Error revealing votes:', error);
            alert('Failed to reveal votes. Please try again.');
        }
    }

    async nextRound() {
        if (!this.isHost) return;
        
        try {
            await this.firebaseMessaging.nextRound();
        } catch (error) {
            console.error('Error starting next round:', error);
            alert('Failed to start next round. Please try again.');
        }
    }

    copyShareURL() {
        const shareURL = this.firebaseMessaging?.getShareURL() || 
                        `${window.location.origin}${window.location.pathname}?session=${this.currentSession.id}`;
            
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
    window.planningPoker = new PlanningPokerFirebaseApp();
});