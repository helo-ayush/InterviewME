import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useNavigate, useOutletContext } from "react-router-dom";
import VoiceOrb from "./VoiceOrb";
import { Track } from "livekit-client";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  StartAudio,
  useLocalParticipant,
  useConnectionState,
  useRemoteParticipants,
  useIsSpeaking,
  useTracks,
  useTrackVolume,
  useTranscriptions
} from "@livekit/components-react";

function StatusBadge({ label, color }) {
  const colorMap = {
    amber: {
      ping: "bg-amber-400",
      dot: "bg-amber-500",
      text: "text-amber-700",
      bg: "bg-amber-50"
    },
    emerald: {
      ping: "bg-emerald-400",
      dot: "bg-emerald-500",
      text: "text-emerald-800",
      bg: "bg-emerald-50"
    },
    blue: {
      ping: "bg-blue-400",
      dot: "bg-blue-500",
      text: "text-blue-800",
      bg: "bg-blue-50"
    }
  };

  const selectedColor = colorMap[color] || colorMap.amber;

  return (
    <div className={`inline-flex items-center gap-2 rounded-full px-3 py-2 ${selectedColor.bg}`}>
      <span className="flex h-2.5 w-2.5 relative">
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${selectedColor.ping}`}></span>
        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${selectedColor.dot}`}></span>
      </span>
      <span className={`text-[0.78rem] font-[820] ${selectedColor.text}`}>
        {label}
      </span>
    </div>
  );
}

function AgentStatusInner({ agent, isPaused }) {
  const agentSpeaking = useIsSpeaking(agent);

  // Check if the agent has published an audio track yet.
  // The agent only publishes audio after its Gemini realtime model is
  // fully connected and has produced at least one audio frame.
  const tracks = useTracks([Track.Source.Microphone]);
  const agentHasAudio = tracks.some(
    (t) => t.participant.identity === agent.identity && t.publication.kind === "audio"
  );

  let label = "Agent Warming Up...";
  let color = "amber";

  if (isPaused) {
    label = "Session Paused";
    color = "amber";
  } else if (!agentHasAudio) {
    label = "Agent Warming Up...";
    color = "amber";
  } else if (agentSpeaking) {
    label = "Agent Speaking...";
    color = "blue";
  } else {
    label = "Listening...";
    color = "emerald";
  }

  return <StatusBadge label={label} color={color} />;
}

function SessionStatus({ isPaused }) {
  const connectionState = useConnectionState();
  const remoteParticipants = useRemoteParticipants();
  const agent = remoteParticipants.length > 0 ? remoteParticipants[0] : null;

  if (isPaused) {
    return <StatusBadge label="Session Paused" color="amber" />;
  }

  if (connectionState !== "connected") {
    return <StatusBadge label="Connecting..." color="amber" />;
  }

  if (!agent) {
    return <StatusBadge label="Waiting..." color="amber" />;
  }

  return <AgentStatusInner agent={agent} isPaused={isPaused} />;
}

