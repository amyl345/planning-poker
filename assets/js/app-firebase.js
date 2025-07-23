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
        this.votes = new Map();
        this.votingEnabled = true; // Always enable voting for simplified app
        this.votesRevealed = false;
        
        // Firebase messaging
        this.firebaseMessaging = null;
        this.connectionStatus = 'disconnected';
        this.authStatus = 'unauthenticated';
        
        this.init();
    }

    init() {
        console.log('Initializing app...');
        this.bindEvents();
        this.checkForSessionInURL();
        this.updateConnectionStatus('initializing');
        console.log('App initialization complete');
    }

    bindEvents() {
        console.log('Binding events...');
        // Session management
        document.getElementById('createSessionBtn').addEventListener('click', () => this.createSession());
        document.getElementById('joinSessionBtn').addEventListener('click', () => this.joinSession());
        document.getElementById('leaveSessionBtn').addEventListener('click', () => this.leaveSession());

        // Voting only - delegate event handling since cards are static now
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('card-btn')) {
                this.vote(e.target.dataset.value);
            }
        });
        document.getElementById('revealVotesBtn').addEventListener('click', () => this.revealVotes());
        document.getElementById('nextRoundBtn').addEventListener('click', () => this.nextRound());

        // Share URL
        document.getElementById('shareURLBtn').addEventListener('click', () => this.copyShareURL());

        // Enter key handling
        document.getElementById('username').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleEnterPress();
        });
        document.getElementById('sessionId').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinSession();
        });
        console.log('Event binding complete');
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
        // Generate a 6-character uppercase alphanumeric session ID
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let id = '';
        for (let i = 0; i < 6; i++) {
            id += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return id;
    }

    // User ID is now handled by Firebase Auth, so this method is not needed
    // but keeping it for backwards compatibility in case it's referenced elsewhere

    async createSession() {
        const username = document.getElementById('username').value.trim();
        if (!username) {
            alert('Please enter your name');
            return;
        }

        this.updateConnectionStatus('connecting');

        const sessionId = this.generateSessionId();
        
        this.isHost = true;
        this.currentSession = {
            id: sessionId,
            createdAt: Date.now()
        };

        // Initialize Firebase messaging
        this.firebaseMessaging = new FirebaseMessaging(
            (state) => this.handleStateChange(state),
            (provider, status) => this.handleConnectionChange(provider, status)
        );

        try {
            const success = await this.firebaseMessaging.initializeAsHost(sessionId, username);
            if (success) {
                // Update current user with Firebase auth UID
                this.currentUser = {
                    id: this.firebaseMessaging.userId,
                    name: username,
                    isHost: true
                };
                this.currentSession.hostId = this.firebaseMessaging.userId;
                
                this.showMainApp();
                console.log('Session created successfully:', sessionId);
            } else {
                throw new Error('Failed to create session');
            }
        } catch (error) {
            console.error('Error creating session:', error);
            this.handleAuthError(error);
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
        
        this.isHost = false;
        this.currentSession = { id: sessionId };

        // Initialize Firebase messaging
        this.firebaseMessaging = new FirebaseMessaging(
            (state) => this.handleStateChange(state),
            (provider, status) => this.handleConnectionChange(provider, status)
        );

        try {
            const success = await this.firebaseMessaging.initializeAsParticipant(sessionId, username);
            if (success) {
                // Update current user with Firebase auth UID
                this.currentUser = {
                    id: this.firebaseMessaging.userId,
                    name: username,
                    isHost: false
                };
                
                this.showMainApp();
                console.log('Joined session successfully:', sessionId);
            } else {
                throw new Error('Failed to join session');
            }
        } catch (error) {
            console.error('Error joining session:', error);
            this.handleAuthError(error);
        }
    }

    async leaveSession() {
        if (this.firebaseMessaging) {
            await this.firebaseMessaging.disconnect();
            this.firebaseMessaging = null;
        }
        this.currentUser = null;
        this.currentSession = null;
        this.isHost = false;
        this.participants = new Map();
        this.votes = new Map();
        this.votingEnabled = false;
        this.votesRevealed = false;
        this.updateConnectionStatus('disconnected');
        this.showSessionPanel();
        this.updateUI();
    }

    // Handle state changes from Firebase
    handleStateChange(state) {
        console.log('State change received:', state);
        console.log('Participants data:', state.participants);
        
        // Update local state with Firebase data
        this.participants = state.participants || new Map();
        this.votes = state.votes || new Map();
        this.votingEnabled = state.votingEnabled !== false; // Default to true for simplified voting
        this.votesRevealed = state.votesRevealed || false;
        
        // Log participant sync for debugging
        console.log('Raw Firebase participants:', state.participants);
        if (this.currentUser) {
            const currentUserInParticipants = this.participants.has(this.currentUser.id);
            console.log('Current user in participants:', currentUserInParticipants, this.currentUser.id);
            if (!currentUserInParticipants) {	
                console.warn('Current user missing from Firebase participants - this indicates a sync issue');
            }
        }
        
        console.log('Updated participants Map size:', this.participants.size);
        console.log('Updated votes Map size:', this.votes.size);
        console.log('Voting enabled:', this.votingEnabled, 'Votes revealed:', this.votesRevealed);
        
        // Update session info
        if (state.sessionId) {
            this.currentSession = { id: state.sessionId };
        }
        
        // Update UI
        this.updateUI();
    }

    // Handle connection changes
    handleConnectionChange(provider, status) {
        console.log('Connection change:', provider, status);
        
        if (provider === 'auth') {
            this.authStatus = status;
        } else if (provider === 'firebase') {
            this.connectionStatus = status;
        }
        
        this.updateConnectionDisplay();
    }

    // Handle authentication errors
    handleAuthError(error) {
        let message = 'Authentication failed. ';
        
        if (error.code === 'auth/network-request-failed') {
            message += 'Please check your internet connection.';
        } else if (error.code === 'permission-denied') {
            message += 'Database access denied. Please try again.';
        } else if (error.message.includes('Session not found')) {
            message = 'Session not found. Please check the session ID.';
        } else {
            message += 'Please try again.';
        }
        
        alert(message);
        this.updateConnectionStatus('disconnected');
    }

    updateConnectionStatus(status) {
        this.connectionStatus = status;
        this.updateConnectionDisplay();
    }

    updateConnectionDisplay() {
        const statusElement = document.getElementById('connectionStatus');
        const modeElement = document.getElementById('connectionMode');
        
        if (statusElement) {
            const displayStatus = this.getOverallStatus();
            statusElement.textContent = this.getStatusText(displayStatus);
            statusElement.className = `connection-status ${displayStatus}`;
        }
        
        if (modeElement) {
            modeElement.textContent = 'Firebase';
        }
    }

    getOverallStatus() {
        // Priority: auth errors > connection issues > normal states
        if (this.authStatus === 'error') return 'failed';
        if (this.authStatus === 'authenticating') return 'connecting';
        if (this.authStatus === 'unauthenticated') return 'disconnected';
        if (this.connectionStatus === 'disconnected') return 'disconnected';
        if (this.connectionStatus === 'connecting') return 'connecting';
        if (this.authStatus === 'authenticated' && this.connectionStatus === 'connected') return 'connected';
        return 'connecting';
    }

    getStatusText(status) {
        switch (status) {
            case 'connected': return 'Connected';
            case 'connecting': return 'Connecting...';
            case 'disconnected': return 'Disconnected';
            case 'initializing': return 'Initializing...';
            case 'failed': return 'Connection Failed';
            default: return status;
        }
    }

    showMainApp() {
        document.getElementById('sessionPanel').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        document.getElementById('currentSessionId').textContent = this.currentSession.id;
        
        this.updateUI();
    }

    showSessionPanel() {
        document.getElementById('sessionPanel').style.display = 'block';
        document.getElementById('mainApp').style.display = 'none';
    }

    updateUI() {
        this.updateParticipantsTable();
        this.updateVotingInterface();
    }

    updateParticipantsTable() {
        console.log('updateParticipantsTable called, participants:', this.participants);
        const tbody = document.getElementById('participantsBody');
        const count = document.getElementById('participantCount');
        
        if (!tbody || !count) {
            console.error('Missing participantsBody or participantCount elements');
            return;
        }
        
        tbody.innerHTML = '';
        count.textContent = `${this.participants.size} participant${this.participants.size !== 1 ? 's' : ''}`;
        
        for (let [id, participant] of this.participants) {
            const row = document.createElement('div');
            row.className = 'table-row d-flex p-3 border-bottom align-items-center';
            
            const hasVoted = this.votes.has(id);
            const voteValue = this.votesRevealed ? (this.votes.get(id) || '-') : (hasVoted ? '✓' : '-');
            const connectionStatus = participant.connected ? 'Online' : 'Offline';
            const statusClass = participant.connected ? 'text-success' : 'text-muted';
            const hostBadge = participant.isHost ? '<span class="badge bg-primary ms-2">Host</span>' : '';
            
            // Vote status indicator
            let voteStatusBadge = '';
            if (this.votesRevealed) {
                voteStatusBadge = `<span class="badge bg-primary fs-6">${voteValue}</span>`;
            } else if (hasVoted) {
                voteStatusBadge = '<span class="badge bg-success">Voted</span>';
            } else {
                voteStatusBadge = '<span class="badge bg-warning text-dark">Waiting</span>';
            }
            
            row.innerHTML = `
                <div class="col-5">
                    <div class="d-flex align-items-center">
                        <div class="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center me-2" style="width: 32px; height: 32px; font-size: 14px;">
                            ${participant.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <span class="fw-semibold">${participant.name}</span>
                            ${hostBadge}
                        </div>
                    </div>
                </div>
                <div class="col-3 text-center">
                    <span class="badge ${participant.connected ? 'bg-success' : 'bg-secondary'}">${connectionStatus}</span>
                </div>
                <div class="col-4 text-center">
                    ${voteStatusBadge}
                </div>
            `;
            
            tbody.appendChild(row);
        }
        console.log('Participants table updated with', this.participants.size, 'participants');
    }

    updateTaskList() {
        // Task management removed for simplified voting app
    }

    updateVotingInterface() {
        console.log('updateVotingInterface called, votingEnabled:', this.votingEnabled, 'votesRevealed:', this.votesRevealed);
        const votingCards = document.getElementById('votingCards');
        const votingStatus = document.getElementById('votingStatus');
        const revealBtn = document.getElementById('revealVotesBtn');
        const nextRoundBtn = document.getElementById('nextRoundBtn');
        const resultsSection = document.getElementById('resultsSection');
        
        if (!votingCards || !votingStatus || !revealBtn || !nextRoundBtn || !resultsSection) {
            console.error('Missing voting interface elements');
            return;
        }
        
        // Update voting status with progress
        const connectedParticipants = Array.from(this.participants.values()).filter(p => p.connected);
        const votedCount = connectedParticipants.filter(p => this.votes.has(p.id)).length;
        const totalCount = connectedParticipants.length;
        const progressPercent = totalCount > 0 ? Math.round((votedCount / totalCount) * 100) : 0;
        
        if (this.votesRevealed) {
            votingStatus.innerHTML = '<span class="status-text text-success"><i class="bi bi-check-circle me-2"></i>Votes revealed! Check results below.</span>';
            votingCards.style.opacity = '0.5';
        } else {
            const hasVoted = this.currentUser && this.votes.has(this.currentUser.id);
            votingStatus.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <span class="status-text">${hasVoted ? 'Vote submitted!' : 'Cast your vote to estimate the story points'}</span>
                    <small class="text-muted">${votedCount}/${totalCount} voted (${progressPercent}%)</small>
                </div>
                <div class="progress mt-2" style="height: 4px;">
                    <div class="progress-bar bg-primary" role="progressbar" style="width: ${progressPercent}%"></div>
                </div>
            `;
            votingCards.style.opacity = '1';
        }
        
        // Update card buttons
        const cardBtns = document.querySelectorAll('.card-btn');
        const userVote = this.currentUser ? this.votes.get(this.currentUser.id) : null;
        
        cardBtns.forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.value === userVote);
            btn.disabled = this.votesRevealed;
        });
        
        // Update host controls
        const allVoted = connectedParticipants.length > 0 && 
                        connectedParticipants.every(p => this.votes.has(p.id));
        
        revealBtn.style.display = (this.isHost && !this.votesRevealed && allVoted) ? 'block' : 'none';
        nextRoundBtn.style.display = (this.isHost && this.votesRevealed) ? 'block' : 'none';
        
        // Show/hide results
        if (this.votesRevealed) {
            this.updateResults();
            resultsSection.style.display = 'block';
        } else {
            resultsSection.style.display = 'none';
        }
        
        console.log('Voting interface updated - cards enabled:', !this.votesRevealed, 'buttons count:', cardBtns.length);
    }

    updateResults() {
        const resultsContent = document.getElementById('resultsContent');
        
        if (this.votes.size === 0) {
            resultsContent.innerHTML = '<p class="text-center text-muted">No votes yet</p>';
            return;
        }

        // Calculate statistics
        const voteValues = Array.from(this.votes.values());
        const numericVotes = voteValues.filter(v => !isNaN(v) && v !== '?' && v !== '☕').map(Number);
        
        let stats = { high: null, low: null, average: null, consensus: false };
        if (numericVotes.length > 0) {
            stats.high = Math.max(...numericVotes);
            stats.low = Math.min(...numericVotes);
            stats.average = (numericVotes.reduce((a, b) => a + b, 0) / numericVotes.length).toFixed(1);
        }
        
        // Check for consensus
        const uniqueVotes = [...new Set(voteValues)];
        stats.consensus = uniqueVotes.length === 1 && voteValues.length > 1;

        let resultsHTML = '';
        
        // Statistics summary
        if (numericVotes.length > 0) {
            resultsHTML += `
                <div class="row mb-4">
                    <div class="col-md-3 col-6">
                        <div class="card text-center bg-light">
                            <div class="card-body py-2">
                                <h6 class="card-title mb-1">High</h6>
                                <h4 class="text-danger mb-0">${stats.high}</h4>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3 col-6">
                        <div class="card text-center bg-light">
                            <div class="card-body py-2">
                                <h6 class="card-title mb-1">Low</h6>
                                <h4 class="text-success mb-0">${stats.low}</h4>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3 col-6">
                        <div class="card text-center bg-light">
                            <div class="card-body py-2">
                                <h6 class="card-title mb-1">Average</h6>
                                <h4 class="text-primary mb-0">${stats.average}</h4>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3 col-6">
                        <div class="card text-center ${stats.consensus ? 'bg-success text-white' : 'bg-warning'}">
                            <div class="card-body py-2">
                                <h6 class="card-title mb-1">Consensus</h6>
                                <h4 class="mb-0">${stats.consensus ? '✓' : '✗'}</h4>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        // Individual votes
        resultsHTML += '<h6 class="mb-3">Individual Votes:</h6><div class="row">';
        
        for (let [id, participant] of this.participants) {
            const vote = this.votes.get(id) || 'No vote';
            const badgeClass = participant.isHost ? 'bg-primary' : 'bg-secondary';
            
            resultsHTML += `
                <div class="col-md-6 col-lg-4 mb-2">
                    <div class="d-flex justify-content-between align-items-center p-2 border rounded">
                        <span>
                            ${participant.name}
                            <span class="badge ${badgeClass} ms-1">${participant.isHost ? 'Host' : 'Member'}</span>
                        </span>
                        <strong class="text-primary fs-5">${vote}</strong>
                    </div>
                </div>
            `;
        }
        
        resultsHTML += '</div>';
        
        // Consensus message
        if (stats.consensus) {
            resultsHTML += '<div class="alert alert-success text-center mt-3"><strong>🎉 Consensus reached!</strong></div>';
        } else if (voteValues.length > 1) {
            resultsHTML += '<div class="alert alert-warning text-center mt-3">Discussion needed - votes vary</div>';
        }
        
        resultsContent.innerHTML = resultsHTML;
    }

    // Action methods - voting only
    async vote(value) {
        console.log('Vote called with value:', value, 'votesRevealed:', this.votesRevealed, 'firebaseMessaging:', !!this.firebaseMessaging);
        if (this.votesRevealed || !this.firebaseMessaging) return;
        
        // Check if user is changing their vote
        const currentVote = this.currentUser ? this.votes.get(this.currentUser.id) : null;
        if (currentVote && currentVote !== value) {
            const changeConfirmed = confirm(`You already voted "${currentVote}". Do you want to change your vote to "${value}"?`);
            if (!changeConfirmed) {
                console.log('Vote change cancelled by user');
                return;
            }
        }
        
        // Show loading state
        this.showVoteLoading(value);
        
        try {
            await this.firebaseMessaging.castVote(value);
            console.log('Vote cast successfully');
            this.showVoteSuccess(value);
            
            // Check if all participants have voted for auto-reveal
            this.checkForAutoReveal();
        } catch (error) {
            console.error('Error casting vote:', error);
            this.showVoteError(value, error.message);
        }
    }

    showVoteLoading(value) {
        const btn = document.querySelector(`.card-btn[data-value="${value}"]`);
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="spinner-border spinner-border-sm" role="status"></i>';
            btn.classList.add('loading');
        }
        
        const votingStatus = document.getElementById('votingStatus');
        if (votingStatus) {
            votingStatus.innerHTML = '<span class="text-info">Casting vote...</span>';
        }
    }

    showVoteSuccess(value) {
        const btn = document.querySelector(`.card-btn[data-value="${value}"]`);
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = value;
            btn.classList.remove('loading');
            btn.classList.add('selected');
        }
        
        const votingStatus = document.getElementById('votingStatus');
        if (votingStatus) {
            votingStatus.innerHTML = '<span class="text-success">Vote submitted successfully!</span>';
        }
        
        // Reset status after 3 seconds
        setTimeout(() => {
            if (votingStatus) {
                votingStatus.innerHTML = '<span class="status-text">Vote submitted!</span>';
            }
        }, 3000);
    }

    showVoteError(value, errorMessage) {
        const btn = document.querySelector(`.card-btn[data-value="${value}"]`);
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = value;
            btn.classList.remove('loading');
        }
        
        const votingStatus = document.getElementById('votingStatus');
        if (votingStatus) {
            votingStatus.innerHTML = `<span class="text-danger">Error: ${errorMessage}. Please try again.</span>`;
        }
        
        // Reset status after 5 seconds
        setTimeout(() => {
            if (votingStatus) {
                votingStatus.innerHTML = '<span class="status-text">Cast your vote to estimate the story points</span>';
            }
        }, 5000);
    }

    showVoteError(value, errorMessage) {
        const votingStatus = document.getElementById('votingStatus');
        if (votingStatus) {
            votingStatus.innerHTML = `<span class="status-text text-danger"><i class="bi bi-exclamation-triangle me-2"></i>Failed to submit vote "${value}". ${errorMessage}</span>`;
            
            // Clear error message after 5 seconds
            setTimeout(() => {
                const hasVoted = this.currentUser && this.votes.has(this.currentUser.id);
                votingStatus.innerHTML = `<span class="status-text">${hasVoted ? 'Vote submitted!' : 'Cast your vote to estimate the story points'}</span>`;
            }, 5000);
        }
        
        // Re-enable voting cards
        const cardBtns = document.querySelectorAll('.card-btn');
        cardBtns.forEach(btn => {
            btn.disabled = this.votesRevealed;
        });
    }

    checkForAutoReveal() {
        if (!this.isHost || this.votesRevealed) return;
        
        // Get connected participants
        const connectedParticipants = Array.from(this.participants.values()).filter(p => p.connected);
        console.log('Connected participants:', connectedParticipants.length);
        console.log('Total votes:', this.votes.size);
        
        // Check if all connected participants have voted
        const allVoted = connectedParticipants.length > 0 && 
                        connectedParticipants.every(p => this.votes.has(p.id));
        
        if (allVoted) {
            console.log('All participants have voted, auto-revealing votes');
            setTimeout(() => {
                this.revealVotes();
            }, 1000); // Small delay for better UX
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
    console.log('DOM loaded, initializing PlanningPokerFirebaseApp...');
    window.planningPoker = new PlanningPokerFirebaseApp();
    console.log('App initialized:', window.planningPoker);
});