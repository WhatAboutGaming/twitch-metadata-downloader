var fs = require("fs");
var os = require("os");
var http = require("http");
var https = require("https")
var url = require("url");
var path = require("path");

var globalConfig = JSON.parse(fs.readFileSync("global.json", "utf8")); // Contains list of channels, videos and clips to download
var twitchCredentials = JSON.parse(fs.readFileSync("twitch_credentials.json", "utf8")); // Contains Twitch Credentials

var downloaderStepCurrent = 0; // Step 0 = Download videos by channel ID, Step 1 = Download videos by video ID,  Step 2 = Download clips by channel ID, Step 3 = Download clips by clip ID
var downloaderStepOld = 0;

var downloaderVideoChannelIndexCurrent = 0;
var downloaderVideoChannelIndexOld = 0;

var downloaderVideoIdIndexCurrent = 0;
var downloaderVideoIdIndexOld = 0;

var videoIdChunkSize = 25;
var videoIdChunks = [];

var downloaderClipChannelIndexCurrent = 0;
var downloaderClipChannelIndexOld = 0;

var downloaderClipIdIndexCurrent = 0;
var downloaderClipIdIndexOld = 0;

var clipIdChunkSize = 25;
var clipIdChunks = [];

var isDownloaderStep0Busy = false;
var isDownloaderStep1Busy = false;
var isDownloaderStep2Busy = false;
var isDownloaderStep3Busy = false;

var isDownloaderStep0Done = false;
var isDownloaderStep1Done = false;
var isDownloaderStep2Done = false;
var isDownloaderStep3Done = false;

var server = http.createServer(handleRequest);
server.listen(globalConfig.webserver_port);

console.log("Server started on port " + globalConfig.webserver_port);

var filesList = fs.readdirSync(__dirname + path.sep);
//console.log(filesList);
var metadataFilesList = filesList.filter(file => path.extname(file).toLowerCase() === ".json");
metadataFilesList = metadataFilesList.filter(file => file.toLowerCase() !== "global.json");
metadataFilesList = metadataFilesList.filter(file => file.toLowerCase() !== "package.json");
metadataFilesList = metadataFilesList.filter(file => file.toLowerCase() !== "package-lock.json");
metadataFilesList = metadataFilesList.filter(file => file.toLowerCase() !== "twitch_credentials.json");
//console.log("Test A");
//console.log(metadataFilesList);
//console.log("Test B");
var videosStringToAddToMarkdown = "|Video|Description|\n|:---|:---|\n"
var clipsStringToAddToMarkdown = "|Video|Description|\n|:---|:---|\n"
for (let metadataFilesListIndex = 0; metadataFilesListIndex < metadataFilesList.length; metadataFilesListIndex++) {
  let metadataFileToParse = JSON.parse(fs.readFileSync(__dirname + path.sep + metadataFilesList[metadataFilesListIndex], "utf8"));
  //console.log("Index = " + metadataFilesListIndex);
  //console.log(metadataFileToParse);
  let metadataMarkdownFileName = metadataFilesList[metadataFilesListIndex].replace(/\.json/ig, ".md");
  let doesMetadataMarkdownFileExists = fs.existsSync(__dirname + path.sep + metadataMarkdownFileName);
  //console.log(metadataMarkdownFileName);
  //console.log(doesMetadataMarkdownFileExists);
  //console.log(new Date().toISOString() + " [FILE CREATION] Creating file " + createdAtMillis + "_" + createdAtForPaths + "_" + channelId + "_" + videoId + "_video_metadata.json");
  //console.log(new Date().toISOString() + " [VIDEOS] Saving metadata for video ID " + videoId + " title " + videoTitle + " filename " + createdAtMillis + "_" + createdAtForPaths + "_" + channelId + "_" + videoId + "_video_metadata.json");
  //console.log("FILENAME A");
  //console.log(__dirname + path.sep + metadataMarkdownFileName);
  //console.log("FILENAME B");
  let dataToParseToMarkdownVideos = "|[YouTube](https://www.youtube.com/)<br>[Twitch]({{url}})<br><br>[<img src=\"../../../../../{{channel_id}}/videos/thumbnails_1152p/{{year}}/{{month_without_leading_zeros}}/{{date_millis}}_{{created_at_for_paths}}_{{channel_id}}_{{video_id}}_videos_thumbnails_1152p_{{thumbnail_url_1152p}}\" width=\"200\">](https://www.youtube.com/)|Broadcaster ID: {{channel_id}}          Broadcaster: {{channel_name}}<br>Video ID: {{video_id}}             Type: {{video_type}}<br>Title: {{video_title}}<br>Date: {{created_at}}        Date Millis: {{date_millis}}        Duration: {{video_duration}}<br>[Original Size Thumbnail](../../../../../{{channel_id}}/videos/thumbnails_orig/{{year}}/{{month_without_leading_zeros}}/{{date_millis}}_{{created_at_for_paths}}_{{channel_id}}_{{video_id}}_videos_thumbnails_orig_{{thumbnail_url_orig}})          [1152p Size Thumbnail](../../../../../{{channel_id}}/videos/thumbnails_1152p/{{year}}/{{month_without_leading_zeros}}/{{date_millis}}_{{created_at_for_paths}}_{{channel_id}}_{{video_id}}_videos_thumbnails_1152p_{{thumbnail_url_1152p}})<br>[Metadata](../../../../../{{channel_id}}/videos/metadata/{{year}}/{{month_without_leading_zeros}}/{{date_millis}}_{{created_at_for_paths}}_{{channel_id}}_{{video_id}}_video_metadata.json)                 [Chat Log](../../../../../{{channel_id}}/videos/chatlogs/{{year}}/{{month_without_leading_zeros}}/{{created_at_2}}_{{channel_id}}_{{video_id}}_chat.json)<br>Upscaled: No                Broken Video: No<br>Missing Chat Log: No           Missing Thumbnail: No<br>Non-native: No              Split Video: No               Parts: 1<br>Missing Video: No";
  let dataToParseToMarkdownClips = "|[YouTube](https://www.youtube.com/)<br>[Twitch]({{url}})<br><br>[<img src=\"../../../../../{{channel_id}}/clips/thumbnails_1152p/{{year}}/{{month_without_leading_zeros}}/{{date_millis}}_{{created_at_for_paths}}_{{channel_id}}_{{video_id}}_clips_thumbnails_1152p_{{thumbnail_url_1152p}}\" width=\"200\">](https://www.youtube.com/)|Broadcaster ID: {{channel_id}}          Broadcaster: {{channel_name}}<br>Clip ID: {{video_id}}             <br>Title: {{video_title}}<br>Date: {{created_at}}        Date Millis: {{date_millis}}        Duration: {{video_duration}}<br>[Original Size Thumbnail](../../../../../{{channel_id}}/clips/thumbnails_orig/{{year}}/{{month_without_leading_zeros}}/{{date_millis}}_{{created_at_for_paths}}_{{channel_id}}_{{video_id}}_clips_thumbnails_orig_{{thumbnail_url_orig}})          [1152p Size Thumbnail](../../../../../{{channel_id}}/clips/thumbnails_1152p/{{year}}/{{month_without_leading_zeros}}/{{date_millis}}_{{created_at_for_paths}}_{{channel_id}}_{{video_id}}_clips_thumbnails_1152p_{{thumbnail_url_1152p}})<br>[Metadata](../../../../../{{channel_id}}/clips/metadata/{{year}}/{{month_without_leading_zeros}}/{{date_millis}}_{{created_at_for_paths}}_{{channel_id}}_{{video_id}}_clip_metadata.json)                 [Chat Log](../../../../../{{channel_id}}/clips/chatlogs/{{year}}/{{month_without_leading_zeros}}/{{created_at_2}}_{{channel_id}}_{{video_id}}_chat.json)<br>Upscaled: No                Broken Video: No<br>Missing Chat Log: No           Missing Thumbnail: No<br>Non-native: No              Split Video: No               Parts: 1<br>Missing Video: No              Clip Creator Name: {{clip_creator_name}}<br>Clip Creator ID: {{clip_creator_id}}";
  //console.log(dataToParseToMarkdownVideos);
  let processedDataToParseVideos = dataToParseToMarkdownVideos;
  let processedDataToParseClips = dataToParseToMarkdownClips;
  let dateReplacedColonsWithUnderscores = metadataFileToParse.created_at.replace(/\:+/ig, "_");
  dateReplacedColonsWithUnderscores = dateReplacedColonsWithUnderscores.replace(/\-+/ig, "_");
  let thumbnailUrlOrig = metadataFileToParse.thumbnail_url;
  thumbnailUrlOrig = thumbnailUrlOrig.replace(/(\%\{width\})+/ig, "0");
  thumbnailUrlOrig = thumbnailUrlOrig.replace(/(\%\{height\})+/ig, "0");
  //thumbnailUrlOrig = thumbnailUrlOrig.replace(/(\d+x+\d+)+/ig, "0x0");
  thumbnailUrlOrig = thumbnailUrlOrig.replace(/(\d+x+\d+)+\.+((j+p+g+)+|(p+n+g+)+|(w+e+b+p+)+)+/ig, "0x0.jpg");
  //console.log("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
  //console.log(thumbnailUrlOrig);
  let thumbnailUrl1152p = metadataFileToParse.thumbnail_url;
  thumbnailUrl1152p = thumbnailUrl1152p.replace(/(\%\{width\})+/ig, "2048");
  thumbnailUrl1152p = thumbnailUrl1152p.replace(/(\%\{height\})+/ig, "1152");
  //thumbnailUrl1152p = thumbnailUrl1152p.replace(/(\d+x+\d+)+/ig, "2048x1152");
  thumbnailUrl1152p = thumbnailUrl1152p.replace(/(\d+x+\d+)+\.+((j+p+g+)+|(p+n+g+)+|(w+e+b+p+)+)+/ig, "2048x1152.jpg");
  //console.log("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
  //console.log(thumbnailUrl1152p);
  let thumbnailUrlOrigParts = thumbnailUrlOrig.split(/\/+/ig);
  let thumbnailUrl1152pParts = thumbnailUrl1152p.split(/\/+/ig);
  //console.log(thumbnailUrl1152pParts[thumbnailUrlOrigParts.length-1]);
  //console.log(thumbnailUrlOrigParts[thumbnailUrlOrigParts.length-1]);
  processedDataToParseVideos = processedDataToParseVideos.replace(/(\{\{url\}\})+/ig, metadataFileToParse.url);
  processedDataToParseVideos = processedDataToParseVideos.replace(/(\{\{video_id\}\})+/ig, metadataFileToParse.id);
  processedDataToParseVideos = processedDataToParseVideos.replace(/(\{\{channel_id\}\})+/ig, metadataFileToParse.user_id);
  processedDataToParseVideos = processedDataToParseVideos.replace(/(\{\{year\}\})+/ig, metadataFileToParse.created_at_year);
  processedDataToParseVideos = processedDataToParseVideos.replace(/(\{\{month_without_leading_zeros\}\})+/ig, metadataFileToParse.created_at_month);
  //processedDataToParseVideos = processedDataToParseVideos.replace(/(\{\{month_with_leading_zeros\}\})+/ig, metadataFileToParse.created_at_month).toString().padStart(2, "0");
  processedDataToParseVideos = processedDataToParseVideos.replace(/(\{\{day\}\})+/ig, metadataFileToParse.created_at_date);
  //processedDataToParseVideos = processedDataToParseVideos.replace(/(\{\{day_with_leading_zeros\}\})+/ig, metadataFileToParse.created_at_date).toString().padStart(2, "0");
  processedDataToParseVideos = processedDataToParseVideos.replace(/(\{\{date_millis\}\})+/ig, metadataFileToParse.created_at_millis);
  processedDataToParseVideos = processedDataToParseVideos.replace(/(\{\{hour\}\})+/ig, metadataFileToParse.created_at_hour);
  //processedDataToParseVideos = processedDataToParseVideos.replace(/(\{\{hour_with_leading_zeros\}\})+/ig, metadataFileToParse.created_at_hour).toString().padStart(2, "0");
  processedDataToParseVideos = processedDataToParseVideos.replace(/(\{\{minute\}\})+/ig, metadataFileToParse.created_at_minute);
  //processedDataToParseVideos = processedDataToParseVideos.replace(/(\{\{minute_with_leading_zeros\}\})+/ig, metadataFileToParse.created_at_minute).toString().padStart(2, "0");
  processedDataToParseVideos = processedDataToParseVideos.replace(/(\{\{second\}\})+/ig, metadataFileToParse.created_at_second);
  //processedDataToParseVideos = processedDataToParseVideos.replace(/(\{\{second_with_)leading_zeros\}\})+/ig, metadataFileToParse.created_at_second).toString().padStart(2, "0");
  processedDataToParseVideos = processedDataToParseVideos.replace(/(\{\{channel_name\}\})+/ig, metadataFileToParse.user_login);
  processedDataToParseVideos = processedDataToParseVideos.replace(/(\{\{video_type\}\})+/ig, metadataFileToParse.type);
  processedDataToParseVideos = processedDataToParseVideos.replace(/(\{\{video_title\}\})+/ig, metadataFileToParse.title);
  processedDataToParseVideos = processedDataToParseVideos.replace(/(\{\{video_duration\}\})+/ig, metadataFileToParse.duration);
  processedDataToParseVideos = processedDataToParseVideos.replace(/(\{\{created_at\}\})+/ig, metadataFileToParse.created_at);
  processedDataToParseVideos = processedDataToParseVideos.replace(/(\{\{created_at_2\}\})+/ig, dateReplacedColonsWithUnderscores);
  processedDataToParseVideos = processedDataToParseVideos.replace(/(\{\{created_at_for_paths\}\})+/ig, metadataFileToParse.created_at_for_paths);
  processedDataToParseVideos = processedDataToParseVideos.replace(/(\{\{thumbnail_url_1152p\}\})+/ig, thumbnailUrl1152pParts[thumbnailUrlOrigParts.length-1]);
  processedDataToParseVideos = processedDataToParseVideos.replace(/(\{\{thumbnail_url_orig\}\})+/ig, thumbnailUrlOrigParts[thumbnailUrlOrigParts.length-1]);


  let clipUrlWithoutPipe = metadataFileToParse.url;
  //clipUrlWithoutPipe = clipUrlWithoutPipe.replace(/\|+/ig, "%25");
  //clipUrlWithoutPipe = clipUrlWithoutPipe.replace(/\|+/ig, "%7C");
  //clipUrlWithoutPipe = clipUrlWithoutPipe.replace(/\|+/ig, "%257C");
  processedDataToParseClips = processedDataToParseClips.replace(/(\{\{url\}\})+/ig, clipUrlWithoutPipe);
  processedDataToParseClips = processedDataToParseClips.replace(/(\{\{video_id\}\})+/ig, metadataFileToParse.id);
  processedDataToParseClips = processedDataToParseClips.replace(/(\{\{channel_id\}\})+/ig, metadataFileToParse.broadcaster_id);
  processedDataToParseClips = processedDataToParseClips.replace(/(\{\{year\}\})+/ig, metadataFileToParse.created_at_year);
  processedDataToParseClips = processedDataToParseClips.replace(/(\{\{month_without_leading_zeros\}\})+/ig, metadataFileToParse.created_at_month);
  //processedDataToParseClips = processedDataToParseClips.replace(/(\{\{month_with_leading_zeros\}\})+/ig, metadataFileToParse.created_at_month).toString().padStart(2, "0");
  processedDataToParseClips = processedDataToParseClips.replace(/(\{\{day\}\})+/ig, metadataFileToParse.created_at_date);
  //processedDataToParseClips = processedDataToParseClips.replace(/(\{\{day_with_leading_zeros\}\})+/ig, metadataFileToParse.created_at_date).toString().padStart(2, "0");
  processedDataToParseClips = processedDataToParseClips.replace(/(\{\{date_millis\}\})+/ig, metadataFileToParse.created_at_millis);
  processedDataToParseClips = processedDataToParseClips.replace(/(\{\{hour\}\})+/ig, metadataFileToParse.created_at_hour);
  //processedDataToParseClips = processedDataToParseClips.replace(/(\{\{hour_with_leading_zeros\}\})+/ig, metadataFileToParse.created_at_hour).toString().padStart(2, "0");
  processedDataToParseClips = processedDataToParseClips.replace(/(\{\{minute\}\})+/ig, metadataFileToParse.created_at_minute);
  //processedDataToParseClips = processedDataToParseClips.replace(/(\{\{minute_with_leading_zeros\}\})+/ig, metadataFileToParse.created_at_minute).toString().padStart(2, "0");
  processedDataToParseClips = processedDataToParseClips.replace(/(\{\{second\}\})+/ig, metadataFileToParse.created_at_second);
  //processedDataToParseClips = processedDataToParseClips.replace(/(\{\{second_with_)leading_zeros\}\})+/ig, metadataFileToParse.created_at_second).toString().padStart(2, "0");
  processedDataToParseClips = processedDataToParseClips.replace(/(\{\{channel_name\}\})+/ig, metadataFileToParse.broadcaster_name);
  //processedDataToParseClips = processedDataToParseClips.replace(/(\{\{video_type\}\})+/ig, metadataFileToParse.type);
  processedDataToParseClips = processedDataToParseClips.replace(/(\{\{video_title\}\})+/ig, metadataFileToParse.title);
  processedDataToParseClips = processedDataToParseClips.replace(/(\{\{video_duration\}\})+/ig, metadataFileToParse.duration);
  processedDataToParseClips = processedDataToParseClips.replace(/(\{\{created_at\}\})+/ig, metadataFileToParse.created_at);
  processedDataToParseClips = processedDataToParseClips.replace(/(\{\{created_at_2\}\})+/ig, dateReplacedColonsWithUnderscores);
  processedDataToParseClips = processedDataToParseClips.replace(/(\{\{created_at_for_paths\}\})+/ig, metadataFileToParse.created_at_for_paths);
  processedDataToParseClips = processedDataToParseClips.replace(/(\{\{thumbnail_url_1152p\}\})+/ig, thumbnailUrl1152pParts[thumbnailUrlOrigParts.length-1]);
  processedDataToParseClips = processedDataToParseClips.replace(/(\{\{thumbnail_url_orig\}\})+/ig, thumbnailUrlOrigParts[thumbnailUrlOrigParts.length-1]);
  processedDataToParseClips = processedDataToParseClips.replace(/(\{\{clip_creator_name\}\})+/ig, metadataFileToParse.creator_name);
  processedDataToParseClips = processedDataToParseClips.replace(/(\{\{clip_creator_id\}\})+/ig, metadataFileToParse.creator_id);
  //console.log(processedDataToParseVideos);
  videosStringToAddToMarkdown = videosStringToAddToMarkdown + processedDataToParseVideos + "\n";
  clipsStringToAddToMarkdown = clipsStringToAddToMarkdown + processedDataToParseClips + "\n";
  // {{clip_creator_name}}<br>Clip Creator ID: {{clip_creator_id}}";
  //console.log(new Date().toISOString() + " [VIDEOS] Saved metadata for video ID " + videoId + " title " + videoTitle + " filename " + createdAtMillis + "_" + createdAtForPaths + "_" + channelId + "_" + videoId + "_video_metadata.json");
}
//console.log(videosStringToAddToMarkdown);
let currentTimeMillis = new Date().getTime();
fs.writeFileSync(__dirname + path.sep + "output" + path.sep + "videos_" + currentTimeMillis + ".md", videosStringToAddToMarkdown, "utf8");
fs.writeFileSync(__dirname + path.sep + "output" + path.sep + "clips_" + currentTimeMillis + ".md", clipsStringToAddToMarkdown, "utf8");
console.log("Test C");

