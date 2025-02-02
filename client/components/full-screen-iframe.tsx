import React from "react";

interface FullScreenIframeProps {
  src: string; // The URL to embed
}

const FullScreenIframe: React.FC<FullScreenIframeProps> = ({ src }) => {
  return (
    <div style={{ margin: 0, padding: 0, width: "100vw", height: "100vh" }}>
      <iframe
        src={src}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          border: "none",
        }}
        allow="fullscreen" // Optional, for enabling fullscreen in the iframe
        title="Embedded Demo"
      />
    </div>
  );
};

export default FullScreenIframe;