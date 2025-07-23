/**
 * Planning Poker Tool - Pure JavaScript Implementation
 * Features: Session management, real-time simulation, task management, voting system
 */

class PlanningPokerApp {
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
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.checkForSessionInURL();
        this.startPolling();
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
        if (hash.startsWith('#session-')) {
            const sessionId = hash.replace('#session-', '');
            document.getElementById('sessionId').value = sessionId;
        }
    }

    generateSessionId() {
        return Math.random().toString(36).substr(2, 8).toUpperCase();
    }

    generateUserId() {
        return 'user-' + Math.random().toString(36).substr(2, 9);
    }

    createSession() {
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
        
        this.currentSession = {
            id: sessionId,
            hostId: userId,
            createdAt: Date.now(),
            participants: new Map([[userId, this.currentUser]]),
            tasks: [],
            currentTaskId: null,
            votes: new Map(),
            votingEnabled: false,
            votesRevealed: false
        };

        this.isHost = true;
        this.participants = this.currentSession.participants;
        this.tasks = this.currentSession.tasks;
        
        this.saveSessionToStorage();
        this.showMainApp();
        this.updateURL(sessionId);
    }

    joinSession() {
        const username = document.getElementById('username').value.trim();
        const sessionId = document.getElementById('sessionId').value.trim();
        
        if (!username || !sessionId) {
            alert('Please enter your name and session ID');
            return;
        }

        const sessionData = this.loadSessionFromStorage(sessionId);
        if (!sessionData) {
            alert('Session not found. Please check the session ID.');
            return;
        }

        const userId = this.generateUserId();
        
        this.currentUser = {
            id: userId,
            name: username,
            isHost: false
        };

        this.currentSession = sessionData;
        this.currentSession.participants.set(userId, this.currentUser);
        
        this.isHost = false;
        this.participants = this.currentSession.participants;
        this.tasks = this.currentSession.tasks;
        this.currentTaskId = this.currentSession.currentTaskId;
        this.votes = this.currentSession.votes;
        this.votingEnabled = this.currentSession.votingEnabled;
        this.votesRevealed = this.currentSession.votesRevealed;

        this.saveSessionToStorage();
        this.showMainApp();
        this.updateURL(sessionId);
    }

    leaveSession() {
        if (this.currentSession && this.currentUser) {
            this.currentSession.participants.delete(this.currentUser.id);
            this.saveSessionToStorage();
        }
        
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
        window.location.hash = '';
        
        // Clear form fields
        document.getElementById('username').value = '';
        document.getElementById('sessionId').value = '';
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

    updateURL(sessionId) {
        window.location.hash = `session-${sessionId}`;
    }

    saveSessionToStorage() {
        if (!this.currentSession) return;
        
        // Convert Maps to objects for JSON serialization
        const sessionData = {
            ...this.currentSession,
            participants: Object.fromEntries(this.currentSession.participants),
            votes: Object.fromEntries(this.currentSession.votes)
        };
        
        localStorage.setItem(`planning-poker-${this.currentSession.id}`, JSON.stringify(sessionData));
        localStorage.setItem(`planning-poker-last-update-${this.currentSession.id}`, Date.now().toString());
    }

    loadSessionFromStorage(sessionId) {
        const data = localStorage.getItem(`planning-poker-${sessionId}`);
        if (!data) return null;
        
        try {
            const sessionData = JSON.parse(data);
            // Convert objects back to Maps
            sessionData.participants = new Map(Object.entries(sessionData.participants));
            sessionData.votes = new Map(Object.entries(sessionData.votes));
            return sessionData;
        } catch (e) {
            console.error('Error loading session:', e);
            return null;
        }
    }

    startPolling() {
        // Poll for updates every 2 seconds
        setInterval(() => {
            if (this.currentSession) {
                this.checkForUpdates();
            }
        }, 2000);
    }

    checkForUpdates() {
        const sessionData = this.loadSessionFromStorage(this.currentSession.id);
        if (!sessionData) return;

        const lastUpdate = localStorage.getItem(`planning-poker-last-update-${this.currentSession.id}`);
        const currentUpdate = Date.now().toString();
        
        // Check if there are any changes
        let hasChanges = false;
        
        // Check participants
        if (sessionData.participants.size !== this.participants.size) {
            hasChanges = true;
        } else {
            for (let [id, participant] of sessionData.participants) {
                if (!this.participants.has(id) || 
                    JSON.stringify(this.participants.get(id)) !== JSON.stringify(participant)) {
                    hasChanges = true;
                    break;
                }
            }
        }
        
        // Check tasks
        if (JSON.stringify(sessionData.tasks) !== JSON.stringify(this.tasks)) {
            hasChanges = true;
        }
        
        // Check voting state
        if (sessionData.currentTaskId !== this.currentTaskId ||
            sessionData.votingEnabled !== this.votingEnabled ||
            sessionData.votesRevealed !== this.votesRevealed) {
            hasChanges = true;
        }
        
        // Check votes
        if (sessionData.votes.size !== this.votes.size) {
            hasChanges = true;
        } else {
            for (let [id, vote] of sessionData.votes) {
                if (this.votes.get(id) !== vote) {
                    hasChanges = true;
                    break;
                }
            }
        }

        if (hasChanges) {
            this.currentSession = sessionData;
            this.participants = sessionData.participants;
            this.tasks = sessionData.tasks;
            this.currentTaskId = sessionData.currentTaskId;
            this.votes = sessionData.votes;
            this.votingEnabled = sessionData.votingEnabled;
            this.votesRevealed = sessionData.votesRevealed;
            this.updateUI();
        }
    }

    updateUI() {
        this.updateParticipantsTable();
        this.updateTaskList();
        this.updateVotingInterface();
        this.updateHostControls();
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
            this.tasks.forEach((task, index) => {
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

    updateHostControls() {
        // Enable/disable voting button could be added here if needed
        // For now, voting is automatically enabled when a task is selected
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
        this.currentSession.tasks = this.tasks;
        this.saveSessionToStorage();
        this.updateTaskList();
        this.hideTaskModal();
    }

    selectTask(taskId) {
        if (!this.isHost) return;
        
        this.currentTaskId = taskId;
        this.currentSession.currentTaskId = taskId;
        this.votingEnabled = true;
        this.currentSession.votingEnabled = true;
        this.votesRevealed = false;
        this.currentSession.votesRevealed = false;
        this.votes.clear();
        this.currentSession.votes.clear();
        
        this.saveSessionToStorage();
        this.updateUI();
    }

    vote(value) {
        if (!this.votingEnabled || this.votesRevealed || !this.currentTaskId) return;
        
        this.votes.set(this.currentUser.id, value);
        this.currentSession.votes.set(this.currentUser.id, value);
        this.saveSessionToStorage();
        this.updateUI();
    }

    revealVotes() {
        if (!this.isHost) return;
        
        this.votesRevealed = true;
        this.currentSession.votesRevealed = true;
        this.saveSessionToStorage();
        this.updateUI();
    }

    nextRound() {
        if (!this.isHost) return;
        
        this.votingEnabled = false;
        this.currentSession.votingEnabled = false;
        this.votesRevealed = false;
        this.currentSession.votesRevealed = false;
        this.votes.clear();
        this.currentSession.votes.clear();
        this.currentTaskId = null;
        this.currentSession.currentTaskId = null;
        
        this.saveSessionToStorage();
        this.updateUI();
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.planningPoker = new PlanningPokerApp();
});