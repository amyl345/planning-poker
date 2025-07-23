# Planning Poker Tool

A real-time planning poker application for agile teams to estimate story points collaboratively. Built with pure HTML, CSS, and JavaScript - no external frameworks required.

## Features

- **Multi-user Sessions**: Create or join planning poker sessions with unique session IDs
- **Real-time Collaboration**: Simulated real-time updates using localStorage polling
- **Task Management**: Add, select, and vote on user stories or tasks
- **Standard Cards**: Classic planning poker values (1, 2, 3, 5, 8, 13, 21, ?, ☕)
- **Host Controls**: Session host can manage tasks and control voting flow
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **No Backend Required**: Perfect for GitHub Pages hosting

## How to Use

### For Session Hosts

1. **Create Session**: Enter your name and click "Create New Session"
2. **Share Session**: Copy the URL or share the session ID with team members
3. **Add Tasks**: Click "Add Task" to create user stories for estimation
4. **Start Voting**: Click on a task to select it and enable voting
5. **Reveal Results**: Once everyone has voted, click "Reveal Votes"
6. **Next Round**: Click "Next Round" to clear votes and select another task

### For Participants

1. **Join Session**: Enter your name and the session ID, then click "Join Session"
2. **Wait for Task**: The host will select a task for estimation
3. **Vote**: Click on a card to submit your estimate
4. **View Results**: Once revealed, see all votes and discuss as needed

## Deployment

### GitHub Pages
1. Push this repository to GitHub
2. Go to Settings > Pages
3. Select source branch (usually `main` or `master`)
4. Your app will be available at `https://yourusername.github.io/repository-name`

### Local Development
1. Simply open `index.html` in a web browser
2. For local testing with multiple users, open multiple browser tabs/windows

## Technical Details

- **Pure JavaScript**: No external dependencies
- **LocalStorage**: Used for session persistence and real-time simulation
- **Responsive CSS**: Mobile-first design with CSS Grid and Flexbox
- **Cross-browser**: Compatible with modern browsers
- **Accessible**: Keyboard navigation and screen reader friendly

## Browser Compatibility

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## Session Management

Sessions are stored in browser localStorage and automatically sync between participants every 2 seconds. Sessions persist until manually cleared or the browser cache is cleared.

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