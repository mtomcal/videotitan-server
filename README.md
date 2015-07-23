# VideoTitan Server

VideoTitan, a side-project of mine, is a React.js frontend for Youtube playlists. This is the server-side API backend for VideoTitan that has endpoints for pulling the latest Youtube playlists into a Firebase store and then importing all the Video meta data associated with each playlist. I am still working on hooking up this newly written backend into the React.js project using Firebase.

##Tech Used

Hapi.js, ES6 Babel, and Youtube API SDK.

## Install

Add a Youtube key for ```config/default.js``` then...

```
npm install
gulp
```

## API Documentation

```http://localhost:3000/documentation```
