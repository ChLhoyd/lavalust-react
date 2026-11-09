// Browser-side face recognition helpers (face-api.js by vladmandic).
// The face is turned into 128 numbers in THIS browser. Photos are never
// uploaded or stored; only the numbers are sent to the server.

let faceapiPromise = null;

export function loadFaceApi() {
  if (!faceapiPromise) {
    faceapiPromise = import("@vladmandic/face-api").then(async (faceapi) => {
      await faceapi.tf.ready();
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
        faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
        faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
      ]);
      return faceapi;
    });

    // Let the next call try again if loading failed.
    faceapiPromise.catch(() => {
      faceapiPromise = null;
    });
  }

  return faceapiPromise;
}

export async function startCamera(video) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error(
      "This browser cannot use the camera here. Open the page on http://localhost or HTTPS."
    );
  }

  let stream;

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
      audio: false,
    });
  } catch (err) {
    if (err?.name === "NotAllowedError") {
      throw new Error("Camera permission was blocked. Allow the camera for this site and reload.");
    }
    if (err?.name === "NotFoundError") {
      throw new Error("No camera was found. Connect a webcam and reload.");
    }
    throw new Error(err?.message || "The camera could not be started.");
  }

  video.srcObject = stream;
  await video.play();

  return stream;
}

export function stopCamera(stream) {
  if (stream) stream.getTracks().forEach((track) => track.stop());
}

/**
 * Look at the current video frame.
 * Returns { count, descriptor?, box?, tooSmall? }.
 *  count      = how many faces are visible
 *  descriptor = 128 numbers (only when exactly one usable face is visible)
 */
export async function readFace(faceapi, video) {
  if (!video || video.readyState < 2 || !video.videoWidth) {
    return { count: 0 };
  }

  const options = new faceapi.TinyFaceDetectorOptions({
    inputSize: 320,
    scoreThreshold: 0.55,
  });

  const results = await faceapi
    .detectAllFaces(video, options)
    .withFaceLandmarks()
    .withFaceDescriptors();

  if (results.length !== 1) {
    return { count: results.length };
  }

  const box = results[0].detection.box;

  // Ask the person to come closer instead of matching a tiny, blurry face.
  if (box.width < video.videoWidth * 0.22) {
    return { count: 1, tooSmall: true, box };
  }

  return {
    count: 1,
    box,
    descriptor: Array.from(results[0].descriptor),
  };
}

/** Draw the face box on an overlay canvas that sits on top of the video. */
export function drawBox(canvas, video, box, color) {
  if (!canvas || !video) return;

  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!box) return;

  ctx.lineWidth = 4;
  ctx.strokeStyle = color || "#22c55e";
  ctx.strokeRect(box.x, box.y, box.width, box.height);
}
