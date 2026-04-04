# AI Nexus - Deployment and Market Guide

## Overview
AI Nexus is a next-generation social platform designed for creators, developers, and AI enthusiasts. It integrates AI-powered content generation, a marketplace for digital products, real-time messaging, and social networking into a single, cohesive experience.

## Target Market & Audience
- **Content Creators:** Looking for AI tools to streamline content creation (auto-generating posts, images, and ideas).
- **Developers & Tech Enthusiasts:** Interested in sharing code snippets, AI prompts, and technical discussions.
- **Digital Entrepreneurs:** Utilizing the marketplace to sell templates, prompts, and digital goods.
- **General Users:** Seeking a modern, AI-enhanced social media experience.

## Key Features
1. **AI-Powered Content Creation:** Generate posts, comments, and images using integrated Gemini AI models.
2. **Social Networking:** Follow users, like/comment on posts, and share content seamlessly.
3. **Drafts & Categories:** Organize posts by categories (Technology, Design, Business, etc.) and save drafts for later.
4. **Marketplace:** Buy and sell digital products, templates, and AI prompts.
5. **Real-Time Messaging:** Direct messaging between users.
6. **Creator Dashboard:** Analytics and management tools for content creators.
7. **Ephemeral Statuses:** WhatsApp-like 24-hour status updates.

## Deployment Process
This application is built with React, Vite, Tailwind CSS, and Firebase.

### Web Deployment (Vercel, Netlify, Firebase)

#### Prerequisites
- Node.js (v18+)
- Firebase Project with Firestore, Authentication, and Storage enabled.
- Gemini API Key.

#### Environment Variables
Ensure the following environment variables are set in your deployment environment:
- `VITE_GEMINI_API_KEY`: Your Google Gemini API Key for AI features.
- Firebase configuration variables (if not using `firebase-applet-config.json` directly).

#### Build & Deploy
1. **Install Dependencies:**
   ```bash
   npm install
   ```
2. **Build the Application:**
   ```bash
   npm run build
   ```
3. **Deploy:**
   - The build output will be in the `dist/` directory.
   - **Vercel / Netlify:** Connect your GitHub repository, set the build command to `npm run build`, and the publish directory to `dist`. Add your environment variables in their dashboard.
   - **Firebase Hosting:**
     ```bash
     npm install -g firebase-tools
     firebase login
     firebase init hosting # Select 'dist' as the public directory
     firebase deploy --only hosting
     ```

### Converting to Android and iOS (Capacitor)
Since this is a modern web app, the easiest way to publish it to the Google Play Store and Apple App Store is by using **Capacitor** (a cross-platform native runtime).

#### 1. Install Capacitor
Run these commands in your project terminal:
```bash
npm install @capacitor/core @capacitor/cli
```

#### 2. Initialize Capacitor
```bash
npx cap init "Nexus AI" "com.nexus.app" --web-dir dist
```

#### 3. Add Native Platforms
Install the Android and iOS packages:
```bash
npm install @capacitor/android @capacitor/ios
npx cap add android
npx cap add ios
```

#### 4. Sync Your Code
Every time you make changes to your web app, you need to build it and sync it to the native projects:
```bash
npm run build
npx cap sync
```

#### 5. Build and Publish
- **For Android:** Run `npx cap open android` to open the project in Android Studio. From there, you can build your APK or App Bundle for the Google Play Store.
- **For iOS:** Run `npx cap open ios` to open the project in Xcode (requires a Mac). From there, you can build and archive your app for the Apple App Store.

*Note: For Google Sign-In to work natively on iOS and Android, you may need to install the `@capacitor-firebase/authentication` plugin and configure the native Google Service files (`google-services.json` and `GoogleService-Info.plist`).*

## Marketing Strategy
- **Leverage AI:** Highlight the "AI-first" approach. Show how users can save time generating content.
- **Community Building:** Encourage tech influencers to share their prompts and templates in the marketplace.
- **Monetization:** Promote the marketplace as a way for creators to earn money directly from their audience.

## Future Roadmap
- **Advanced AI Agents:** Allow users to train custom AI agents based on their profile data.
- **Web3 Integration:** Crypto wallet support for marketplace transactions.
- **Live Audio/Video Rooms:** Real-time collaboration spaces.
