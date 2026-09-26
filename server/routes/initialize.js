const express = require("express");
const router = express.Router();
const { ClerkExpressRequireAuth } = require("@clerk/clerk-sdk-node");
const { getrepos } = require('../utils/get_repo.js')
const multer = require('multer');
const { textExtractor } = require("../utils/get_resume_data.js");
const { cleanRepo } = require('../utils/clean_repo.js');
const { generateSystemPrompt } = require('../utils/prompt_builder.js');

const { AccessToken } = require('livekit-server-sdk');
const { RoomConfiguration, RoomAgentDispatch } = require("@livekit/protocol");

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // this field is optional
})


router.post("/", ClerkExpressRequireAuth(), upload.single('resume'), async (req, res) => {
  try {
    // Clerk automatically populates req.auth with the verified user's details
    const userId = req.auth.userId;

    // Extracting Fields from multer, it puts text files in req.body
    // And for file it puts in req.file
    const resumeName = req.body.resumeName;
    const file = req.file;

    // Extract resume text and clean repository metadata
    const resumeContent = await textExtractor(file);
    const repoData = await getrepos(userId);
    const cleanedRepo = cleanRepo(repoData);

    // Generate the master system prompt
    const systemPrompt = generateSystemPrompt(resumeContent, cleanedRepo);


    // LIVEKIT TOKEN 
    const token = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
      {
        identity: `candidate-${userId}`,
        // We are passing system prompt in the metadata so that agent can wakeup 
        // instantly when the user joins the room instead of asking backend to fetch system prompt from db
      }
    );

    // Token Permission Granting
    token.addGrant({
      roomJoin: true,
      room: `room-${userId}-${Date.now()}`,
      canPublish: true,      // Allow candidate to talk
      canSubscribe: true,    // Allow candidate to hear
      canPublishData: true   // Allow sending data messages
    });

    token.roomConfig = new RoomConfiguration({
      agents: [
        new RoomAgentDispatch({
          agentName: "interview-agent", // must match WorkerOptions(agent_name=...)
          metadata: JSON.stringify({ userId, systemPrompt }),
        }),
      ],
    });

    const signedJwtToken = await token.toJwt();

    // Once everything is ready Send the Room Access Token to the client
    return res.status(200).json({
      success: true,
      roomName: `room-${userId}`,
      token: signedJwtToken,
      livekitUrl: process.env.LIVEKIT_URL
    });

  } catch (error) {
    console.error("Initialization failed:", error);
    return res.status(500).json({
      success: false,
      error: `Internal Server Error during initialization: ${error}`
    });
  }
});

module.exports = router;
