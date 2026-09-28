import { useState, useRef, useEffect } from "react";

function Worker() {
  const [imageSrc, setImageSrc] = useState(null);
  const [resultSrc, setResultSrc] = useState(null);
  const workerRef = useRef(null);
  const canvasRef = useRef(null); // hidden canvas, used to extract pixel data

  useEffect(() => {
    workerRef.current = new Worker(new URL("./image.js", import.meta.url), {
      type: "module",
    });

    workerRef.current.onmessage = (e) => {
      const { data, width, height } = e.data;
      const imageData = new ImageData(data, width, height);

      // Draw processed pixels onto a canvas, then export as a data URL
      const outCanvas = document.createElement("canvas");
      outCanvas.width = width;
      outCanvas.height = height;
      const ctx = outCanvas.getContext("2d");
      ctx.putImageData(imageData, 0, 0);
      setResultSrc(outCanvas.toDataURL());
    };

    return () => workerRef.current.terminate();
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setImageSrc(event.target.result);
      setResultSrc(null);
    };
    reader.readAsDataURL(file);
  };

  const handleProcess = () => {
    if (!imageSrc) return;

    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, img.width, img.height);

      // Transfer the pixel buffer to the worker 
      workerRef.current.postMessage(
        { data: imageData.data, width: img.width, height: img.height },
        [imageData.data.buffer]
      );
    };
    img.src = imageSrc;
  };

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h2>Image Processor (Web Worker)</h2>

      <input type="file" accept="image/*" onChange={handleFileChange} />
      <button onClick={handleProcess} disabled={!imageSrc} style={{ marginLeft: "1rem" }}>
        Process Image
      </button>

      {/* Hidden canvas used only to read pixel data from the uploaded image */}
      <canvas ref={canvasRef} style={{ display: "none" }} />

      <div style={{ display: "flex", gap: "2rem", marginTop: "1.5rem" }}>
        {imageSrc && (
          <div>
            <p>Original</p>
            <img src={imageSrc} alt="original" style={{ maxWidth: "300px" }} />
          </div>
        )}
        {resultSrc && (
          <div>
            <p>Processed</p>
            <img src={resultSrc} alt="processed" style={{ maxWidth: "300px" }} />
          </div>
        )}
      </div>
    </div>
  );
}

export default Worker;