process.exit(0);

function handleRequest(req, res) {
  // What did we request?
  let pathname = req.url;

  // If blank let's ask for index.html
  if (pathname == "/") {
    pathname = "/index.html";
  }

  // Ok what's our file extension
  var ext = path.extname(pathname);

  // Map extension to file type
  var typeExt = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".ttf": "font/ttf",
    ".ico": "image/vnd.microsoft.icon",
    ".mp3": "audio/mpeg",
    ".png": "image/png",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".gif": "image/gif"
  };

  // What is it?  Default to plain text
  var contentType = typeExt[ext] || "text/plain";

  // User file system module
  fs.readFile(__dirname + pathname,
    // Callback function for reading
    function(err, data) {
      // if there is an error
      if (err) {
        res.writeHead(500);
        return res.end("Error loading " + pathname);
      }
      // Otherwise, send the data, the contents of the file
      res.writeHead(200, {
        "Content-Type": contentType
      });
      res.end(data);
    }
  );
}

// WebSocket Portion
// WebSockets work with the HTTP server
var io = require("socket.io").listen(server);

// Register a callback function to run when we have an individual connection
// This is run for each individual user that connects
io.sockets.on("connection",
  // We are given a websocket object in our function
  function(socket) {
    console.log(new Date().toISOString() + " We have a new client: " + socket.id);
    globalConfig = JSON.parse(fs.readFileSync("global.json", "utf8")); // Contains list of channels, videos and clips to download
    twitchCredentials = JSON.parse(fs.readFileSync("twitch_credentials.json", "utf8")); // Contains Twitch Credentials
    socket.on("disconnect", function() {
      console.log(new Date().toISOString() + " Client has disconnected: " + socket.id);
    });
  }
);


setInterval(downloadRequestedMetadata, 2000, globalConfig, twitchCredentials);

function downloadRequestedMetadata(globalConfigObject, twitchCredentialsObject) {
  if (downloaderStepCurrent == 0) {
    if (isDownloaderStep0Done == false) {
      if (globalConfigObject.videos.channel_ids.length <= 0) {
        console.log(new Date().toISOString() + " There are no channels to list in videos by channel ID, we can close this step.");
        isDownloaderStep0Done = true;
      }
      if (globalConfigObject.videos.channel_ids.length > 0) {
        if (downloaderVideoChannelIndexCurrent != downloaderVideoChannelIndexOld) {
          console.log(new Date().toISOString() + " downloaderVideoChannelIndexCurrent = " + downloaderVideoChannelIndexCurrent +  " , downloaderVideoChannelIndexOld = " + downloaderVideoChannelIndexOld);
          isDownloaderStep0Busy = false;
          if (downloaderVideoChannelIndexCurrent >= globalConfigObject.videos.channel_ids.length) {
            console.log(new Date().toISOString() + " We are at the end of videos by channel IDs list, we can now close this step.");
            isDownloaderStep0Done = true;
          }
        }
        if (isDownloaderStep0Busy == false && isDownloaderStep0Done == false) {
          isDownloaderStep0Busy = true;
          console.log(new Date().toISOString() + " Starting step " + downloaderStepCurrent + ": Download videos by channel ID");
          getTwitchVideosByBroadcasterId(globalConfigObject.videos.channel_ids[downloaderVideoChannelIndexCurrent], globalConfigObject, twitchCredentials, "");
        }
      }
    }
    if (isDownloaderStep0Done == true) {
      console.log(new Date().toISOString() + " Finished step 0: Download videos by channel ID. We can now go to step 1: Download videos by video ID.");
      downloaderStepCurrent = 1;
    }
    downloaderVideoChannelIndexOld = downloaderVideoChannelIndexCurrent;
  }

  ////////////////

  if (downloaderStepCurrent == 1) {
    console.log(new Date().toISOString() + " downloaderVideoIdIndexCurrent = " + downloaderVideoIdIndexCurrent +  " , downloaderVideoIdIndexOld = " + downloaderVideoIdIndexOld + " videoIdChunks.length = " + videoIdChunks.length);
    if (isDownloaderStep1Done == false) {
      if (globalConfigObject.videos.video_ids.length <= 0) {
        console.log(new Date().toISOString() + " There are no videos to list in videos by video ID, we can now close this step.");
        isDownloaderStep1Done = true;
      }
      if (globalConfigObject.videos.video_ids.length > 0) {
        if (videoIdChunks.length <= 0) {
          for (let videoIdChunksIndex = 0; videoIdChunksIndex < globalConfigObject.videos.video_ids.length; videoIdChunksIndex += videoIdChunkSize) {
            let videoIdChunk = globalConfigObject.videos.video_ids.slice(videoIdChunksIndex, videoIdChunksIndex + videoIdChunkSize);
            videoIdChunks.push(videoIdChunk);
          }
        }
        //console.log("TEST");
        //console.log(videoIdChunks);
        if (downloaderVideoIdIndexCurrent != downloaderVideoIdIndexOld) {
          console.log(new Date().toISOString() + " downloaderVideoIdIndexCurrent = " + downloaderVideoIdIndexCurrent +  " , downloaderVideoIdIndexOld = " + downloaderVideoIdIndexOld);
          isDownloaderStep1Busy = false;
          if (downloaderVideoIdIndexCurrent >= videoIdChunks.length) {
            console.log(new Date().toISOString() + " We are at the end of videos by video IDs list, we can now close this step.");
            isDownloaderStep1Done = true;
          }
        }
        if (isDownloaderStep1Busy == false && isDownloaderStep1Done == false) {
          isDownloaderStep1Busy = true;
          console.log(new Date().toISOString() + " Starting step " + downloaderStepCurrent + ": Download videos by video ID");
          //console.log("downloaderVideoIdIndexCurrent " + downloaderVideoIdIndexCurrent + " videoIdChunks[downloaderVideoIdIndexCurrent] = " + videoIdChunks[downloaderVideoIdIndexCurrent]);
          getTwitchVideosByVideoId(videoIdChunks[downloaderVideoIdIndexCurrent], globalConfigObject, twitchCredentials);
        }
      }
    }
    if (isDownloaderStep1Done == true) {
      console.log(new Date().toISOString() + " Finished step 1: Download videos by video ID. We can now go to step 2: Download clips by channel ID.");
      downloaderStepCurrent = 2;
    }
    downloaderVideoIdIndexOld = downloaderVideoIdIndexCurrent;
  }

  //////////////////

  if (downloaderStepCurrent == 2) {
    if (isDownloaderStep2Done == false) {
      if (globalConfigObject.clips.channel_ids.length <= 0) {
        console.log(new Date().toISOString() + " There are no channels to list in clips by channel ID, we can close this step.");
        isDownloaderStep2Done = true;
      }
      if (globalConfigObject.clips.channel_ids.length > 0) {
        if (downloaderClipChannelIndexCurrent != downloaderClipChannelIndexOld) {
          console.log(new Date().toISOString() + " downloaderClipChannelIndexCurrent = " + downloaderClipChannelIndexCurrent +  " , downloaderClipChannelIndexOld = " + downloaderClipChannelIndexOld);
          isDownloaderStep2Busy = false;
          if (downloaderClipChannelIndexCurrent >= globalConfigObject.clips.channel_ids.length) {
            console.log(new Date().toISOString() + " We are at the end of clips by channel IDs list, we can now close this step.");
            isDownloaderStep2Done = true;
          }
        }
        if (isDownloaderStep2Busy == false && isDownloaderStep2Done == false) {
          isDownloaderStep2Busy = true;
          console.log(new Date().toISOString() + " Starting step " + downloaderStepCurrent + ": Download clips by channel ID");
          getTwitchClipsByBroadcasterId(globalConfigObject.clips.channel_ids[downloaderClipChannelIndexCurrent], globalConfigObject, twitchCredentials, "");
        }
      }
    }
    if (isDownloaderStep2Done == true) {
      console.log(new Date().toISOString() + " Finished step 2: Download clips by channel ID. We can now go to step 3: Download clips by clip ID.");
      downloaderStepCurrent = 3;
    }
    downloaderClipChannelIndexOld = downloaderClipChannelIndexCurrent;
  }

  ///////////////////////

  if (downloaderStepCurrent == 3) {
    if (isDownloaderStep3Done == false) {
      if (globalConfigObject.clips.clip_ids.length <= 0) {
        console.log(new Date().toISOString() + " There are no clips to list in clips by clip ID, we can now close this step.");
        isDownloaderStep3Done = true;
      }
      if (globalConfigObject.clips.clip_ids.length > 0) {
        if (clipIdChunks.length <= 0) {
          for (let clipIdChunksIndex = 0; clipIdChunksIndex < globalConfigObject.clips.clip_ids.length; clipIdChunksIndex += clipIdChunkSize) {
            let clipIdChunk = globalConfigObject.clips.clip_ids.slice(clipIdChunksIndex, clipIdChunksIndex + clipIdChunkSize);
            clipIdChunks.push(clipIdChunk);
          }
        }
        //console.log("TEST");
        //console.log(clipIdChunks);
        if (downloaderClipIdIndexCurrent != downloaderClipIdIndexOld) {
          console.log(new Date().toISOString() + " downloaderClipIdIndexCurrent = " + downloaderClipIdIndexCurrent +  " , downloaderClipIdIndexOld = " + downloaderClipIdIndexOld);
          isDownloaderStep3Busy = false;
          if (downloaderClipIdIndexCurrent >= clipIdChunks.length) {
            console.log(new Date().toISOString() + " We are at the end of clips by clip IDs list, we can now close this step.");
            isDownloaderStep3Done = true;
          }
        }
        if (isDownloaderStep3Busy == false && isDownloaderStep3Done == false) {
          isDownloaderStep3Busy = true;
          console.log(new Date().toISOString() + " Starting step " + downloaderStepCurrent + ": Download clips by clip ID");
          //console.log("downloaderClipIdIndexCurrent " + downloaderClipIdIndexCurrent + " clipIdChunks[downloaderClipIdIndexCurrent] = " + clipIdChunks[downloaderClipIdIndexCurrent]);
          getTwitchClipsByClipId(clipIdChunks[downloaderClipIdIndexCurrent], globalConfigObject, twitchCredentials);
        }
      }
    }
    if (isDownloaderStep3Done == true) {
      console.log(new Date().toISOString() + " Finished step 3: Download clips by clip ID. We can now go to step 4: End the script.");
      downloaderStepCurrent = 4;
    }
    downloaderClipIdIndexOld = downloaderClipIdIndexCurrent;
  }

  ////////////////

  //console.log(new Date().toISOString() + " Things are happening I guess");
  //console.log(globalConfigObject);
  //console.log(twitchCredentialsObject);
  if (downloaderStepCurrent >= 4) {
    console.log(new Date().toISOString() + " All done! You can now close this window!");
    //quitApp();
  }
  downloaderStepOld = downloaderStepCurrent;
}

