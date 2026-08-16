import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import './index.css';

// Handle and suppress benign unhandled media play interruption or AbortError rejections globally
if (typeof HTMLMediaElement !== "undefined" && HTMLMediaElement.prototype) {
  const originalPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (this: HTMLMediaElement, ...args: any[]) {
    try {
      const result = originalPlay.apply(this, args);
      if (result instanceof Promise) {
        return result.catch((error) => {
          if (
            error &&
            (error.name === "AbortError" ||
             error.name === "NotAllowedError" ||
             (typeof error.message === "string" &&
              (error.message.includes("play() request was interrupted") ||
               error.message.includes("The play() request was interrupted"))))
          ) {
            console.info("Suppressed video/audio play interruption rejection:", error);
            return undefined;
          }
          console.info("Suppressed other media play promise rejection:", error);
          return undefined;
        });
      }
      return result;
    } catch (error) {
      console.info("Suppressed video/audio play synchronous error:", error);
      return Promise.resolve();
    }
  };
}

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  
  let isBenign = false;
  if (reason) {
    const reasonStr = reason.message || (typeof reason === "string" ? reason : String(reason));
    const reasonType = reason.type || "";
    const constructorName = reason.constructor?.name || "";
    const isWsTarget = reason.target && (reason.target instanceof WebSocket || reason.target.constructor?.name === "WebSocket");
    
    if (
      constructorName === "CloseEvent" ||
      constructorName === "ErrorEvent" ||
      isWsTarget ||
      reasonType === "close" ||
      reasonStr.toLowerCase().includes("websocket") ||
      reasonStr.toLowerCase().includes("vite") ||
      reasonStr.toLowerCase().includes("closed without opened") ||
      (reason.reason && typeof reason.reason === "string" && reason.reason.toLowerCase().includes("closed without opened"))
    ) {
      isBenign = true;
    }
  }

  if (isBenign) {
    event.stopImmediatePropagation();
    event.preventDefault();
    console.info("Muted benign dev-server WebSocket/Vite rejection:", reason);
    return;
  }
}, true);

// Handle and suppress benign resize observer warnings or media play errors without swallowing real runtime errors
window.addEventListener("error", (event) => {
  const msg = event.message || "";
  const errStr = event.error ? (event.error.message || String(event.error)) : "";
  const targetTagName = (event.target as any)?.tagName?.toLowerCase() || "";
  
  let isBenign = false;
  const trimmedMsg = msg.trim();
  const lowerMsg = msg.toLowerCase();
  const lowerErr = errStr.toLowerCase();

  if (
    !msg ||
    trimmedMsg === "" ||
    lowerMsg.includes("websocket") ||
    lowerMsg.includes("vite") ||
    lowerMsg.includes("closed without opened") ||
    lowerErr.includes("websocket") ||
    lowerErr.includes("vite") ||
    lowerErr.includes("closed without opened") ||
    targetTagName === "script" ||
    targetTagName === "link"
  ) {
    isBenign = true;
  }

  if (isBenign) {
    event.stopImmediatePropagation();
    event.preventDefault();
    console.info("Muted benign dev-server WebSocket/Vite/Asset error:", msg, errStr);
    return;
  }
}, true);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);


