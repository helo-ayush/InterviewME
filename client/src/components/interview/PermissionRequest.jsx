import React, { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate, useOutletContext } from "react-router-dom";
import { useApi } from "../../utils/api";

const contextItems = [
  ["Microphone", "Required for a voice-led interview room."],
  ["Resume", "Optional, used for personalized follow-up questions."],
  ["Privacy", "Only session context is prepared for this interview."],
];

function PermissionRequest() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const apiFetch = useApi();
  const {
    microphoneAllowed,
    resumeName,
    setResumeName,
    requestMicrophoneAccess,
    setToken,
    setRoomName,
    setLivekitUrl,
    setInitError,
  } = useOutletContext();

  useEffect(() => {
    setToken("");
    setRoomName("");
    setLivekitUrl("");
    setInitError("");
  }, [setToken, setRoomName, setLivekitUrl, setInitError]);

  const startSession = async () => {
    try {
      const file = fileInputRef.current?.files?.[0];
      const MAX_FILE_SIZE = 5 * 1024 * 1024;

      if (file && file.size > MAX_FILE_SIZE) {
        alert("File size must be less than 5MB");
        return;
      }

      const formdata = new FormData();
      if (file) {
        formdata.append("resume", file);
        formdata.append("resumeName", resumeName);
      }

      apiFetch(import.meta.env.VITE_BACKEND_URL + "/initialize", {
        method: "POST",
        body: formdata,
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success === true) {
            setToken(data.token);
            setLivekitUrl(data.livekitUrl);
            setRoomName(data.roomName);
          } else {
            setInitError(data.error);
            console.log(data.error);
          }
        })
        .catch((error) => {
          setInitError(error.message || "Network Error");
          console.error("Background initialization failed:", error);
        });

      navigate("/home/interview/booting");
    } catch (error) {
      console.error("Failed to start session:", error);
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto grid h-full w-full max-w-[1480px] grid-rows-[1fr_auto] gap-5 px-5 pb-5 md:px-8 xl:px-10"
    >
      <div className="grid min-h-0 gap-5 lg:grid-cols-[minmax(380px,0.9fr)_minmax(0,1.1fr)]">
        <aside className="flex min-h-0 flex-col justify-between rounded-[40px] border border-slate-950/[0.055] bg-[linear-gradient(145deg,rgba(255,255,255,0.94),rgba(240,245,252,0.62)),#fbfbfb] p-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.88),0_30px_80px_rgba(18,24,35,0.07)]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-950/[0.06] bg-white/72 px-3.5 py-2 text-[0.72rem] font-[820] uppercase text-slate-500">
              <span className="size-1.5 rounded-full bg-[#111722]" />
              Setup
            </span>
            <h1 className="mt-6 text-[clamp(2.7rem,5vw,5.25rem)] font-[780] leading-[0.92] text-[#0f1420]">
              Prepare the room.
            </h1>
            <p className="mt-5 max-w-[520px] text-[0.98rem] font-[560] leading-[1.72] text-slate-500">
              Confirm audio and add your resume if you want the session to adapt to your experience, projects, and target role.
            </p>
          </div>

          <div className="grid gap-3">
            {contextItems.map(([title, copy]) => (
              <div className="rounded-[24px] border border-slate-950/[0.05] bg-white/58 px-4 py-3.5" key={title}>
                <strong className="block text-[0.98rem] font-[780] text-[#111722]">{title}</strong>
                <span className="mt-1 block text-[0.86rem] font-[560] leading-relaxed text-slate-500">{copy}</span>
              </div>
            ))}
          </div>
        </aside>

        <div className="grid min-h-0 gap-5">
          <motion.div
            whileHover={{ y: -3 }}
            className="rounded-[40px] border border-slate-950/[0.055] bg-white/68 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.88),0_24px_70px_rgba(18,24,35,0.06)] backdrop-blur-2xl"
          >
            <div className="flex items-start justify-between gap-5">
              <div>
                <span className="text-[0.72rem] font-[820] uppercase text-slate-400">Permission 01</span>
                <h2 className="mt-2 text-[1.8rem] font-[780] leading-tight text-[#111722]">Microphone access</h2>
                <p className="mt-2 max-w-[620px] text-[0.93rem] font-[560] leading-relaxed text-slate-500">
                  RIVR needs your microphone to listen, detect pauses, and keep the interview conversational.
                </p>
              </div>
              <span className={`rounded-full px-3 py-1.5 text-[0.78rem] font-[780] ${microphoneAllowed ? "bg-emerald-50 text-emerald-800" : "bg-slate-950/[0.06] text-slate-500"}`}>
                {microphoneAllowed ? "Allowed" : "Required"}
              </span>
            </div>
            <button
              onClick={requestMicrophoneAccess}
              className={`mt-8 min-h-12 cursor-pointer rounded-full px-5 text-[0.9rem] font-[820] transition hover:-translate-y-0.5 ${microphoneAllowed ? "bg-white text-[#111722] ring-1 ring-slate-950/[0.08]" : "bg-[#111722] text-white shadow-[0_18px_38px_rgba(18,24,35,0.18)]"}`}
              type="button"
            >
              {microphoneAllowed ? "Access enabled" : "Allow microphone"}
            </button>
          </motion.div>

          <motion.label
            whileHover={{ y: -3 }}
            className="block cursor-pointer rounded-[40px] border border-dashed border-slate-950/[0.14] bg-white/56 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.88),0_24px_70px_rgba(18,24,35,0.05)] backdrop-blur-2xl"
          >
            <div className="flex items-start justify-between gap-5">
              <div>
                <span className="text-[0.72rem] font-[820] uppercase text-slate-400">Optional context</span>
                <h2 className="mt-2 text-[1.8rem] font-[780] leading-tight text-[#111722]">Upload resume</h2>
                <p className="mt-2 max-w-[620px] text-[0.93rem] font-[560] leading-relaxed text-slate-500">
                  PDF or DOCX. This can power role-specific questions, project follow-ups, and better scoring later.
                </p>
              </div>
              <span className="rounded-full bg-white px-4 py-2 text-[0.84rem] font-[800] text-[#111722] shadow-[0_12px_28px_rgba(18,24,35,0.06)]">
                Choose file
              </span>
            </div>
            <div className="mt-6 rounded-[26px] border border-slate-950/[0.055] bg-white/62 px-4 py-4">
              <span className="block text-[0.72rem] font-[820] uppercase text-slate-400">Selected file</span>
              <strong className="mt-1 block truncate text-[1rem] font-[760] text-[#111722]">{resumeName || "No resume selected yet"}</strong>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx"
              className="sr-only"
              onChange={(event) => setResumeName(event.target.files?.[0]?.name || "")}
            />
          </motion.label>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-[30px] border border-slate-950/[0.055] bg-white/68 p-3 shadow-[0_18px_50px_rgba(18,24,35,0.065)] backdrop-blur-2xl">
        <button
          onClick={() => navigate("/home/interview")}
          className="min-h-11 cursor-pointer rounded-full px-5 text-[0.9rem] font-[780] text-slate-500 transition hover:bg-slate-950/[0.05] hover:text-[#111722]"
          type="button"
        >
          Back
        </button>
        <motion.button
          onClick={startSession}
          disabled={!microphoneAllowed}
          whileHover={microphoneAllowed ? { y: -2 } : undefined}
          whileTap={microphoneAllowed ? { scale: 0.98 } : undefined}
          className="min-h-12 cursor-pointer rounded-full bg-[#111722] px-7 text-[0.92rem] font-[820] text-white shadow-[0_18px_38px_rgba(18,24,35,0.18)] transition disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-white disabled:shadow-none"
          type="button"
        >
          Prepare interview
        </motion.button>
      </div>
    </motion.section>
  );
}

export default PermissionRequest;
