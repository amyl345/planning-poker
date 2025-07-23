
# Planning Poker Tool - P2P & Firebase Edition

A real-time planning poker application for agile teams to estimate story points collaboratively. Built with pure HTML, CSS, and JavaScript using P2P WebRTC technology and optional Firebase Realtime Database for cloud sessions. No external frameworks required.


## Features

- **True Multi-user Sessions**: Peer-to-peer or cloud collaboration across browsers/devices
- **P2P WebRTC Communication**: Direct browser-to-browser connections with automatic fallback
- **Firebase Cloud Sessions**: Use Firebase Realtime Database for persistent, multi-user sessions
- **Fragment Sharing Fallback**: URL-based session sharing when WebRTC isn't available
- **Task Management**: Add, select, and vote on user stories or tasks
- **Standard Cards**: Classic planning poker values (1, 2, 3, 5, 8, 13, 21, ?, ☕)
- **Host Controls**: Session host can manage tasks and control voting flow
- **Responsive Design**: Works on desktop, tablet, and mobile devices


## How to Use


### For Session Hosts

1. **Create Session**: Enter your name and click "Create New Session"
2. **Share Session**: Click "Share URL" to copy the session link for team members
3. **Connection Method**: App automatically uses WebRTC P2P, Firebase, or URL sharing
4. **Add Tasks**: Click "Add Task" to create user stories for estimation
5. **Start Voting**: Click on a task to select it and enable voting
6. **Reveal Results**: Once everyone has voted, click "Reveal Votes"
7. **Next Round**: Click "Next Round" to clear votes and select another task


### For Participants

1. **Join Session**: Click the shared URL or enter your name and session ID
2. **Auto-Connect**: App automatically establishes P2P or Firebase connection with host
3. **Wait for Task**: The host will select a task for estimation
4. **Vote**: Click on a card to submit your estimate
5. **View Results**: Once revealed, see all votes and discuss as needed


## Connection Methods

### WebRTC P2P (Primary)
- **Real-time sync**: Instant updates between all participants
- **Direct connections**: Browser-to-browser communication
- **Host relay**: Host acts as central relay for all participants
- **Automatic**: Works transparently when browsers support WebRTC

### Firebase Cloud Sessions (Production)
- **Persistent cloud sessions**: Use Firebase Realtime Database for multi-user sessions
- **Anonymous Authentication**: No sign-up required, but must be enabled in Firebase Console
- **Production Database Rules**: You must set rules to allow only authenticated users to read/write:
  ```json
  {
    "rules": {
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
  ```
- **Session ID Format**: Session IDs must be 6 uppercase alphanumeric characters (A-Z, 0-9)
- **Host/Participant Permissions**: Only the host can manage tasks and session info; users can only update their own participant and vote records

### Fragment Sharing (Fallback)
- **URL-based**: Session state encoded in shareable URLs
- **Manual sharing**: Host shares updated URLs when state changes
- **Universal compatibility**: Works on any browser that supports modern JavaScript
- **Compressed state**: Efficient URL encoding for large sessions


## Deployment

### GitHub Pages
1. Push this repository to GitHub
2. Go to Settings > Pages
3. Select source branch (usually `main` or `master`)
4. Your app will be available at `https://yourusername.github.io/repository-name`

### Firebase Production Setup
1. Create a Firebase project at [firebase.google.com](https://firebase.google.com/)
2. Enable Anonymous Authentication in the Firebase Console
3. Copy your Firebase config to `firebase-config.js`
4. **Deploy Firebase Security Rules** (Required - choose one method):

   **Method A: Using Firebase CLI (Recommended)**
   ```bash
   # Install Firebase CLI
   npm install -g firebase-tools
   
   # Login to Firebase
   firebase login
   
   # Initialize Firebase in your project directory
   firebase init database
   
   # Deploy the security rules
   firebase deploy --only database
   ```
   
   **Method B: Manual via Firebase Console**
   - Go to your Firebase Console → Realtime Database → Rules
   - Copy the contents of `database.rules.json` into the rules editor
   - Click "Publish" to deploy the rules

5. Deploy your app as usual

**Important**: The security rules in `database.rules.json` are required for the app to function. Without proper rules, you'll get "PERMISSION_DENIED" errors when creating sessions.


### Local Development
1. Simply open `index.html` in a web browser
2. For local testing with multiple users, open multiple browser tabs/windows


## Technical Details

- **Pure JavaScript**: No external dependencies or frameworks
- **WebRTC DataChannels**: Real peer-to-peer communication
- **Firebase Realtime Database**: Cloud-based session management
- **URL Fragment Encoding**: Compressed session state sharing
- **Responsive CSS**: Mobile-first design with CSS Grid and Flexbox
- **Cross-browser**: Compatible with modern browsers
- **Accessible**: Keyboard navigation and screen reader friendly
- **Dual Connection System**: WebRTC, Firebase, and fragment sharing fallback

## Browser Compatibility

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## Session Management

### WebRTC Mode
- **P2P connections**: Direct browser-to-browser communication via WebRTC DataChannels
- **Host relay**: Host browser acts as central relay for all participants
- **Real-time sync**: Instant updates when votes, tasks, or state changes
- **Auto-reconnect**: Handles connection drops and participant rejoining

### Fragment Sharing Mode  
- **URL encoding**: Session state compressed and encoded in shareable URLs
- **Manual sync**: Host generates new URLs when state changes
- **Universal compatibility**: Works without WebRTC support
- **Persistent links**: URLs contain full session state for easy sharing

## Cards Explained

- **1, 2, 3, 5, 8, 13, 21**: Fibonacci sequence for story point estimation
- **?**: "I don't know" or need more information
- **☕**: "This is too big" or "Let's take a break"

## Customization

The design system follows Bootstrap patterns and can be easily customized by modifying CSS variables in `assets/css/style.css`:

```css
:root {
    --primary-color: #2c5aa0;    /* Main brand color */
    --secondary-color: #6c757d;  /* Secondary actions */
    --success-color: #10b981;    /* Success states */
    /* ... more variables */
}
```

## Contributing

This tool is designed for simplicity and ease of deployment. If you'd like to contribute:

1. Keep it framework-free
2. Maintain responsive design
3. Test across different browsers
4. Follow the existing code style

## License

Open source - feel free to use and modify for your team's needs.