function getTwitchVideosByBroadcasterId(broadcasterId, globalConfigObject, twitchCredentialsObject, paginationCursor) {
  if (twitchCredentialsObject.use_twitch_api == false) {
    return;
  }
  console.log(new Date().toISOString() + " [VIDEOS] Attempting to download videos list for channel " + broadcasterId);
  let rawOutputData = "";
  let nextPageCursor = "";
  let twitchBotClientId = twitchCredentialsObject.twitch_client_id;
  let twitchBotId = twitchCredentialsObject.twitch_channel_id;
  let twitchBotOauthToken = twitchCredentialsObject.twitch_oauth_access_token;
  let pathToUse = "/helix/videos?user_id=" + broadcasterId + "&type=all&period=all&sort=time&first=100";
  if (paginationCursor === "" || paginationCursor === undefined || paginationCursor === null || paginationCursor === [] || paginationCursor === "[]" || paginationCursor.toLowerCase() === "null" || paginationCursor.toLowerCase() === "undefined") {
    //console.log(new Date().toISOString() + " No pagination cursor provided!");
    pathToUse = "/helix/videos?user_id=" + broadcasterId + "&type=all&period=all&sort=time&first=100";
  }
  if (paginationCursor !== "" && paginationCursor !== undefined && paginationCursor !== null && paginationCursor !== [] && paginationCursor !== "[]" && paginationCursor.toLowerCase() !== "null" && paginationCursor.toLowerCase() !== "undefined") {
    //console.log(new Date().toISOString() + " Using Pagination Cursor " + paginationCursor);
    pathToUse = "/helix/videos?user_id=" + broadcasterId + "&type=all&period=all&sort=time&first=100" + "&after=" + paginationCursor;
  }
  let options = {
    hostname: "api.twitch.tv",
    path: pathToUse,
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + twitchBotOauthToken,
      "Client-Id": twitchBotClientId
    }
  };
  let req = https.request(options, function(res) {
    console.log(new Date().toISOString() + " [VIDEOS] Starting download for videos list for channel " + broadcasterId + " statusCode: " + res.statusCode);
    //console.log(new Date().toISOString() + " [VIDEOS] VIDEOS STATUS statusCode: " + res.statusCode);
    res.on("data", function(d) {
      //console.log(new Date().toISOString() + " VIDEOS STATUS DATA RECEIVED");
      //console.log(d.toString("utf8"));
      rawOutputData = rawOutputData + d.toString("utf8");
      //console.log(JSON.parse(d.toString("utf8")));
      //process.stdout.write(d);
      //console.log(d);
    });
    res.on("end", async function() {
      if (res.statusCode < 200 || res.statusCode > 299) {
        // Something went wrong idk lol
        downloaderVideoChannelIndexCurrent++;
        console.log(new Date().toISOString() + " [VIDEOS] Something went wrong downloading videos list for channel " + broadcasterId + ", the response code is " + res.statusCode);
        //console.log(new Date().toISOString() + " [VIDEOS] Something went wrong getting the videos, the response code is " + res.statusCode);
        console.log(rawOutputData.toString("utf8"));
      }
      if (res.statusCode >= 200 && res.statusCode <= 299) {
        let dataArray = JSON.parse(rawOutputData.toString("utf8")).data;
        if (dataArray === "" || dataArray === undefined || dataArray === null || dataArray === [] || dataArray === "[]" || dataArray === "null" || dataArray === "undefined") {
          downloaderVideoChannelIndexCurrent++;
          console.log(new Date().toISOString() + " [VIDEOS] Twitch returned invalid data for videos list for channel " + broadcasterId);
          console.log(rawOutputData.toString("utf8"));
        }
        if (dataArray !== "" && dataArray !== undefined && dataArray !== null && dataArray !== [] && dataArray !== "[]" && dataArray !== "null" && dataArray !== "undefined") {
          //console.log(new Date().toISOString() + " VALID RESPONSE PogChamp PogChamp PogChamp PogChamp PogChamp PogChamp PogChamp PogChamp PogChamp PogChamp PogChamp PogChamp");
          let dataSize = dataArray.length;
          //console.log(new Date().toISOString() + new Date().toISOString() + " dataSize = " + dataSize);
          //console.log(new Date().toISOString() + " VIDEOS STATUS END");
          //console.log(rawOutputData.toString("utf8"));
          //console.log(new Date().toISOString() + " I'm not sure if the videos status response worked or not, look above for any error messages!");
          if (dataSize > 0) {
            //console.log(new Date().toISOString() + new Date().toISOString() + " dataSize = " + dataSize);
            nextPageCursor = JSON.parse(rawOutputData.toString("utf8")).pagination.cursor;
            //console.log(new Date().toISOString() + " nextPageCursor = ");
            //console.log(nextPageCursor);
            console.log(new Date().toISOString() + " [VIDEOS] Successfully downloaded videos list for channel " + broadcasterId + " statusCode: " + res.statusCode);
            for (let dataIndex = 0; dataIndex < dataSize; dataIndex++) {
              //console.log(new Date().toISOString() + " dataIndex = " + dataIndex);
              //console.log(JSON.parse(rawOutputData.toString("utf8")).data[dataIndex]);
              let metadataToWriteToJsonFile = JSON.parse(rawOutputData.toString("utf8")).data[dataIndex];
              //console.log(JSON.stringify(metadataToWriteToJsonFile, null, 2));
              let videoId = metadataToWriteToJsonFile.id;
              let channelId = metadataToWriteToJsonFile.user_id;
              let userLogin = metadataToWriteToJsonFile.user_login;
              let videoTitle = metadataToWriteToJsonFile.title;

              let createdAt = metadataToWriteToJsonFile.created_at;
              let createdAtForPaths = createdAt.replace(/([\!\@\#\$\%\^\&\*\(\)\:\;\-\=\+\_\,\.\[\]\{\}]+)+/ig, "_");
              let createdAtMillis = Date.parse(createdAt);

              let createdAtMillisecond = new Date(createdAtMillis).getUTCMilliseconds();
              let createdAtSecond = new Date(createdAtMillis).getUTCSeconds();
              let createdAtMinute = new Date(createdAtMillis).getUTCMinutes();
              let createdAtHour = new Date(createdAtMillis).getUTCHours();

              let createdAtDate = new Date(createdAtMillis).getUTCDate();
              let createdAtMonth = new Date(createdAtMillis).getUTCMonth() + 1;
              let createdAtYear = new Date(createdAtMillis).getUTCFullYear();

              metadataToWriteToJsonFile.created_at_for_paths = createdAtForPaths;
              metadataToWriteToJsonFile.created_at_millis = createdAtMillis;

              metadataToWriteToJsonFile.created_at_year = createdAtYear;
              metadataToWriteToJsonFile.created_at_month = createdAtMonth;
              metadataToWriteToJsonFile.created_at_date = createdAtDate;

              metadataToWriteToJsonFile.created_at_hour = createdAtHour;
              metadataToWriteToJsonFile.created_at_minute = createdAtMinute;
              metadataToWriteToJsonFile.created_at_second = createdAtSecond;
              metadataToWriteToJsonFile.created_at_millisecond = createdAtMillisecond;

              let publishedAt = metadataToWriteToJsonFile.published_at;
              let publishedAtForPaths = publishedAt.replace(/([\!\@\#\$\%\^\&\*\(\)\:\;\-\=\+\_\,\.\[\]\{\}]+)+/ig, "_");
              let publishedAtMillis = Date.parse(publishedAt);

              let publishedAtMillisecond = new Date(publishedAtMillis).getUTCMilliseconds();
              let publishedAtSecond = new Date(publishedAtMillis).getUTCSeconds();
              let publishedAtMinute = new Date(publishedAtMillis).getUTCMinutes();
              let publishedAtHour = new Date(publishedAtMillis).getUTCHours();

              let publishedAtDate = new Date(publishedAtMillis).getUTCDate();
              let publishedAtMonth = new Date(publishedAtMillis).getUTCMonth() + 1;
              let publishedAtYear = new Date(publishedAtMillis).getUTCFullYear();

              metadataToWriteToJsonFile.published_at_for_paths = publishedAtForPaths;
              metadataToWriteToJsonFile.published_at_millis = publishedAtMillis;

              metadataToWriteToJsonFile.published_at_year = publishedAtYear;
              metadataToWriteToJsonFile.published_at_month = publishedAtMonth;
              metadataToWriteToJsonFile.published_at_date = publishedAtDate;

              metadataToWriteToJsonFile.published_at_hour = publishedAtHour;
              metadataToWriteToJsonFile.published_at_minute = publishedAtMinute;
              metadataToWriteToJsonFile.published_at_second = publishedAtSecond;
              metadataToWriteToJsonFile.published_at_millisecond = publishedAtMillisecond;

              let videoDuration = metadataToWriteToJsonFile.duration;
              let thumbnailUrlOrig = metadataToWriteToJsonFile.thumbnail_url;
              thumbnailUrlOrig = thumbnailUrlOrig.replace(/(\%\{width\})+/ig, "0");
              thumbnailUrlOrig = thumbnailUrlOrig.replace(/(\%\{height\})+/ig, "0");
              if (globalConfigObject.download_videos_by_channel_id_orig_thumbnails == true) {
                getTwitchVideoThumbnail(thumbnailUrlOrig, "videos", "orig", globalConfigObject, metadataToWriteToJsonFile, twitchCredentialsObject);
              }
              let thumbnailUrl1152p = metadataToWriteToJsonFile.thumbnail_url;
              thumbnailUrl1152p = thumbnailUrl1152p.replace(/(\%\{width\})+/ig, "2048");
              thumbnailUrl1152p = thumbnailUrl1152p.replace(/(\%\{height\})+/ig, "1152");
              if (globalConfigObject.download_videos_by_channel_id_1152p_thumbnails == true) {
                getTwitchVideoThumbnail(thumbnailUrl1152p, "videos", "1152p", globalConfigObject, metadataToWriteToJsonFile, twitchCredentialsObject); // NOTE: Resolutions other than 0x0 (orig) get extra compressed, extra crunchy, extra jpeg-ed, extra deepfried, so it isn't really recommended to download thumbnails that are not 0x0 (orig)
              }
              //console.log(metadataToWriteToJsonFile);
              let folderToMake = "";
              let metadataJsonFileFilename = "";
              let doesMetadataJsonFileExist = false;
              if (globalConfigObject.download_videos_by_channel_id_metadata == true) {
                // Doing this multiple times because I'm using an old version of node that doesn't support recursive folder creation (There was a reason for using this old version but I can't remember what, I think there were compatibility issues with either the serial port module or tmi.js module)
                // "output" folder
                folderToMake = __dirname + path.sep + "output";
                if (fs.existsSync(folderToMake) == false) {
                  //console.log(new Date().toISOString() + " [FOLDER CREATION] Creating the folder " + "output");
                  fs.mkdirSync(folderToMake);
                }
                // "userid_username" folder
                folderToMake = __dirname + path.sep + "output" + path.sep + channelId;
                if (fs.existsSync(folderToMake) == false) {
                  //console.log(new Date().toISOString() + " [FOLDER CREATION] Creating the folder " + channelId);
                  fs.mkdirSync(folderToMake);
                }
                // "videos" folder
                folderToMake = __dirname + path.sep + "output" + path.sep + channelId + path.sep + "videos";
                if (fs.existsSync(folderToMake) == false) {
                  //console.log(new Date().toISOString() + " [FOLDER CREATION] Creating the folder " + "videos");
                  fs.mkdirSync(folderToMake);
                }
                // "metadata" folder
                folderToMake = __dirname + path.sep + "output" + path.sep + channelId + path.sep + "videos" + path.sep + "metadata";
                if (fs.existsSync(folderToMake) == false) {
                  //console.log(new Date().toISOString() + " [FOLDER CREATION] Creating the folder " + "metadata");
                  fs.mkdirSync(folderToMake);
                }
                // year folder
                folderToMake = __dirname + path.sep + "output" + path.sep + channelId + path.sep + "videos" + path.sep + "metadata" + path.sep + createdAtYear;
                if (fs.existsSync(folderToMake) == false) {
                  //console.log(new Date().toISOString() + " [FOLDER CREATION] Creating the folder " + createdAtYear);
                  fs.mkdirSync(folderToMake);
                }
                // month folder
                folderToMake = __dirname + path.sep + "output" + path.sep + channelId + path.sep + "videos" + path.sep + "metadata" + path.sep + createdAtYear + path.sep + createdAtMonth;
                if (fs.existsSync(folderToMake) == false) {
                  //console.log(new Date().toISOString() + " [FOLDER CREATION] Creating the folder " + createdAtMonth);
                  fs.mkdirSync(folderToMake);
                }
                // Make file if file doesn't exist
                metadataJsonFileFilename = __dirname + path.sep + "output" + path.sep + channelId + path.sep + "videos" + path.sep + "metadata" + path.sep + createdAtYear + path.sep + createdAtMonth + path.sep + createdAtMillis + "_" + createdAtForPaths + "_" + channelId + "_" + videoId + "_video_metadata.json";
                doesMetadataJsonFileExist = fs.existsSync(metadataJsonFileFilename);
                if (doesMetadataJsonFileExist == false) {
                  //console.log(new Date().toISOString() + " [FILE CREATION] Creating file " + createdAtMillis + "_" + createdAtForPaths + "_" + channelId + "_" + videoId + "_video_metadata.json");
                  console.log(new Date().toISOString() + " [VIDEOS] Saving metadata for video ID " + videoId + " title " + videoTitle + " filename " + createdAtMillis + "_" + createdAtForPaths + "_" + channelId + "_" + videoId + "_video_metadata.json");
                  fs.writeFileSync(metadataJsonFileFilename, JSON.stringify(metadataToWriteToJsonFile, null, 2), "utf8");
                  console.log(new Date().toISOString() + " [VIDEOS] Saved metadata for video ID " + videoId + " title " + videoTitle + " filename " + createdAtMillis + "_" + createdAtForPaths + "_" + channelId + "_" + videoId + "_video_metadata.json");
                }
                // Or we choose to overwrite or not to overwrite file if file already exists
                //metadataJsonFileFilename = __dirname + path.sep + "output" + path.sep + channelId + path.sep + "videos" + path.sep + "metadata" + path.sep + createdAtYear + path.sep + createdAtMonth + path.sep + createdAtMillis + "_" + createdAtForPaths + "_" + channelId + "_" + videoId + "_video_metadata.json";
                //doesMetadataJsonFileExist = fs.existsSync(metadataJsonFileFilename);
                if (doesMetadataJsonFileExist == true) {
                  if (globalConfigObject.overwrite_files == false) {
                    console.log(new Date().toISOString() + " [VIDEOS] Overwriting disabled, skipping metadata for video ID " + videoId + " title " + videoTitle + " filename " + createdAtMillis + "_" + createdAtForPaths + "_" + channelId + "_" + videoId + "_video_metadata.json");
                    //console.log(new Date().toISOString() + " [FILE WRITING] Overwriting disabled, skipping file " + createdAtMillis + "_" + createdAtForPaths + "_" + channelId + "_" + videoId + "_video_metadata.json");
                  }
                  if (globalConfigObject.overwrite_files == true) {
                    //console.log(new Date().toISOString() + " [FILE WRITING] Overwriting file " + createdAtMillis + "_" + createdAtForPaths + "_" + channelId + "_" + videoId + "_video_metadata.json");
                    console.log(new Date().toISOString() + " [VIDEOS] Overwriting enabled, saving metadata for video ID " + videoId + " title " + videoTitle + " filename " + createdAtMillis + "_" + createdAtForPaths + "_" + channelId + "_" + videoId + "_video_metadata.json");
                    fs.writeFileSync(metadataJsonFileFilename, JSON.stringify(metadataToWriteToJsonFile, null, 2), "utf8");
                    console.log(new Date().toISOString() + " [VIDEOS] Overwriting enabled, saved metadata for video ID " + videoId + " title " + videoTitle + " filename " + createdAtMillis + "_" + createdAtForPaths + "_" + channelId + "_" + videoId + "_video_metadata.json");
                  }
                }
              }
              await sleep(200); // This sleep exists here because 1) the requests are non-blocking, which means that the code will not stop even when the request is still in progress and 2) it's usually not recommended to go too fast with HTTP requests, you can still comment this line if you want, but you'll likely get rate limited for going too fast
              if (dataSize < 100) {
                if (dataIndex >= dataSize - 1) {
                  //downloaderVideoChannelIndexCurrent++;
                  // THE LINE BELOW IS RECURSIVE AND IS FROWNED UPON IN PROGRAMMING, IT IS NEVER RECOMMENDED TO CODE LIKE THIS
                  if (nextPageCursor === "" || nextPageCursor === undefined || nextPageCursor === null || nextPageCursor === [] || nextPageCursor === "[]" || nextPageCursor.toLowerCase() === "null" || nextPageCursor.toLowerCase() === "undefined") {
                    // Do nothing and go to next channel
                    //console.log(new Date().toISOString() + " [VIDEOS] AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
                    downloaderVideoChannelIndexCurrent++;
                  }
                  if (nextPageCursor !== "" && nextPageCursor !== undefined && nextPageCursor !== null && nextPageCursor !== [] && nextPageCursor !== "[]" && nextPageCursor.toLowerCase() !== "null" && nextPageCursor.toLowerCase() !== "undefined") {
                    //console.log(new Date().toISOString() + " [VIDEOS] BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB");
                    getTwitchVideosByBroadcasterId(broadcasterId, globalConfigObject, twitchCredentialsObject, nextPageCursor);
                  }
                }
              }
              if (dataSize >= 100) {
                if (dataIndex >= dataSize - 1) {
                  // THE LINE BELOW IS RECURSIVE AND IS FROWNED UPON IN PROGRAMMING, IT IS NEVER RECOMMENDED TO CODE LIKE THIS
                  if (nextPageCursor === "" || nextPageCursor === undefined || nextPageCursor === null || nextPageCursor === [] || nextPageCursor === "[]" || nextPageCursor.toLowerCase() === "null" || nextPageCursor.toLowerCase() === "undefined") {
                    // Do nothing and go to next channel
                    //console.log(new Date().toISOString() + " [VIDEOS] CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC");
                    downloaderVideoChannelIndexCurrent++;
                  }
                  if (nextPageCursor !== "" && nextPageCursor !== undefined && nextPageCursor !== null && nextPageCursor !== [] && nextPageCursor !== "[]" && nextPageCursor.toLowerCase() !== "null" && nextPageCursor.toLowerCase() !== "undefined") {
                    //console.log(new Date().toISOString() + " [VIDEOS] DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD");
                    getTwitchVideosByBroadcasterId(broadcasterId, globalConfigObject, twitchCredentialsObject, nextPageCursor);
                  }
                }
              }
            }
            // Valid response?
            //console.log(JSON.parse(rawOutputData.toString("utf8")));
            //console.log(new Date().toISOString() +" Printing Pagination Cursors Below");
            //console.log(JSON.parse(rawOutputData.toString("utf8")).pagination);
            //nextPageCursor = JSON.parse(rawOutputData.toString("utf8")).pagination.cursor;
            //console.log(new Date().toISOString() + " nextPageCursor = ");
            //console.log(nextPageCursor);
          }
          if (dataSize <= 0) {
            // Something went wrong idk lol
            downloaderVideoChannelIndexCurrent++;
            console.log(new Date().toISOString() + " [VIDEOS] Something went wrong downloading videos list for channel " + broadcasterId + " or there are no videos to list");
            console.log(rawOutputData.toString("utf8"));
            //console.log(new Date().toISOString() + " Something went wrong getting the videos list or there are simply no videos to list");
          }
        }
      }
    });
  });
  req.on("error", function(error) {
    //downloaderVideoChannelIndexCurrent++;
    console.log(new Date().toISOString() + " [VIDEOS] Failed to download videos list for channel " + broadcasterId);
    //console.log(new Date().toISOString() + " VIDEOS STATUS CONNECTION ERROR");
    console.error(error);
    getTwitchVideosByBroadcasterId(broadcasterId, globalConfigObject, twitchCredentialsObject, paginationCursor);
  });
  req.end();
}

function getTwitchVideosByVideoId(videoIds, globalConfigObject, twitchCredentialsObject) {
  if (twitchCredentialsObject.use_twitch_api == false) {
    return;
  }
  let formattedVideoIds = videoIds.join("&id=");
  //console.log(formattedVideoIds);
  //console.log(new Date().toISOString() + " [VIDEOS] Attempting to get videos for IDs" + formattedVideoIds);
  console.log(new Date().toISOString() + " [VIDEOS] Attempting to download videos list for IDs " + formattedVideoIds);
  let rawOutputData = "";
  let twitchBotClientId = twitchCredentialsObject.twitch_client_id;
  let twitchBotId = twitchCredentialsObject.twitch_channel_id;
  let twitchBotOauthToken = twitchCredentialsObject.twitch_oauth_access_token;
  let pathToUse = "/helix/videos?id=" + formattedVideoIds + "&type=all&period=all&sort=time&first=100";
  let options = {
    hostname: "api.twitch.tv",
    path: pathToUse,
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + twitchBotOauthToken,
      "Client-Id": twitchBotClientId
    }
  };
  let req = https.request(options, function(res) {
    console.log(new Date().toISOString() + " [VIDEOS] Starting download for videos list for IDs " + formattedVideoIds + " statusCode: " + res.statusCode);
    //console.log(new Date().toISOString() + " VIDEOS STATUS statusCode: " + res.statusCode);
    res.on("data", function(d) {
      //console.log(new Date().toISOString() + " VIDEOS STATUS DATA RECEIVED");
      //console.log(d.toString("utf8"));
      rawOutputData = rawOutputData + d.toString("utf8");
      //console.log(JSON.parse(d.toString("utf8")));
      //process.stdout.write(d);
      //console.log(d);
    });
    res.on("end", async function() {
      if (res.statusCode < 200 || res.statusCode > 299) {
        // Something went wrong idk lol
        downloaderVideoIdIndexCurrent++;
        //console.log(new Date().toISOString() + " Something went wrong getting the videos, the response code is " + res.statusCode);
        console.log(new Date().toISOString() + " [VIDEOS] Something went wrong downloading videos list for IDs " + formattedVideoIds + ", the response code is " + res.statusCode);
        console.log(rawOutputData.toString("utf8"));
      }
      if (res.statusCode >= 200 && res.statusCode <= 299) {
        let dataArray = JSON.parse(rawOutputData.toString("utf8")).data;
        if (dataArray === "" || dataArray === undefined || dataArray === null || dataArray === [] || dataArray === "[]" || dataArray === "null" || dataArray === "undefined") {
          downloaderVideoIdIndexCurrent++;
          console.log(new Date().toISOString() + " [VIDEOS] Twitch returned invalid data for videos list for IDs " + formattedVideoIds);
          //console.log(new Date().toISOString() + " INVALID RESPONSE");
          console.log(rawOutputData.toString("utf8"));
        }
        if (dataArray !== "" && dataArray !== undefined && dataArray !== null && dataArray !== [] && dataArray !== "[]" && dataArray !== "null" && dataArray !== "undefined") {
          //console.log(new Date().toISOString() + " VALID RESPONSE PogChamp PogChamp PogChamp PogChamp PogChamp PogChamp PogChamp PogChamp PogChamp PogChamp PogChamp PogChamp");
          let dataSize = dataArray.length;
          //console.log(new Date().toISOString() + new Date().toISOString() + " dataSize = " + dataSize);
          //console.log(new Date().toISOString() + " VIDEOS STATUS END");
          //console.log(JSON.parse(rawOutputData.toString("utf8")));
          //console.log(new Date().toISOString() + " I'm not sure if the videos status response worked or not, look above for any error messages!");
          if (dataSize > 0) {
            console.log(new Date().toISOString() + " [VIDEOS] Successfully downloaded videos list for IDs " + formattedVideoIds + " statusCode: " + res.statusCode);
            for (let dataIndex = 0; dataIndex < dataSize; dataIndex++) {
              //console.log(new Date().toISOString() + " dataIndex = " + dataIndex);
              //console.log(JSON.parse(rawOutputData.toString("utf8")).data[dataIndex]);
              let metadataToWriteToJsonFile = JSON.parse(rawOutputData.toString("utf8")).data[dataIndex];
              //console.log(JSON.stringify(metadataToWriteToJsonFile, null, 2));
              let videoId = metadataToWriteToJsonFile.id;
              let channelId = metadataToWriteToJsonFile.user_id;
              let userLogin = metadataToWriteToJsonFile.user_login;
              let videoTitle = metadataToWriteToJsonFile.title;

              let createdAt = metadataToWriteToJsonFile.created_at;
              let createdAtForPaths = createdAt.replace(/([\!\@\#\$\%\^\&\*\(\)\:\;\-\=\+\_\,\.\[\]\{\}]+)+/ig, "_");
              let createdAtMillis = Date.parse(createdAt);

              let createdAtMillisecond = new Date(createdAtMillis).getUTCMilliseconds();
              let createdAtSecond = new Date(createdAtMillis).getUTCSeconds();
              let createdAtMinute = new Date(createdAtMillis).getUTCMinutes();
              let createdAtHour = new Date(createdAtMillis).getUTCHours();

              let createdAtDate = new Date(createdAtMillis).getUTCDate();
              let createdAtMonth = new Date(createdAtMillis).getUTCMonth() + 1;
              let createdAtYear = new Date(createdAtMillis).getUTCFullYear();

              metadataToWriteToJsonFile.created_at_for_paths = createdAtForPaths;
              metadataToWriteToJsonFile.created_at_millis = createdAtMillis;

              metadataToWriteToJsonFile.created_at_year = createdAtYear;
              metadataToWriteToJsonFile.created_at_month = createdAtMonth;
              metadataToWriteToJsonFile.created_at_date = createdAtDate;

              metadataToWriteToJsonFile.created_at_hour = createdAtHour;
              metadataToWriteToJsonFile.created_at_minute = createdAtMinute;
              metadataToWriteToJsonFile.created_at_second = createdAtSecond;
              metadataToWriteToJsonFile.created_at_millisecond = createdAtMillisecond;

              let publishedAt = metadataToWriteToJsonFile.published_at;
              let publishedAtForPaths = publishedAt.replace(/([\!\@\#\$\%\^\&\*\(\)\:\;\-\=\+\_\,\.\[\]\{\}]+)+/ig, "_");
              let publishedAtMillis = Date.parse(publishedAt);

              let publishedAtMillisecond = new Date(publishedAtMillis).getUTCMilliseconds();
              let publishedAtSecond = new Date(publishedAtMillis).getUTCSeconds();
              let publishedAtMinute = new Date(publishedAtMillis).getUTCMinutes();
              let publishedAtHour = new Date(publishedAtMillis).getUTCHours();

              let publishedAtDate = new Date(publishedAtMillis).getUTCDate();
              let publishedAtMonth = new Date(publishedAtMillis).getUTCMonth() + 1;
              let publishedAtYear = new Date(publishedAtMillis).getUTCFullYear();

              metadataToWriteToJsonFile.published_at_for_paths = publishedAtForPaths;
              metadataToWriteToJsonFile.published_at_millis = publishedAtMillis;

              metadataToWriteToJsonFile.published_at_year = publishedAtYear;
              metadataToWriteToJsonFile.published_at_month = publishedAtMonth;
              metadataToWriteToJsonFile.published_at_date = publishedAtDate;

              metadataToWriteToJsonFile.published_at_hour = publishedAtHour;
              metadataToWriteToJsonFile.published_at_minute = publishedAtMinute;
              metadataToWriteToJsonFile.published_at_second = publishedAtSecond;
              metadataToWriteToJsonFile.published_at_millisecond = publishedAtMillisecond;

              let videoDuration = metadataToWriteToJsonFile.duration;
              let thumbnailUrlOrig = metadataToWriteToJsonFile.thumbnail_url;
              thumbnailUrlOrig = thumbnailUrlOrig.replace(/(\%\{width\})+/ig, "0");
              thumbnailUrlOrig = thumbnailUrlOrig.replace(/(\%\{height\})+/ig, "0");
              if (globalConfigObject.download_videos_by_video_id_orig_thumbnails == true) {
                getTwitchVideoThumbnail(thumbnailUrlOrig, "videos", "orig", globalConfigObject, metadataToWriteToJsonFile, twitchCredentialsObject);
              }
              let thumbnailUrl1152p = metadataToWriteToJsonFile.thumbnail_url;
              thumbnailUrl1152p = thumbnailUrl1152p.replace(/(\%\{width\})+/ig, "2048");
              thumbnailUrl1152p = thumbnailUrl1152p.replace(/(\%\{height\})+/ig, "1152");
              if (globalConfigObject.download_videos_by_video_id_1152p_thumbnails == true) {
                getTwitchVideoThumbnail(thumbnailUrl1152p, "videos", "1152p", globalConfigObject, metadataToWriteToJsonFile, twitchCredentialsObject); // NOTE: Resolutions other than 0x0 (orig) get extra compressed, extra crunchy, extra jpeg-ed, extra deepfried, so it isn't really recommended to download thumbnails that are not 0x0 (orig)
              }
              //console.log(metadataToWriteToJsonFile);
              let folderToMake = "";
              let metadataJsonFileFilename = "";
              let doesMetadataJsonFileExist = false;
              if (globalConfigObject.download_videos_by_video_id_metadata == true) {
                // Doing this multiple times because I'm using an old version of node that doesn't support recursive folder creation (There was a reason for using this old version but I can't remember what, I think there were compatibility issues with either the serial port module or tmi.js module)
                // "output" folder
                folderToMake = __dirname + path.sep + "output";
                if (fs.existsSync(folderToMake) == false) {
                  //console.log(new Date().toISOString() + " [FOLDER CREATION] Creating the folder " + "output");
                  fs.mkdirSync(folderToMake);
                }
                // "userid_username" folder
                folderToMake = __dirname + path.sep + "output" + path.sep + channelId;
                if (fs.existsSync(folderToMake) == false) {
                  //console.log(new Date().toISOString() + " [FOLDER CREATION] Creating the folder " + channelId);
                  fs.mkdirSync(folderToMake);
                }
                // "videos" folder
                folderToMake = __dirname + path.sep + "output" + path.sep + channelId + path.sep + "videos";
                if (fs.existsSync(folderToMake) == false) {
                  //console.log(new Date().toISOString() + " [FOLDER CREATION] Creating the folder " + "videos");
                  fs.mkdirSync(folderToMake);
                }
                // "metadata" folder
                folderToMake = __dirname + path.sep + "output" + path.sep + channelId + path.sep + "videos" + path.sep + "metadata";
                if (fs.existsSync(folderToMake) == false) {
                  //console.log(new Date().toISOString() + " [FOLDER CREATION] Creating the folder " + "metadata");
                  fs.mkdirSync(folderToMake);
                }
                // year folder
                folderToMake = __dirname + path.sep + "output" + path.sep + channelId + path.sep + "videos" + path.sep + "metadata" + path.sep + createdAtYear;
                if (fs.existsSync(folderToMake) == false) {
                  //console.log(new Date().toISOString() + " [FOLDER CREATION] Creating the folder " + createdAtYear);
                  fs.mkdirSync(folderToMake);
                }
                // month folder
                folderToMake = __dirname + path.sep + "output" + path.sep + channelId + path.sep + "videos" + path.sep + "metadata" + path.sep + createdAtYear + path.sep + createdAtMonth;
                if (fs.existsSync(folderToMake) == false) {
                  //console.log(new Date().toISOString() + " [FOLDER CREATION] Creating the folder " + createdAtMonth);
                  fs.mkdirSync(folderToMake);
                }
                // Make file if file doesn't exist
                metadataJsonFileFilename = __dirname + path.sep + "output" + path.sep + channelId + path.sep + "videos" + path.sep + "metadata" + path.sep + createdAtYear + path.sep + createdAtMonth + path.sep + createdAtMillis + "_" + createdAtForPaths + "_" + channelId + "_" + videoId + "_video_metadata.json";
                doesMetadataJsonFileExist = fs.existsSync(metadataJsonFileFilename);
                if (doesMetadataJsonFileExist == false) {
                  console.log(new Date().toISOString() + " [VIDEOS] Saving metadata for video ID " + videoId + " title " + videoTitle + " filename " + createdAtMillis + "_" + createdAtForPaths + "_" + channelId + "_" + videoId + "_video_metadata.json");
                  //console.log(new Date().toISOString() + " [FILE CREATION] Creating file " + createdAtMillis + "_" + createdAtForPaths + "_" + channelId + "_" + videoId + "_video_metadata.json");
                  fs.writeFileSync(metadataJsonFileFilename, JSON.stringify(metadataToWriteToJsonFile, null, 2), "utf8");
                  console.log(new Date().toISOString() + " [VIDEOS] Saved metadata for video ID " + videoId + " title " + videoTitle + " filename " + createdAtMillis + "_" + createdAtForPaths + "_" + channelId + "_" + videoId + "_video_metadata.json");
                }
                // Or we choose to overwrite or not to overwrite file if file already exists
                //metadataJsonFileFilename = __dirname + path.sep + "output" + path.sep + channelId + path.sep + "videos" + path.sep + "metadata" + path.sep + createdAtYear + path.sep + createdAtMonth + path.sep + createdAtMillis + "_" + createdAtForPaths + "_" + channelId + "_" + videoId + "_video_metadata.json";
                //doesMetadataJsonFileExist = fs.existsSync(metadataJsonFileFilename);
                if (doesMetadataJsonFileExist == true) {
                  if (globalConfigObject.overwrite_files == false) {
                    console.log(new Date().toISOString() + " [VIDEOS] Overwriting disabled, skipping metadata for video ID " + videoId + " title " + videoTitle + " filename " + createdAtMillis + "_" + createdAtForPaths + "_" + channelId + "_" + videoId + "_video_metadata.json");
                    //console.log(new Date().toISOString() + " [FILE WRITING] Overwriting disabled, skipping file " + createdAtMillis + "_" + createdAtForPaths + "_" + channelId + "_" + videoId + "_video_metadata.json");
                  }
                  if (globalConfigObject.overwrite_files == true) {
                    console.log(new Date().toISOString() + " [VIDEOS] Overwriting enabled, saving metadata for video ID " + videoId + " title " + videoTitle + " filename " + createdAtMillis + "_" + createdAtForPaths + "_" + channelId + "_" + videoId + "_video_metadata.json");
                    //console.log(new Date().toISOString() + " [FILE WRITING] Overwriting file " + createdAtMillis + "_" + createdAtForPaths + "_" + channelId + "_" + videoId + "_video_metadata.json");
                    fs.writeFileSync(metadataJsonFileFilename, JSON.stringify(metadataToWriteToJsonFile, null, 2), "utf8");
                    console.log(new Date().toISOString() + " [VIDEOS] Overwriting enabled, saved metadata for video ID " + videoId + " title " + videoTitle + " filename " + createdAtMillis + "_" + createdAtForPaths + "_" + channelId + "_" + videoId + "_video_metadata.json");
                  }
                }
              }
              await sleep(200); // This sleep exists here because 1) the requests are non-blocking, which means that the code will not stop even when the request is still in progress and 2) it's usually not recommended to go too fast with HTTP requests, you can still comment this line if you want, but you'll likely get rate limited for going too fast
              if (dataSize < 100) {
                if (dataIndex >= dataSize - 1) {
                  downloaderVideoIdIndexCurrent++;
                }
              }
              if (dataSize >= 100) {
                if (dataIndex >= dataSize - 1) {
                  downloaderVideoIdIndexCurrent++;
                }
              }
            }
            // Valid response?
            //console.log(JSON.parse(rawOutputData.toString("utf8")));
          }
          if (dataSize <= 0) {
            // Something went wrong idk lol
            downloaderVideoIdIndexCurrent++;
            console.log(new Date().toISOString() + " [VIDEOS] Something went wrong downloading videos list for IDs " + formattedVideoIds + " or there are no videos to list");
            console.log(rawOutputData.toString("utf8"));
            //console.log(new Date().toISOString() + " Something went wrong getting the videos list or there are simply no videos to list");
          }
        }
      }
    });
  });
  req.on("error", function(error) {
    //downloaderVideoIdIndexCurrent++;
    console.log(new Date().toISOString() + " [VIDEOS] Failed to download videos list for IDs " + broadcasterId);
    //console.log(new Date().toISOString() + " VIDEOS STATUS CONNECTION ERROR");
    console.error(error);
    getTwitchVideosByVideoId(videoIds, globalConfigObject, twitchCredentialsObject);
  });
  req.end();
}

function getTwitchClipsByBroadcasterId(broadcasterId, globalConfigObject, twitchCredentialsObject, paginationCursor) {
  if (twitchCredentialsObject.use_twitch_api == false) {
    return;
  }
  console.log(new Date().toISOString() + " [CLIPS] Attempting to download clips list for channel " + broadcasterId);
  //console.log(new Date().toISOString() + " [CLIPS] Attempting to get clips list for channel " + broadcasterId);
  let rawOutputData = "";
  let nextPageCursor = "";
  let twitchBotClientId = twitchCredentialsObject.twitch_client_id;
  let twitchBotId = twitchCredentialsObject.twitch_channel_id;
  let twitchBotOauthToken = twitchCredentialsObject.twitch_oauth_access_token;
  let pathToUse = "/helix/clips?broadcaster_id=" + broadcasterId + "&first=100";
  if (paginationCursor === "" || paginationCursor === undefined || paginationCursor === null || paginationCursor === [] || paginationCursor === "[]" || paginationCursor.toLowerCase() === "null" || paginationCursor.toLowerCase() === "undefined") {
    //console.log(new Date().toISOString() + " No pagination cursor provided!");
    pathToUse = "/helix/clips?broadcaster_id=" + broadcasterId + "&first=100";
  }
  if (paginationCursor !== "" && paginationCursor !== undefined && paginationCursor !== null && paginationCursor !== [] && paginationCursor !== "[]" && paginationCursor.toLowerCase() !== "null" && paginationCursor.toLowerCase() !== "undefined") {
    //console.log(new Date().toISOString() + " Using Pagination Cursor " + paginationCursor);
    pathToUse = "/helix/clips?broadcaster_id=" + broadcasterId + "&first=100" + "&after=" + paginationCursor;
  }
  let options = {
    hostname: "api.twitch.tv",
    path: pathToUse,
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + twitchBotOauthToken,
      "Client-Id": twitchBotClientId
    }
  };
  let req = https.request(options, function(res) {
    console.log(new Date().toISOString() + " [CLIPS] Starting download for clips list for channel " + broadcasterId + " statusCode: " + res.statusCode);
    //console.log(new Date().toISOString() + " CLIPS STATUS statusCode: " + res.statusCode);
    res.on("data", function(d) {
      //console.log(new Date().toISOString() + " CLIPS STATUS DATA RECEIVED");
      //console.log(d.toString("utf8"));
      rawOutputData = rawOutputData + d.toString("utf8");
      //console.log(JSON.parse(d.toString("utf8")));
      //process.stdout.write(d);
      //console.log(d);
    });
    res.on("end", async function() {
      if (res.statusCode < 200 || res.statusCode > 299) {
        // Something went wrong idk lol
        downloaderClipChannelIndexCurrent++;
        console.log(new Date().toISOString() + " [CLIPS] Something went wrong downloading clips list for channel " + broadcasterId + ", the response code is " + res.statusCode);
        //console.log(new Date().toISOString() + " Something went wrong getting the clips, the response code is " + res.statusCode);
        console.log(rawOutputData.toString("utf8"));
      }
      if (res.statusCode >= 200 && res.statusCode <= 299) {
        let dataArray = JSON.parse(rawOutputData.toString("utf8")).data;
        if (dataArray === "" || dataArray === undefined || dataArray === null || dataArray === [] || dataArray === "[]" || dataArray === "null" || dataArray === "undefined") {
          downloaderClipChannelIndexCurrent++;
          //console.log(new Date().toISOString() + " INVALID RESPONSE");
          console.log(new Date().toISOString() + " [CLIPS] Twitch returned invalid data for clips list for channel " + broadcasterId);
          console.log(rawOutputData.toString("utf8"));
        }
        if (dataArray !== "" && dataArray !== undefined && dataArray !== null && dataArray !== [] && dataArray !== "[]" && dataArray !== "null" && dataArray !== "undefined") {
          //console.log(new Date().toISOString() + " VALID RESPONSE PogChamp PogChamp PogChamp PogChamp PogChamp PogChamp PogChamp PogChamp PogChamp PogChamp PogChamp PogChamp");
          let dataSize = dataArray.length;
          //console.log(new Date().toISOString() + new Date().toISOString() + " dataSize = " + dataSize);
          //console.log(new Date().toISOString() + " CLIPS STATUS END");
          //console.log(JSON.parse(rawOutputData.toString("utf8")));
          //console.log(new Date().toISOString() + " I'm not sure if the clips status response worked or not, look above for any error messages!");
          if (dataSize > 0) {
            //console.log(new Date().toISOString() + new Date().toISOString() + " dataSize = " + dataSize);
            nextPageCursor = JSON.parse(rawOutputData.toString("utf8")).pagination.cursor;
            //console.log(new Date().toISOString() + " nextPageCursor = ");
            //console.log(nextPageCursor);
            console.log(new Date().toISOString() + " [CLIPS] Successfully downloaded clips list for channel " + broadcasterId + " statusCode: " + res.statusCode);
            for (let dataIndex = 0; dataIndex < dataSize; dataIndex++) {
              //console.log(new Date().toISOString() + " dataIndex = " + dataIndex);
              //console.log(JSON.parse(rawOutputData.toString("utf8")).data[dataIndex]);
              let metadataToWriteToJsonFile = JSON.parse(rawOutputData.toString("utf8")).data[dataIndex];
              //console.log(JSON.stringify(metadataToWriteToJsonFile, null, 2));
              let clipId = metadataToWriteToJsonFile.id;
              let channelId = metadataToWriteToJsonFile.broadcaster_id;
              metadataToWriteToJsonFile.user_id = channelId;
              metadataToWriteToJsonFile.channel_id = channelId;
              let userLogin = metadataToWriteToJsonFile.broadcaster_name;
              let clipTitle = metadataToWriteToJsonFile.title;

              let createdAt = metadataToWriteToJsonFile.created_at;
              let createdAtForPaths = createdAt.replace(/([\!\@\#\$\%\^\&\*\(\)\:\;\-\=\+\_\,\.\[\]\{\}]+)+/ig, "_");
              let createdAtMillis = Date.parse(createdAt);

              let createdAtMillisecond = new Date(createdAtMillis).getUTCMilliseconds();
              let createdAtSecond = new Date(createdAtMillis).getUTCSeconds();
              let createdAtMinute = new Date(createdAtMillis).getUTCMinutes();
              let createdAtHour = new Date(createdAtMillis).getUTCHours();

              let createdAtDate = new Date(createdAtMillis).getUTCDate();
              let createdAtMonth = new Date(createdAtMillis).getUTCMonth() + 1;
              let createdAtYear = new Date(createdAtMillis).getUTCFullYear();

              metadataToWriteToJsonFile.created_at_for_paths = createdAtForPaths;
              metadataToWriteToJsonFile.created_at_millis = createdAtMillis;

              metadataToWriteToJsonFile.created_at_year = createdAtYear;
              metadataToWriteToJsonFile.created_at_month = createdAtMonth;
              metadataToWriteToJsonFile.created_at_date = createdAtDate;

              metadataToWriteToJsonFile.created_at_hour = createdAtHour;
              metadataToWriteToJsonFile.created_at_minute = createdAtMinute;
              metadataToWriteToJsonFile.created_at_second = createdAtSecond;
              metadataToWriteToJsonFile.created_at_millisecond = createdAtMillisecond;

              let clipDuration = metadataToWriteToJsonFile.duration;
              let thumbnailUrlOrig = metadataToWriteToJsonFile.thumbnail_url;
              thumbnailUrlOrig = thumbnailUrlOrig.replace(/(\%\{width\})+/ig, "0");
              thumbnailUrlOrig = thumbnailUrlOrig.replace(/(\%\{height\})+/ig, "0");
              //thumbnailUrlOrig = thumbnailUrlOrig.replace(/(\d+x+\d+)+/ig, "0x0");
              thumbnailUrlOrig = thumbnailUrlOrig.replace(/(\d+x+\d+)+\.+((j+p+g+)+|(p+n+g+)+|(w+e+b+p+)+)+/ig, "0x0.jpg");
              //console.log("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
              //console.log(thumbnailUrlOrig);
              if (globalConfigObject.download_clips_by_channel_id_thumbnails == true) {
                getTwitchVideoThumbnail(thumbnailUrlOrig, "clips", "orig", globalConfigObject, metadataToWriteToJsonFile, twitchCredentialsObject);
              }
              let thumbnailUrl1152p = metadataToWriteToJsonFile.thumbnail_url;
              thumbnailUrl1152p = thumbnailUrl1152p.replace(/(\%\{width\})+/ig, "2048");
              thumbnailUrl1152p = thumbnailUrl1152p.replace(/(\%\{height\})+/ig, "1152");
              //thumbnailUrl1152p = thumbnailUrl1152p.replace(/(\d+x+\d+)+/ig, "2048x1152");
              thumbnailUrl1152p = thumbnailUrl1152p.replace(/(\d+x+\d+)+\.+((j+p+g+)+|(p+n+g+)+|(w+e+b+p+)+)+/ig, "2048x1152.jpg");
              //console.log("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
              //console.log(thumbnailUrl1152p);
              if (globalConfigObject.download_clips_by_channel_id_thumbnails == true) {
                getTwitchVideoThumbnail(thumbnailUrl1152p, "clips", "1152p", globalConfigObject, metadataToWriteToJsonFile, twitchCredentialsObject); // NOTE: Resolutions other than 0x0 (orig) get extra compressed, extra crunchy, extra jpeg-ed, extra deepfried, so it isn't really recommended to download thumbnails that are not 0x0 (orig)
              }
              //console.log(metadataToWriteToJsonFile);
              let folderToMake = "";
              let metadataJsonFileFilename = "";
              let doesMetadataJsonFileExist = false;
              if (globalConfigObject.download_clips_by_channel_id_metadata == true) {
                // Doing this multiple times because I'm using an old version of node that doesn't support recursive folder creation (There was a reason for using this old version but I can't remember what, I think there were compatibility issues with either the serial port module or tmi.js module)
                // "output" folder
                folderToMake = __dirname + path.sep + "output";
                if (fs.existsSync(folderToMake) == false) {
                  //console.log(new Date().toISOString() + " [FOLDER CREATION] Creating the folder " + "output");
                  fs.mkdirSync(folderToMake);
                }
                // "userid_username" folder
                folderToMake = __dirname + path.sep + "output" + path.sep + channelId;
                if (fs.existsSync(folderToMake) == false) {
                  //console.log(new Date().toISOString() + " [FOLDER CREATION] Creating the folder " + channelId);
                  fs.mkdirSync(folderToMake);
                }
                // "clips" folder
                folderToMake = __dirname + path.sep + "output" + path.sep + channelId + path.sep + "clips";
                if (fs.existsSync(folderToMake) == false) {
                  //console.log(new Date().toISOString() + " [FOLDER CREATION] Creating the folder " + "clips");
                  fs.mkdirSync(folderToMake);
                }
                // "metadata" folder
                folderToMake = __dirname + path.sep + "output" + path.sep + channelId + path.sep + "clips" + path.sep + "metadata";
                if (fs.existsSync(folderToMake) == false) {
                  //console.log(new Date().toISOString() + " [FOLDER CREATION] Creating the folder " + "metadata");
                  fs.mkdirSync(folderToMake);
                }
                // year folder
                folderToMake = __dirname + path.sep + "output" + path.sep + channelId + path.sep + "clips" + path.sep + "metadata" + path.sep + createdAtYear;
                if (fs.existsSync(folderToMake) == false) {
                  //console.log(new Date().toISOString() + " [FOLDER CREATION] Creating the folder " + createdAtYear);
                  fs.mkdirSync(folderToMake);
                }
                // month folder
                folderToMake = __dirname + path.sep + "output" + path.sep + channelId + path.sep + "clips" + path.sep + "metadata" + path.sep + createdAtYear + path.sep + createdAtMonth;
                if (fs.existsSync(folderToMake) == false) {
                  //console.log(new Date().toISOString() + " [FOLDER CREATION] Creating the folder " + createdAtMonth);
                  fs.mkdirSync(folderToMake);
                }
                // Make file if file doesn't exist
                metadataJsonFileFilename = __dirname + path.sep + "output" + path.sep + channelId + path.sep + "clips" + path.sep + "metadata" + path.sep + createdAtYear + path.sep + createdAtMonth + path.sep + createdAtMillis + "_" + createdAtForPaths + "_" + channelId + "_" + clipId + "_clip_metadata.json";
                doesMetadataJsonFileExist = fs.existsSync(metadataJsonFileFilename);
                if (doesMetadataJsonFileExist == false) {
                  console.log(new Date().toISOString() + " [CLIPS] Saving metadata for clip ID " + clipId + " title " + clipTitle + " filename " + createdAtMillis + "_" + createdAtForPaths + "_" + channelId + "_" + clipId + "_clip_metadata.json");
                  //console.log(new Date().toISOString() + " [FILE CREATION] Creating file " + createdAtMillis + "_" + createdAtForPaths + "_" + channelId + "_" + clipId + "_clip_metadata.json");
                  fs.writeFileSync(metadataJsonFileFilename, JSON.stringify(metadataToWriteToJsonFile, null, 2), "utf8");
                  console.log(new Date().toISOString() + " [CLIPS] Saved metadata for clip ID " + clipId + " title " + clipTitle + " filename " + createdAtMillis + "_" + createdAtForPaths + "_" + channelId + "_" + clipId + "_clip_metadata.json");
                }
                // Or we choose to overwrite or not to overwrite file if file already exists
                //metadataJsonFileFilename = __dirname + path.sep + "output" + path.sep + channelId + path.sep + "clips" + path.sep + "metadata" + path.sep + createdAtYear + path.sep + createdAtMonth + path.sep + createdAtMillis + "_" + createdAtForPaths + "_" + channelId + "_" + clipId + "_clip_metadata.json";
                //doesMetadataJsonFileExist = fs.existsSync(metadataJsonFileFilename);
                if (doesMetadataJsonFileExist == true) {
                  if (globalConfigObject.overwrite_files == false) {
                    console.log(new Date().toISOString() + " [CLIPS] Overwriting disabled, skipping metadata for clip ID " + clipId + " title " + clipTitle + " filename " + createdAtMillis + "_" + createdAtForPaths + "_" + channelId + "_" + clipId + "_clip_metadata.json");
                    //console.log(new Date().toISOString() + " [FILE WRITING] Overwriting disabled, skipping file " + createdAtMillis + "_" + createdAtForPaths + "_" + channelId + "_" + clipId + "_clip_metadata.json");
                  }
                  if (globalConfigObject.overwrite_files == true) {
                    console.log(new Date().toISOString() + " [CLIPS] Overwriting enabled, saving metadata for clip ID " + clipId + " title " + clipTitle + " filename " + createdAtMillis + "_" + createdAtForPaths + "_" + channelId + "_" + clipId + "_clip_metadata.json");
                    //console.log(new Date().toISOString() + " [FILE WRITING] Overwriting file " + createdAtMillis + "_" + createdAtForPaths + "_" + channelId + "_" + clipId + "_clip_metadata.json");
                    fs.writeFileSync(metadataJsonFileFilename, JSON.stringify(metadataToWriteToJsonFile, null, 2), "utf8");
                    console.log(new Date().toISOString() + " [CLIPS] Overwriting enabled, saved metadata for clip ID " + clipId + " title " + clipTitle + " filename " + createdAtMillis + "_" + createdAtForPaths + "_" + channelId + "_" + clipId + "_clip_metadata.json");
                  }
                }
              }
              await sleep(200); // This sleep exists here because 1) the requests are non-blocking, which means that the code will not stop even when the request is still in progress and 2) it's usually not recommended to go too fast with HTTP requests, you can still comment this line if you want, but you'll likely get rate limited for going too fast
              if (dataSize < 100) {
                if (dataIndex >= dataSize - 1) {
                  //downloaderClipChannelIndexCurrent++;
                  // THE LINE BELOW IS RECURSIVE AND IS FROWNED UPON IN PROGRAMMING, IT IS NEVER RECOMMENDED TO CODE LIKE THIS
                  if (nextPageCursor === "" || nextPageCursor === undefined || nextPageCursor === null || nextPageCursor === [] || nextPageCursor === "[]" || nextPageCursor.toLowerCase() === "null" || nextPageCursor.toLowerCase() === "undefined") {
                    // Do nothing and go to next channel
                    //console.log(new Date().toISOString() + " [CLIPS] AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
                    downloaderClipChannelIndexCurrent++;
                  }
                  if (nextPageCursor !== "" && nextPageCursor !== undefined && nextPageCursor !== null && nextPageCursor !== [] && nextPageCursor !== "[]" && nextPageCursor.toLowerCase() !== "null" && nextPageCursor.toLowerCase() !== "undefined") {
                    //console.log(new Date().toISOString() + " [CLIPS] BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB");
                    getTwitchClipsByBroadcasterId(broadcasterId, globalConfigObject, twitchCredentialsObject, nextPageCursor);
                  }
                }
              }
              if (dataSize >= 100) {
                if (dataIndex >= dataSize - 1) {
                  // THE LINE BELOW IS RECURSIVE AND IS FROWNED UPON IN PROGRAMMING, IT IS NEVER RECOMMENDED TO CODE LIKE THIS
                  if (nextPageCursor === "" || nextPageCursor === undefined || nextPageCursor === null || nextPageCursor === [] || nextPageCursor === "[]" || nextPageCursor.toLowerCase() === "null" || nextPageCursor.toLowerCase() === "undefined") {
                    // Do nothing and go to next channel
                    //console.log(new Date().toISOString() + " [CLIPS] CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC");
                    downloaderClipChannelIndexCurrent++;
                  }
                  if (nextPageCursor !== "" && nextPageCursor !== undefined && nextPageCursor !== null && nextPageCursor !== [] && nextPageCursor !== "[]" && nextPageCursor.toLowerCase() !== "null" && nextPageCursor.toLowerCase() !== "undefined") {
                    //console.log(new Date().toISOString() + " [CLIPS] DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD");
                    getTwitchClipsByBroadcasterId(broadcasterId, globalConfigObject, twitchCredentialsObject, nextPageCursor);
                  }
                }
              }
            }
            // Valid response?
            //console.log(JSON.parse(rawOutputData.toString("utf8")));
            //console.log(new Date().toISOString() +" Printing Pagination Cursors Below");
            //console.log(JSON.parse(rawOutputData.toString("utf8")).pagination);
            //nextPageCursor = JSON.parse(rawOutputData.toString("utf8")).pagination.cursor;
            //console.log(new Date().toISOString() + " nextPageCursor = ");
            //console.log(nextPageCursor);
          }
          if (dataSize <= 0) {
            // Something went wrong idk lol
            downloaderClipChannelIndexCurrent++;
            console.log(new Date().toISOString() + " [CLIPS] Something went wrong downloading clips list for channel " + broadcasterId + " or there are no clips to list");
            console.log(rawOutputData.toString("utf8"));
            //console.log(new Date().toISOString() + " Something went wrong getting the clips list or there are simply no clips to list");
          }
        }
      }
    });
  });
  req.on("error", function(error) {
    //downloaderClipChannelIndexCurrent++;
    console.log(new Date().toISOString() + " [CLIPS] Failed to download clips list for channel " + broadcasterId);
    //console.log(new Date().toISOString() + " VIDEOS STATUS CONNECTION ERROR");
    console.error(error);
    getTwitchClipsByBroadcasterId(broadcasterId, globalConfigObject, twitchCredentialsObject, paginationCursor);
  });
  req.end();
}

function getTwitchClipsByClipId(clipIds, globalConfigObject, twitchCredentialsObject) {
  if (twitchCredentialsObject.use_twitch_api == false) {
    return;
  }
  let formattedClipIds = clipIds.join("&id=");
  //console.log(formattedClipIds);
  //console.log(new Date().toISOString() + " [CLIPS] Attempting to get clips for IDs" + formattedClipIds);
  console.log(new Date().toISOString() + " [CLIPS] Attempting to download clips list for IDs " + formattedClipIds);
  let rawOutputData = "";
  let twitchBotClientId = twitchCredentialsObject.twitch_client_id;
  let twitchBotId = twitchCredentialsObject.twitch_channel_id;
  let twitchBotOauthToken = twitchCredentialsObject.twitch_oauth_access_token;
  let pathToUse = "/helix/clips?id=" + formattedClipIds + "&first=100";
  let options = {
    hostname: "api.twitch.tv",
    path: pathToUse,
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + twitchBotOauthToken,
      "Client-Id": twitchBotClientId
    }
  };
  let req = https.request(options, function(res) {
    console.log(new Date().toISOString() + " [CLIPS] Starting download for clips list for IDs " + formattedClipIds + " statusCode: " + res.statusCode);
    //console.log(new Date().toISOString() + " CLIPS STATUS statusCode: " + res.statusCode);
    res.on("data", function(d) {
      //console.log(new Date().toISOString() + " CLIPS STATUS DATA RECEIVED");
      //console.log(d.toString("utf8"));
      rawOutputData = rawOutputData + d.toString("utf8");
      //console.log(JSON.parse(d.toString("utf8")));
      //process.stdout.write(d);
      //console.log(d);
    });
    res.on("end", async function() {
      if (res.statusCode < 200 || res.statusCode > 299) {
        // Something went wrong idk lol
        downloaderClipIdIndexCurrent++;
        //console.log(new Date().toISOString() + " Something went wrong getting the clips, the response code is " + res.statusCode);
        console.log(new Date().toISOString() + " [CLIPS] Something went wrong downloading clips list for IDs " + formattedClipIds + ", the response code is " + res.statusCode);
        console.log(rawOutputData.toString("utf8"));
      }
      if (res.statusCode >= 200 && res.statusCode <= 299) {
        let dataArray = JSON.parse(rawOutputData.toString("utf8")).data;
        if (dataArray === "" || dataArray === undefined || dataArray === null || dataArray === [] || dataArray === "[]" || dataArray === "null" || dataArray === "undefined") {
          downloaderClipIdIndexCurrent++;
          console.log(new Date().toISOString() + " [CLIPS] Twitch returned invalid data for clips list for IDs " + formattedClipIds);
          //console.log(new Date().toISOString() + " INVALID RESPONSE");
          console.log(rawOutputData.toString("utf8"));
        }
        if (dataArray !== "" && dataArray !== undefined && dataArray !== null && dataArray !== [] && dataArray !== "[]" && dataArray !== "null" && dataArray !== "undefined") {
          //console.log(new Date().toISOString() + " VALID RESPONSE PogChamp PogChamp PogChamp PogChamp PogChamp PogChamp PogChamp PogChamp PogChamp PogChamp PogChamp PogChamp");
          let dataSize = dataArray.length;
          //console.log(new Date().toISOString() + new Date().toISOString() + " dataSize = " + dataSize);
          //console.log(new Date().toISOString() + " CLIPS STATUS END");
          //console.log(JSON.parse(rawOutputData.toString("utf8")));
          //console.log(new Date().toISOString() + " I'm not sure if the clips status response worked or not, look above for any error messages!");
          if (dataSize > 0) {
            for (let dataIndex = 0; dataIndex < dataSize; dataIndex++) {
              console.log(new Date().toISOString() + " [CLIPS] Successfully downloaded clips list for IDs " + formattedClipIds + " statusCode: " + res.statusCode);
              //console.log(new Date().toISOString() + " dataIndex = " + dataIndex);
              //console.log(JSON.parse(rawOutputData.toString("utf8")).data[dataIndex]);
              let metadataToWriteToJsonFile = JSON.parse(rawOutputData.toString("utf8")).data[dataIndex];
              //console.log(JSON.stringify(metadataToWriteToJsonFile, null, 2));
              let clipId = metadataToWriteToJsonFile.id;
              let channelId = metadataToWriteToJsonFile.broadcaster_id;
              metadataToWriteToJsonFile.user_id = channelId;
              metadataToWriteToJsonFile.channel_id = channelId;
              let userLogin = metadataToWriteToJsonFile.broadcaster_name;
              let clipTitle = metadataToWriteToJsonFile.title;

              let createdAt = metadataToWriteToJsonFile.created_at;
              let createdAtForPaths = createdAt.replace(/([\!\@\#\$\%\^\&\*\(\)\:\;\-\=\+\_\,\.\[\]\{\}]+)+/ig, "_");
              let createdAtMillis = Date.parse(createdAt);

              let createdAtMillisecond = new Date(createdAtMillis).getUTCMilliseconds();
              let createdAtSecond = new Date(createdAtMillis).getUTCSeconds();
              let createdAtMinute = new Date(createdAtMillis).getUTCMinutes();
              let createdAtHour = new Date(createdAtMillis).getUTCHours();

              let createdAtDate = new Date(createdAtMillis).getUTCDate();
              let createdAtMonth = new Date(createdAtMillis).getUTCMonth() + 1;
              let createdAtYear = new Date(createdAtMillis).getUTCFullYear();

              metadataToWriteToJsonFile.created_at_for_paths = createdAtForPaths;
              metadataToWriteToJsonFile.created_at_millis = createdAtMillis;

              metadataToWriteToJsonFile.created_at_year = createdAtYear;
              metadataToWriteToJsonFile.created_at_month = createdAtMonth;
              metadataToWriteToJsonFile.created_at_date = createdAtDate;

              metadataToWriteToJsonFile.created_at_hour = createdAtHour;
              metadataToWriteToJsonFile.created_at_minute = createdAtMinute;
              metadataToWriteToJsonFile.created_at_second = createdAtSecond;
              metadataToWriteToJsonFile.created_at_millisecond = createdAtMillisecond;;

              let clipDuration = metadataToWriteToJsonFile.duration;
              let thumbnailUrlOrig = metadataToWriteToJsonFile.thumbnail_url;
              thumbnailUrlOrig = thumbnailUrlOrig.replace(/(\%\{width\})+/ig, "0");
              thumbnailUrlOrig = thumbnailUrlOrig.replace(/(\%\{height\})+/ig, "0");
              //thumbnailUrlOrig = thumbnailUrlOrig.replace(/(\d+x+\d+)+/ig, "0x0");
              thumbnailUrlOrig = thumbnailUrlOrig.replace(/(\d+x+\d+)+\.+((j+p+g+)+|(p+n+g+)+|(w+e+b+p+)+)+/ig, "0x0.jpg");
              //console.log("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
              //console.log(thumbnailUrlOrig);
              if (globalConfigObject.download_clips_by_clip_id_thumbnails == true) {
                getTwitchVideoThumbnail(thumbnailUrlOrig, "clips", "orig", globalConfigObject, metadataToWriteToJsonFile, twitchCredentialsObject);
              }
              let thumbnailUrl1152p = metadataToWriteToJsonFile.thumbnail_url;
              thumbnailUrl1152p = thumbnailUrl1152p.replace(/(\%\{width\})+/ig, "2048");
              thumbnailUrl1152p = thumbnailUrl1152p.replace(/(\%\{height\})+/ig, "1152");
              //thumbnailUrl1152p = thumbnailUrl1152p.replace(/(\d+x+\d+)+/ig, "2048x1152");
              thumbnailUrl1152p = thumbnailUrl1152p.replace(/(\d+x+\d+)+\.+((j+p+g+)+|(p+n+g+)+|(w+e+b+p+)+)+/ig, "2048x1152.jpg");
              //console.log("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
              //console.log(thumbnailUrl1152p);
              if (globalConfigObject.download_clips_by_clip_id_thumbnails == true) {
                getTwitchVideoThumbnail(thumbnailUrl1152p, "clips", "1152p", globalConfigObject, metadataToWriteToJsonFile, twitchCredentialsObject); // NOTE: Resolutions other than 0x0 (orig) get extra compressed, extra crunchy, extra jpeg-ed, extra deepfried, so it isn't really recommended to download thumbnails that are not 0x0 (orig)
              }
              //console.log(metadataToWriteToJsonFile);
              let folderToMake = "";
              let metadataJsonFileFilename = "";
              let doesMetadataJsonFileExist = false;
              if (globalConfigObject.download_clips_by_clip_id_metadata == true) {
                // Doing this multiple times because I'm using an old version of node that doesn't support recursive folder creation (There was a reason for using this old version but I can't remember what, I think there were compatibility issues with either the serial port module or tmi.js module)
                // "output" folder
                folderToMake = __dirname + path.sep + "output";
                if (fs.existsSync(folderToMake) == false) {
                  //console.log(new Date().toISOString() + " [FOLDER CREATION] Creating the folder " + "output");
                  fs.mkdirSync(folderToMake);
                }
                // "userid_username" folder
                folderToMake = __dirname + path.sep + "output" + path.sep + channelId;
                if (fs.existsSync(folderToMake) == false) {
                  //console.log(new Date().toISOString() + " [FOLDER CREATION] Creating the folder " + channelId);
                  fs.mkdirSync(folderToMake);
                }
                // "clips" folder
                folderToMake = __dirname + path.sep + "output" + path.sep + channelId + path.sep + "clips";
                if (fs.existsSync(folderToMake) == false) {
                  //console.log(new Date().toISOString() + " [FOLDER CREATION] Creating the folder " + "clips");
                  fs.mkdirSync(folderToMake);
                }
                // "metadata" folder
                folderToMake = __dirname + path.sep + "output" + path.sep + channelId + path.sep + "clips" + path.sep + "metadata";
                if (fs.existsSync(folderToMake) == false) {
                  //console.log(new Date().toISOString() + " [FOLDER CREATION] Creating the folder " + "metadata");
                  fs.mkdirSync(folderToMake);
                }
                // year folder
                folderToMake = __dirname + path.sep + "output" + path.sep + channelId + path.sep + "clips" + path.sep + "metadata" + path.sep + createdAtYear;
                if (fs.existsSync(folderToMake) == false) {
                  //console.log(new Date().toISOString() + " [FOLDER CREATION] Creating the folder " + createdAtYear);
                  fs.mkdirSync(folderToMake);
                }
                // month folder
                folderToMake = __dirname + path.sep + "output" + path.sep + channelId + path.sep + "clips" + path.sep + "metadata" + path.sep + createdAtYear + path.sep + createdAtMonth;
                if (fs.existsSync(folderToMake) == false) {
                  //console.log(new Date().toISOString() + " [FOLDER CREATION] Creating the folder " + createdAtMonth);
                  fs.mkdirSync(folderToMake);
                }
                // Make file if file doesn't exist
                metadataJsonFileFilename = __dirname + path.sep + "output" + path.sep + channelId + path.sep + "clips" + path.sep + "metadata" + path.sep + createdAtYear + path.sep + createdAtMonth + path.sep + createdAtMillis + "_" + createdAtForPaths + "_" + channelId + "_" + clipId + "_clip_metadata.json";
                doesMetadataJsonFileExist = fs.existsSync(metadataJsonFileFilename);
                if (doesMetadataJsonFileExist == false) {
                  //console.log(new Date().toISOString() + " [FILE CREATION] Creating file " + createdAtMillis + "_" + createdAtForPaths + "_" + channelId + "_" + clipId + "_clip_metadata.json");
                  console.log(new Date().toISOString() + " [CLIPS] Saving metadata for clip ID " + clipId + " title " + clipTitle + " filename " + createdAtMillis + "_" + createdAtForPaths + "_" + channelId + "_" + clipId + "_clip_metadata.json");
                  fs.writeFileSync(metadataJsonFileFilename, JSON.stringify(metadataToWriteToJsonFile, null, 2), "utf8");
                  console.log(new Date().toISOString() + " [CLIPS] Saved metadata for clip ID " + clipId + " title " + clipTitle + " filename " + createdAtMillis + "_" + createdAtForPaths + "_" + channelId + "_" + clipId + "_clip_metadata.json");
                }
                // Or we choose to overwrite or not to overwrite file if file already exists
                //metadataJsonFileFilename = __dirname + path.sep + "output" + path.sep + channelId + path.sep + "clips" + path.sep + "metadata" + path.sep + createdAtYear + path.sep + createdAtMonth + path.sep + createdAtMillis + "_" + createdAtForPaths + "_" + channelId + "_" + clipId + "_clip_metadata.json";
                //doesMetadataJsonFileExist = fs.existsSync(metadataJsonFileFilename);
                if (doesMetadataJsonFileExist == true) {
                  if (globalConfigObject.overwrite_files == false) {
                    console.log(new Date().toISOString() + " [CLIPS] Overwriting disabled, skipping metadata for clip ID " + clipId + " title " + clipTitle + " filename " + createdAtMillis + "_" + createdAtForPaths + "_" + channelId + "_" + clipId + "_clip_metadata.json");
                    //console.log(new Date().toISOString() + " [FILE WRITING] Overwriting disabled, skipping file " + createdAtMillis + "_" + createdAtForPaths + "_" + channelId + "_" + clipId + "_clip_metadata.json");
                  }
                  if (globalConfigObject.overwrite_files == true) {
                    console.log(new Date().toISOString() + " [CLIPS] Overwriting enabled, saving metadata for clip ID " + clipId + " title " + clipTitle + " filename " + createdAtMillis + "_" + createdAtForPaths + "_" + channelId + "_" + clipId + "_clip_metadata.json");
                    //console.log(new Date().toISOString() + " [FILE WRITING] Overwriting file " + createdAtMillis + "_" + createdAtForPaths + "_" + channelId + "_" + clipId + "_clip_metadata.json");
                    fs.writeFileSync(metadataJsonFileFilename, JSON.stringify(metadataToWriteToJsonFile, null, 2), "utf8");
                    console.log(new Date().toISOString() + " [CLIPS] Overwriting enabled, saved metadata for clip ID " + clipId + " title " + clipTitle + " filename " + createdAtMillis + "_" + createdAtForPaths + "_" + channelId + "_" + clipId + "_clip_metadata.json");
                  }
                }
              }
              await sleep(200); // This sleep exists here because 1) the requests are non-blocking, which means that the code will not stop even when the request is still in progress and 2) it's usually not recommended to go too fast with HTTP requests, you can still comment this line if you want, but you'll likely get rate limited for going too fast
              if (dataSize < 100) {
                if (dataIndex >= dataSize - 1) {
                  downloaderClipIdIndexCurrent++;
                }
              }
              if (dataSize >= 100) {
                if (dataIndex >= dataSize - 1) {
                  downloaderClipIdIndexCurrent++;
                }
              }
            }
            // Valid response?
            //console.log(JSON.parse(rawOutputData.toString("utf8")));
          }
          if (dataSize <= 0) {
            // Something went wrong idk lol
            downloaderClipIdIndexCurrent++;
            console.log(new Date().toISOString() + " [CLIPS] Something went wrong downloading clips list for IDs " + formattedClipIds + " or there are no clips to list");
            console.log(rawOutputData.toString("utf8"));
            //console.log(new Date().toISOString() + " Something went wrong getting the clips list or there are simply no clips to list");
          }
        }
      }
    });
  });
  req.on("error", function(error) {
    //downloaderClipIdIndexCurrent++;
    console.log(new Date().toISOString() + " [CLIPS] Failed to download clips list for IDs " + formattedClipIds);
    //console.log(new Date().toISOString() + " CLIPS STATUS CONNECTION ERROR");
    console.error(error);
    getTwitchClipsByClipId(clipIds, globalConfigObject, twitchCredentialsObject);
  });
  req.end();
}

function getTwitchVideoThumbnail(thumbnailUrl, thumbnailType, thumbnailSize, globalConfigObject, thumbnailMetadata, twitchCredentialsObject) {
  // thumbnailUrl (string) is the URL as provided by the Twitch API, but already formatted to the correct dimensions (eg: %{width} and %{height} are replaced by 2048 and by 1152 respectively (or 0 and 0)) // NOTE: Resolutions other than 0x0 (orig) get extra compressed, extra crunchy, extra jpeg-ed, extra deepfried, so it isn't really recommended to download thumbnails that are not 0x0 (orig)
  // thumbnailType (string) is the type of video the thumbnail belongs to, the options are "clips" and "videos"
  // thumbnailSize (string) is the identifier that's appended at the end of the file name, the options are "1152p" and "orig", 1152p requests 2048x1152 thumbnail regardless of native stream resolution, orig requests 0x0 (orig) thumbnail, which means the thumbnail will match the native stream resolution // NOTE: Resolutions other than 0x0 (orig) get extra compressed, extra crunchy, extra jpeg-ed, extra deepfried, so it isn't really recommended to download thumbnails that are not 0x0 (orig)
  // thumbnailMetadata (object) is all of the metadata tied to a video or clip
  // twitchCredentialsObject (object) are your Twitch credentials as provided in the file twitch_credentials.json
  if (twitchCredentialsObject.use_twitch_api == false) {
    return;
  }
  if (globalConfigObject.use_get_twitch_video_thumbnail == false) {
    return;
  }
  console.log(new Date().toISOString() + " [THUMBNAIL] Attempting to download thumbnail for " + thumbnailType + " size " + thumbnailSize + " ID " + thumbnailMetadata.id + " title " + thumbnailMetadata.title + " on URL " + thumbnailUrl);
  //console.log(new Date().toISOString() + " [THUMBNAIL] Attempting to get thumbnail for " + thumbnailType + " " + thumbnailSize + " " + thumbnailMetadata.id + " on URL " + thumbnailUrl);
  let thumbnailParts = thumbnailUrl.split(/\/+/ig);
  //console.log(thumbnailParts);
  // index 0 is https
  // index 1 is domain
  // index 2 and beyond is the path to the thumbnail file
  // last index is the filename
  let thumbnailFilenameFromTheApi = thumbnailParts[thumbnailParts.length - 1];
  //console.log(new Date().toISOString() + " thumbnailFilenameFromTheApi = " + thumbnailFilenameFromTheApi);
  let thumbnailUrlPath = "";
  for (let thumbnailPartsIndex = 0; thumbnailPartsIndex < thumbnailParts.length; thumbnailPartsIndex++) {
    if (thumbnailPartsIndex >= 2 && thumbnailPartsIndex < thumbnailParts.length - 1) {
      thumbnailUrlPath = thumbnailUrlPath + thumbnailParts[thumbnailPartsIndex] + "\/";
    }
    if (thumbnailPartsIndex >= thumbnailParts.length - 1) {
      thumbnailUrlPath = thumbnailUrlPath + thumbnailParts[thumbnailPartsIndex];
    }
  }
  //console.log(new Date().toISOString() + " thumbnailUrlPath = " + thumbnailUrlPath);

  let rawOutputData = [];
  let twitchBotClientId = twitchCredentialsObject.twitch_client_id;
  let twitchBotId = twitchCredentialsObject.twitch_channel_id;
  let twitchBotOauthToken = twitchCredentialsObject.twitch_oauth_access_token;
  let pathToUse = "/" + thumbnailUrlPath;
  let options = {
    hostname: thumbnailParts[1],
    path: pathToUse,
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + twitchBotOauthToken,
      "Client-Id": twitchBotClientId
    }
  };
  let req = https.request(options, function(res) {
    res.setEncoding("binary"); // ALWAYS DO THIS IF YOU ARE DOWNLOADING BINARY STUFF, WHAT A HEADACHE IT WAS TO FIND THIS OUT https://stackoverflow.com/questions/17836438/getting-binary-content-in-node-js-with-http-request (See comment by Pärt Johanson on Apr 1, 2018 at 17:51) https://stackoverflow.com/questions/14855015/getting-binary-content-in-node-js-using-request (This is just an attempt that didn't work out, but it's here for other people who might be reading this comment)
    //console.log(new Date().toISOString() + " THUMBNAIL STATUS statusCode: " + res.statusCode);
    console.log(new Date().toISOString() + " [THUMBNAIL] Starting download for thumbnail for " + thumbnailType + " size " + thumbnailSize + " ID " + thumbnailMetadata.id + " title " + thumbnailMetadata.title + " on URL " + thumbnailUrl);
    res.on("data", function(d) {
      //console.log(new Date().toISOString() + " THUMBNAIL STATUS DATA RECEIVED");
      //console.log(d.toString("utf8"));
      rawOutputData = rawOutputData + d;
      //console.log(JSON.parse(d.toString("utf8")));
      //process.stdout.write(d);
      //console.log(d);
    });
    res.on("end", async function() {
      if (res.statusCode < 200 || res.statusCode > 299) {
        // Something went wrong idk lol
        console.log(new Date().toISOString() + " [THUMBNAIL] Something went wrong downloading thumbnail for " + thumbnailType + " size " + thumbnailSize + " ID " + thumbnailMetadata.id + " title " + thumbnailMetadata.title + " on URL " + thumbnailUrl);
        //console.log(new Date().toISOString() + " Something went wrong getting the thumbnail, the response code is " + res.statusCode);
        console.log(rawOutputData);
      }
      if (res.statusCode >= 200 && res.statusCode <= 299) {
        console.log(new Date().toISOString() + " [THUMBNAIL] Successfully downloaded thumbnail for " + thumbnailType + " size " + thumbnailSize + " ID " + thumbnailMetadata.id + " title " + thumbnailMetadata.title + " on URL " + thumbnailUrl);
        //console.log(new Date().toISOString() + " VALID RESPONSE PogChamp PogChamp PogChamp PogChamp PogChamp PogChamp PogChamp PogChamp PogChamp PogChamp PogChamp PogChamp");
        //console.log(new Date().toISOString() + " THUMBNAIL STATUS END");
        //console.log(rawOutputData);
        //console.log(new Date().toISOString() + " I'm not sure if the videos status response worked or not, look above for any error messages!");

        let videoId = thumbnailMetadata.id;
        let channelId = thumbnailMetadata.user_id;
        let userLogin = thumbnailMetadata.user_login;
        let videoTitle = thumbnailMetadata.title;

        let createdAt = thumbnailMetadata.created_at;
        let createdAtForPaths = thumbnailMetadata.created_at_for_paths;
        let createdAtMillis = thumbnailMetadata.created_at_millis;

        let createdAtMillisecond = thumbnailMetadata.created_at_millisecond;
        let createdAtSecond = thumbnailMetadata.created_at_second;
        let createdAtMinute = thumbnailMetadata.created_at_minute;
        let createdAtHour = thumbnailMetadata.created_at_hour;

        let createdAtDate = thumbnailMetadata.created_at_date;
        let createdAtMonth = thumbnailMetadata.created_at_month;
        let createdAtYear = thumbnailMetadata.created_at_year;

        let publishedAt = thumbnailMetadata.published_at;
        let publishedAtForPaths = thumbnailMetadata.published_at_for_paths;
        let publishedAtMillis = thumbnailMetadata.published_at_millis;

        let publishedAtMillisecond = thumbnailMetadata.published_at_millisecond;
        let publishedAtSecond = thumbnailMetadata.published_at_second;
        let publishedAtMinute = thumbnailMetadata.published_at_minute;
        let publishedAtHour = thumbnailMetadata.published_at_hour;

        let publishedAtDate = thumbnailMetadata.published_at_date;
        let publishedAtMonth = thumbnailMetadata.published_at_month;
        let publishedAtYear = thumbnailMetadata.published_at_year;

        let videoDuration = thumbnailMetadata.duration;

        let folderToMake = "";
        let thumbnailFileFilename = "";
        let doesThumbnailJpegFileExist = false;
        // Doing this multiple times because I'm using an old version of node that doesn't support recursive folder creation (There was a reason for using this old version but I can't remember what, I think there were compatibility issues with either the serial port module or tmi.js module)
        // "output" folder
        folderToMake = __dirname + path.sep + "output";
        if (fs.existsSync(folderToMake) == false) {
          //console.log(new Date().toISOString() + " [FOLDER CREATION] Creating the folder " + "output");
          fs.mkdirSync(folderToMake);
        }
        // "userid_username" folder
        folderToMake = __dirname + path.sep + "output" + path.sep + channelId;
        if (fs.existsSync(folderToMake) == false) {
          //console.log(new Date().toISOString() + " [FOLDER CREATION] Creating the folder " + channelId);
          fs.mkdirSync(folderToMake);
        }
        // thumbnailType folder
        folderToMake = __dirname + path.sep + "output" + path.sep + channelId + path.sep + thumbnailType;
        if (fs.existsSync(folderToMake) == false) {
          //console.log(new Date().toISOString() + " [FOLDER CREATION] Creating the folder " + thumbnailType);
          fs.mkdirSync(folderToMake);
        }
        // thumbnails_thumbnailSize folder
        folderToMake = __dirname + path.sep + "output" + path.sep + channelId + path.sep + thumbnailType + path.sep + "thumbnails" + "_" + thumbnailSize;
        if (fs.existsSync(folderToMake) == false) {
          //console.log(new Date().toISOString() + " [FOLDER CREATION] Creating the folder " + "thumbnails" + "_" + thumbnailSize);
          fs.mkdirSync(folderToMake);
        }
        // year folder
        folderToMake = __dirname + path.sep + "output" + path.sep + channelId + path.sep + thumbnailType + path.sep + "thumbnails" + "_" + thumbnailSize + path.sep + createdAtYear;
        if (fs.existsSync(folderToMake) == false) {
          //console.log(new Date().toISOString() + " [FOLDER CREATION] Creating the folder " + createdAtYear);
          fs.mkdirSync(folderToMake);
        }
        // month folder
        folderToMake = __dirname + path.sep + "output" + path.sep + channelId + path.sep + thumbnailType + path.sep + "thumbnails" + "_" + thumbnailSize + path.sep + createdAtYear + path.sep + createdAtMonth;
        if (fs.existsSync(folderToMake) == false) {
          //console.log(new Date().toISOString() + " [FOLDER CREATION] Creating the folder " + createdAtMonth);
          fs.mkdirSync(folderToMake);
        }
        // Make file if file doesn't exist
        thumbnailFileFilename = __dirname + path.sep + "output" + path.sep + channelId + path.sep + thumbnailType + path.sep + "thumbnails" + "_" + thumbnailSize + path.sep + createdAtYear + path.sep + createdAtMonth + path.sep + createdAtMillis + "_" + createdAtForPaths + "_" + channelId + "_" + videoId + "_" + thumbnailType + "_thumbnails_" + thumbnailSize + "_" + thumbnailFilenameFromTheApi;
        doesThumbnailJpegFileExist = fs.existsSync(thumbnailFileFilename);
        if (doesThumbnailJpegFileExist == false) {
          console.log(new Date().toISOString() + " [THUMBNAIL] Saving thumbnail for video ID " + videoId + " title " + videoTitle + " filename " + createdAtMillis + "_" + createdAtForPaths + "_" + channelId + "_" + videoId + "_" + thumbnailType + "_thumbnails_" + thumbnailSize + "_" + thumbnailFilenameFromTheApi);
          //console.log(new Date().toISOString() + " [FILE CREATION] Creating file " + createdAtMillis + "_" + createdAtForPaths + "_" + channelId + "_" + videoId + "_" + thumbnailType + "_thumbnails_" + thumbnailSize + "_" + thumbnailFilenameFromTheApi);
          fs.writeFileSync(thumbnailFileFilename, rawOutputData, "binary");
          console.log(new Date().toISOString() + " [THUMBNAIL] Saved thumbnail for video ID " + videoId + " title " + videoTitle + " filename " + createdAtMillis + "_" + createdAtForPaths + "_" + channelId + "_" + videoId + "_" + thumbnailType + "_thumbnails_" + thumbnailSize + "_" + thumbnailFilenameFromTheApi);
        }
        // Or we choose to overwrite or not to overwrite file if file already exists
        //thumbnailFileFilename = __dirname + path.sep + "output" + path.sep + channelId + path.sep + thumbnailType + path.sep + "thumbnails" + "_" + thumbnailSize + path.sep + createdAtYear + path.sep + createdAtMonth + path.sep + createdAtMillis + "_" + createdAtForPaths + "_" + channelId + "_" + videoId + "_" + thumbnailType + "_thumbnails_" + thumbnailSize + "_" + thumbnailFilenameFromTheApi;
        //doesThumbnailJpegFileExist = fs.existsSync(thumbnailFileFilename);
        if (doesThumbnailJpegFileExist == true) {
          if (globalConfigObject.overwrite_files == false) {
            console.log(new Date().toISOString() + " [THUMBNAIL] Overwriting disabled, skipping thumbnail for video ID " + videoId + " title " + videoTitle + " filename " + createdAtMillis + "_" + createdAtForPaths + "_" + channelId + "_" + videoId + "_" + thumbnailType + "_thumbnails_" + thumbnailSize + "_" + thumbnailFilenameFromTheApi);
            //console.log(new Date().toISOString() + " [FILE WRITING] Overwriting disabled, skipping file " + createdAtMillis + "_" + createdAtForPaths + "_" + channelId + "_" + videoId + "_" + thumbnailType + "_thumbnails_" + thumbnailSize + "_" + thumbnailFilenameFromTheApi);
          }
          if (globalConfigObject.overwrite_files == true) {
            console.log(new Date().toISOString() + " [THUMBNAIL] Overwriting enabled, saving thumbnail for video ID " + videoId + " title " + videoTitle + " filename " + createdAtMillis + "_" + createdAtForPaths + "_" + channelId + "_" + videoId + "_" + thumbnailType + "_thumbnails_" + thumbnailSize + "_" + thumbnailFilenameFromTheApi);
            //console.log(new Date().toISOString() + " [FILE WRITING] Overwriting file " + createdAtMillis + "_" + createdAtForPaths + "_" + channelId + "_" + videoId + "_" + thumbnailType + "_thumbnails_" + thumbnailSize + "_" + thumbnailFilenameFromTheApi);
            fs.writeFileSync(thumbnailFileFilename, rawOutputData, "binary");
            console.log(new Date().toISOString() + " [THUMBNAIL] Overwriting enabled, saved thumbnail for video ID " + videoId + " title " + videoTitle + " filename " + createdAtMillis + "_" + createdAtForPaths + "_" + channelId + "_" + videoId + "_" + thumbnailType + "_thumbnails_" + thumbnailSize + "_" + thumbnailFilenameFromTheApi);
          }
        }
        await sleep(200); // This sleep exists here because 1) the requests are non-blocking, which means that the code will not stop even when the request is still in progress and 2) it's usually not recommended to go too fast with HTTP requests
      }
    });
  });
  req.on("error", function(error) {
    console.log(new Date().toISOString() + " [THUMBNAIL] Failed to download thumbnail for " + thumbnailType + " size " + thumbnailSize + " ID " + thumbnailMetadata.id + " title " + thumbnailMetadata.title + " on URL " + thumbnailUrl);
    //console.log(new Date().toISOString() + " THUMBNAIL STATUS CONNECTION ERROR");
    console.error(error);
    getTwitchVideoThumbnail(thumbnailUrl, thumbnailType, thumbnailSize, globalConfigObject, thumbnailMetadata, twitchCredentialsObject);
  });
  req.end();
}

function getTwitchTokenStatus(twitchAccessTokenObject, globalConfigObject) {
  if (twitchCredentials.use_twitch_api == false) {
    return;
  }
  console.log(new Date().toISOString() + " Attempting to get twitch OAuth Token Status");
  let rawOutputData = "";
  let twitchOauthToken = twitchAccessTokenObject.twitch_oauth_access_token;
  if (twitchOauthToken === "" || twitchOauthToken === undefined || twitchOauthToken === null || twitchOauthToken === [] || twitchOauthToken === "[]" || twitchOauthToken.toLowerCase() === "null" || twitchOauthToken.toLowerCase() === "undefined") {
    twitchOauthToken = twitchAccessTokenObject.access_token;
  }
  let options = {
    hostname: "id.twitch.tv",
    path: "/oauth2/validate",
    method: "GET",
    headers: {
      "Authorization": "Bearer " + twitchOauthToken
    }
  };
  let req = https.request(options, function(res) {
    console.log("TWITCH OAUTH TOKEN STATUS statusCode: " + res.statusCode);
    res.on("data", function(d) {
      rawOutputData = rawOutputData + d.toString("utf8");
      //console.log(JSON.parse(d.toString("utf8")));
      //process.stdout.write(d);
      //console.log(d);
    });
    res.on("end", function() {
      if (res.statusCode < 200 || res.statusCode > 299) {
        console.log(new Date().toISOString() + " TWITCH OAUTH TOKEN STATUS RESPONSE ERROR res.statusCode = " + res.statusCode);
        console.log(rawOutputData.toString("utf8"));
      }
      if (res.statusCode >= 200 && res.statusCode <= 299) {
        //console.log(twitchAccessTokenObject);
        console.log(new Date().toISOString() + " TWITCH OAUTH TOKEN STATUS BELOW");
        console.log(JSON.parse(rawOutputData.toString("utf8")));
      }
    });
  });
  req.on("error", function(error) {
    console.log(new Date().toISOString() + " TWITCH OAUTH TOKEN STATUS CONNECTION ERROR");
    console.error(error);
  });
  req.end();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

process.on("SIGINT", onSigInt);

async function quitApp() {
  process.exit(0); // 0 will let Node.js know to terminate the process when no async operations are performing. Without mentioning, it will take the default value of 0.
}

async function onSigInt() {
  await quitApp();
}