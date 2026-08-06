import React, { useState, useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, AlertCircle, RefreshCw, CheckCircle, Smartphone, Keyboard, Search, Send, User, KeyRound } from "lucide-react";
import { Student, Token } from "../types";

interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void;
  students: Student[];
  tokens: Token[];
  cooldownActive: boolean;
}

export default function QRScanner({
  onScanSuccess,
  students,
  tokens,
  cooldownActive
}: QRScannerProps) {
  const [activeTab, setActiveTab] = useState<"camera" | "manual">("camera");
  const [manualInput, setManualInput] = useState<string>("");
  const [manualError, setManualError] = useState<string | null>(null);

  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraState, setCameraState] = useState<"idle" | "loading" | "scanning" | "error">("idle");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<any[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [successOverlay, setSuccessOverlay] = useState(false);
  const [scannedValue, setScannedValue] = useState<string | null>(null);

  const qrReaderRef = useRef<Html5Qrcode | null>(null);
  const containerId = "qr-reader-viewport";

  const onScanSuccessRef = useRef(onScanSuccess);
  const cooldownActiveRef = useRef(cooldownActive);

  useEffect(() => {
    onScanSuccessRef.current = onScanSuccess;
    cooldownActiveRef.current = cooldownActive;
  }, [onScanSuccess, cooldownActive]);

  // Safe mount tracker to guard asynchronous operations
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Track the active camera start/stop process using a single lock/serial mechanism to avoid race conditions
  const currentActionRef = useRef<Promise<any>>(Promise.resolve());

  const executeSequence = (action: () => Promise<any>) => {
    currentActionRef.current = currentActionRef.current
      .then(action)
      .catch((err) => {
        console.warn("Sequence action failed:", err);
      });
  };

  // Scan success feedback
  const triggerSuccessFeedback = (value: string) => {
    if (!isMountedRef.current) return;
    setScannedValue(value);
    setSuccessOverlay(true);
    setTimeout(() => {
      if (!isMountedRef.current) return;
      setSuccessOverlay(false);
      setScannedValue(null);
    }, 1800);
  };

  // Start/Stop camera sequentially based on isCameraActive & activeTab
  useEffect(() => {
    if (activeTab === "manual" || !isCameraActive) {
      executeSequence(stopCamera);
      if (isMountedRef.current) {
        setCameraState("idle");
        setCameraError(null);
      }
      return;
    }

    let mounted = true;

    const startAndRegister = async () => {
      // Always stop first
      await stopCamera();
      
      if (!mounted || !isMountedRef.current) return;

      // Start new camera
      await startCamera();
    };

    executeSequence(startAndRegister);

    return () => {
      mounted = false;
      executeSequence(stopCamera);
    };
  }, [isCameraActive, activeTab]);

  const startCamera = async () => {
    // Check if the container element actually exists in the DOM first
    const element = document.getElementById(containerId);
    if (!element) {
      console.warn("Scanner element not found in DOM.");
      return;
    }

    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      if (isMountedRef.current) {
        setCameraError("Camera is restricted by browser security. Please open the website via http://localhost:5050 or HTTPS.");
        setCameraState("error");
      }
      return;
    }

    try {
      if (isMountedRef.current) {
        setCameraState("loading");
        setCameraError(null);
      }

      const html5Qrcode = new Html5Qrcode(containerId);
      qrReaderRef.current = html5Qrcode;

      const scanConfig = { fps: 10, qrbox: 250, aspectRatio: 1.0 };
      const onScanSuccessCallback = (decodedText: string) => {
        if (cooldownActiveRef.current) return;
        if (isMountedRef.current) {
          triggerSuccessFeedback(decodedText);
          setTimeout(() => {
            if (isMountedRef.current) setIsCameraActive(false);
          }, 400);
        }
        onScanSuccessRef.current(decodedText);
      };
      const onScanErrorCallback = (_errorMessage: string) => {};

      let started = false;

      // Strategy 1: Try environment facingMode
      try {
        await html5Qrcode.start({ facingMode: "environment" }, scanConfig, onScanSuccessCallback, onScanErrorCallback);
        started = true;
      } catch (e1) {
        console.warn("Environment camera not available, trying user/webcam...", e1);
      }

      // Strategy 2: Try user facingMode (desktop webcam / front camera)
      if (!started) {
        try {
          await html5Qrcode.start({ facingMode: "user" }, scanConfig, onScanSuccessCallback, onScanErrorCallback);
          started = true;
        } catch (e2) {
          console.warn("User camera not available, trying enumerated devices...", e2);
        }
      }

      // Strategy 3: Enumerate devices explicitly
      if (!started) {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          const targetId = selectedCameraId || devices[0].id;
          await html5Qrcode.start(targetId, scanConfig, onScanSuccessCallback, onScanErrorCallback);
          started = true;
        } else {
          throw new Error("No physical camera device detected on this system.");
        }
      }

      if (isMountedRef.current) {
        setCameraState("scanning");
      }
    } catch (err: any) {
      console.warn("Failed to start camera feed:", err);
      if (isMountedRef.current) {
        setCameraError(err?.message || "Could not start camera feed. Please check browser permissions.");
        setCameraState("error");
      }
    }
  };

  const stopCamera = async () => {
    if (qrReaderRef.current) {
      try {
        const isCurrentlyScanning = 
          typeof qrReaderRef.current.isScanning === "boolean"
            ? qrReaderRef.current.isScanning
            : (typeof qrReaderRef.current.getState === "function"
                ? qrReaderRef.current.getState() === 2 // SCANNING state
                : true);

        if (isCurrentlyScanning) {
          await qrReaderRef.current.stop();
        }
      } catch (err) {
        console.warn("Failed to stop camera", err);
      } finally {
        try {
          qrReaderRef.current.clear();
        } catch (e) {}
        qrReaderRef.current = null;
      }
    }
    if (isMountedRef.current) {
      setCameraState("idle");
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setManualError(null);

    const val = manualInput.trim();
    if (!val) {
      setManualError("Please enter a valid Student Register No or Token ID.");
      return;
    }

    if (cooldownActive) {
      setManualError("System cooldown in progress. Please wait a moment.");
      return;
    }

    triggerSuccessFeedback(val);
    onScanSuccess(val);
    setManualInput("");
  };

  const handleQuickSelect = (val: string) => {
    if (cooldownActive) return;
    setManualInput(val);
    setManualError(null);
    triggerSuccessFeedback(val);
    onScanSuccess(val);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xl relative overflow-hidden flex flex-col min-h-[460px]">
      
      {/* Scanner Mode Header Tabs */}
      <div className="flex flex-wrap border-b border-slate-100 pb-3 items-center justify-between gap-2">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => {
              setActiveTab("camera");
              setManualError(null);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "camera"
                ? "bg-white text-[#FF9933] shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Camera Scan</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("manual");
              setIsCameraActive(false);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "manual"
                ? "bg-white text-[#FF9933] shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span>Manual Entry</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === "camera" && isCameraActive && (
            <button
              type="button"
              onClick={() => {
                setIsCameraActive(false);
                setCameraState("idle");
              }}
              className="text-[9px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 py-1 px-2 rounded-lg border border-rose-200 transition-all cursor-pointer"
            >
              Stop Camera
            </button>
          )}
          {activeTab === "camera" ? (
            cameraState === "scanning" ? (
              <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 py-1 px-2.5 rounded-full border border-emerald-150 text-[9px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Live Feed Enabled
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-rose-50 text-rose-700 py-1 px-2.5 rounded-full border border-rose-150 text-[9px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                Offline / Pending
              </div>
            )
          ) : (
            <div className="flex items-center gap-1.5 bg-amber-50 text-amber-700 py-1 px-2.5 rounded-full border border-amber-150 text-[9px] font-bold">
              <Keyboard className="w-3 h-3 text-[#FF9933]" />
              Manual Mode Active
            </div>
          )}
        </div>
      </div>

      {/* Main Viewport / Form Container */}
      <div className="my-5 flex-grow flex flex-col justify-center items-center relative min-h-[280px]">
        
        {/* Success Flash Feedback Overlay */}
        {successOverlay && (
          <div className="absolute inset-0 bg-emerald-500/20 backdrop-blur-[2px] flex flex-col items-center justify-center z-25 animate-in fade-in duration-200 rounded-2xl">
            <div className="bg-white p-3.5 rounded-full shadow-xl border border-emerald-300 flex items-center justify-center animate-bounce">
              <CheckCircle className="w-8 h-8 text-emerald-500" />
            </div>
            <p className="text-white font-mono text-[9px] font-bold tracking-widest uppercase mt-3 bg-emerald-600/90 px-3 py-1 rounded-full border border-emerald-400">
              Code Processed
            </p>
            {scannedValue && (
              <p className="text-white font-mono text-[9px] mt-1 opacity-90 max-w-[180px] truncate bg-black/40 px-2 py-0.5 rounded">
                {scannedValue}
              </p>
            )}
          </div>
        )}

        {activeTab === "camera" ? (
          /* Real Live Camera Canvas Viewport */
          <div 
            className={`w-full max-w-[340px] aspect-square rounded-2xl bg-slate-950 overflow-hidden relative border-4 ${
              cameraState === "scanning" ? "border-emerald-500/20 shadow-lg shadow-emerald-500/5" : "border-slate-100"
            }`}
          >
            <div id={containerId} className="w-full h-full"></div>

            {/* Idle state overlay */}
            {cameraState === "idle" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/95 text-slate-300 z-10 p-6 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-[#FF9933]">
                  <Camera className="w-6 h-6 animate-pulse" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-xs font-bold text-slate-200 tracking-wide uppercase font-display leading-tight">Camera Feed Dormant</p>
                  <p className="text-[9px] text-slate-400 max-w-[200px] leading-relaxed mx-auto">
                    Start the hardware link to scan student registration codes or physical tokens.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCameraActive(true)}
                  className="w-full bg-[#FF9933] hover:bg-[#e68a2e] text-white text-[10px] font-bold py-2.5 px-4 rounded-xl border border-[#FF9933] transition-colors cursor-pointer text-center uppercase tracking-wider"
                >
                  Activate Camera
                </button>
              </div>
            )}

            {/* Loading state overlay */}
            {cameraState === "loading" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 text-slate-300 z-10 space-y-2">
                <RefreshCw className="w-7 h-7 animate-spin text-[#FF9933]" />
                <p className="text-[10px] font-bold tracking-wider uppercase font-display">Initializing Camera Link...</p>
              </div>
            )}

            {/* Error state overlay */}
            {cameraState === "error" && (
              <div className="absolute inset-0 flex flex-col justify-center bg-slate-900/95 text-slate-300 z-10 p-6 space-y-4">
                <div className="flex flex-col items-center text-center space-y-2 pb-2">
                  <AlertCircle className="w-8 h-8 text-rose-500" />
                  <div>
                    <p className="text-xs font-black text-rose-400 tracking-wide uppercase font-display leading-tight">Camera Offline</p>
                    <p className="text-[9px] text-slate-400 mt-1 leading-relaxed">
                      {cameraError || "No physical camera detected. Please check permissions, connect a camera, and ensure you are using HTTPS or localhost."}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 w-full">
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedCameraId) {
                        startCamera();
                      } else {
                        Html5Qrcode.getCameras().then((devices) => {
                          if (devices && devices.length > 0) {
                            setCameras(devices);
                            setSelectedCameraId(devices[0].id);
                          }
                        }).catch(err => {
                          console.warn(err);
                        });
                      }
                    }}
                    className="w-full bg-[#FF9933] hover:bg-[#e68a2e] text-white text-[9px] font-bold py-2 px-3 rounded-xl border border-[#FF9933] transition-colors cursor-pointer text-center uppercase tracking-wider"
                  >
                    Retry Hardware Link
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* MANUAL ENTRY FORM PANEL */
          <div className="w-full max-w-[360px] space-y-5 py-2">
            <div className="text-center space-y-1.5">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-150 flex items-center justify-center text-[#FF9933] mx-auto shadow-xs">
                <Keyboard className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-extrabold text-slate-800 tracking-tight font-display">
                Manual Code Entry
              </h3>
              <p className="text-[11px] text-slate-500 max-w-[260px] mx-auto leading-relaxed">
                Type the Student Reg No to issue a token, or a Token ID (TOK-...) to verify a claim.
              </p>
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-3">
              {manualError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-[11px] p-2.5 rounded-xl flex items-center gap-2 font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{manualError}</span>
                </div>
              )}

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Search className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  placeholder="e.g. 243301034021 or TOK-123456"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-mono font-bold pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF9933]/50 focus:border-[#FF9933] transition-all uppercase placeholder:normal-case placeholder:font-normal"
                />
              </div>

              <button
                type="submit"
                disabled={cooldownActive}
                className={`w-full text-white text-xs font-bold py-3 px-4 rounded-xl border transition-all cursor-pointer shadow-md text-center uppercase tracking-wider font-display flex items-center justify-center gap-2 ${
                  cooldownActive
                    ? "bg-slate-300 border-slate-300 cursor-not-allowed shadow-none"
                    : "bg-[#FF9933] hover:bg-[#e68a2e] border-[#FF9933] shadow-[#FF9933]/20"
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                <span>Process Code Entry</span>
              </button>
            </form>

          </div>
        )}
      </div>

    </div>
  );
}

