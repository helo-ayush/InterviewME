import React, { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";

function Interview() {
  const [microphoneAllowed, setMicrophoneAllowed] = useState(false);
  const [resumeName, setResumeName] = useState("");

  // Room Details
  const [token, setToken] = useState("");
  const [roomName, setRoomName] = useState("");
  const [livekitUrl, setLivekitUrl] = useState("");
  const [initError, setInitError] = useState("");

  useEffect(() => {
    let mounted = true;

    const checkPermission = async () => {
      if (!navigator.permissions?.query) return;

      try {
        const permission = await navigator.permissions.query({ name: "microphone" });
        if (mounted && permission.state === "granted") {
          setMicrophoneAllowed(true);
        }
      } catch {
        // Some browsers do not expose microphone through the Permissions API.
      }
    };

    checkPermission();

    return () => {
      mounted = false;
    };
  }, []);

  const requestMicrophoneAccess = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setMicrophoneAllowed(true);
    } catch {
      setMicrophoneAllowed(false);
    }
  };

  return (
    <main className="relative h-screen overflow-hidden bg-[linear-gradient(90deg,rgba(24,30,42,0.028)_1px,transparent_1px),linear-gradient(180deg,rgba(24,30,42,0.026)_1px,transparent_1px),radial-gradient(circle_at_82%_10%,rgba(209,216,228,0.76),transparent_34%),linear-gradient(180deg,#fbfbfa_0%,#f3f3f0_60%,#ececea_100%)] bg-[length:84px_84px,84px_84px,auto,auto] pt-[96px] text-[#111722]">
      <div className="relative z-10 h-full w-full overflow-hidden">
        <Outlet
          context={{
            microphoneAllowed,
            resumeName,
            setResumeName,
            requestMicrophoneAccess,
            token, setToken,
            roomName, setRoomName,
            livekitUrl, setLivekitUrl,
            initError, setInitError
          }}
        />
      </div>
    </main>
  );
}

export default Interview;