function ChatPanel() {
  const transcriptions = useTranscriptions();
  const { localParticipant } = useLocalParticipant();
  const scrollContainerRef = useRef(null);

  // Auto scroll to bottom of the scroll container
  useEffect(() => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      setTimeout(() => {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: "smooth"
        });
      }, 60);
    }
  }, [transcriptions]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="mb-4 flex shrink-0 items-center justify-between border-b border-slate-950/[0.06] pb-4">
        <div>
          <h2 className="text-[0.76rem] font-[820] uppercase tracking-normal text-slate-400">Live transcript</h2>
          <p className="mt-1 text-[0.86rem] font-[560] text-slate-500">Responses appear here as the interview progresses.</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-slate-950/[0.055] bg-white px-3 py-1.5">
          <span className="size-1.5 animate-pulse rounded-full bg-[#111722]" />
          <span className="text-[0.68rem] font-[820] uppercase text-slate-500">Syncing</span>
        </div>
      </div>

      {transcriptions.length === 0 ? (
        <div className="flex flex-1 flex-col justify-end pb-2">
          <div className="space-y-3">
            <div className="w-fit rounded-[22px] border border-slate-950/[0.055] bg-white px-4 py-3 text-[0.86rem] font-[650] text-slate-500 shadow-sm">
              Welcome to your interview room.
            </div>
            <div className="w-72 rounded-[22px] border border-slate-950/[0.055] bg-white px-4 py-3 text-[0.86rem] font-[650] leading-relaxed text-slate-500 shadow-sm">
              I will guide the conversation and keep the questions focused.
            </div>
            <div className="w-[22rem] max-w-full rounded-[22px] border border-slate-950/[0.055] bg-[#111722] px-4 py-3 text-[0.86rem] font-[650] leading-relaxed text-white shadow-[0_18px_38px_rgba(18,24,35,0.16)]">
              Start when you are ready. Speak naturally and leave room for follow-ups.
            </div>
          </div>
        </div>
      ) : (
        <div
          ref={scrollContainerRef}
          className="flex flex-1 flex-col space-y-3.5 overflow-y-auto pr-1 pb-2"
        >
          {transcriptions.map((t) => {
            const isUser = t.participantIdentity === localParticipant?.identity;
            return (
              <div
                key={t.id}
                className={`flex flex-col max-w-[85%] ${
                  isUser ? "self-end items-end" : "self-start items-start"
                }`}
              >
                <span className="mb-1 px-1 text-[0.66rem] font-[820] uppercase text-slate-400">
                  {isUser ? "You" : "Interviewer"}
                </span>
                <div
                  className={`rounded-[22px] border px-4 py-3 text-[0.86rem] font-[640] leading-relaxed shadow-sm ${
                    isUser
                      ? "rounded-tr-none border-slate-950/[0.08] bg-[#111722] text-white"
                      : "rounded-tl-none border-slate-950/[0.055] bg-white text-slate-700"
                  } ${!t.isFinal ? "opacity-60 italic" : ""}`}
                >
                  {t.text}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function InterviewSession({ isPaused, setIsPaused }) {
  const navigate = useNavigate();

  // Control Toggles
  const [isMuted, setIsMuted] = useState(false);

  // Handling the mute and pause feature
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  
  const toggleMic = async () => {
    setIsMuted(!isMuted);
  };

  // Sync mic status whenever isMuted or isPaused changes
  useEffect(() => {
    if (localParticipant) {
      const shouldEnable = !isMuted && !isPaused;
      localParticipant.setMicrophoneEnabled(shouldEnable);
    }
  }, [isMuted, isPaused, localParticipant]);

  // Track the agent's real-time audio volume
  const tracks = useTracks([Track.Source.Microphone]);
  const agentTrack = tracks.find(
    (t) => !t.participant.isLocal && t.publication.kind === "audio"
  );
  const volume = useTrackVolume(agentTrack) || 0;

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="mx-auto flex h-full w-full max-w-[1480px] flex-col gap-5 px-5 pb-5 md:px-8 xl:px-10"
    >
      <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[minmax(360px,0.78fr)_minmax(0,1.22fr)]">
        <div className="flex min-h-0 flex-col overflow-hidden rounded-[40px] border border-slate-950/[0.055] bg-white/64 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.88),0_30px_80px_rgba(18,24,35,0.07)] backdrop-blur-2xl">
          <ChatPanel />
        </div>

        <div className="relative min-h-0 overflow-hidden rounded-[42px] border border-slate-950/[0.055] bg-[linear-gradient(145deg,rgba(255,255,255,0.96),rgba(238,243,250,0.68)),#fbfbfb] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.88),0_34px_90px_rgba(18,24,35,0.09)]">
          <div className="absolute inset-x-8 top-8 h-[280px] rounded-[34px] bg-[linear-gradient(90deg,rgba(17,23,34,0.045)_1px,transparent_1px),linear-gradient(180deg,rgba(17,23,34,0.045)_1px,transparent_1px)] bg-[length:38px_38px]" />
          <div className="relative z-10 mb-4 flex items-center justify-between gap-4">
            <div>
              <span className="text-[0.72rem] font-[820] uppercase text-slate-400">AI interviewer</span>
              <h1 className="mt-1 text-[1.6rem] font-[780] leading-tight text-[#111722]">Frontend architecture review</h1>
            </div>
            <SessionStatus isPaused={isPaused} />
          </div>
          <div className="relative z-10 h-[calc(100%-88px)] min-h-0">
            <VoiceOrb volume={volume} isPaused={isPaused} />
          </div>
        </div>
      </div>

      <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-[32px] border border-slate-950/[0.055] bg-white/74 p-3 shadow-[0_20px_60px_rgba(18,24,35,0.075)] backdrop-blur-2xl">
        <div className="flex justify-start">
          <div>
            <span className="block text-[0.68rem] font-[820] uppercase text-slate-400">Session</span>
            <strong className="text-[0.95rem] font-[780] text-[#111722]">Live practice</strong>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={toggleMic}
            className={`flex size-12 cursor-pointer items-center justify-center rounded-full transition shadow-sm
            ${isMuted
                ? "bg-rose-500 text-white hover:bg-rose-600"
                : "bg-[#111722] text-white hover:bg-[#20283a]"
              }`}
            title={isMuted ? "Unmute Mic" : "Mute Mic"}
            type="button"
          >
            {isMuted ? (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
              </svg>
            )}
          </button>

          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`flex size-12 cursor-pointer items-center justify-center rounded-full transition shadow-sm
            ${isPaused
                ? "bg-amber-500 text-white hover:bg-amber-600"
                : "bg-white text-[#111722] ring-1 ring-slate-950/[0.08] hover:bg-slate-50"
              }`}
            title={isPaused ? "Resume Session" : "Pause Session"}
            type="button"
          >
            {isPaused ? (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347c-.75.412-1.667-.13-1.667-.986V5.653Z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
              </svg>
            )}
          </button>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => navigate("/home/interview/complete")}
            className="min-h-12 cursor-pointer rounded-full bg-[#111722] px-6 text-[0.9rem] font-[820] text-white shadow-[0_18px_38px_rgba(18,24,35,0.16)] transition hover:-translate-y-0.5 hover:bg-[#20283a]"
            type="button"
          >
            End session
          </button>
        </div>
      </div>
    </motion.section>
  );
}

function InterviewSessionWrapper() {
  const { token, livekitUrl } = useOutletContext();
  const [isPaused, setIsPaused] = useState(false);

  return (
    <LiveKitRoom
      token={token}
      serverUrl={livekitUrl}
      connect={!!token}
      audio={true}
      video={false}
      className="flex-1 flex flex-col"
    >
      <StartAudio />
      {!isPaused && <RoomAudioRenderer />}
      <InterviewSession isPaused={isPaused} setIsPaused={setIsPaused} />
    </LiveKitRoom>
  );
}

export default InterviewSessionWrapper;
