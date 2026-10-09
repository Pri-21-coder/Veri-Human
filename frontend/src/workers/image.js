// imageWorker.js
self.onmessage = (e) => {
  const { data, width, height } = e.data;

  //  Uint8ClampedArray (RGBA pixels)
  const pixels = new Uint8ClampedArray(data);

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];

    // Grayscale conversion 
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;

    pixels[i] = gray;
    pixels[i + 1] = gray;
    pixels[i + 2] = gray;
    // alpha (pixels[i + 3]) unchanged
  }

  self.postMessage({ data: pixels, width, height }, [pixels.buffer]);
};