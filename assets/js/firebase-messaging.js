/**
 * Firebase Messaging Manager for Planning Poker
 * Handles all Firebase Realtime Database operations for multi-user collaboration
 */

import { database, auth } from './firebase-config.js';
import { 
    ref, 
    set, 
    push, 
    remove, 
    onValue, 
    off, 
    serverTimestamp, 
    onDisconnect,
    get,
    update 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
import { 
    signInAnonymously,
    onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

class FirebaseMessaging {
    constructor(onStateChange, onConnectionChange) {
        this.onStateChange = onStateChange;
        this.onConnectionChange = onConnectionChange;
        
        this.sessionId = null;
        this.userId = null;
        this.isHost = false;
        this.isConnected = false;
        this.isAuthenticated = false;
        
        // Firebase references
        this.sessionRef = null;
        this.participantsRef = null;
        this.tasksRef = null;
        this.votesRef = null;
        this.infoRef = null;
        
        // Listeners for cleanup
        this.listeners = [];
        
        // Connection status
        this.setupConnectionMonitoring();
        this.setupAuthStateListener();
    }

    // Setup connection monitoring
    setupConnectionMonitoring() {
        const connectedRef = ref(database, '.info/connected');
        onValue(connectedRef, (snapshot) => {
            this.isConnected = snapshot.val();
            console.log('Firebase connection status:', this.isConnected);
            this.onConnectionChange('firebase', this.isConnected ? 'connected' : 'disconnected');
        });
    }

    // Setup authentication state listener
    setupAuthStateListener() {
        onAuthStateChanged(auth, (user) => {
            this.isAuthenticated = !!user;
            if (user) {
                console.log('User authenticated:', user.uid);
                this.onConnectionChange('auth', 'authenticated');
            } else {
                console.log('User not authenticated');
                this.onConnectionChange('auth', 'unauthenticated');
            }
        });
    }

    // Ensure user is authenticated
    async ensureAuthenticated() {
        if (auth.currentUser) {
            return auth.currentUser;
        }

        console.log('Signing in anonymously...');
        this.onConnectionChange('auth', 'authenticating');
        
        try {
            const userCredential = await signInAnonymously(auth);
            console.log('Anonymous sign-in successful:', userCredential.user.uid);
            return userCredential.user;
        } catch (error) {
            console.error('Anonymous sign-in failed:', error);
            this.onConnectionChange('auth', 'error');
            throw error;
        }
    }

    // Initialize as session host
    async initializeAsHost(sessionId, username) {
        // Validate session ID format
        if (!/^[A-Z0-9]{6}$/.test(sessionId)) {
            throw new Error('Session ID must be 6 uppercase alphanumeric characters');
        }
        this.sessionId = sessionId;
        this.isHost = true;
        console.log('Initializing Firebase as host:', { sessionId, username });
        try {
            // Ensure user is authenticated first
            const user = await this.ensureAuthenticated();
            this.userId = user.uid;
            await this.setupSessionReferences();
            // HostId must match auth.uid
            await this.createSession(username);
            this.setupRealtimeListeners();
            this.setupDisconnectionHandling();
            console.log('Host initialization complete');
            return true;
        } catch (error) {
            console.error('Error initializing as host:', error);
            throw error;
        }
    }

    // Initialize as participant
    async initializeAsParticipant(sessionId, username) {
        // Validate session ID format
        if (!/^[A-Z0-9]{6}$/.test(sessionId)) {
            throw new Error('Session ID must be 6 uppercase alphanumeric characters');
        }
        this.sessionId = sessionId;
        this.isHost = false;
        console.log('Initializing Firebase as participant:', { sessionId, username });
        try {
            // Ensure user is authenticated first
            const user = await this.ensureAuthenticated();
            this.userId = user.uid;
            await this.setupSessionReferences();
            // Check if session exists by reading the info node (which has read permission)
            const sessionInfoSnapshot = await get(this.infoRef);
            if (!sessionInfoSnapshot.exists()) {
                throw new Error('Session not found');
            }
            // Try to join session
            try {
                await this.joinSession(username);
            } catch (err) {
                console.error('Error writing participant record:', err);
                throw err;
            }
            this.setupRealtimeListeners();
            this.setupDisconnectionHandling();
            console.log('Participant initialization complete');
            return true;
        } catch (error) {
            console.error('Error initializing as participant:', error);
            throw error;
        }
    }

    // Setup Firebase references
    async setupSessionReferences() {
        this.sessionRef = ref(database, `sessions/${this.sessionId}`);
        this.participantsRef = ref(database, `sessions/${this.sessionId}/participants`);
        this.tasksRef = ref(database, `sessions/${this.sessionId}/tasks`);
        this.votesRef = ref(database, `sessions/${this.sessionId}/votes`);
        this.infoRef = ref(database, `sessions/${this.sessionId}/info`);
    }

    // Create new session (host only)
    async createSession(username) {
        // Write info node (host only)
        await set(this.infoRef, {
            hostId: this.userId,
            createdAt: serverTimestamp(),
            currentTaskId: null,
            votingEnabled: true,
            votesRevealed: false
        });

        // Write participants node (self only)
        const participantRef = ref(database, `sessions/${this.sessionId}/participants/${this.userId}`);
        console.log('[FirebaseMessaging] Host creating participant:', {
            path: `sessions/${this.sessionId}/participants/${this.userId}`,
            authUid: this.userId,
            username
        });
        const participantData = {
            name: username,
            isHost: true,
            joinedAt: serverTimestamp(),
            lastSeen: serverTimestamp(),
            connected: true
        };
        await set(participantRef, participantData);
        console.log('[FirebaseMessaging] Host participant created successfully:', {
            username,
            userId: this.userId,
            data: participantData
        });
    }

    // Join existing session (participant)
    async joinSession(username) {
        // Add self to participants node
        const participantRef = ref(database, `sessions/${this.sessionId}/participants/${this.userId}`);
        console.log('[FirebaseMessaging] Participant joining:', {
            path: `sessions/${this.sessionId}/participants/${this.userId}`,
            authUid: this.userId,
            username
        });
        const participantData = {
            name: username,
            isHost: false,
            joinedAt: serverTimestamp(),
            lastSeen: serverTimestamp(),
            connected: true
        };
        await set(participantRef, participantData);
        console.log('[FirebaseMessaging] Participant joined successfully:', {
            username,
            userId: this.userId,
            data: participantData
        });
    }

    // Setup real-time listeners
    setupRealtimeListeners() {
        // Listen to entire session for complete state updates
        const sessionListener = onValue(this.sessionRef, (snapshot) => {
            if (snapshot.exists()) {
                const sessionData = snapshot.val();
                console.log('Session data updated:', sessionData);
                // Convert Firebase data to app format
                const appState = this.convertFirebaseToAppState(sessionData);
                this.onStateChange(appState);
            } else {
                console.warn('Session snapshot does not exist!');
            }
        });
        this.listeners.push({ ref: this.sessionRef, listener: sessionListener });
    }

    // Convert Firebase data format to app state format
    convertFirebaseToAppState(firebaseData) {
        const participants = new Map();
        if (firebaseData.participants) {
            Object.entries(firebaseData.participants).forEach(([id, data]) => {
                participants.set(id, {
                    id: id,
                    name: data.name,
                    isHost: !!data.isHost,
                    connected: !!data.connected,
                    lastSeen: data.lastSeen || null
                });
            });
        }

        // No tasks for simplified app
        const tasks = [];

        const votes = new Map();
        if (firebaseData.votes) {
            Object.entries(firebaseData.votes).forEach(([userId, voteData]) => {
                const vote = typeof voteData === 'object' ? voteData.value : voteData;
                votes.set(userId, vote);
            });
        }

        return {
            sessionId: this.sessionId,
            participants: participants,
            tasks: tasks,
            currentTaskId: null,
            votes: votes,
            votingEnabled: firebaseData.info?.votingEnabled ?? true,
            votesRevealed: firebaseData.info?.votesRevealed ?? false,
            hostId: firebaseData.info?.hostId ?? null
        };
    }

    // Setup disconnection handling
    setupDisconnectionHandling() {
        const participantRef = ref(database, `sessions/${this.sessionId}/participants/${this.userId}`);
        
        // Update last seen timestamp periodically
        const updatePresence = () => {
            set(ref(database, `sessions/${this.sessionId}/participants/${this.userId}/lastSeen`), serverTimestamp());
            set(ref(database, `sessions/${this.sessionId}/participants/${this.userId}/connected`), true);
        };
        
        // Update presence every 30 seconds
        this.presenceInterval = setInterval(updatePresence, 30000);
        
        // Handle disconnection
        const disconnectRef = onDisconnect(participantRef);
        disconnectRef.update({
            connected: false,
            lastSeen: serverTimestamp()
        });
    }

    // Add new task (host only)
    async addTask(title, description = '') {
        if (!this.isHost) {
            console.error('Only host can add tasks');
            return null;
        }

        const taskData = {
            title: title,
            description: description,
            createdAt: serverTimestamp(),
            createdBy: this.userId,
            isActive: false
        };

        const newTaskRef = push(this.tasksRef);
        await set(newTaskRef, taskData);
        
        console.log('Task added:', newTaskRef.key);
        return newTaskRef.key;
    }

    // Select task for voting (host only)
    async selectTask(taskId) {
        if (!this.isHost) {
            console.error('Only host can select tasks');
            return;
        }

        const updates = {
            'info/currentTaskId': taskId,
            'info/votingEnabled': true,
            'info/votesRevealed': false,
            'votes': {} // Clear all votes
        };

        await update(ref(database, `sessions/${this.sessionId}`), updates);
        console.log('Task selected for voting:', taskId);
    }

    // Cast vote
    async castVote(vote) {
        const allowedVotes = ['1','2','3','5','8','13','21','?','☕'];
        if (!allowedVotes.includes(vote)) {
            console.error('[FirebaseMessaging] Invalid vote value:', vote);
            throw new Error('Invalid vote value');
        }
        if (!this.sessionId || !this.userId) {
            console.warn('[FirebaseMessaging] Cannot cast vote, missing sessionId or userId', {
                sessionId: this.sessionId,
                userId: this.userId
            });
            return;
        }
        const voteRef = ref(database, `sessions/${this.sessionId}/votes/${this.userId}`);
        console.log('[FirebaseMessaging] Casting vote:', vote, 'for session:', this.sessionId, 'by user:', this.userId);
        try {
            await set(voteRef, {
                value: vote,
                timestamp: serverTimestamp()
            });
            console.log('[FirebaseMessaging] Vote cast:', vote, 'by', this.userId);
        } catch (error) {
            console.error('[FirebaseMessaging] Error casting vote:', error);
            throw error;
        }
    }

    // Reveal votes (host only)
    async revealVotes() {
        if (!this.isHost) {
            console.error('Only host can reveal votes');
            return;
        }

        await set(ref(database, `sessions/${this.sessionId}/info/votesRevealed`), true);
        console.log('Votes revealed');
    }

    // Start next round (host only)
    async nextRound() {
        if (!this.isHost) {
            console.error('Only host can start next round');
            return;
        }

        const updates = {
            'info/currentTaskId': null,
            'info/votingEnabled': true,
            'info/votesRevealed': false,
            'votes': {} // Clear all votes
        };

        const sessionRef = ref(database, `sessions/${this.sessionId}`);
        await update(sessionRef, updates);
        console.log('Next round started');
    }

    // Get session share URL
    getShareURL() {
        return `${window.location.origin}${window.location.pathname}?session=${this.sessionId}`;
    }

    // Disconnect and cleanup
    async disconnect() {
        console.log('Disconnecting from Firebase session');
        
        // Clear presence interval
        if (this.presenceInterval) {
            clearInterval(this.presenceInterval);
        }

        // Update participant status to disconnected
        if (this.userId && this.sessionId) {
            try {
                await set(ref(database, `sessions/${this.sessionId}/participants/${this.userId}/connected`), false);
                await set(ref(database, `sessions/${this.sessionId}/participants/${this.userId}/lastSeen`), serverTimestamp());
            } catch (error) {
                console.error('Error updating disconnection status:', error);
            }
        }

        // Remove all listeners
        this.listeners.forEach(({ ref: dbRef, listener }) => {
            off(dbRef, 'value', listener);
        });
        this.listeners = [];

        // Reset state
        this.sessionId = null;
        this.userId = null;
        this.isHost = false;
        
        this.onConnectionChange('firebase', 'disconnected');
    }

    // Get connection status
    getConnectionStatus() {
        return {
            isConnected: this.isConnected,
            sessionId: this.sessionId,
            userId: this.userId,
            isHost: this.isHost,
            provider: 'firebase'
        };
    }
}

// Export for use in main app
export default FirebaseMessaging;