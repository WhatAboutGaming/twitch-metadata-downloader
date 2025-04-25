# twitch-metadata-downloader
Node.js application used to mass download metadata and thumbnails for Twitch VODs and Clips.

Everything is done via config files, there's ``global.json`` and ``twitch_credentials.json``. ``global.json`` is where a list of channels goes, videos and clips whose metadata you want to download. ``twitch_credentials.json`` is where your Twitch credentials go, stuff such as Client ID, Client Secret, Client Access Token, User ID, Channel name, and scopes (Scopes is currently unused), read notes to see how to generate a new token. You have to make sure ``use_twitch_api`` is always set to ``true`` before running the app.
